// Онлайн-сервер DOFFA Games: WebSocket, вход через кошелёк Solana,
// лобби, столы, авторитетная игра, ставки и выплаты. Запуск: npm run start.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, OnlineUser } from './protocol';
import {
  verifyToken,
  accountById,
  tokenFor,
  upsertByWallet,
  setName,
  addFriend,
  removeFriend,
  friendsOf,
  shortAddress,
} from './accounts';
import * as lobby from './lobby';
import { redactFor } from './match';
import { initDuel, queueForDuel, cancelQueue as cancelDuelQueue, submitInput as submitDuelInput, leaveMatch as leaveDuelMatch } from './duel';
import {
  SERVER_WALLET,
  PLATFORM_FEE,
  PLATFORM_WALLET,
  sendSol,
  verifyPayment,
  verifySignature,
} from './solana.js';
import { SOL_BETTING_ENABLED, BEANS_ENTRY_FEE, validateRewardSplit } from './config';
import { createEconomy } from './services';
import type { BeansState } from './services/beansService';
import { burnConfigSummary } from './services/rewardBudgetService';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, '..', 'data'), { recursive: true });

const PORT = Number(process.env.PORT ?? 8080);

// PLAYER_REWARD_PERCENT + BURN_PERCENT должны давать 100 — падаем на старте,
// а не молча считаем награду неправильно.
validateRewardSplit();

// Доменная экономика DOFFA: зёрна, награды, заявки на вывод (см. services/).
const economy = createEconomy();
console.log(`Экономика DOFFA: ${economy.summary} · ${burnConfigSummary()}`);

// Плата за вход, списанная при создании/входе за стол — до старта партии
// возвращается при выходе (см. table:leave / ws close), после старта сгорает.
const entryCharges = new Map<string, { tableId: string; amount: number }>();

// Использованные подписи платежей — защита от повторного зачёта одной транзакции.
const USED_SIGS_PATH = resolve(here, '..', 'data', 'used_sigs.json');
const usedSigs = new Set<string>(
  existsSync(USED_SIGS_PATH) ? (JSON.parse(readFileSync(USED_SIGS_PATH, 'utf8')) as string[]) : [],
);
function persistSigs(): void {
  try {
    writeFileSync(USED_SIGS_PATH, JSON.stringify([...usedSigs]));
  } catch (e) {
    console.error('Не удалось сохранить использованные подписи:', e);
  }
}
function markSigUsed(sig: string): void {
  usedSigs.add(sig);
  persistSigs();
}
// Снять резерв подписи, если проверка платежа не прошла (валидная попытка ещё возможна).
function releaseSig(sig: string): void {
  if (usedSigs.delete(sig)) persistSigs();
}

// Текст, который кошелёк подписывает для входа. Должен совпадать с клиентом.
function authMessage(nonce: string): string {
  return `DOFFA Games — вход\nNonce: ${nonce}`;
}

interface Conn {
  ws: WebSocket;
  userId?: string;
  name?: string;
  inLobby: boolean;
  /** Метки времени последних сообщений — для ограничения частоты (anti-flood). */
  msgTimes: number[];
  /** Отдельные метки для duel:input — щедрее общего лимита (см. DUEL_RATE_*). */
  duelInputTimes: number[];
}

// Anti-flood: не более RATE_MAX сообщений за RATE_WINDOW мс с одного сокета.
// Рассчитан на обычные действия лобби/стола — НЕ подходит для потока ввода
// авторитетного PvP-матча Bean Duel (см. DUEL_RATE_* ниже, отдельный лимит).
const RATE_WINDOW = 10_000;
const RATE_MAX = 60;
// duel:input шлётся клиентом почти каждый кадр (позиция пальца/мыши) — на
// порядок чаще обычных сообщений. Отдельный, более щедрый лимит; превышение
// просто отбрасывает лишний кадр ввода, а не рвёт соединение (в отличие от
// общего лимита) — короткий сетевой всплеск у честного игрока не должен
// обрывать матч.
const DUEL_RATE_WINDOW = 1_000;
const DUEL_RATE_MAX = 40; // ~40 Гц с запасом над клиентским requestAnimationFrame
// Защита от гигантских payload (DoS памяти): максимум 16 КБ на сообщение.
const MAX_MSG_BYTES = 16 * 1024;

