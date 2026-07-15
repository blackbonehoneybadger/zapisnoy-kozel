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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createInitialState,
  stepDuelPvP,
  type DuelInput,
  type DuelState,
  type FighterId,
  type Vec2,
} from '../../src/games/bean-duel/engine';
import type { ServerMessage } from './protocol';
import { BEAN_DUEL_ENTRY_FEE } from './config';
import type { BeansService, BeansState } from './services/beansService';
import type { RewardService } from './services/rewardService';
import type { Repositories } from './repositories/types';
import { computeWinReward, recordBurn } from './services/rewardBudgetService';

const TICK_MS = 50; // 20 тиков/сек — частота авторитетной симуляции
const SIDES: FighterId[] = ['player', 'bot'];
/** Матчи короче этого — подозрительны (слив/фарм), помечаются в журнале для будущего ревью. */
const SUSPICIOUSLY_SHORT_MS = 4_000;

interface DuelMatch {
  id: string;
  userIds: Record<FighterId, string>;
  state: DuelState;
  input: Record<FighterId, DuelInput>;
  timer: ReturnType<typeof setInterval>;
  lastTickAt: number;
  startedAt: number;
  finished: boolean;
}

const neutralInput = (): DuelInput => ({ target: null, dashPressed: false, throwPressed: false });

const matches = new Map<string, DuelMatch>();
const matchByUser = new Map<string, string>();
/**
 * FIFO очередь ожидания соперника. Игрок не может встретить сам себя:
 * queueForDuel не ставит повторно уже стоящего в очереди/играющего
 * пользователя (см. проверку ниже) — вторая попытка того же userId просто
 * игнорируется, а не создаёт матч с самим собой.
 */
const queue: string[] = [];

let sendFn: (userId: string, msg: ServerMessage) => void = () => {};
let beansFn: BeansService | null = null;
let rewardsFn: RewardService | null = null;
let reposFn: Repositories | null = null;
/**
 * Вызывается один раз при старте сервера — внедряет отправку сообщений и
 * доменные сервисы (зёрна, награды, репозитории — см. index.ts).
 */
export function initDuel(
  send: (userId: string, msg: ServerMessage) => void,
  beans: BeansService,
  rewards: RewardService,
  repositories: Repositories,
): void {
  sendFn = send;
  beansFn = beans;
  rewardsFn = rewards;
  reposFn = repositories;
}

// ─── Журнал матчей (анти-фарм: см. requirement — "keep a match event log") ─
const here = dirname(fileURLToPath(import.meta.url));
const JOURNAL_PATH = resolve(here, '..', 'data', 'duel_matches.json');

interface DuelMatchEvent {
  matchId: string;
  players: [string, string];
  winner: FighterId | 'draw';
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  suspiciouslyShort: boolean;
}

function loadJournal(): DuelMatchEvent[] {
  try {
    return existsSync(JOURNAL_PATH) ? (JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as DuelMatchEvent[]) : [];
  } catch (e) {
    console.error('Не удалось прочитать журнал матчей Bean Duel:', e);
    return [];
  }
}

