// Онлайн-сервер «Записной Козёл»: WebSocket, вход через кошелёк Solana,
// лобби, столы, авторитетная игра, ставки и выплаты. Запуск: npm run start.
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
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
import {
  SERVER_WALLET,
  PLATFORM_FEE,
  PLATFORM_WALLET,
  sendSol,
  verifyPayment,
  verifySignature,
} from './solana.js';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, '..', 'data'), { recursive: true });

const PORT = Number(process.env.PORT ?? 8080);

// Текст, который кошелёк подписывает для входа. Должен совпадать с клиентом.
function authMessage(nonce: string): string {
  return `Записной Козёл — вход\nNonce: ${nonce}`;
}

interface Conn {
  ws: WebSocket;
  userId?: string;
  name?: string;
  inLobby: boolean;
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
  if (table.game.phase === 'gameOver' && table.betLamports && table.betLamports > 0) {
    void handlePayout(table);
  }
}

async function handlePayout(table: lobby.Table): Promise<void> {
  const game = table.game;
  if (!game) return;
  const candidates = table.seats
    .map((seat, i) => ({ seat, player: game.players[i], seatIndex: i }))
    .filter(({ player, seat }) => !player.busted && seat.userId && !seat.isBot && seat.walletAddress);
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.player.score - b.player.score);
  const winner = candidates[0];
  if (!winner.seat.walletAddress) return;

  const humans = table.seats.filter((s) => s.userId && !s.isBot);
  const pot = (table.betLamports ?? 0) * humans.length;
  const commission = Math.floor(pot * PLATFORM_FEE);
  const winnerGets = pot - commission;

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
  }
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
  }, 850);
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
      const res = lobby.createTable(
        user,
        msg.name,
        msg.maxPlayers,
        msg.password,
        msg.betLamports,
        msg.betLamports && msg.betLamports > 0 ? SERVER_WALLET : undefined,
      );
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      conn.inLobby = false;
      pushTable(res.table);
      pushLobby();
      pushPresence();
      break;
    }

    case 'table:join': {
      const res = lobby.joinTable(user, msg.tableId, msg.password);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      conn.inLobby = false;
      pushTable(res.table);
      pushLobby();
      pushPresence();
      break;
    }

    case 'table:leave': {
      const table = lobby.leaveTable(user.id);
      send(conn.ws, { t: 'table:left' });
      if (table) {
        pushTable(table);
        if (table.game) pushGame(table);
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
      addFriend(user.id, msg.userId);
      pushFriends(user.id);
      pushPresence();
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
      if (!paySeat?.walletAddress) {
        send(conn.ws, { t: 'error', message: 'Сначала зарегистрируйте кошелёк' });
        break;
      }
      const valid = await verifyPayment(msg.signature, paySeat.walletAddress, payTable.betLamports);
      if (!valid) {
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
  res.end('Записной Козёл — онлайн-сервер. Подключение по WebSocket.');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws) => {
  const conn: Conn = { ws, inLobby: false };
  conns.set(ws, conn);

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: 'error', message: 'Некорректное сообщение' });
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
        const table = lobby.leaveTable(conn.userId);
        if (table) {
          pushTable(table);
          if (table.game) pushGame(table);
        }
        pushLobby();
      }
    }
    conns.delete(ws);
    pushPresence();
  });
});

http.listen(PORT, () => {
  console.log(`Сервер «Записной Козёл» слушает порт ${PORT}`);
});