/** Проверяет лимит частоты. true — можно обрабатывать, false — превышен. */
function allowMessage(conn: Conn): boolean {
  const now = Date.now();
  conn.msgTimes = conn.msgTimes.filter((t) => now - t < RATE_WINDOW);
  if (conn.msgTimes.length >= RATE_MAX) return false;
  conn.msgTimes.push(now);
  return true;
}

/** Отдельный, более щедрый лимит частоты для duel:input (см. DUEL_RATE_*). */
function allowDuelInput(conn: Conn): boolean {
  const now = Date.now();
  conn.duelInputTimes = conn.duelInputTimes.filter((t) => now - t < DUEL_RATE_WINDOW);
  if (conn.duelInputTimes.length >= DUEL_RATE_MAX) return false;
  conn.duelInputTimes.push(now);
  return true;
}

const conns = new Map<WebSocket, Conn>();
const byUser = new Map<string, Set<Conn>>();
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Одноразовые nonce для входа: адрес → { nonce, срок }.
const nonces = new Map<string, { nonce: string; exp: number }>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendToUser(userId: string, msg: ServerMessage): void {
  byUser.get(userId)?.forEach((c) => send(c.ws, msg));
}

// DOFFA Bean Duel — авторитетный PvP-матч шлёт сообщения игрокам напрямую
// (тиковый цикл, не привязан к синхронной обработке входящего сообщения).
initDuel(sendToUser, economy.beans, economy.rewards, economy.repositories);

function beansStateMsg(s: BeansState): ServerMessage {
  return { t: 'beans:state', beans: s.beans, energy: s.energy };
}

/**
 * Возвращает плату за вход, если игрок покинул стол ДО старта партии
 * (матч не состоялся). Если партия уже шла — плата сгорает по правилам
 * (сознательный выход после начала). Идемпотентно: одна плата возвращается
 * не более одного раза (запись сразу удаляется из entryCharges).
 */
async function settleEntryOnLeave(userId: string, wasPlaying: boolean): Promise<void> {
  const charge = entryCharges.get(userId);
  if (!charge) return;
  entryCharges.delete(userId);
  if (wasPlaying) return;
  const state = await economy.beans.refundEntry(userId, userId, charge.amount);
  sendToUser(userId, beansStateMsg(state));
}

function bindUser(conn: Conn, userId: string, name: string): void {
  conn.userId = userId;
  conn.name = name;
  if (!byUser.has(userId)) byUser.set(userId, new Set());
  byUser.get(userId)!.add(conn);
}

// ─── Присутствие и друзья ──────────────────────────────────────────
function displayName(userId: string): string {
  return accountById(userId)?.name ?? shortAddress(userId);
}

function onlineUsersBase(): OnlineUser[] {
  const out: OnlineUser[] = [];
  for (const userId of byUser.keys()) {
    out.push({
      id: userId,
      name: displayName(userId),
      inGame: lobby.tableOf(userId)?.status === 'playing',
    });
  }
  return out;
}

// Список присутствия персонализирован: помечаем друзей и убираем самого себя.
function pushPresence(): void {
  const base = onlineUsersBase();
  for (const conn of conns.values()) {
    if (!conn.inLobby || !conn.userId) continue;
    const friends = new Set(friendsOf(conn.userId));
    const users = base
      .filter((u) => u.id !== conn.userId)
      .map((u) => ({ ...u, isFriend: friends.has(u.id) }));
    send(conn.ws, { t: 'presence', users });
  }
}

function friendsList(userId: string): OnlineUser[] {
  return friendsOf(userId).map((addr) => ({
    id: addr,
    name: displayName(addr),
    inGame: lobby.tableOf(addr)?.status === 'playing',
    isFriend: true,
  }));
}