function appendJournal(event: DuelMatchEvent): void {
  try {
    mkdirSync(dirname(JOURNAL_PATH), { recursive: true });
    const journal = loadJournal();
    journal.push(event);
    // Ограничиваем размер файла — храним последние 5000 записей, этого
    // достаточно для анти-фарм проверок на скользящем окне (см. Этап 8+).
    const trimmed = journal.length > 5000 ? journal.slice(-5000) : journal;
    writeFileSync(JOURNAL_PATH, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Не удалось записать журнал матчей Bean Duel:', e);
  }
}

/**
 * Сколько матчей сыграно между этими двумя игроками за последние `windowMs`
 * (по умолчанию сутки) — основа для будущего лимита повторных наградных
 * встреч с одним соперником (см. Этап 8: расчёт наград).
 */
export function recentMatchCountBetween(userA: string, userB: string, windowMs = 24 * 60 * 60 * 1000): number {
  const since = Date.now() - windowMs;
  return loadJournal().filter(
    (e) => e.finishedAt >= since && ((e.players[0] === userA && e.players[1] === userB) || (e.players[0] === userB && e.players[1] === userA)),
  ).length;
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

function beansStateMsg(s: BeansState): ServerMessage {
  return { t: 'beans:state', beans: s.beans, energy: s.energy };
}

/** Сумма, списанная за вход, для каждого игрока, ожидающего соперника в очереди. */
const queueCharges = new Map<string, number>();

/**
 * Ставит игрока в очередь на матч Bean Duel. Списывает плату за вход
 * (BEAN_DUEL_ENTRY_FEE зёрен) атомарно ДО постановки в очередь — недостаток
 * зёрен отклоняет запрос ошибкой. Если уже есть ожидающий соперник — сразу
 * создаёт матч и уведомляет обоих через duel:matchFound (плата обоих
 * сгорает — билет на вход, не возвращается после начала матча). Игрок, уже
 * находящийся в очереди или в активном матче, повторно не ставится
 * (идемпотентно) — тем самым исключена встреча с самим собой.
 */
export async function queueForDuel(userId: string): Promise<void> {
  if (matchByUser.has(userId) || queue.includes(userId) || !beansFn) return;

  const charged = await beansFn.chargeEntry(userId, userId, BEAN_DUEL_ENTRY_FEE);
  if (!charged) {
    sendFn(userId, { t: 'error', message: 'Недостаточно зёрен для входа в Bean Duel' });
    return;
  }
  sendFn(userId, beansStateMsg(charged));

  const opponent = queue.shift();
  if (!opponent) {
    queue.push(userId);
    queueCharges.set(userId, BEAN_DUEL_ENTRY_FEE);
    sendFn(userId, { t: 'duel:queued' });
    return;
  }
  queueCharges.delete(opponent); // соперник переходит в матч — плата сгорает, билет использован
  createMatch(opponent, userId);
}

/**
 * Убирает игрока из очереди, если он там есть, и возвращает плату за вход
 * (матч не состоялся — техническая отмена, требование: "если матч не
 * найден... зёрна возвращаются"). Не действует на уже начавшийся матч —
 * там выход/разрыв соединения обрабатывает leaveMatch (техническое
 * поражение, без возврата — билет уже использован).
 */
export async function cancelQueue(userId: string): Promise<void> {
  const idx = queue.indexOf(userId);
  if (idx < 0) return;
  queue.splice(idx, 1);
  const amount = queueCharges.get(userId);
  queueCharges.delete(userId);
  if (amount && beansFn) {
    const state = await beansFn.refundEntry(userId, userId, amount);
    sendFn(userId, beansStateMsg(state));
  }
  sendFn(userId, { t: 'duel:cancelled' });
}

function createMatch(userA: string, userB: string): void {
  const id = nextMatchId();
  const match: DuelMatch = {
    id,
    userIds: { player: userA, bot: userB },
    state: createInitialState(),
    input: { player: neutralInput(), bot: neutralInput() },
    lastTickAt: Date.now(),
    startedAt: Date.now(),
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
  const finishedAt = Date.now();
  for (const side of SIDES) {
    const you = match.userIds[side];
    matchByUser.delete(you);
    sendFn(you, { t: 'duel:result', matchId: match.id, winner, youWon: winner === side });
  }
  matches.delete(match.id);

  const durationMs = finishedAt - match.startedAt;
  const suspiciouslyShort = durationMs < SUSPICIOUSLY_SHORT_MS;
  appendJournal({
    matchId: match.id,
    players: [match.userIds.player, match.userIds.bot],
    winner,
    durationMs,
    startedAt: match.startedAt,
    finishedAt,
    suspiciouslyShort,
  });

  // Награда DOFFA — только за решающую (не ничья) победу; расчёт суммы и
  // запись асинхронны, поэтому не блокируют завершение матча для игроков.
  if (winner !== 'draw') {
    void awardWinReward(match, winner, finishedAt, suspiciouslyShort);
  }
}

/**
 * Начисляет награду DOFFA победителю через RewardService (80/20-разделение
 * уже применено computeWinReward): доля игрока становится доступной
 * наградой (reward:match), доля на сжигание уходит в burn-журнал.
 * Подозрительно короткие матчи (<SUSPICIOUSLY_SHORT_MS) награду НЕ получают
 * — только статистика/рейтинг, матч всё равно фиксируется со статусом
 * "review" (анти-фарм: слив/обрыв сразу после старта не должен платить).
 */
async function awardWinReward(match: DuelMatch, winner: FighterId, finishedAt: number, suspiciouslyShort: boolean): Promise<void> {
  if (!rewardsFn || !reposFn) return;
  const winnerId = match.userIds[winner];

  let doffaReward: number | undefined;
  if (!suspiciouslyShort) {
    try {
      const computation = await computeWinReward(winnerId, reposFn);
      doffaReward = computation.playerAmount;
      if (computation.burnAmount > 0) recordBurn(match.id, computation.burnAmount);
    } catch (e) {
      console.error('Не удалось рассчитать награду Bean Duel:', e);
      return;
    }
  }

  try {
    const { reward } = await rewardsFn.recordMatchResult({
      matchId: match.id,
      players: [match.userIds.player, match.userIds.bot],
      winnerId,
      winnerWallet: winnerId,
      startedAt: match.startedAt,
      finishedAt,
      beansEntryFee: BEAN_DUEL_ENTRY_FEE,
      doffaReward,
      flags: suspiciouslyShort ? ['suspiciously_short_match'] : undefined,
    });
    if (reward && reward.amount > 0) {
      sendFn(winnerId, { t: 'reward:match', matchId: match.id, amount: reward.amount });
    }
  } catch (e) {
    console.error('Не удалось записать результат матча Bean Duel:', e);
  }
}

/**
 * Игрок явно вышел или отключился до конца матча — техническое поражение:
 * сопернику засчитывается победа сервером (клиент соперника не может
 * подделать этот исход — событие приходит только отсюда). Если игрок был
 * только в очереди (матч ещё не начался) — просто отменяет очередь с
 * возвратом платы (см. cancelQueue), поражение не засчитывается.
 */
export async function leaveMatch(userId: string): Promise<void> {
  await cancelQueue(userId);
  const matchId = matchByUser.get(userId);
  if (!matchId) return;
  const match = matches.get(matchId);
  if (!match || match.finished) return;
  const side = sideOf(match, userId);
  if (!side) return;
  match.state = { ...match.state, phase: 'over', winner: opponentSide(side) };
  finishMatch(match);
}
