import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType, GameState, Suit } from '../game/types';
import { canPlayCard, hasPlayableCard } from '../game/rules';
import { SUITS, SUIT_IS_RED, SUIT_LABEL, SUIT_SYMBOL } from '../game/deck';
import { getTakeLabel } from '../game/labels';
import { GameTable } from '../components/GameTable';
import { PlayerHand } from '../components/PlayerHand';
import { ScoreBoard } from '../components/ScoreBoard';
import { PremiumButton } from '../components/PremiumButton';
import { GoatEmblem } from '../components/GoatEmblem';
import { useGameStore } from '../store/gameStore';

interface Props {
  onExit: () => void;
}

export function GameScreen({ onExit }: Props) {
  const game = useGameStore((s) => s.game);
  const playCard = useGameStore((s) => s.playCard);
  const take = useGameStore((s) => s.take);
  const nextRound = useGameStore((s) => s.nextRound);
  const start = useGameStore((s) => s.start);

  const [queenCard, setQueenCard] = useState<CardType | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Тост на яркие события (спец-карты, штрафы, победы).
  useEffect(() => {
    if (!game) return;
    const last = game.log[0];
    if (last && last.kind !== 'info') {
      setToast({ id: last.id, text: last.text });
      const t = setTimeout(() => setToast(null), 2200);
      return () => clearTimeout(t);
    }
  }, [game?.log[0]?.id]);

  if (!game) return null;

  const human = game.players.find((p) => p.id === 'you')!;
  const current = game.players[game.currentPlayerIndex];
  const yourTurn = current.id === 'you' && game.phase === 'playing';
  const isPlayable = (card: CardType) => canPlayCard(game, card);
  const canPlayAny = hasPlayableCard(game, human.hand);
  const takeLabel = getTakeLabel(game, canPlayAny);

  const onPlay = (card: CardType) => {
    if (card.rank === 'Q') setQueenCard(card);
    else playCard(card.id);
  };

  const chooseSuit = (suit: Suit) => {
    if (queenCard) playCard(queenCard.id, suit);
    setQueenCard(null);
  };

  const handleBack = () => {
    if (game.phase === 'playing') setConfirmExit(true);
    else onExit();
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden px-3 pt-3 safe-top">
      {/* верхняя панель */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={handleBack}
          aria-label="Выйти в меню"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-wide gold-text">Раунд {game.roundNumber}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Crazy 8</div>
        </div>
        <button
          onClick={() => setShowScore(true)}
          aria-label="Показать счёт и события"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-gold-400 transition active:scale-95 hover:text-gold-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <GameTable state={game} />

      {/* статус хода */}
      <div className="relative mt-2 flex min-h-[2.25rem] shrink-0 items-center justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${yourTurn}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-full px-4 py-1.5 text-center text-sm"
          >
            {yourTurn ? (
              <span className="text-gold-300">
                {takeLabel.prompt ?? 'Ваш ход — выберите карту'}
              </span>
            ) : (
              <span className="text-white/60">Ходит {current.name}…</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* рука игрока */}
      <div className="relative mt-1 shrink-0">
        <AnimatePresence>
          {yourTurn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-full bg-gold-500/25 blur-2xl"
            />
          )}
        </AnimatePresence>
        <PlayerHand
          cards={human.hand}
          isPlayable={isPlayable}
          onPlay={onPlay}
          yourTurn={yourTurn}
        />
      </div>

      {/* действия */}
      <div className="mt-2 flex shrink-0 items-center justify-center gap-3 px-3 pb-1 safe-bottom">
        <PremiumButton
          variant="ghost"
          disabled={!yourTurn}
          onClick={take}
          className="min-w-[10rem]"
        >
          {takeLabel.button}
        </PremiumButton>
      </div>

      {/* тост события */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="pointer-events-none absolute left-1/2 top-20 z-30 w-[88%] max-w-sm -translate-x-1/2"
          >
            <div className="glass-strong rounded-2xl px-4 py-3 text-center text-sm text-white/90">
              {toast.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* выбор масти дамой */}
      <AnimatePresence>
        {queenCard && (
          <SuitChooser onChoose={chooseSuit} onCancel={() => setQueenCard(null)} />
        )}
      </AnimatePresence>

      {/* таблица счёта (шторка) */}
      <AnimatePresence>
        {showScore && (
          <Sheet onClose={() => setShowScore(false)}>
            <ScoreBoard state={game} />
            <div className="mt-4 max-h-48 overflow-y-auto no-scrollbar">
              <h4 className="mb-2 text-xs uppercase tracking-widest text-white/40">События</h4>
              <div className="space-y-1.5">
                {game.log.slice(0, 14).map((l) => (
                  <p key={l.id} className={`text-xs ${logColor(l.kind)}`}>
                    {l.text}
                  </p>
                ))}
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* подтверждение выхода */}
      <AnimatePresence>
        {confirmExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6"
            onClick={() => setConfirmExit(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center"
            >
              <h3 className="font-display text-xl gold-text">Выйти в меню?</h3>
              <p className="mb-5 mt-1 text-xs text-white/50">
                Текущая партия не сохранится.
              </p>
              <div className="space-y-3">
                <PremiumButton full variant="danger" onClick={onExit}>
                  Выйти
                </PremiumButton>
                <PremiumButton full variant="ghost" onClick={() => setConfirmExit(false)}>
                  Продолжить игру
                </PremiumButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* конец раунда */}
      <AnimatePresence>
        {game.phase === 'roundOver' && game.roundResults && (
          <RoundOverlay state={game} onNext={nextRound} />
        )}
      </AnimatePresence>

      {/* конец партии */}
      <AnimatePresence>
        {game.phase === 'gameOver' && (
          <GameOverOverlay
            state={game}
            won={game.winnerId === 'you'}
            onMenu={onExit}
            onRestart={start}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SuitChooser({ onChoose, onCancel }: { onChoose: (s: Suit) => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm px-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center"
      >
        <GoatEmblem size={40} className="mx-auto mb-2" />
        <h3 className="font-display text-xl gold-text">Выберите масть</h3>
        <p className="mb-5 mt-1 text-xs text-white/50">Дама меняет масть на столе</p>
        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((s) => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.04 }}
              onClick={() => onChoose(s)}
              className="glass flex flex-col items-center gap-1 rounded-2xl py-4"
            >
              <span className={`text-3xl ${SUIT_IS_RED[s] ? 'text-[#d98a93]' : 'text-white'}`}>
                {SUIT_SYMBOL[s]}
              </span>
              <span className="text-xs text-white/60">{SUIT_LABEL[s]}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full rounded-t-3xl p-5 safe-bottom"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        {children}
      </motion.div>
    </motion.div>
  );
}

function CountUp({ from, to, duration = 0.8, delay = 0 }: { from: number; to: number; duration?: number; delay?: number }) {
  const [display, setDisplay] = useState(from);
  useEffect(() => {
    let start: number;
    let raf: number;
    const startTime = performance.now() + delay * 1000;
    const tick = (now: number) => {
      if (now < startTime) { raf = requestAnimationFrame(tick); return; }
      if (!start) start = now;
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration, delay]);
  return <>{display}</>;
}

function RoundOverlay({ state, onNext }: { state: GameState; onNext: () => void }) {
  const results = state.roundResults!;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 grid place-items-center bg-black/75 backdrop-blur-md px-6"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="glass-strong w-full max-w-sm rounded-3xl p-6"
      >
        <p className="mb-1 text-center text-[11px] uppercase tracking-[0.3em] text-gold-500/60">
          Раунд {state.roundNumber}
        </p>
        <h2 className="mb-4 text-center font-display text-2xl gold-text">Раунд завершён</h2>
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg gold-text">Счёт</h3>
            <span className="text-[11px] text-white/50">Лимит {state.settings.scoreLimit}</span>
          </div>
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <motion.div
                key={r.playerId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.12 }}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  r.busted ? 'bg-wine-700/20' : 'bg-white/[0.03]'
                }`}
              >
                <span className={`text-sm ${r.busted ? 'text-wine-400 line-through' : 'text-white/85'}`}>
                  {r.name}
                </span>
                <span className="flex items-center gap-2">
                  {r.gained > 0 && (
                    <span className="text-[11px] text-wine-400">
                      +<CountUp from={0} to={r.gained} delay={0.25 + i * 0.12} />
                    </span>
                  )}
                  {r.reset && <span className="text-[11px] text-emerald-300">обнулён</span>}
                  {r.busted && <span className="text-[11px] text-wine-400">улетел</span>}
                  <span className="font-display text-lg text-gold-300">
                    <CountUp from={r.total - r.gained} to={r.total} delay={0.4 + i * 0.12} />
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <PremiumButton full onClick={onNext}>
            Следующий раунд
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GameOverOverlay({
  state,
  won,
  onMenu,
  onRestart,
}: {
  state: GameState;
  won: boolean;
  onMenu: () => void;
  onRestart: () => void;
}) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden px-6"
    >
      <div className={`absolute inset-0 ${won ? 'bg-felt-radial' : 'bg-ink-900'}`} />
      <div className="absolute inset-0 bg-black/55" />
      {won && <Confetti />}

      {/* пульсирующий ореол за баннером победы */}
      {won && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(153,69,255,0.55), rgba(25,214,138,0.22) 55%, transparent 72%)' }}
        />
      )}

      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="glass-strong relative w-full max-w-sm rounded-3xl p-7 text-center"
      >
        <div className="relative mx-auto mb-3 grid h-28 w-28 place-items-center">
          {/* вращающийся орб-награда за эмблемой (место под сумму SOL в онлайне) */}
          {won && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full table-ring animate-spin-slow opacity-80"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-2 rounded-full blur-xl animate-halo"
                style={{ background: 'radial-gradient(circle, rgba(153,69,255,0.5), transparent 70%)' }}
              />
            </>
          )}
          <motion.div
            animate={won ? { rotate: [0, -6, 6, 0], y: [0, -4, 0] } : {}}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="relative grid h-24 w-24 place-items-center rounded-3xl glass"
          >
            {won ? <Trophy size={60} /> : <GoatEmblem size={64} />}
          </motion.div>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">
          {won ? 'Победа' : 'Партия окончена'}
        </p>
        <h2 className="mt-1 font-display text-4xl">
          {won ? <span className="gold-text">Вы выиграли!</span> : <span className="text-white/90">Вы проиграли</span>}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {won
            ? 'Вы остались последним, кто не «улетел».'
            : `Победитель — ${winner?.name ?? '—'}.`}
        </p>

        <div className="mt-5 space-y-3">
          <PremiumButton full onClick={onRestart}>
            Новая партия
          </PremiumButton>
          <PremiumButton full variant="ghost" onClick={onMenu}>
            В меню
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Trophy({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="drop-shadow-[0_4px_12px_rgba(153,69,255,0.5)]">
      <defs>
        <linearGradient id="trophyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8c7ff" />
          <stop offset="0.5" stopColor="#9945ff" />
          <stop offset="1" stopColor="#19d68a" />
        </linearGradient>
      </defs>
      <g stroke="url(#trophyGrad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12v4.5a6 6 0 0 1-12 0V4Z" fill="url(#trophyGrad)" fillOpacity="0.14" />
        <path d="M6 6H4a2.5 2.5 0 0 0 0 5h2.4" />
        <path d="M18 6h2a2.5 2.5 0 0 1 0 5h-2.4" />
        <path d="M12 14.5V18" />
        <path d="M8.5 21h7" />
        <path d="M9.5 21c0-1.8 1-2.8 2.5-2.8s2.5 1 2.5 2.8" />
      </g>
    </svg>
  );
}

function Confetti() {
  const palette = ['#c4a5ff', '#9945ff', '#19d68a', '#d8c7ff', '#f5efe0'];
  const pieces = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 1.6,
        dur: 2.6 + Math.random() * 2.4,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 60,
        size: 4 + Math.random() * 5,
        round: Math.random() > 0.55,
        color: palette[i % palette.length],
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: p.rot }}
          animate={{ y: '112vh', x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rot + 540 }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeIn' }}
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.7,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            boxShadow: `0 0 6px ${p.color}88`,
          }}
          className="absolute top-0"
        />
      ))}
    </div>
  );
}

function logColor(kind: string): string {
  if (kind === 'special') return 'text-gold-300/90';
  if (kind === 'penalty') return 'text-wine-400/90';
  if (kind === 'win') return 'text-emerald-300/90';
  return 'text-white/55';
}
