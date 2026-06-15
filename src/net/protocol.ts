// Протокол WebSocket (зеркало server/src/protocol.ts).
import type { GameState, MoveAction } from '../game/types';

export interface PublicUser {
  id: string;
  name: string;
}

export interface LobbyTable {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
}

export interface Seat {
  userId: string | null;
  name: string;
  isBot: boolean;
}

export interface TableView {
  id: string;
  name: string;
  hostId: string;
  seats: Seat[];
  maxPlayers: number;
  hasPassword: boolean;
  status: 'waiting' | 'playing';
}

export type ClientMessage =
  | { t: 'register'; name: string; password: string }
  | { t: 'login'; name: string; password: string }
  | { t: 'auth'; token: string }
  | { t: 'lobby:subscribe' }
  | { t: 'lobby:unsubscribe' }
  | { t: 'table:create'; name: string; maxPlayers: 2 | 3 | 4; password?: string }
  | { t: 'table:join'; tableId: string; password?: string }
  | { t: 'table:leave' }
  | { t: 'table:start' }
  | { t: 'game:move'; move: MoveAction }
  | { t: 'game:next' };

export type ServerMessage =
  | { t: 'auth:ok'; token: string; user: PublicUser }
  | { t: 'auth:err'; message: string }
  | { t: 'lobby'; tables: LobbyTable[] }
  | { t: 'table'; table: TableView }
  | { t: 'table:left' }
  | { t: 'game'; state: GameState; youSeat: number }
  | { t: 'error'; message: string };