function pushFriends(userId: string): void {
  sendToUser(userId, { t: 'friends', friends: friendsList(userId) });
}

// ─── Рассылка лобби/стола/игры ─────────────────────────────────────
function pushLobby(): void {
  const tables = lobby.lobbyList();
  for (const conn of conns.values()) {
    if (conn.inLobby) send(conn.ws, { t: 'lobby', tables });
  }
}

function pushTable(table: lobby.Table): void {
  const view = lobby.toTableView(table);
  for (const seat of table.seats) {
    if (seat.userId) sendToUser(seat.userId, { t: 'table', table: view });
  }
}

function pushGame(table: lobby.Table): void {
  if (!table.game) return;
  for (let i = 0; i < table.seats.length; i++) {
    const seat = table.seats[i];
    if (!seat.userId) continue;
    sendToUser(seat.userId, { t: 'game', state: redactFor(table.game, i), youSeat: i });
  }
  if (table.game.phase === 'gameOver') {
    // DOFFA-награда — за КАЖДЫЙ подтверждённый онлайн-матч (вход всегда за
    // зёрна), а не только за столы со ставкой SOL.
    void handleMatchReward(table);
    if (table.betLamports && table.betLamports > 0) {
      void handlePayout(table);
    }
  }
}

/**
 * Фиксирует результат матча в доменной экономике DOFFA и уведомляет
 * победителя о подтверждённой сервером сумме награды (0, если реванш не
 * дал результата или награда не назначена). Клиент никогда не считает эту
 * сумму сам — см. src/games/crazy8/screens/OnlineGameScreen.tsx.
 */
async function handleMatchReward(table: lobby.Table): Promise<void> {
  const game = table.game;
  if (!game || table.rewardRecorded) return;
  const candidates = table.seats
    .map((seat, i) => ({ seat, player: game.players[i] }))
    .filter(({ player, seat }) => !player.busted && seat.userId && !seat.isBot);
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.player.score - b.player.score);
  const winner = candidates[0];
  if (!winner.seat.userId) return;
  table.rewardRecorded = true;

  const humanIds = table.seats.filter((s) => s.userId && !s.isBot).map((s) => s.userId as string);
  const matchId = `${table.id}:${table.matchStartedAt ?? game.roundNumber}`;
  try {
    const { reward } = await economy.rewards.recordMatchResult({
      matchId,
      players: humanIds,
      winnerId: winner.seat.userId,
      winnerWallet: winner.seat.walletAddress ?? winner.seat.userId,
      startedAt: table.matchStartedAt ?? Date.now(),
      finishedAt: Date.now(),
      beansEntryFee: BEANS_ENTRY_FEE,
    });
    sendToUser(winner.seat.userId, { t: 'reward:match', matchId, amount: reward?.amount ?? 0 });
  } catch (e) {
    console.error('Не удалось записать результат матча:', e);
  }
}

