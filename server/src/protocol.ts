// Протокол WebSocket (зеркало server/src/protocol.ts).
import type { GameState, MoveAction } from '../../src/game/types';

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
  | { t: 'friend:remove'; userId: string };

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
  | { t: 'wallet:payout'; winnerName: string; txSignature: string; lamports: number; commission: number };
