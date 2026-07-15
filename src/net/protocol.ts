// Протокол WebSocket (зеркало server/src/protocol.ts).
import type { GameState, MoveAction } from '../games/crazy8/engine/types';
import type { DuelState, FighterId, Vec2 } from '../games/bean-duel/engine';

export interface PublicUser {
  id: string; // адрес кошелька Solana
  name: string;
}

/** Игрок в сети: для списка присутствия и друзей. */
export interface OnlineUser {
  id: string;
  name: string;
  inGame: boolean;
  isFriend?: boolean;
}

export interface LobbyTable {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
  betLamports?: number;
}

export interface Seat {
  userId: string | null;
  name: string;
  isBot: boolean;
  walletAddress?: string;
  paid?: boolean;
}

export interface TableView {
  id: string;
  name: string;
  hostId: string;
  seats: Seat[];
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
  betLamports?: number;
  serverWallet?: string;
  /** Фактический банк партии (lamports), зафиксированный при старте. */
  potLamports?: number;
}

export type ClientMessage =
  // Вход только через кошелёк: запрос nonce → подпись → проверка.
  | { t: 'auth:nonce'; walletAddress: string }
  | { t: 'auth:verify'; walletAddress: string; signature: string }
  | { t: 'auth'; token: string }
  | { t: 'profile:setName'; name: string }
  | { t: 'lobby:subscribe' }
  | { t: 'lobby:unsubscribe' }
  | { t: 'table:create'; name: string; maxPlayers: 2 | 3 | 4; password?: string; betLamports?: number }
  | { t: 'table:join'; tableId: string; password?: string }
  | { t: 'table:leave' }
  | { t: 'table:start' }
  | { t: 'game:move'; move: MoveAction }
  | { t: 'game:next' }
  | { t: 'wallet:register'; walletAddress: string }
  | { t: 'wallet:pay'; tableId: string; signature: string }
  | { t: 'invite:send'; tableId: string; toUserId: string }
  | { t: 'invite:all'; tableId: string }
  | { t: 'friend:add'; userId: string }
  | { t: 'friend:remove'; userId: string }
  // Сверка партии тапов тапалки: сколько тапов и сколько зёрен клиент
  // насчитал локально с прошлой сверки — сервер урезает до правдоподобного.
  | { t: 'beans:sync'; tapped: number; claimedGain: number; elapsedMs: number }
  // Запрос тренировочных зёрен за офлайн-партию против ботов (rate-limited).
  | { t: 'beans:awardTraining'; won: boolean }
  | { t: 'reward:list' }
  | { t: 'reward:claim'; rewardId: string; walletAddress: string; idempotencyKey: string }
  | { t: 'reward:history' }
  // DOFFA Bean Duel — авторитетный PvP-матч (см. server/src/duel.ts). Клиент
  // шлёт только СВОЙ ввод каждый кадр/тик; движок и решение о победителе —
  // исключительно на сервере (см. duel:state/duel:result ниже).
  | { t: 'duel:queue' }
  | { t: 'duel:cancelQueue' }
  | { t: 'duel:input'; target: Vec2 | null; dashPressed: boolean; throwPressed: boolean }
  | { t: 'duel:leave' };

export type ServerMessage =
  | { t: 'auth:challenge'; nonce: string }
  | { t: 'auth:ok'; token: string; user: PublicUser }
  | { t: 'auth:err'; message: string }
  | { t: 'lobby'; tables: LobbyTable[] }
  | { t: 'presence'; users: OnlineUser[] }
  | { t: 'friends'; friends: OnlineUser[] }
  | { t: 'table'; table: TableView }
  | { t: 'table:left' }
  | { t: 'game'; state: GameState; youSeat: number }
  | { t: 'error'; message: string }
  | { t: 'invite'; tableId: string; tableName: string; fromName: string; betLamports?: number }
  | { t: 'wallet:required'; serverWallet: string; lamports: number }
  | { t: 'wallet:paid'; seatIndex: number }
  | { t: 'wallet:payout'; winnerName: string; txSignature: string; lamports: number; commission: number }
  // Авторитетный баланс зёрен/энергии — единственный легитимный источник
  // для клиента (см. src/features/beans/beansStore.ts syncFromServer).
  | { t: 'beans:state'; beans: number; energy: number }
  // Результат запроса тренировочных зёрен (0, если сервер отказал/rate-limit).
  | { t: 'beans:trainingResult'; granted: number; beans: number; energy: number }
  // Подтверждённая сервером сумма DOFFA за окончание онлайн-матча
  // (0/undefined, если победы не было или награда не назначена).
  | { t: 'reward:match'; matchId: string; amount: number }
  | { t: 'reward:list'; rewards: RewardSummary[] }
  | { t: 'reward:claimResult'; ok: boolean; status: RewardStatusValue; message?: string; txSignature?: string; testMode: boolean }
  | { t: 'reward:history'; items: RewardHistoryItemSummary[] }
  // DOFFA Bean Duel — авторитетный PvP.
  | { t: 'duel:queued' }
  | { t: 'duel:matchFound'; matchId: string; you: FighterId; opponentName: string }
  // Полное состояние движка каждый тик — источник истины для рендера обоих
  // клиентов; `you` говорит клиенту, какой боец в state — он сам.
  | { t: 'duel:state'; matchId: string; you: FighterId; state: DuelState }
  | { t: 'duel:result'; matchId: string; winner: FighterId | 'draw'; youWon: boolean }
  | { t: 'duel:cancelled' };

/** Статус жизненного цикла награды (зеркало server/src/domain/types.ts RewardStatus). */
export type RewardStatusValue = 'none' | 'available' | 'processing' | 'sent' | 'failed' | 'review';

/** Урезанная для клиента форма Reward (server/src/domain/types.ts). */
export interface RewardSummary {
  id: string;
  matchId: string;
  amount: number;
  status: RewardStatusValue;
  createdAt: number;
}

/** Урезанная для клиента форма RewardHistoryItem (server/src/domain/types.ts). */
export interface RewardHistoryItemSummary {
  id: string;
  date: number;
  kind: 'doffa' | 'claim';
  amount: number;
  note: string;
  txSignature?: string;
}