async function handlePayout(table: lobby.Table): Promise<void> {
  const game = table.game;
  if (!game) return;
  // Защита от двойной выплаты: pushGame может сработать повторно в gameOver.
  if (table.paidOut) return;
  const candidates = table.seats
    .map((seat, i) => ({ seat, player: game.players[i], seatIndex: i }))
    .filter(({ player, seat }) => !player.busted && seat.userId && !seat.isBot && seat.walletAddress);
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.player.score - b.player.score);
  const winner = candidates[0];
  if (!winner.seat.walletAddress) return;

  const humans = table.seats.filter((s) => s.userId && !s.isBot);
  // potLamports зафиксирован при старте — не уменьшается, если кто-то вышел.
  const pot = table.potLamports ?? (table.betLamports ?? 0) * humans.length;
  const commission = Math.floor(pot * PLATFORM_FEE);
  const winnerGets = pot - commission;

  // Ставим флаг ДО await — чтобы параллельный вызов сразу вышел выше.
  table.paidOut = true;
  try {
    const sig = await sendSol(winner.seat.walletAddress, winnerGets);
    // Опционально уводим комиссию на отдельный кошелёк площадки.
    if (PLATFORM_WALLET && PLATFORM_WALLET !== SERVER_WALLET && commission > 0) {
      sendSol(PLATFORM_WALLET, commission).catch((e) =>
        console.error('Не удалось перевести комиссию:', e),
      );
    }
    for (const s of table.seats) {
      if (s.userId) {
        sendToUser(s.userId, {
          t: 'wallet:payout',
          winnerName: winner.player.name,
          txSignature: sig,
          lamports: winnerGets,
          commission,
        });
      }
    }
    for (const s of table.seats) s.paid = false;
  } catch (e) {
    console.error('Ошибка выплаты Solana:', e);
    table.paidOut = false; // выплата не прошла — разрешаем повтор
    // Важно: после gameOver ходов больше нет, поэтому pushGame сам не
    // повторит выплату. Планируем повтор здесь, иначе банк застрянет.
    const attempts = (table.payoutAttempts ?? 0) + 1;
    table.payoutAttempts = attempts;
    if (attempts <= 6) {
      const delay = Math.min(5000 * attempts, 30_000);
      console.warn(`Повтор выплаты по столу ${table.id} через ${delay} мс (попытка ${attempts}).`);
      setTimeout(() => {
        const t = lobby.getTable(table.id);
        if (t && !t.paidOut) void handlePayout(t);
      }, delay);
    } else {
      console.error(
        `Выплата по столу ${table.id} не удалась после ${attempts} попыток — требуется ручная проверка горячего кошелька.`,
      );
    }
  }
}

/** Бот «думает» 3–5 секунд — ощущается как живой соперник, а не автомат. */
function botThinkDelay(): number {
  return 3000 + Math.random() * 2000;
}

// Гоняет ходы ботов с «живой» задержкой, пока очередь не дойдёт до человека.
function pumpBots(tableId: string): void {
  clearTimeout(botTimers.get(tableId));
  const table = lobby.getTable(tableId);
  if (!table || !table.game || table.game.phase !== 'playing') return;
  const seat = table.seats[table.game.currentPlayerIndex];
  if (!seat?.isBot) return;
  const timer = setTimeout(() => {
    const changed = lobby.botStep(tableId);
    if (changed) {
      pushGame(changed);
      pumpBots(tableId);
    }
  }, botThinkDelay());
  botTimers.set(tableId, timer);
}

