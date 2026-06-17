// Онлайн-сервер «Записной Козёл»: WebSocket, аккаунты, лобби, столы,
// авторитетная игра с ботами. Запуск: npm run start (порт PORT, по умолчанию 8080).
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from './protocol';
import { register, login, verifyToken, accountById, tokenFor } from './accounts';
import * as lobby from './lobby';
import { redactFor } from './match';
import { SERVER_WALLET, sendSol, verifyPayment } from './solana.js';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, '..', 'data'), { recursive: true });

const PORT = Number(process.env.PORT ?? 8080);

interface Conn {
  ws: WebSocket;
  userId?: string;
  name?: string;
  inLobby: boolean;
}

const conns = new Map<WebSocket, Conn>();
const byUser = new Map<string, Set<Conn>>();
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

// ─── Рассылка ──────────────────────────────────────────────────────
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
  // Автоматическая выплата победителю при завершении игры
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

  try {
    const sig = await sendSol(winner.seat.walletAddress, pot);
    for (const s of table.seats) {
      if (s.userId) {
        sendToUser(s.userId, {
          t: 'wallet:payout',
          winnerName: winner.player.name,
          txSignature: sig,
          lamports: pot,
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
  // Аутентификация
  if (msg.t === 'register' || msg.t === 'login') {
    const res = msg.t === 'register' ? register(msg.name, msg.password) : login(msg.name, msg.password);
    if (!res.ok || !res.account || !res.token) {
      send(conn.ws, { t: 'auth:err', message: res.message ?? 'Ошибка' });
      return;
    }
    bindUser(conn, res.account.id, res.account.name);
    send(conn.ws, { t: 'auth:ok', token: res.token, user: { id: res.account.id, name: res.account.name } });
    return;
  }
  if (msg.t === 'auth') {
    const userId = verifyToken(msg.token);
    const account = userId ? accountById(userId) : undefined;
    if (!userId || !account) {
      send(conn.ws, { t: 'auth:err', message: 'Сессия истекла' });
      return;
    }
    bindUser(conn, account.id, account.name);
    send(conn.ws, { t: 'auth:ok', token: tokenFor(account.id), user: { id: account.id, name: account.name } });
    // Восстанавливаем стол/партию, если игрок где-то сидит.
    const table = lobby.tableOf(account.id);
    if (table) {
      send(conn.ws, { t: 'table', table: lobby.toTableView(table) });
      if (table.game) {
        const seat = lobby.seatIndexOf(table, account.id);
        send(conn.ws, { t: 'game', state: redactFor(table.game, seat), youSeat: seat });
      }
    }
    return;
  }

  // Дальше — только для авторизованных.
  if (!conn.userId || !conn.name) {
    send(conn.ws, { t: 'error', message: 'Сначала войдите' });
    return;
  }
  const user = { id: conn.userId, name: conn.name };

  switch (msg.t) {
    case 'lobby:subscribe':
      conn.inLobby = true;
      send(conn.ws, { t: 'lobby', tables: lobby.lobbyList() });
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
      break;
    }

    case 'table:join': {
      const res = lobby.joinTable(user, msg.tableId, msg.password);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      conn.inLobby = false;
      pushTable(res.table);
      pushLobby();
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
      break;
    }

    case 'table:start': {
      const startTable = lobby.tableOf(user.id);
      if (startTable && startTable.betLamports && startTable.betLamports > 0) {
        if (!lobby.allPaid(startTable)) {
          return send(conn.ws, { t: 'error', message: 'Не все игроки оплатили ставку' });
        }
      }
      const res = lobby.startGame(user.id);
      if (!res.ok || !res.table) return send(conn.ws, { t: 'error', message: res.error ?? 'Ошибка' });
      pushTable(res.table);
      pushGame(res.table);
      pushLobby();
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

    case 'wallet:register': {
      lobby.registerWallet(user.id, msg.walletAddress);
      // Сообщаем игроку реквизиты для оплаты, если стол с ставкой
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
    res.end(JSON.stringify({ ok: true, tables: lobby.lobbyList().length }));
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
      // Если у пользователя не осталось соединений — выводим из-за стола.
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
  });
});

http.listen(PORT, () => {
  console.log(`Сервер «Записной Козёл» слушает порт ${PORT}`);
});
