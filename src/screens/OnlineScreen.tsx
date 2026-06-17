import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GoatEmblem } from '../components/GoatEmblem';
import { PremiumButton } from '../components/PremiumButton';
import { WalletButton } from '../components/WalletButton';
import { OnlineGameScreen } from './OnlineGameScreen';
import { useOnlineStore } from '../net/onlineStore';
import { useWalletStore } from '../solana/walletStore';
import type { LobbyTable, OnlineUser } from '../net/protocol';

interface Props {
  onBack: () => void;
}

function short(addr: string): string {
  return addr.length <= 9 ? addr : `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function OnlineScreen({ onBack }: Props) {
  const view = useOnlineStore((s) => s.view);
  const connect = useOnlineStore((s) => s.connect);
  const notice = useOnlineStore((s) => s.notice);
  const clearNotice = useOnlineStore((s) => s.clearNotice);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 2600);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  return (
    <div className="relative min-h-[100dvh]">
      {view === 'auth' && <WalletConnectView onBack={onBack} />}
      {view === 'lobby' && <LobbyView onBack={onBack} />}
      {view === 'table' && <WaitingRoom />}
      {view === 'game' && <OnlineGameScreen />}

      {/* входящие приглашения — поверх любого экрана */}
      <InviteToasts />

      {/* всплывающее уведомление */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="pointer-events-none fixed left-1/2 top-6 z-50 w-[88%] max-w-sm -translate-x-1/2"
          >
            <div className="glass-strong rounded-2xl px-4 py-3 text-center text-sm text-white/90">
              {notice}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Назад"
          className="glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 font-display text-2xl tracking-wide gold-text">{title}</h1>
      {right}
    </div>
  );
}

// ─── Вход через кошелёк ────────────────────────────────────────────
function WalletConnectView({ onBack }: { onBack: () => void }) {
  const connectWallet = useOnlineStore((s) => s.connectWallet);
  const authError = useOnlineStore((s) => s.authError);
  const busy = useOnlineStore((s) => s.busy);
  const connecting = useWalletStore((s) => s.connecting);
  const hasProvider = typeof window !== 'undefined' && (window.solana || window.solflare);

  const working = busy || connecting;

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-8 safe-top safe-bottom">
      <Header title="Онлайн" onBack={onBack} />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-6 grid h-24 w-24 place-items-center rounded-3xl glass-strong"
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gold-sheen opacity-20 blur-xl" />
          <GoatEmblem size={62} />
        </motion.div>

        <h2 className="font-display text-3xl gold-text">Играй на SOL</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/55">
          Децентрализованная площадка. Подключи кошелёк Solana — без регистраций и паролей.
          Ставка в SOL, банк забирает победитель.
        </p>

        <div className="mt-8 w-full max-w-xs">
          <PremiumButton full onClick={connectWallet} disabled={working}>
            <span className="flex items-center justify-center gap-2">
              <SolMark />
              {working ? 'Подключение…' : 'Подключить кошелёк'}
            </span>
          </PremiumButton>

          {authError && <p className="mt-3 text-center text-xs text-wine-400">{authError}</p>}

          {!hasProvider && (
            <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
              Нет кошелька?{' '}
              <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-gold-400/80 underline">
                Установить Phantom
              </a>{' '}
              или{' '}
              <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" className="text-gold-400/80 underline">
                Solflare
              </a>
            </p>
          )}
          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/30">
            Подпись входа бесплатна и не списывает средства.
          </p>
        </div>
      </div>
    </div>
  );
}

function SolMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6.5 15.5h9.3l-2.3 2.5H6.5l2.3-2.5zm0-4.5h11l-2.3 2.5H6.5L8.8 11zm2.3-4.5h9.3L15.8 9H6.5l2.3-2.5z" fill="currentColor" />
    </svg>
  );
}

// ─── Лобби ─────────────────────────────────────────────────────────
function LobbyView({ onBack }: { onBack: () => void }) {
  const lobby = useOnlineStore((s) => s.lobby);
  const user = useOnlineStore((s) => s.user);
  const online = useOnlineStore((s) => s.online);
  const friends = useOnlineStore((s) => s.friends);
  const refreshLobby = useOnlineStore((s) => s.refreshLobby);
  const joinTable = useOnlineStore((s) => s.joinTable);
  const addFriend = useOnlineStore((s) => s.addFriend);
  const removeFriend = useOnlineStore((s) => s.removeFriend);
  const logout = useOnlineStore((s) => s.logout);
  const balance = useWalletStore((s) => s.balance);
  const [creating, setCreating] = useState(false);
  const [joinTarget, setJoinTarget] = useState<LobbyTable | null>(null);
  const [editName, setEditName] = useState(false);

  useEffect(() => {
    refreshLobby();
  }, [refreshLobby]);

  const friendIds = new Set(friends.map((f) => f.id));

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-8 safe-top safe-bottom">
      <Header
        title="Столы"
        onBack={onBack}
        right={
          <button
            onClick={logout}
            className="glass grid h-10 w-10 place-items-center rounded-xl text-white/55 transition active:scale-95 hover:text-wine-400"
            aria-label="Отключить кошелёк"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      {/* профиль игрока */}
      <button
        onClick={() => setEditName(true)}
        className="-mt-2 mb-4 flex items-center gap-3 rounded-2xl glass px-4 py-3 text-left transition active:scale-[0.99]"
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gold-sheen text-ink-900 font-display text-lg shadow-glow">
          {(user?.name.trim()[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white/90">{user?.name}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/40">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[11px] text-gold-400/70">
            {balance !== null ? `${balance.toFixed(3)} SOL` : 'Кошелёк подключён'}
          </span>
        </div>
      </button>

      <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar pb-2">
        <SectionLabel>Открытые столы</SectionLabel>
        {lobby.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-white/35">
            Пока нет открытых столов.
            <br />
            Создайте первый!
          </div>
        )}
        {lobby.map((tbl) => (
          <motion.button
            key={tbl.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              if (tbl.status !== 'waiting' || tbl.players >= tbl.maxPlayers) return;
              if (tbl.hasPassword) setJoinTarget(tbl);
              else joinTable(tbl.id);
            }}
            disabled={tbl.status !== 'waiting' || tbl.players >= tbl.maxPlayers}
            className="flex w-full items-center justify-between rounded-2xl glass px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-45"
          >
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium text-white/90">
                {tbl.hasPassword && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 text-gold-500/70">
                    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {tbl.name}
              </span>
              <span className="flex items-center gap-2 text-[11px] text-white/40">
                {tbl.status === 'playing'
                  ? 'Партия идёт'
                  : tbl.players >= tbl.maxPlayers
                    ? 'Стол заполнен'
                    : `${tbl.players} в столе · ждут ещё ${tbl.maxPlayers - tbl.players}`}
                {!!tbl.betLamports && tbl.betLamports > 0 && (
                  <span className="font-medium text-gold-300">⬙ {(tbl.betLamports / 1e9).toFixed(3)} SOL</span>
                )}
              </span>
            </span>
            <span className="ml-3 shrink-0 rounded-full bg-white/[0.05] px-3 py-1 text-xs text-gold-300">
              {tbl.players}/{tbl.maxPlayers}
            </span>
          </motion.button>
        ))}

        {/* Игроки в сети */}
        <SectionLabel>
          В сети{online.length > 0 ? ` · ${online.length}` : ''}
        </SectionLabel>
        {online.length === 0 ? (
          <p className="px-1 text-[12px] text-white/30">Сейчас никого нет. Позовите друзей!</p>
        ) : (
          online.map((u) => (
            <PlayerRow
              key={u.id}
              player={u}
              isFriend={friendIds.has(u.id)}
              onToggleFriend={() => (friendIds.has(u.id) ? removeFriend(u.id) : addFriend(u.id))}
            />
          ))
        )}
      </div>

      <div className="pt-4">
        <PremiumButton full onClick={() => setCreating(true)}>
          Создать стол
        </PremiumButton>
      </div>

      <AnimatePresence>
        {creating && <CreateTableModal onClose={() => setCreating(false)} />}
        {joinTarget && <JoinPasswordModal table={joinTarget} onClose={() => setJoinTarget(null)} />}
        {editName && <EditNameModal current={user?.name ?? ''} onClose={() => setEditName(false)} />}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pt-3 text-[11px] uppercase tracking-[0.25em] text-white/35">{children}</p>
  );
}

/** Строка игрока в сети: статус + кнопка избранного и опц. приглашения. */
function PlayerRow({
  player,
  isFriend,
  onToggleFriend,
  onInvite,
}: {
  player: OnlineUser;
  isFriend: boolean;
  onToggleFriend: () => void;
  onInvite?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl glass px-3.5 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05] border border-white/10 font-display text-sm text-gold-300">
        {(player.name.trim()[0] ?? '?').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/85">{player.name}</div>
        <div className="text-[11px] text-white/40">
          {player.inGame ? (
            <span className="text-wine-400/80">в игре</span>
          ) : (
            <span className="text-emerald-400/80">свободен</span>
          )}
          {' · '}
          {short(player.id)}
        </div>
      </div>
      {onInvite && !player.inGame && (
        <button
          onClick={onInvite}
          className="rounded-xl bg-gold-sheen px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-glow transition active:scale-95"
        >
          Позвать
        </button>
      )}
      <button
        onClick={onToggleFriend}
        aria-label={isFriend ? 'Убрать из друзей' : 'В друзья'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/40 transition active:scale-90 hover:text-gold-300"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isFriend ? 'currentColor' : 'none'} className={isFriend ? 'text-gold-400' : ''}>
          <path d="M12 17.3l-5.4 3.3 1.5-6.1L3 10.3l6.2-.5L12 4l2.8 5.8 6.2.5-5.1 4.2 1.5 6.1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

const SOL_PRESETS = [0.01, 0.05, 0.1, 0.5];

function CreateTableModal({ onClose }: { onClose: () => void }) {
  const createTable = useOnlineStore((s) => s.createTable);
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useBet, setUseBet] = useState(false);
  const [solAmount, setSolAmount] = useState(0.01);

  const handleCreate = () => {
    const betLamports = useBet ? Math.round(solAmount * 1e9) : undefined;
    createTable(name, maxPlayers, usePassword ? password : undefined, betLamports);
  };

  return (
    <Modal onClose={onClose} title="Новый стол">
      <div className="space-y-3">
        <Field label="Название" value={name} onChange={setName} placeholder="Например: Вечерняя партия" />
        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-widest text-white/40">Игроков</span>
          <div className="flex gap-2">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                className={`flex-1 rounded-2xl border py-3 text-sm font-medium transition-colors ${
                  maxPlayers === n
                    ? 'border-gold-500/40 bg-gold-500/10 text-gold-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/55'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Ставка SOL */}
        <label className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-white/80">
            <SolMark />
            Ставка SOL
          </span>
          <button
            onClick={() => setUseBet((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${useBet ? 'bg-[#9945ff]/70' : 'bg-white/15'}`}
          >
            <motion.span
              animate={{ x: useBet ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="absolute top-1 h-4 w-4 rounded-full bg-white"
            />
          </button>
        </label>

        <AnimatePresence>
          {useBet && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <span className="mb-1.5 block text-[11px] uppercase tracking-widest text-white/40">Размер ставки (SOL)</span>
              <div className="flex gap-2">
                {SOL_PRESETS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSolAmount(v)}
                    className={`flex-1 rounded-2xl border py-2.5 text-xs font-medium transition-colors ${
                      solAmount === v
                        ? 'border-[#9945ff]/50 bg-[#9945ff]/10 text-[#c4a5ff]'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/55'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/30">
                Банк: {(solAmount * maxPlayers).toFixed(3)} SOL · победителю −5% комиссии
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                💡 Ставка работает только если все {maxPlayers} места заняты живыми игроками
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <label className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-white/80">Закрыть паролем</span>
          <button
            onClick={() => setUsePassword((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${usePassword ? 'bg-gold-600' : 'bg-white/15'}`}
          >
            <motion.span
              animate={{ x: usePassword ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="absolute top-1 h-4 w-4 rounded-full bg-white"
            />
          </button>
        </label>
        {usePassword && (
          <Field label="Пароль стола" value={password} onChange={setPassword} placeholder="Скажите друзьям" type="password" />
        )}
      </div>
      <div className="mt-5">
        <PremiumButton full onClick={handleCreate} disabled={usePassword && password.length < 1}>
          Создать
        </PremiumButton>
      </div>
    </Modal>
  );
}

function JoinPasswordModal({ table, onClose }: { table: LobbyTable; onClose: () => void }) {
  const joinTable = useOnlineStore((s) => s.joinTable);
  const [password, setPassword] = useState('');
  return (
    <Modal onClose={onClose} title="Пароль стола">
      <p className="mb-4 text-xs text-white/45">Стол «{table.name}» защищён паролем.</p>
      <Field
        label="Пароль"
        value={password}
        onChange={setPassword}
        type="password"
        placeholder="Введите пароль"
        onEnter={() => joinTable(table.id, password)}
      />
      <div className="mt-5">
        <PremiumButton full onClick={() => joinTable(table.id, password)} disabled={!password}>
          Войти за стол
        </PremiumButton>
      </div>
    </Modal>
  );
}

function EditNameModal({ current, onClose }: { current: string; onClose: () => void }) {
  const setName = useOnlineStore((s) => s.setName);
  const [value, setValue] = useState(current);
  const save = () => {
    if (value.trim()) setName(value.trim());
    onClose();
  };
  return (
    <Modal onClose={onClose} title="Ваше имя">
      <p className="mb-4 text-xs text-white/45">Так вас будут видеть другие игроки за столом и в сети.</p>
      <Field label="Имя" value={value} onChange={setValue} placeholder="До 20 символов" onEnter={save} />
      <div className="mt-5">
        <PremiumButton full onClick={save}>
          Сохранить
        </PremiumButton>
      </div>
    </Modal>
  );
}

// ─── Комната ожидания ──────────────────────────────────────────────
function WaitingRoom() {
  const table = useOnlineStore((s) => s.table);
  const user = useOnlineStore((s) => s.user);
  const online = useOnlineStore((s) => s.online);
  const friends = useOnlineStore((s) => s.friends);
  const serverWallet = useOnlineStore((s) => s.serverWallet);
  const registerWallet = useOnlineStore((s) => s.registerWallet);
  const startGame = useOnlineStore((s) => s.startGame);
  const leaveTable = useOnlineStore((s) => s.leaveTable);
  const payBet = useOnlineStore((s) => s.payBet);
  const invitePlayer = useOnlineStore((s) => s.invitePlayer);
  const inviteAll = useOnlineStore((s) => s.inviteAll);

  const walletAddress = useWalletStore((s) => s.address);
  const sendBet = useWalletStore((s) => s.sendBet);

  const [paying, setPaying] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  if (!table) return null;
  const isHost = table.hostId === user?.id;
  const humanCount = table.seats.filter((s) => s.userId).length;
  const mySeat = table.seats.find((s) => s.userId === user?.id);
  const myPaid = mySeat?.paid ?? false;
  const hasBet = !!table.betLamports && table.betLamports > 0;
  const emptySeats = table.seats.filter((s) => !s.userId).length;
  const needsHumans = hasBet && emptySeats > 0;

  // Кого можно позвать: онлайн + друзья, кто не сидит за этим столом и не в игре.
  const seatedIds = new Set(table.seats.map((s) => s.userId).filter(Boolean) as string[]);
  const invitable = [...friends, ...online].filter(
    (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i && !seatedIds.has(u.id) && !u.inGame,
  );

  const handlePay = async () => {
    if (!walletAddress || !serverWallet || !table.betLamports) return;
    setPaying(true);
    try {
      if (!mySeat?.walletAddress) registerWallet(walletAddress);
      const sig = await sendBet(serverWallet, table.betLamports);
      payBet(table.id, sig);
    } catch (e) {
      console.error('Ошибка оплаты:', e);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-8 safe-top safe-bottom">
      <Header title={table.name} onBack={leaveTable} />
      <p className="-mt-3 mb-5 flex items-center gap-2 text-xs text-white/40">
        {table.hasPassword && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-gold-500/70">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        Комната ожидания · {humanCount}/{table.maxPlayers}
        {hasBet && (
          <span className="ml-1 font-medium text-gold-300">· ⬙ {(table.betLamports! / 1e9).toFixed(3)} SOL</span>
        )}
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar">
        {table.seats.map((seat, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${
              seat.userId ? 'glass' : 'border border-dashed border-white/10 bg-transparent'
            }`}
          >
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.05] border border-white/10">
              {seat.userId ? (
                <span className="font-display text-lg gold-text">{(seat.name.trim()[0] ?? '?').toUpperCase()}</span>
              ) : (
                <span className="text-white/25 text-lg">+</span>
              )}
            </div>
            <span className="flex flex-1 flex-col">
              <span className={`text-sm ${seat.userId ? 'text-white/85' : 'text-white/35'}`}>
                {seat.userId ? seat.name : 'Свободное место'}
              </span>
              {seat.userId === table.hostId && <span className="text-[11px] text-gold-500/70">Хозяин стола</span>}
            </span>
            {hasBet && seat.userId && !seat.isBot && (
              <span className={`text-[11px] font-medium ${seat.paid ? 'text-emerald-400' : 'text-white/30'}`}>
                {seat.paid ? '✓ оплачено' : '⏳ не оплачено'}
              </span>
            )}
          </div>
        ))}

        {/* приглашения (только хозяин) */}
        {isHost && emptySeats > 0 && (
          <div className="rounded-2xl glass px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/75">Пригласить игроков</span>
              <button onClick={inviteAll} className="rounded-xl bg-gold-sheen px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-glow transition active:scale-95">
                Позвать всех
              </button>
            </div>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="mt-2 text-[12px] text-gold-300/80 underline-offset-2 hover:underline"
            >
              {showInvite ? 'Скрыть список' : `Выбрать из тех, кто в сети (${invitable.length})`}
            </button>
            <AnimatePresence>
              {showInvite && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1.5 overflow-hidden"
                >
                  {invitable.length === 0 ? (
                    <p className="text-[12px] text-white/30">Сейчас некого позвать.</p>
                  ) : (
                    invitable.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="flex items-center gap-1.5 text-sm text-white/80">
                          {u.isFriend && <span className="text-gold-400">★</span>}
                          {u.name}
                        </span>
                        <button
                          onClick={() => invitePlayer(u.id)}
                          className="rounded-lg bg-white/[0.06] px-3 py-1 text-xs text-gold-300 transition active:scale-95 hover:bg-white/[0.1]"
                        >
                          Позвать
                        </button>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {hasBet && !myPaid && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#9945ff]/25 bg-[#9945ff]/5 px-4 py-3"
          >
            <p className="mb-2 text-xs text-white/60">
              Для участия переведите {(table.betLamports! / 1e9).toFixed(3)} SOL в банк партии.
            </p>
            {walletAddress ? (
              <PremiumButton full onClick={handlePay} disabled={paying}>
                {paying ? 'Подтвердите в кошельке…' : `Оплатить ${(table.betLamports! / 1e9).toFixed(3)} SOL`}
              </PremiumButton>
            ) : (
              <WalletButton />
            )}
          </motion.div>
        )}

        {needsHumans && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-wine-600/25 bg-wine-600/5 px-4 py-3"
          >
            <p className="text-xs text-wine-400/80">
              ⚠ Ставка SOL — только среди людей. Свободных мест: {emptySeats}. Пригласите игроков.
            </p>
          </motion.div>
        )}

        <p className="px-1 pt-2 text-[11px] leading-relaxed text-white/30">
          {hasBet
            ? 'Ставки только среди живых игроков — все места должны быть заняты.'
            : 'Свободные места при старте займут боты. Хозяин стола начинает партию.'}
        </p>
      </div>

      <div className="space-y-3 pt-4">
        {isHost ? (
          <PremiumButton full onClick={startGame} disabled={needsHumans || (hasBet && !myPaid)}>
            Начать партию
          </PremiumButton>
        ) : (
          <div className="rounded-2xl glass px-4 py-3.5 text-center text-sm text-white/55">
            Ждём, пока хозяин начнёт партию…
          </div>
        )}
        <PremiumButton full variant="ghost" onClick={leaveTable}>
          Покинуть стол
        </PremiumButton>
      </div>
    </div>
  );
}

// ─── Входящие приглашения ──────────────────────────────────────────
function InviteToasts() {
  const invites = useOnlineStore((s) => s.invites);
  const acceptInvite = useOnlineStore((s) => s.acceptInvite);
  const dismissInvite = useOnlineStore((s) => s.dismissInvite);
  const view = useOnlineStore((s) => s.view);

  // Не мешаем во время самой партии.
  if (view === 'game') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {invites.map((inv) => (
          <motion.div
            key={inv.tableId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="pointer-events-auto w-full max-w-sm rounded-2xl glass-strong p-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-sheen text-lg shadow-glow">
                🎴
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/90">
                  <span className="font-medium text-gold-300">{inv.fromName}</span> зовёт за стол
                </p>
                <p className="truncate text-[12px] text-white/50">
                  «{inv.tableName}»
                  {!!inv.betLamports && inv.betLamports > 0 && (
                    <span className="text-gold-300"> · ⬙ {(inv.betLamports / 1e9).toFixed(3)} SOL</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => acceptInvite(inv)}
                className="flex-1 rounded-xl bg-gold-sheen py-2.5 text-sm font-semibold text-ink-900 shadow-glow transition active:scale-95"
              >
                Войти
              </button>
              <button
                onClick={() => dismissInvite(inv.tableId)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/60 transition active:scale-95"
              >
                Позже
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  onEnter?: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-widest text-white/40">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-gold-500/40"
      />
    </label>
  );
}

function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl glass-strong p-6 safe-bottom sm:rounded-3xl"
      >
        <h3 className="mb-4 font-display text-xl gold-text">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}