// ─── Обработка сообщений ───────────────────────────────────────────
async function handle(conn: Conn, msg: ClientMessage): Promise<void> {
  // Шаг 1: запрос nonce для подписи.
  if (msg.t === 'auth:nonce') {
    const nonce = randomBytes(16).toString('hex');
    nonces.set(msg.walletAddress, { nonce, exp: Date.now() + 5 * 60_000 });
    send(conn.ws, { t: 'auth:challenge', nonce });
    return;
  }
  // Шаг 2: проверка подписи nonce → вход.
  if (msg.t === 'auth:verify') {
    const rec = nonces.get(msg.walletAddress);
    if (!rec || rec.exp < Date.now()) {
      send(conn.ws, { t: 'auth:err', message: 'Срок входа истёк, попробуйте снова' });
      return;
    }
    if (!verifySignature(msg.walletAddress, authMessage(rec.nonce), msg.signature)) {
      send(conn.ws, { t: 'auth:err', message: 'Подпись недействительна' });
      return;
    }
    nonces.delete(msg.walletAddress);
    const account = upsertByWallet(msg.walletAddress);
    bindUser(conn, account.address, account.name);
    send(conn.ws, {
      t: 'auth:ok',
      token: tokenFor(account.address),
      user: { id: account.address, name: account.name },
    });
    send(conn.ws, beansStateMsg(await economy.beans.getState(account.address, account.address)));
    pushFriends(account.address);
    pushPresence();
    return;
  }
  // Восстановление сессии по токену.
  if (msg.t === 'auth') {
    const userId = verifyToken(msg.token);
    const account = userId ? accountById(userId) : undefined;
    if (!userId || !account) {
      send(conn.ws, { t: 'auth:err', message: 'Сессия истекла' });
      return;
    }
    bindUser(conn, account.address, account.name);
    send(conn.ws, {
      t: 'auth:ok',
      token: tokenFor(account.address),
      user: { id: account.address, name: account.name },
    });
    send(conn.ws, beansStateMsg(await economy.beans.getState(account.address, account.address)));
    pushFriends(account.address);
    const table = lobby.tableOf(account.address);
    if (table) {
      send(conn.ws, { t: 'table', table: lobby.toTableView(table) });
      if (table.game) {
        const seat = lobby.seatIndexOf(table, account.address);
        send(conn.ws, { t: 'game', state: redactFor(table.game, seat), youSeat: seat });
      }
    }
    pushPresence();
    return;
  }

  // Дальше — только для авторизованных.
  if (!conn.userId || !conn.name) {
    send(conn.ws, { t: 'error', message: 'Сначала подключите кошелёк' });
    return;
  }
  const user = { id: conn.userId, name: conn.name };

  switch (msg.t) {
    case 'profile:setName': {
      const acc = setName(user.id, msg.name);
      if (acc) {
        conn.name = acc.name;
        send(conn.ws, { t: 'auth:ok', token: tokenFor(acc.address), user: { id: acc.address, name: acc.name } });
        const table = lobby.tableOf(user.id);
        if (table) {
          const seat = table.seats.find((s) => s.userId === user.id);
          if (seat) seat.name = acc.name;
          pushTable(table);
        }
        pushPresence();
      }
      break;
    }

    case 'lobby:subscribe':
      conn.inLobby = true;
      send(conn.ws, { t: 'lobby', tables: lobby.lobbyList() });
      pushFriends(user.id);
      pushPresence();
      break;

    case 'lobby:unsubscribe':
      conn.inLobby = false;
      break;

    case 'table:create': {
      // SOL-ставки — legacy-механика за флагом (см. docs/SOL_BETTING_LEGACY.md).
      // Выключена по умолчанию: игнорируем betLamports, стол создаётся без ставки.
      const wantsBet = !!msg.betLamports && msg.betLamports > 0;
      const betLamports = wantsBet && SOL_BETTING_ENABLED ? msg.betLamports : undefined;

      // Вход в онлайн-матч — за зёрна. Списываем ДО создания стола; если стол
      // не создался по другой причине, возвращаем деньги немедленно.
      const charged = await economy.beans.chargeEntry(user.id, user.id, BEANS_ENTRY_FEE);
      if (!charged) return send(conn.ws, { t: 'error', message: 'Недостаточно зёрен' });
      send(conn.ws, beansStateMsg(charged));

      const res = lobby.createTable(
        user,
        msg.name,
        msg.maxPlayers,
        msg.password,
        betLamports,
        betLamports ? SERVER_WALLET : undefined,
      );
      if (!res.ok || !res.table) {
        send(conn.ws, beansStateMsg(await economy.beans.refundEntry(user.id, user.id, BEANS_ENTRY_FEE)));
        return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      }
      entryCharges.set(user.id, { tableId: res.table.id, amount: BEANS_ENTRY_FEE });
      conn.inLobby = false;
      pushTable(res.table);
      pushLobby();
      pushPresence();
      break;
    }

    case 'table:join': {
      const charged = await economy.beans.chargeEntry(user.id, user.id, BEANS_ENTRY_FEE);
      if (!charged) return send(conn.ws, { t: 'error', message: 'Недостаточно зёрен' });
      send(conn.ws, beansStateMsg(charged));

      const res = lobby.joinTable(user, msg.tableId, msg.password);
      if (!res.ok || !res.table) {
        send(conn.ws, beansStateMsg(await economy.beans.refundEntry(user.id, user.id, BEANS_ENTRY_FEE)));
        return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      }
      entryCharges.set(user.id, { tableId: res.table.id, amount: BEANS_ENTRY_FEE });
      conn.inLobby = false;
      pushTable(res.table);
      pushLobby();
      pushPresence();
      break;
    }

    case 'table:leave': {
      const wasPlaying = lobby.tableOf(user.id)?.status === 'playing';
      const table = lobby.leaveTable(user.id);
      await settleEntryOnLeave(user.id, wasPlaying);
      send(conn.ws, { t: 'table:left' });
      if (table) {
        pushTable(table);
        if (table.game) {
          pushGame(table);
          pumpBots(table.id); // бот мог занять ход ушедшего игрока
        }
      }
      pushLobby();
      pushPresence();
      break;
    }

    case 'table:start': {
      const startTable = lobby.tableOf(user.id);
      if (startTable && startTable.betLamports && startTable.betLamports > 0) {
        const emptySeats = startTable.seats.filter((s) => !s.userId).length;
        if (emptySeats > 0) {
          return send(conn.ws, { t: 'error', message: 'Ставка SOL — только игра людей: заполните все места' });
        }
        if (!lobby.allPaid(startTable)) {
          return send(conn.ws, { t: 'error', message: 'Не все игроки оплатили ставку' });
        }
      }
      const res = lobby.startGame(user.id);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      // Партия началась — плата за вход сгорает (больше не возвращается при выходе).
      for (const seat of res.table.seats) {
        if (seat.userId) entryCharges.delete(seat.userId);
      }
      pushTable(res.table);
      pushGame(res.table);
      pushLobby();
      pushPresence();
      pumpBots(res.table.id);
      break;
    }

    case 'game:move': {
      const res = lobby.applyUserMove(user.id, msg.move);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      pushGame(res.table);
      pumpBots(res.table.id);
      break;
    }

    case 'game:next': {
      const res = lobby.nextRound(user.id);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      pushGame(res.table);
      pumpBots(res.table.id);
      break;
    }

    case 'invite:send': {
      const table = lobby.tableOf(user.id);
      if (!table || table.id !== msg.tableId || table.hostId !== user.id) break;
      sendToUser(msg.toUserId, {
        t: 'invite',
        tableId: table.id,
        tableName: table.name,
        fromName: user.name,
        betLamports: table.betLamports,
      });
      break;
    }

    case 'invite:all': {
      const table = lobby.tableOf(user.id);
      if (!table || table.id !== msg.tableId || table.hostId !== user.id) break;
      for (const uid of byUser.keys()) {
        if (uid === user.id || lobby.tableOf(uid)) continue;
        sendToUser(uid, {
          t: 'invite',
          tableId: table.id,
          tableName: table.name,
          fromName: user.name,
          betLamports: table.betLamports,
        });
      }
      break;
    }

    case 'friend:add': {
      // Принимаем только похожее на адрес Solana (base58, 32–44 символа).
      if (typeof msg.userId === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(msg.userId)) {
        addFriend(user.id, msg.userId);
        pushFriends(user.id);
        pushPresence();
      }
      break;
    }

    case 'friend:remove': {
      removeFriend(user.id, msg.userId);
      pushFriends(user.id);
      pushPresence();
      break;
    }

    case 'wallet:register': {
      lobby.registerWallet(user.id, msg.walletAddress);
      const walletTable = lobby.tableOf(user.id);
      if (walletTable?.betLamports && walletTable.betLamports > 0) {
        send(conn.ws, {
          t: 'wallet:required',
          serverWallet: SERVER_WALLET,
          lamports: walletTable.betLamports,
        });
      }
      break;
    }

    case 'wallet:pay': {
      const payTable = lobby.tableOf(user.id);
      if (!payTable || !payTable.betLamports) break;
      const paySeat = payTable.seats.find((s) => s.userId === user.id);
      if (!paySeat) break;
      // Платёж ДОЛЖЕН идти с кошелька, которым игрок вошёл (user.id доказан
      // подписью при auth). Иначе можно было бы засчитать себе чужую входящую
      // транзакцию на кошелёк сервера — бесплатная ставка + блок честного платежа.
      const payer = user.id;
      if (typeof msg.signature !== 'string') {
        send(conn.ws, { t: 'error', message: 'Некорректная транзакция' });
        break;
      }
      // Анти-реплей: резервируем подпись СИНХРОННО до await, иначе два
      // параллельных сообщения проскочат проверку has() оба (TOCTOU).
      if (usedSigs.has(msg.signature)) {
        send(conn.ws, { t: 'error', message: 'Эта транзакция уже использована' });
        break;
      }
      markSigUsed(msg.signature);
      // Проверяем, что деньги реально пришли на кошелёк сервера в нужном объёме
      // именно с кошелька вошедшего игрока.
      const valid = await verifyPayment(
        msg.signature,
        payer,
        SERVER_WALLET,
        payTable.betLamports,
      );
      if (!valid) {
        // Проверка не прошла — снимаем резерв, чтобы валидная попытка была возможна.
        releaseSig(msg.signature);
        send(conn.ws, { t: 'error', message: 'Транзакция не подтверждена' });
        break;
      }
      const paid = lobby.markPaid(user.id);
      if (paid) {
        pushTable(paid.table);
        for (const s of paid.table.seats) {
          if (s.userId) {
            sendToUser(s.userId, { t: 'wallet:paid', seatIndex: paid.seatIndex });
          }
        }
      }
      break;
    }

    case 'beans:sync': {
      const state = await economy.beans.applyTapSync(
        user.id,
        user.id,
        msg.tapped,
        msg.claimedGain,
        msg.elapsedMs,
      );
      send(conn.ws, beansStateMsg(state));
      break;
    }

    case 'beans:awardTraining': {
      const result = await economy.beans.awardTraining(user.id, user.id, msg.won);
      send(conn.ws, {
        t: 'beans:trainingResult',
        granted: result.granted,
        beans: result.beans,
        energy: result.energy,
      });
      break;
    }

    case 'run:start': {
      // Вход в забег Defense за зёрна — списывается здесь, на старте; после
      // старта плата не возвращается (как билет дуэли). Недостаток зёрен не
      // мешает офлайн-игре: клиент просто продолжает без серверных наград.
      const started = await economy.runs.startRun(user.id, user.id);
      if (!started) return send(conn.ws, { t: 'error', message: 'Недостаточно зёрен для входа в забег' });
      send(conn.ws, { t: 'run:started', runId: started.runId, beans: started.beans, energy: started.energy });
      break;
    }

    case 'run:finish': {
      if (typeof msg.runId !== 'string') {
        send(conn.ws, { t: 'error', message: 'Некорректный забег' });
        break;
      }
      const result = await economy.runs.finishRun(user.id, user.id, {
        runId: msg.runId,
        roomsCleared: msg.roomsCleared,
        miniBossKilled: msg.miniBossKilled,
        chapterComplete: msg.chapterComplete,
        durationMs: msg.durationMs,
        seed: msg.seed,
      });
      if (!result) {
        send(conn.ws, { t: 'error', message: 'Забег не найден' });
        break;
      }
      send(conn.ws, {
        t: 'run:finished',
        runId: result.runId,
        ok: result.ok,
        reason: result.reason,
        beansGranted: result.beansGranted,
        doffaGranted: result.doffaGranted,
        beans: result.beans,
        energy: result.energy,
        rewardStatus: result.rewardStatus,
      });
      // Как и у дуэли (reward:match): отдельный push о подтверждённой DOFFA-
      // награде, чтобы клиент подтянул список наград (см. onlineStore).
      if (result.doffaGranted > 0) {
        sendToUser(user.id, { t: 'reward:run', runId: result.runId, amount: result.doffaGranted });
      }
      break;
    }

    case 'duel:queue':
      await queueForDuel(user.id);
      break;

    case 'duel:cancelQueue':
      await cancelDuelQueue(user.id);
      break;

    case 'duel:input':
      submitDuelInput(user.id, msg.target, msg.dashPressed, msg.throwPressed);
      break;

    case 'duel:leave':
      await leaveDuelMatch(user.id);
      break;

    case 'reward:list': {
      const rewards = await economy.rewards.listAvailable(user.id);
      send(conn.ws, {
        t: 'reward:list',
        rewards: rewards.map((r) => ({ id: r.id, matchId: r.matchId, amount: r.amount, status: r.status, createdAt: r.createdAt })),
      });
      break;
    }

    case 'reward:claim': {
      const outcome = await economy.claims.claim({
        userId: user.id,
        rewardId: msg.rewardId,
        walletAddress: msg.walletAddress,
        idempotencyKey: msg.idempotencyKey,
      });
      send(conn.ws, {
        t: 'reward:claimResult',
        ok: outcome.ok,
        status: outcome.status,
        message: outcome.message,
        txSignature: outcome.claim?.txSignature,
        testMode: outcome.testMode,
      });
      break;
    }

    case 'reward:history': {
      const items = await economy.rewards.history(user.id);
      send(conn.ws, {
        t: 'reward:history',
        // history() комбинирует только записи rewards/claims — 'beans' здесь
        // не встречается на практике (см. RewardService.history).
        items: items.map((i) => ({ id: i.id, date: i.date, kind: i.kind as 'doffa' | 'claim', amount: i.amount, note: i.note, txSignature: i.txSignature })),
      });
      break;
    }
  }
}

