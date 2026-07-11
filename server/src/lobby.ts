// Лобби и столы (в памяти). Один источник правды о том, кто где сидит и
// какая партия идёт. Сокеты и рассылку обновлений берёт на себя index.ts.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { GameSettings, GameState, MoveAction } from '../../src/game/types';
import { applyMove, startNextRound } from '../../src/game/engine';
import { decideBotMove } from '../../src/game/bots';
import { createMatch, type SeatAssignment } from './match';
import type { LobbyTable, TableView } from './protocol';

const BOT_NAMES = ['Бот Мира', 'Бот Лев', 'Бот Ника'];

const DEFAULT_SETTINGS: GameSettings = {
  scoreLimit: 101,
  playerCount: 4,
  startingCards: 6,
  difficulty: 'normal',
  soundEnabled: false,
};

interface Table {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  status: 'waiting' | 'playing';
  passwordSalt?: string;
  passwordHash?: string;
  seats: SeatAssignment[];
  game: GameState | null;
  betLamports?: number;
  serverWallet?: string;
  /** Защита от двойной выплаты: банк уже отправлен победителю. */
  paidOut?: boolean;
  /** Итоговый банк, зафиксированный при старте (lamports). Не меняется при уходе игроков. */
  potLamports?: number;
  /** Сколько раз пытались выплатить банк (для авто-повтора при сбое RPC). */
  payoutAttempts?: number;
}

// Здравый предел ставки (1000 SOL), чтобы исключить абсурдные/переполненные значения.
const MAX_BET_LAMPORTS = 1000 * 1_000_000_000;

/** Нормализует ставку от клиента: целое, положительное, в пределах лимита. */
function sanitizeBet(betLamports?: number): number | undefined {
  if (betLamports === undefined) return undefined;
  if (!Number.isFinite(betLamports) || betLamports <= 0) return undefined;
  const bet = Math.floor(betLamports);
  if (bet > MAX_BET_LAMPORTS) return undefined;
  return bet;
}

const tables = new Map<string, Table>();
const userTable = new Map<string, string>(); // userId → tableId

function emptySeat(): SeatAssignment {
  return { userId: null, name: 'Свободно', isBot: false };
}

function hashPw(pw: string): { salt: string; hash: string } {
  const salt = randomBytes(12).toString('hex');
  return { salt, hash: scryptSync(pw, salt, 32).toString('hex') };
}

