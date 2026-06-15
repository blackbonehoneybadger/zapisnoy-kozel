// Сетевое хранилище: WebSocket-соединение с онлайн-сервером, авторизация,
// лобби, стол и партия. UI читает это состояние и вызывает действия.
import { create } from 'zustand';
import type { GameState, MoveAction, Suit } from '../game/types';
import type {
  ClientMessage,
  LobbyTable,
  PublicUser,
  ServerMessage,
  TableView,
} from './protocol';

// Адрес сервера задаётся на сборке: VITE_SERVER_URL=wss://your-host
const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';

const TOKEN_KEY = 'kozel.token';

export type OnlineView = 'auth' | 'lobby' | 'table' | 'game';

interface OnlineStore {
  status: 'idle' | 'connecting' | 'connected';
  view: OnlineView;
  user: PublicUser | null;
  authError: string | null;
  notice: string | null;
  lobby: LobbyTable[];
  table: TableView | null;
  game: GameState | null;
  youSeat: number;
  busy: boolean;

  connect: () => void;
  register: (name: string, password: string) => void;
  login: (name: string, password: string) => void;
  logout: () => void;
  refreshLobby: () => void;
  createTable: (name: string, maxPlayers: 2 | 3 | 4, password?: string) => void;
  joinTable: (tableId: string, password?: string) => void;
  leaveTable: () => void;
  startGame: () => void;
  playCard: (cardId: string, chosenSuit?: Suit) => void;
  take: () => void;
  nextRound: () => void;
  clearNotice: () => void;
}

let socket: WebSocket | null = null;
// Запрос на вход/регистрацию, отложенный до установки соединения.
let pendingAuth: ClientMessage | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

export const useOnlineStore = create<OnlineStore>((set, get) => {
  function sendMsg(msg: ClientMessage): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  // Отправить запрос авторизации сейчас, либо подключиться и отправить по готовности.
  function authOrQueue(msg: ClientMessage): void {
    set({ busy: true, authError: null });
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendMsg(msg);
      return;
    }
    pendingAuth = msg;
    get().connect();
  }

  function onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case 'auth:ok':
        localStorage.setItem(TOKEN_KEY, msg.token);
        set({ user: msg.user, authError: null, busy: false });
        if (!get().table) {
          set({ view: 'lobby' });
          sendMsg({ t: 'lobby:subscribe' });
        }
        break;
      case 'auth:err':
        localStorage.removeItem(TOKEN_KEY);
        set({ authError: msg.message, busy: false, view: 'auth' });
        break;
      case 'lobby':
        set({ lobby: msg.tables });
        break;
      case 'table':
        set({
          table: msg.table,
          busy: false,
          view: msg.table.status === 'playing' ? 'game' : 'table',
        });
        break;
      case 'table:left':
        set({ table: null, game: null, view: 'lobby' });
        sendMsg({ t: 'lobby:subscribe' });
        break;
      case 'game':
        set({ game: msg.state, youSeat: msg.youSeat, view: 'game', busy: false });
        break;
      case 'error':
        set({ notice: msg.message, busy: false });
        break;
    }
  }

  return {
    status: 'idle',
    view: 'auth',
    user: null,
    authError: null,
    notice: null,
    lobby: [],
    table: null,
    game: null,
    youSeat: 0,
    busy: false,

    connect: () => {
      if (socket && socket.readyState <= WebSocket.OPEN) return;
      set({ status: 'connecting' });
      if (connectTimer) clearTimeout(connectTimer);
      // Если за 8 секунд не подключились — сервер недоступен, разблокируем UI.
      connectTimer = setTimeout(() => {
        if (get().status !== 'connected') {
          try {
            socket?.close();
          } catch {
            /* ignore */
          }
          pendingAuth = null;
          set({
            status: 'idle',
            busy: false,
            authError: 'Сервер онлайн-игры недоступен. Попробуйте позже.',
          });
        }
      }, 8000);

      try {
        socket = new WebSocket(SERVER_URL);
      } catch {
        if (connectTimer) clearTimeout(connectTimer);
        set({ status: 'idle', busy: false, authError: 'Не удалось подключиться к серверу.' });
        return;
      }

      socket.onopen = () => {
        if (connectTimer) clearTimeout(connectTimer);
        set({ status: 'connected' });
        // Сначала пробуем восстановить сессию по токену, иначе шлём отложенный вход.
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) sendMsg({ t: 'auth', token });
        if (pendingAuth) {
          sendMsg(pendingAuth);
          pendingAuth = null;
        }
      };
      socket.onmessage = (e) => {
        try {
          onMessage(JSON.parse(e.data) as ServerMessage);
        } catch {
          /* игнорируем мусор */
        }
      };
      socket.onclose = () => {
        if (connectTimer) clearTimeout(connectTimer);
        set({ status: 'idle' });
        // Соединение упало во время ожидания авторизации — сообщаем и не висим.
        if (get().busy && pendingAuth) {
          pendingAuth = null;
          set({ busy: false, authError: 'Соединение с сервером прервано.' });
        }
      };
      socket.onerror = () => {
        if (connectTimer) clearTimeout(connectTimer);
        pendingAuth = null;
        set({ notice: 'Нет связи с сервером', status: 'idle', busy: false });
      };
    },

    register: (name, password) => {
      authOrQueue({ t: 'register', name, password });
    },
    login: (name, password) => {
      authOrQueue({ t: 'login', name, password });
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      sendMsg({ t: 'table:leave' });
      set({ user: null, table: null, game: null, view: 'auth', lobby: [] });
    },

    refreshLobby: () => sendMsg({ t: 'lobby:subscribe' }),
    createTable: (name, maxPlayers, password) => {
      set({ busy: true });
      sendMsg({ t: 'table:create', name, maxPlayers, password: password || undefined });
    },
    joinTable: (tableId, password) => {
      set({ busy: true });
      sendMsg({ t: 'table:join', tableId, password: password || undefined });
    },
    leaveTable: () => sendMsg({ t: 'table:leave' }),
    startGame: () => sendMsg({ t: 'table:start' }),
    playCard: (cardId, chosenSuit) =>
      sendMsg({ t: 'game:move', move: { type: 'play', cardId, chosenSuit } as MoveAction }),
    take: () => sendMsg({ t: 'game:move', move: { type: 'take' } }),
    nextRound: () => sendMsg({ t: 'game:next' }),
    clearNotice: () => set({ notice: null }),
  };
});
