// Сетевое хранилище: WebSocket-соединение с онлайн-сервером, вход через
// кошелёк Solana, лобби, присутствие, друзья, приглашения, стол и партия.
import { create } from 'zustand';
import type { GameState, MoveAction, Suit } from '../game/types';
import type {
  ClientMessage,
  LobbyTable,
  OnlineUser,
  PublicUser,
  ServerMessage,
  TableView,
} from './protocol';
import { useWalletStore } from '../solana/walletStore';

// Адрес сервера задаётся на сборке: VITE_SERVER_URL=wss://your-host
const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';

const TOKEN_KEY = 'kozel.token';

// Текст входа — должен побайтово совпадать с сервером (server/src/index.ts).
function authMessage(nonce: string): string {
  return `Записной Козёл — вход\nNonce: ${nonce}`;
}

export type OnlineView = 'auth' | 'lobby' | 'table' | 'game';

export interface Invite {
  tableId: string;
  tableName: string;
  fromName: string;
  betLamports?: number;
}

interface OnlineStore {
  status: 'idle' | 'connecting' | 'connected';
  view: OnlineView;
  user: PublicUser | null;
  authError: string | null;
  notice: string | null;
  lobby: LobbyTable[];
  online: OnlineUser[];
  friends: OnlineUser[];
  invites: Invite[];
  table: TableView | null;
  game: GameState | null;
  youSeat: number;
  busy: boolean;
  walletAddress: string | null;
  serverWallet: string | null;
  betRequired: boolean;

  connect: () => void;
  connectWallet: () => Promise<void>;
  logout: () => void;
  setName: (name: string) => void;
  refreshLobby: () => void;
  createTable: (name: string, maxPlayers: 2 | 3 | 4, password?: string, betLamports?: number) => void;
  joinTable: (tableId: string, password?: string) => void;
  leaveTable: () => void;
  startGame: () => void;
  playCard: (cardId: string, chosenSuit?: Suit) => void;
  take: () => void;
  nextRound: () => void;
  clearNotice: () => void;
  registerWallet: (address: string) => void;
  payBet: (tableId: string, signature: string) => void;
  invitePlayer: (toUserId: string) => void;
  inviteAll: () => void;
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  acceptInvite: (invite: Invite) => void;
  dismissInvite: (tableId: string) => void;
}

