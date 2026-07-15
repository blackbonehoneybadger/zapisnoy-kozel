// DOFFA Bean Duel — серверный авторитетный PvP-матч. Использует ТОТ ЖЕ
// детерминированный движок, что и офлайн-прототип (src/games/bean-duel/
// engine.ts), но через stepDuelPvP: оба бойца управляются реальным вводом
// двух людей, без встроенного ИИ. Сервер — источник истины: клиент шлёт
// только свой ввод (позиция/рывок/бросок) и получает авторитетное
// состояние каждый тик; клиент не может заявить «я победил» — победителя
// определяет исключительно сервер (см. finishMatch).
//
// FighterId('player'|'bot') здесь — просто ярлыки первого/второго слота
// матча, а НЕ признак бота: stepDuelPvP не запускает никакого ИИ, оба
// слота ведут реальные игроки.
import {
  createInitialState,
  stepDuelPvP,
  type DuelInput,
  type DuelState,
  type FighterId,
  type Vec2,
} from '../../src/games/bean-duel/engine';
import type { ServerMessage } from './protocol';

const TICK_MS = 50; // 20 тиков/сек — частота авторитетной симуляции
const SIDES: FighterId[] = ['player', 'bot'];

interface DuelMatch {
  id: string;
  userIds: Record<FighterId, string>;
  state: DuelState;
  input: Record<FighterId, DuelInput>;
  timer: ReturnType<typeof setInterval>;
  lastTickAt: number;
  finished: boolean;
}

const neutralInput = (): DuelInput => ({ target: null, dashPressed: false, throwPressed: false });

const matches = new Map<string, DuelMatch>();
const matchByUser = new Map<string, string>();
/** FIFO очередь ожидания соперника (см. Этап 7 для анти-фарм лимитов поверх этого). */
const queue: string[] = [];

let sendFn: (userId: string, msg: ServerMessage) => void = () => {};
/** Вызывается один раз при старте сервера — внедряет функцию отправки сообщений (см. index.ts). */
export function initDuel(send: (userId: string, msg: ServerMessage) => void): void {
  sendFn = send;
}

let matchCounter = 0;
function nextMatchId(): string {
  matchCounter += 1;
  return `duel-${Date.now()}-${matchCounter}`;
}

function sideOf(match: DuelMatch, userId: string): FighterId | null {
  if (match.userIds.player === userId) return 'player';
  if (match.userIds.bot === userId) return 'bot';
  return null;
}

function opponentSide(side: FighterId): FighterId {
  return side === 'player' ? 'bot' : 'player';
}

/**
 * Ставит игрока в очередь на матч Bean Duel. Если уже есть ожидающий
 * соперник — сразу создаёт матч и уведомляет обоих через duel:matchFound.
 * Игрок, уже находящийся в очереди или в активном матче, повторно не
 * ставится (идемпотентно).
 */
export function queueForDuel(userId: string): void {
  if (matchByUser.has(userId) || queue.includes(userId)) return;

  const opponent = queue.shift();
  if (!opponent) {
    queue.push(userId);
    sendFn(userId, { t: 'duel:queued' });
    return;
  }
  createMatch(opponent, userId);
}

export function cancelQueue(userId: string): void {
  const idx = queue.indexOf(userId);
  if (idx >= 0) {
    queue.splice(idx, 1);
    sendFn(userId, { t: 'duel:cancelled' });
  }
}

function createMatch(userA: string, userB: string): void {
  const id = nextMatchId();
  const match: DuelMatch = {
    id,
    userIds: { player: userA, bot: userB },
    state: createInitialState(),
    input: { player: neutralInput(), bot: neutralInput() },
    lastTickAt: Date.now(),
    finished: false,
    timer: setInterval(() => tick(id), TICK_MS),
  };
  matches.set(id, match);
  matchByUser.set(userA, id);
  matchByUser.set(userB, id);

  for (const side of SIDES) {
    const you = match.userIds[side];
    sendFn(you, { t: 'duel:matchFound', matchId: id, you: side, opponentName: match.userIds[opponentSide(side)] });
  }
}

/** Принимает ввод игрока за текущий кадр — применяется на следующем серверном тике. */
export function submitInput(userId: string, target: Vec2 | null, dashPressed: boolean, throwPressed: boolean): void {
  const matchId = matchByUser.get(userId);
  if (!matchId) return;
  const match = matches.get(matchId);
  if (!match || match.finished) return;
  const side = sideOf(match, userId);
  if (!side) return;
  match.input[side] = { target, dashPressed, throwPressed };
}

function tick(matchId: string): void {
  const match = matches.get(matchId);
  if (!match || match.finished) return;

  const now = Date.now();
  // Защита от гигантского dt после паузы event loop (GC-пауза, lag).
  const dt = Math.min(120, now - match.lastTickAt);
  match.lastTickAt = now;

  match.state = stepDuelPvP(match.state, { player: match.input.player, bot: match.input.bot }, dt);

  // Рывок/бросок — edge-triggered на входе: сбрасываем после применения,
  // иначе один клик спамил бы способность на каждом следующем тике (тот
  // же принцип, что и в клиентском dashQueuedRef/throwQueuedRef).
  match.input.player = { ...match.input.player, dashPressed: false, throwPressed: false };
  match.input.bot = { ...match.input.bot, dashPressed: false, throwPressed: false };

  for (const side of SIDES) {
    sendFn(match.userIds[side], { t: 'duel:state', matchId, you: side, state: match.state });
  }

  if (match.state.phase === 'over') finishMatch(match);
}

function finishMatch(match: DuelMatch): void {
  if (match.finished) return;
  match.finished = true;
  clearInterval(match.timer);

  // phase === 'over' гарантирует, что движок выставил winner (см. engine.ts
  // resolveStep) — 'draw' здесь чисто типовой fallback, на практике не достижим.
  const winner = match.state.winner ?? 'draw';
  for (const side of SIDES) {
    const you = match.userIds[side];
    matchByUser.delete(you);
    sendFn(you, { t: 'duel:result', matchId: match.id, winner, youWon: winner === side });
  }
  matches.delete(match.id);
}

/**
 * Игрок явно вышел или отключился до конца матча — техническое поражение:
 * сопернику засчитывается победа сервером (клиент соперника не может
 * подделать этот исход — событие приходит только отсюда).
 */
export function leaveMatch(userId: string): void {
  cancelQueue(userId);
  const matchId = matchByUser.get(userId);
  if (!matchId) return;
  const match = matches.get(matchId);
  if (!match || match.finished) return;
  const side = sideOf(match, userId);
  if (!side) return;
  match.state = { ...match.state, phase: 'over', winner: opponentSide(side) };
  finishMatch(match);
}
