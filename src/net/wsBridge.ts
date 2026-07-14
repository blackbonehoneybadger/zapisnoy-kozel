// Тонкий мост к WebSocket: без сторов, чтобы beans/rewards не циклили с onlineStore.
import type { ClientMessage } from './protocol';

let socket: WebSocket | null = null;

export function bindOnlineSocket(ws: WebSocket | null): void {
  socket = ws;
}

export function sendOnline(msg: ClientMessage): boolean {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

export function isOnlineConnected(): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}