// ─── HTTP + WebSocket ──────────────────────────────────────────────
const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, tables: lobby.lobbyList().length, online: byUser.size }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('DOFFA Games — онлайн-сервер. Подключение по WebSocket.');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws) => {
  const conn: Conn = { ws, inLobby: false, msgTimes: [], duelInputTimes: [] };
  conns.set(ws, conn);

  ws.on('message', (raw) => {
    // Лимит размера: отсекаем гигантские payload до парсинга.
    const size = (raw as Buffer).length ?? 0;
    if (size > MAX_MSG_BYTES) {
      return send(ws, { t: 'error', message: 'Сообщение слишком большое' });
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: 'error', message: 'Некорректное сообщение' });
    }
    // duel:input — отдельный, более щедрый лимит частоты (см. DUEL_RATE_*):
    // превышение просто отбрасывает лишний кадр ввода, не рвёт соединение.
    if (msg.t === 'duel:input') {
      if (!allowDuelInput(conn)) return;
    } else if (!allowMessage(conn)) {
      // Anti-flood для остальных сообщений: при превышении частоты — закрываем сокет.
      send(ws, { t: 'error', message: 'Слишком много запросов. Подождите.' });
      try { ws.close(1008, 'rate limit'); } catch { /* уже закрыт */ }
      return;
    }
    handle(conn, msg).catch((e) => {
      console.error('Ошибка обработки:', e);
      send(ws, { t: 'error', message: 'Внутренняя ошибка сервера' });
    });
  });

  ws.on('close', () => {
    if (conn.userId) {
      const set = byUser.get(conn.userId);
      set?.delete(conn);
      if (set && set.size === 0) {
        byUser.delete(conn.userId);
        void leaveDuelMatch(conn.userId); // техническое поражение в активном Bean Duel, если был
        const wasPlaying = lobby.tableOf(conn.userId)?.status === 'playing';
        const table = lobby.leaveTable(conn.userId);
        void settleEntryOnLeave(conn.userId, wasPlaying);
        if (table) {
          pushTable(table);
          if (table.game) {
            pushGame(table);
            pumpBots(table.id); // бот мог занять ход отключившегося
          }
        }
        pushLobby();
      }
    }
    conns.delete(ws);
    pushPresence();
  });
});

http.listen(PORT, () => {
  console.log(`Сервер DOFFA Games слушает порт ${PORT}`);
});
