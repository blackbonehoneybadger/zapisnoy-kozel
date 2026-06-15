import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GoatEmblem } from '../components/GoatEmblem';
import { PremiumButton } from '../components/PremiumButton';
import { OnlineGameScreen } from './OnlineGameScreen';
import { useOnlineStore } from '../net/onlineStore';
import type { LobbyTable } from '../net/protocol';

interface Props {
  onBack: () => void;
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
      {view === 'auth' && <AuthView onBack={onBack} />}
      {view === 'lobby' && <LobbyView onBack={onBack} />}
      {view === 'table' && <WaitingRoom />}
      {view === 'game' && <OnlineGameScreen />}

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

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
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
      <h1 className="font-display text-2xl tracking-wide gold-text">{title}</h1>
    </div>
  );
}

function AuthView({ onBack }: { onBack: () => void }) {
  const register = useOnlineStore((s) => s.register);
  const login = useOnlineStore((s) => s.login);
  const authError = useOnlineStore((s) => s.authError);
  const busy = useOnlineStore((s) => s.busy);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const tooShort = mode === 'register' && password.length > 0 && password.length < 4;

  const submit = () => {
    if (!name.trim() || password.length < 4 || busy) return;
    if (mode === 'login') login(name.trim(), password);
    else register(name.trim(), password);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-8 safe-top safe-bottom">
      <Header title="Онлайн" onBack={onBack} />

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-3xl glass-strong">
          <GoatEmblem size={56} />
        </div>

        <div className="w-full max-w-xs">
          {/* переключатель вход / регистрация */}
          <div className="mb-5 flex rounded-2xl glass p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  mode === m ? 'text-ink-900' : 'text-white/55'
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="authTab"
                    className="absolute inset-0 rounded-xl bg-gold-sheen"
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  />
                )}
                <span className="relative">{m === 'login' ? 'Вход' : 'Регистрация'}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Field label="Имя" value={name} onChange={setName} placeholder="Как вас зовут" />
            <Field
              label="Пароль"
              value={password}
              onChange={setPassword}
              placeholder="Минимум 4 символа"
              type="password"
              onEnter={submit}
            />
          </div>

          {tooShort && (
            <p className="mt-3 text-center text-xs text-white/40">Пароль — минимум 4 символа</p>
          )}
          {authError && <p className="mt-3 text-center text-xs text-wine-400">{authError}</p>}

          <div className="mt-5">
            <PremiumButton full onClick={submit} disabled={busy || !name.trim() || password.length < 4}>
              {busy ? 'Подключение…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </PremiumButton>
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/30">
            Аккаунт нужен, чтобы садиться за столы с другими игроками.
          </p>
        </div>
      </div>
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

function LobbyView({ onBack }: { onBack: () => void }) {
  const lobby = useOnlineStore((s) => s.lobby);
  const user = useOnlineStore((s) => s.user);
  const refreshLobby = useOnlineStore((s) => s.refreshLobby);
  const joinTable = useOnlineStore((s) => s.joinTable);
  const [creating, setCreating] = useState(false);
  const [joinTarget, setJoinTarget] = useState<LobbyTable | null>(null);

  useEffect(() => {
    refreshLobby();
  }, [refreshLobby]);

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-8 safe-top safe-bottom">
      <Header title="Столы" onBack={onBack} />
      <p className="-mt-3 mb-4 text-xs text-white/40">
        {user ? `Вы вошли как ${user.name}` : ''}
      </p>

      <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar">
        {lobby.length === 0 && (
          <div className="mt-16 text-center text-sm text-white/35">
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
              <span className="text-[11px] text-white/40">
                {tbl.status === 'playing'
                  ? 'Партия идёт'
                  : tbl.players >= tbl.maxPlayers
                    ? 'Стол заполнен'
                    : `${tbl.players} в столе · ждут ещё ${tbl.maxPlayers - tbl.players}`}
              </span>
            </span>
            <span className="ml-3 shrink-0 rounded-full bg-white/[0.05] px-3 py-1 text-xs text-gold-300">
              {tbl.players}/{tbl.maxPlayers}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="pt-4">
        <PremiumButton full onClick={() => setCreating(true)}>
          Создать стол
        </PremiumButton>
      </div>

      <AnimatePresence>
        {creating && <CreateTableModal onClose={() => setCreating(false)} />}
        {joinTarget && (
          <JoinPasswordModal table={joinTarget} onClose={() => setJoinTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateTableModal({ onClose }: { onClose: () => void }) {
  const createTable = useOnlineStore((s) => s.createTable);
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');

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
        <PremiumButton
          full
          onClick={() => createTable(name, maxPlayers, usePassword ? password : undefined)}
          disabled={usePassword && password.length < 1}
        >
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

function WaitingRoom() {
  const table = useOnlineStore((s) => s.table);
  const user = useOnlineStore((s) => s.user);
  const startGame = useOnlineStore((s) => s.startGame);
  const leaveTable = useOnlineStore((s) => s.leaveTable);

  if (!table) return null;
  const isHost = table.hostId === user?.id;
  const humanCount = table.seats.filter((s) => s.userId).length;

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
      </p>

      <div className="flex-1 space-y-2.5">
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
            <span className="flex flex-col">
              <span className={`text-sm ${seat.userId ? 'text-white/85' : 'text-white/35'}`}>
                {seat.userId ? seat.name : 'Свободное место'}
              </span>
              {seat.userId === table.hostId && <span className="text-[11px] text-gold-500/70">Хозяин стола</span>}
            </span>
          </div>
        ))}
        <p className="px-1 pt-2 text-[11px] leading-relaxed text-white/30">
          Свободные места при старте займут боты. Хозяин стола начинает партию.
        </p>
      </div>

      <div className="space-y-3 pt-4">
        {isHost ? (
          <PremiumButton full onClick={startGame}>
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

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
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