function checkPw(table: Table, pw: string | undefined): boolean {
  if (!table.passwordHash || !table.passwordSalt) return true;
  if (!pw) return false;
  const candidate = scryptSync(pw, table.passwordSalt, 32).toString('hex');
  const a = Buffer.from(candidate);
  const b = Buffer.from(table.passwordHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tableOf(userId: string): Table | undefined {
  const id = userTable.get(userId);
  return id ? tables.get(id) : undefined;
}

export function getTable(tableId: string): Table | undefined {
  return tables.get(tableId);
}

export function lobbyList(): LobbyTable[] {
  return [...tables.values()].map((t) => ({
    id: t.id,
    name: t.name,
    players: t.seats.filter((s) => s.userId).length,
    maxPlayers: t.maxPlayers,
    hasPassword: Boolean(t.passwordHash),
    status: t.status,
    betLamports: t.betLamports,
  }));
}

export function toTableView(table: Table): TableView {
  return {
    id: table.id,
    name: table.name,
    hostId: table.hostId,
    seats: table.seats,
    maxPlayers: table.maxPlayers,
    hasPassword: Boolean(table.passwordHash),
    status: table.status,
    betLamports: table.betLamports,
    serverWallet: table.serverWallet,
    potLamports: table.potLamports,
  };
}

export interface MutationResult {
  ok: boolean;
  error?: string;
  table?: Table;
}

export function createTable(
  user: { id: string; name: string },
  name: string,
  maxPlayers: 2 | 3 | 4,
  password?: string,
  betLamports?: number,
  serverWallet?: string,
): MutationResult {
  if (tableOf(user.id)) return { ok: false, error: 'Вы уже за столом' };
  const safeMax = ([2, 3, 4].includes(maxPlayers) ? maxPlayers : 4) as 2 | 3 | 4;
  const cleanName = (name || '').trim() || `Стол ${user.name}`;
  const bet = sanitizeBet(betLamports);
  const seats: SeatAssignment[] = Array.from({ length: safeMax }, emptySeat);
  // id пользователя = адрес кошелька, поэтому сразу годится для выплат.
  seats[0] = { userId: user.id, name: user.name, isBot: false, walletAddress: user.id };
  const table: Table = {
    id: randomBytes(6).toString('base64url'),
    name: cleanName.slice(0, 30),
    hostId: user.id,
    maxPlayers: safeMax,
    status: 'waiting',
    seats,
    game: null,
    ...(password ? hashPw(password) : {}),
    ...(bet ? { betLamports: bet, serverWallet } : {}),
  };
  tables.set(table.id, table);
  userTable.set(user.id, table.id);
  return { ok: true, table };
}

export function registerWallet(userId: string, walletAddress: string): void {
  const table = tableOf(userId);
  if (!table) return;
  const seat = table.seats.find((s) => s.userId === userId);
  if (seat) seat.walletAddress = walletAddress;
}

export function markPaid(userId: string): { seatIndex: number; table: Table } | undefined {
  const table = tableOf(userId);
  if (!table) return undefined;
  const seatIndex = table.seats.findIndex((s) => s.userId === userId);
  if (seatIndex === -1) return undefined;
  table.seats[seatIndex].paid = true;
  return { seatIndex, table };
}

export function allPaid(table: Table): boolean {
  if (!table.betLamports || table.betLamports === 0) return true;
  return table.seats
    .filter((s) => s.userId && !s.isBot)
    .every((s) => s.paid === true);
}

export function joinTable(
  user: { id: string; name: string },
  tableId: string,
  password?: string,
): MutationResult {
  if (tableOf(user.id)) return { ok: false, error: 'Вы уже за столом' };
  const table = tables.get(tableId);
  if (!table) return { ok: false, error: 'Стол не найден' };
  if (table.status !== 'waiting') return { ok: false, error: 'Партия уже идёт' };
  if (!checkPw(table, password)) return { ok: false, error: 'Неверный пароль' };
  const freeIndex = table.seats.findIndex((s) => !s.userId);
  if (freeIndex === -1) return { ok: false, error: 'Свободных мест нет' };
  table.seats[freeIndex] = { userId: user.id, name: user.name, isBot: false, walletAddress: user.id };
  userTable.set(user.id, table.id);
  return { ok: true, table };
}

/** Игрок выходит из-за стола. Возвращает покинутый стол (для рассылки) либо ничего. */
export function leaveTable(userId: string): Table | undefined {
  const table = tableOf(userId);
  if (!table) return undefined;
  userTable.delete(userId);
  const idx = table.seats.findIndex((s) => s.userId === userId);

  // Ставочная партия в процессе: заменяем ушедшего ботом, игра идёт дальше.
  const inBetGame = idx !== -1 && table.status === 'playing' && !!table.betLamports && table.betLamports > 0;
  if (idx !== -1) {
    if (inBetGame) {
      const botCount = table.seats.filter((s) => s.isBot).length;
      table.seats[idx] = {
        userId: null,
        name: BOT_NAMES[botCount % BOT_NAMES.length] ?? `Бот-${idx + 1}`,
        isBot: true,
      };
    } else {
      table.seats[idx] = emptySeat();
    }
  }

  const humans = table.seats.filter((s) => s.userId);
  if (humans.length === 0) {
    tables.delete(table.id);
    return table;
  }
  // Если ушёл хост — передаём роль первому оставшемуся человеку.
  if (table.hostId === userId) table.hostId = humans[0].userId as string;

  if (inBetGame) {
    // Если после замены не осталось людей — стол не нужен (выплатить некому).
    if (!table.seats.some((s) => s.userId && !s.isBot)) {
      tables.delete(table.id);
    }
  } else if (table.status === 'playing') {
    // Без ставки: прерываем игру.
    table.status = 'waiting';
    table.game = null;
    table.seats = table.seats.map((s) => (s.isBot ? emptySeat() : s));
  }
  return table;
}

export function startGame(userId: string): MutationResult {
  const table = tableOf(userId);
  if (!table) return { ok: false, error: 'Вы не за столом' };
  if (table.hostId !== userId) return { ok: false, error: 'Партию начинает хозяин стола' };
  const canStart = table.status === 'waiting' || table.game?.phase === 'gameOver';
  if (!canStart) return { ok: false, error: 'Партия уже идёт' };

  // Свободные кресла занимают боты.
  let botN = 0;
  const seats = table.seats.map((s) =>
    s.userId ? { ...s, isBot: false } : { userId: null, name: BOT_NAMES[botN++] ?? `Бот ${botN}`, isBot: true },
  );
  table.seats = seats;
  table.game = createMatch(seats, DEFAULT_SETTINGS);
  table.status = 'playing';
  table.paidOut = false; // новая партия — разрешаем новую выплату
  table.payoutAttempts = 0; // сбрасываем счётчик попыток выплаты
  // Фиксируем банк до того, как кто-то успеет выйти.
  if (table.betLamports) {
    table.potLamports = table.betLamports * seats.filter((s) => s.userId && !s.isBot).length;
  }
  // Reset paid flags for next game
  for (const s of table.seats) {
    if (s.userId) s.paid = false;
  }
  return { ok: true, table };
}

export function applyUserMove(userId: string, move: MoveAction): MutationResult {
  const table = tableOf(userId);
  if (!table || !table.game) return { ok: false, error: 'Партия не идёт' };
  if (table.game.phase !== 'playing') return { ok: false, error: 'Сейчас не ход' };
  const seatIndex = table.seats.findIndex((s) => s.userId === userId);
  if (seatIndex === -1) return { ok: false, error: 'Вы не за столом' };
  if (seatIndex !== table.game.currentPlayerIndex) return { ok: false, error: 'Сейчас не ваш ход' };
  try {
    table.game = applyMove(table.game, move);
  } catch (e) {
    return { ok: false, error: 'Недопустимый ход' };
  }
  return { ok: true, table };
}

/** Ход бота, если сейчас очередь бота. Возвращает стол при изменении. */
export function botStep(tableId: string): Table | undefined {
  const table = tables.get(tableId);
  if (!table || !table.game || table.game.phase !== 'playing') return undefined;
  const seat = table.seats[table.game.currentPlayerIndex];
  if (!seat?.isBot) return undefined;
  const action = decideBotMove(table.game, table.game.settings.difficulty);
  table.game = applyMove(table.game, action);
  return table;
}

export function nextRound(userId: string): MutationResult {
  const table = tableOf(userId);
  if (!table || !table.game) return { ok: false, error: 'Партия не идёт' };
  if (table.game.phase !== 'roundOver') return { ok: false, error: 'Раунд ещё идёт' };
  table.game = startNextRound(table.game);
  return { ok: true, table };
}

export function seatIndexOf(table: Table, userId: string): number {
  return table.seats.findIndex((s) => s.userId === userId);
}

export type { Table };
