// DOFFA Bean Duel — первый рабочий вертикальный прототип. Локальная дуэль
// (устройство vs бот): управление пальцем/мышью — боец следует за
// указателем, кнопка «Рывок» — атака с уклонением (см. engine.ts). Матч
// 60–90 сек, победа не передаёт ставку — чисто skill-based результат.
//
// Экономика: v1 не списывает и не начисляет зёрна/DOFFA за матч Bean Duel —
// это отдельная задача (см. TODO ниже), первый прототип фокусируется на
// самой механике дуэли. Существующие системы (баланс зёрен, кошелёк,
// профиль, награды) не дублируются — Bean Duel их не трогает.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Duelist } from './Duelist';
import { PremiumButton } from '../../components/PremiumButton';
import { haptics } from '../../game/haptics';
import {
  ARENA,
  DASH_COOLDOWN_MS,
  MATCH_DURATION_MS,
  createInitialState,
  stepDuel,
  type DuelInput,
  type DuelState,
  type Vec2,
} from './engine';

interface Props {
  onExit: () => void;
}

export function BeanDuelScreen({ onExit }: Props) {
  const [state, setState] = useState<DuelState>(createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const arenaRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<Vec2 | null>(null);
  const dashQueuedRef = useRef(false);
  const lastHitSeenRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Игровой цикл — requestAnimationFrame, шаг ограничен, чтобы фон-таб не
  // «телепортировал» бойцов огромным dt при возврате на вкладку.
  useEffect(() => {
    const tick = (ts: number) => {
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      const dt = last === null ? 16 : Math.min(48, ts - last);

      const input: DuelInput = {
        target: pointerRef.current,
        dashPressed: dashQueuedRef.current,
      };
      dashQueuedRef.current = false;

      const next = stepDuel(stateRef.current, input, dt);
      stateRef.current = next;
      setState(next);

      if (next.lastHit && next.lastHit.at !== lastHitSeenRef.current) {
        lastHitSeenRef.current = next.lastHit.at;
        haptics.special?.();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toArenaPoint = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const el = arenaRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * ARENA.w;
    const y = ((clientY - rect.top) / rect.height) * ARENA.h;
    return { x, y };
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    pointerRef.current = toArenaPoint(e.clientX, e.clientY);
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerRef.current = toArenaPoint(e.clientX, e.clientY);
  };
  const handlePointerUp = () => {
    pointerRef.current = null;
  };

  const handleDash = () => {
    dashQueuedRef.current = true;
    haptics.tap?.();
  };

  const restart = () => {
    lastTsRef.current = null;
    lastHitSeenRef.current = null;
    const fresh = createInitialState();
    stateRef.current = fresh;
    setState(fresh);
  };

  const player = state.fighters.player;
  const dashReady = player.dashCooldownMs <= 0;
  const dashPct = Math.max(0, Math.min(100, 100 - (player.dashCooldownMs / DASH_COOLDOWN_MS) * 100));
  const secondsLeft = Math.ceil(state.timeLeftMs / 1000);

  return (
    <div className="relative flex min-h-[100dvh] flex-col px-4 pt-3 safe-top safe-bottom">
      {/* шапка */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={onExit}
          aria-label="Выйти из дуэли"
          className="glass grid h-10 w-10 place-items-center rounded-xl text-white/70 transition active:scale-95 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-wide gold-text">DOFFA Bean Duel</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
            {state.phase === 'playing' ? `${secondsLeft} сек` : ' '}
          </div>
        </div>
        <div className="h-10 w-10" />
      </div>

      {/* арена */}
      <div
        ref={arenaRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative mx-auto w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl glass-strong"
        style={{ aspectRatio: `${ARENA.w} / ${ARENA.h}` }}
      >
        {/* фон арены — тёплое кофейное свечение по бренду */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 50% 50%, rgba(224,164,59,0.08), transparent 65%)' }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-4 rounded-2xl border border-white/[0.06]" />

        <Duelist fighter={state.fighters.bot} team="bot" label="Соперник" />
        <Duelist fighter={state.fighters.player} team="player" label="Игрок" />

        {/* обратный отсчёт */}
        <AnimatePresence>
          {state.phase === 'countdown' && (
            <motion.div
              key={Math.ceil(state.countdown)}
              initial={{ opacity: 0, scale: 1.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <span className="font-display text-7xl gold-text">
                {Math.ceil(state.countdown) || 'Бой!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HUD: таймер-полоска + кнопка рывка */}
      <div className="mx-auto mt-4 w-full max-w-sm">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gold-sheen transition-[width] duration-200"
            style={{ width: `${Math.max(0, (state.timeLeftMs / MATCH_DURATION_MS) * 100)}%` }}
          />
        </div>

        <div className="mt-5 flex justify-center">
          <motion.button
            onPointerDown={(e) => {
              e.preventDefault();
              handleDash();
            }}
            whileTap={{ scale: 0.92 }}
            disabled={!dashReady}
            className="relative grid h-20 w-20 place-items-center rounded-full text-sm font-semibold text-ink-900 shadow-glow disabled:opacity-50"
            style={{ background: dashReady ? undefined : 'rgba(255,255,255,0.08)' }}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-gold-sheen"
              style={{ opacity: dashReady ? 1 : 0.25 }}
            />
            <svg
              aria-hidden
              className="absolute inset-0 -rotate-90"
              viewBox="0 0 80 80"
            >
              <circle cx="40" cy="40" r="37" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <circle
                cx="40"
                cy="40"
                r="37"
                fill="none"
                stroke="#f2d9a0"
                strokeWidth="3"
                strokeDasharray={2 * Math.PI * 37}
                strokeDashoffset={2 * Math.PI * 37 * (1 - dashPct / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="relative">РЫВОК</span>
          </motion.button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">
          Веди пальцем по арене · рывок — атака и уклонение
        </p>
      </div>

      {/* итог матча */}
      <AnimatePresence>
        {state.phase === 'over' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-strong w-full max-w-xs rounded-3xl p-7 text-center"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">
                {state.winner === 'draw' ? 'Ничья' : 'Дуэль окончена'}
              </p>
              <h2 className="mt-1 font-display text-3xl gold-text">
                {state.winner === 'player' ? 'Победа!' : state.winner === 'bot' ? 'Поражение' : 'Ничья'}
              </h2>
              <div className="mt-5 space-y-3">
                <PremiumButton full variant="gold" onClick={restart}>
                  Реванш
                </PremiumButton>
                <PremiumButton full variant="ghost" onClick={onExit}>
                  В меню
                </PremiumButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