let socket: WebSocket | null = null;
// Сообщение, отложенное до установки соединения.
let pendingAuth: ClientMessage | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
// Авто-переподключение: пользователь вышел сам — не переподключаемся.
let intentionalClose = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useOnlineStore = create<OnlineStore>((set, get) => {
  function sendMsg(msg: ClientMessage): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  // Отправить сейчас, либо подключиться и отправить по готовности.
  function authOrQueue(msg: ClientMessage): void {
    set({ busy: true, authError: null });
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendMsg(msg);
      return;
    }
    pendingAuth = msg;
    get().connect();
  }

  async function handleChallenge(nonce: string): Promise<void> {
    const address = get().walletAddress;
    if (!address) return;
    try {
      const sig = await useWalletStore.getState().signMessage(authMessage(nonce));
      sendMsg({ t: 'auth:verify', walletAddress: address, signature: sig });
    } catch {
      set({ busy: false, authError: 'Вход отменён в кошельке' });
    }
  }

  function onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case 'auth:challenge':
        void handleChallenge(msg.nonce);
        break;
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
      case 'presence':
        set({ online: msg.users });
        break;
      case 'friends':
        set({ friends: msg.friends });
        break;
      case 'invite':
        set((s) => ({
          invites: [
            ...s.invites.filter((i) => i.tableId !== msg.tableId),
            {
              tableId: msg.tableId,
              tableName: msg.tableName,
              fromName: msg.fromName,
              betLamports: msg.betLamports,
            },
          ],
        }));
        break;
      case 'table':
        set({
          table: msg.table,
          busy: false,
          view: msg.table.status === 'playing' ? 'game' : 'table',
          serverWallet: msg.table.serverWallet ?? null,
        });
        break;
      case 'table:left':
        set({ table: null, game: null, view: 'lobby', serverWallet: null, betRequired: false });
        sendMsg({ t: 'lobby:subscribe' });
        break;
      case 'game':
        set({ game: msg.state, youSeat: msg.youSeat, view: 'game', busy: false });
        break;
      case 'error':
        set({ notice: msg.message, busy: false });
        break;
      case 'wallet:required':
        set({ serverWallet: msg.serverWallet, betRequired: true });
        break;
      case 'wallet:paid': {
        const t = get().table;
        if (t) {
          const seats = t.seats.map((s, i) => (i === msg.seatIndex ? { ...s, paid: true } : s));
          set({ table: { ...t, seats } });
        }
        break;
      }
      case 'wallet:payout': {
        const fee = msg.commission > 0 ? ` (−${(msg.commission / 1e9).toFixed(3)} комиссия)` : '';
        set({
          notice: `🏆 ${msg.winnerName} выиграл ${(msg.lamports / 1e9).toFixed(3)} SOL${fee}!`,
        });
        break;
      }
    }
  }

  return {
    status: 'idle',
    view: 'auth',
    user: null,
    authError: null,
    notice: null,
    lobby: [],
    online: [],
    friends: [],
    invites: [],
    table: null,
    game: null,
    youSeat: 0,
    busy: false,
    walletAddress: null,
    serverWallet: null,
    betRequired: false,

    connect: () => {
      if (socket && socket.readyState <= WebSocket.OPEN) return;
      intentionalClose = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      set({ status: 'connecting' });
      if (connectTimer) clearTimeout(connectTimer);
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
        reconnectAttempts = 0; // успешно — сбрасываем счётчик попыток
        set({ status: 'connected' });
        // Тихо восстанавливаем сессию по токену, иначе шлём отложенное.
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
        if (get().busy && pendingAuth) {
          pendingAuth = null;
          set({ busy: false, authError: 'Соединение с сервером прервано.' });
        }
        // Авто-переподключение, если пользователь вошёл и не вышел сам.
        const token = localStorage.getItem(TOKEN_KEY);
        if (!intentionalClose && token) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 16000);
          reconnectAttempts++;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => get().connect(), delay);
        }
      };
      socket.onerror = () => {
        if (connectTimer) clearTimeout(connectTimer);
        pendingAuth = null;
        set({ notice: 'Нет связи с сервером', status: 'idle', busy: false });
      };
    },

    connectWallet: async () => {
      set({ busy: true, authError: null });
      const wallet = useWalletStore.getState();
      await wallet.connect();
      const address = useWalletStore.getState().address;
      if (!address) {
        set({ busy: false, authError: useWalletStore.getState().error ?? 'Кошелёк не подключён' });
        return;
      }
      set({ walletAddress: address });
      authOrQueue({ t: 'auth:nonce', walletAddress: address });
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      intentionalClose = true; // явный выход — не переподключаемся
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempts = 0;
      sendMsg({ t: 'table:leave' });
      useWalletStore.getState().disconnect();
      set({
        user: null,
        table: null,
        game: null,
        view: 'auth',
        lobby: [],
        online: [],
        friends: [],
        invites: [],
        walletAddress: null,
      });
    },

    setName: (name) => sendMsg({ t: 'profile:setName', name }),
    refreshLobby: () => sendMsg({ t: 'lobby:subscribe' }),
    createTable: (name, maxPlayers, password, betLamports) => {
      set({ busy: true });
      sendMsg({
        t: 'table:create',
        name,
        maxPlayers,
        password: password || undefined,
        betLamports: betLamports || undefined,
      });
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
    registerWallet: (address: string) => {
      set({ walletAddress: address });
      sendMsg({ t: 'wallet:register', walletAddress: address });
    },
    payBet: (tableId: string, signature: string) => {
      sendMsg({ t: 'wallet:pay', tableId, signature });
    },
    invitePlayer: (toUserId: string) => {
      const t = get().table;
      if (t) sendMsg({ t: 'invite:send', tableId: t.id, toUserId });
    },
    inviteAll: () => {
      const t = get().table;
      if (t) {
        sendMsg({ t: 'invite:all', tableId: t.id });
        set({ notice: 'Приглашения разосланы всем в сети' });
      }
    },
    addFriend: (userId: string) => sendMsg({ t: 'friend:add', userId }),
    removeFriend: (userId: string) => sendMsg({ t: 'friend:remove', userId }),
    acceptInvite: (invite: Invite) => {
      set((s) => ({ invites: s.invites.filter((i) => i.tableId !== invite.tableId), busy: true }));
      sendMsg({ t: 'table:join', tableId: invite.tableId });
    },
    dismissInvite: (tableId: string) =>
      set((s) => ({ invites: s.invites.filter((i) => i.tableId !== tableId) })),
  };
});
