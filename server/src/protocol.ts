// Протокол WebSocket между клиентом и сервером. Каждое сообщение — JSON с полем `t`.
import type { GameState, MoveAction } from '../../src/game/types';

export interface PublicUser {
  id: string;
  name: string;
}

/** Карточка стола в списке лобби. */
export interface LobbyTable {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
}

/** Кресло за столом. */
export interface Seat {
  userId: string | null; // null — пустое кресло
  name: string;
  isBot: boolean;
}

/** Полное состояние стола, в котором сидит игрок. */
export interface TableView {
  id: string;
  name: string;
  hostId: string;
  seats: Seat[];
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
}

// ─── Клиент → Сервер ───────────────────────────────────────────────
export type ClientMessage =
  | { t: 'register'; name: string; password: string }
  | { t: 'login'; name: string; password: string }
  | { t: 'auth'; token: string }
  | { t: 'lobby:subscribe' }
  | { t: 'lobby:unsubscribe' }
  | { t: 'table:create'; name: string; maxPlayers: 3 | 4; password?: string }
  | { t: 'table:join'; tableId: string; password?: string }
  | { t: 'table:leave' }
  | { t: 'table:start' }
  | { t: 'game:move'; move: MoveAction }
  | { t: 'game:next' };

// ─── Сервер → Клиент ───────────────────────────────────────────────
export type ServerMessage =
  | { t: 'auth:ok'; token: string; user: PublicUser }
  | { t: 'auth:err'; message: string }
  | { t: 'lobby'; tables: LobbyTable[] }
  | { t: 'table'; table: TableView }
  | { t: 'table:left' }
  | { t: 'game'; state: GameState; youSeat: number }
  | { t: 'error'; message: string };
