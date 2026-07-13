// Фирменный DOFFA-экран победы и получения награды.
// Cups — внутренняя энергия (бесплатная игра), DOFFA — реальная награда (онлайн).
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PremiumButton } from './PremiumButton';
import { Confetti, Trophy } from './WinFx';
import { CountUpOnView } from './CountUpOnView';

interface Props {
  won: boolean;
  /** Сумма награды для отображения (визуальная). Если не задана — показываем без числа. */
  reward?: number;
  /** Единица: «Cups» (энергия) или «DOFFA» (награда). */
  unit?: 'Cups' | 'DOFFA';
  /** Подпись под заголовком при проигрыше / имя победителя. */
  loserNote?: string;
  onAgain: () => void;
  onMenu: () => void;
  againLabel?: string;
  menuLabel?: string;
  /** Показывать кнопку «Играть ещё» (напр. только хосту онлайн-стола). */
  showAgain?: boolean;
}

/** Летящие монеты-зёрна при получении награды. */
function CoinBurst() {
  const coins = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 220,
        delay: Math.random() * 0.25,
        dur: 0.9 + Math.random() * 0.6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 grid place-items-center">
      {coins.map((c) => (
        <motion.span
          key={c.id}
          initial={{ y: 0, x: 0, opacity: 0, scale: 0.6 }}
          animate={{ y: -180, x: c.x, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: c.dur, delay: c.delay, ease: 'easeOut' }}
          className="absolute grid h-6 w-6 place-items-center rounded-full border border-gold-600/50 bg-gold-sheen text-[10px] font-bold text-ink-900 shadow-glow"
        >
          ◎
        </motion.span>
      ))}
    </div>
  );
}

export function RewardOverlay({
  won,
  reward,
  unit = 'Cups',
  loserNote,
  onAgain,
  onMenu,
  againLabel = 'Сыграть ещё',
  menuLabel = 'В меню',
  showAgain = true,
}: Props) {
  const [claimed, setClaimed] = useState(false);
  const [bursting, setBursting] = useState(false);

  const claim = () => {
    if (claimed) return;
    setBursting(true);
    setClaimed(true);
    setTimeout(() => setBursting(false), 1400);
  };

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
      {bursting && <CoinBurst />}

      {/* пульсирующий тёплый ореол за кубком */}
      {won && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(224,164,59,0.5), rgba(58,94,66,0.2) 55%, transparent 72%)' }}
        />
      )}

      <motion.div
        initial={{ scale: 0.82, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="glass-strong relative w-full max-w-sm rounded-3xl p-7 text-center"
      >
        <div className="relative mx-auto mb-3 grid h-28 w-28 place-items-center">
          {won && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full table-ring animate-spin-slow opacity-80"
            />
          )}
          <motion.div
            animate={won ? { rotate: [0, -6, 6, 0], y: [0, -4, 0] } : {}}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="relative grid h-24 w-24 place-items-center rounded-3xl glass"
          >
            <Trophy size={60} />
          </motion.div>
        </div>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70">
          {won ? 'Поздравляем!' : 'Партия окончена'}
        </p>

        {won ? (
          <>
            <h2 className="mt-1 font-display text-3xl gold-text">Вы выиграли</h2>
            {reward !== undefined ? (
              <div className="mt-1 flex items-end justify-center gap-2">
                <span className="font-display text-5xl text-gold-300">
                  <CountUpOnView value={reward} />
                </span>
                <span className="mb-1.5 text-lg font-medium text-gold-400">{unit}</span>
              </div>
            ) : (
              <div className="mt-1 font-display text-4xl text-gold-300">{unit}</div>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-1 font-display text-3xl text-white/90">В другой раз</h2>
            {loserNote && <p className="mt-2 text-sm text-white/55">{loserNote}</p>}
          </>
        )}

        <div className="mt-6 space-y-3">
          {won && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              animate={claimed ? {} : { scale: [1, 1.035, 1] }}
              transition={{ duration: 1.8, repeat: claimed ? 0 : Infinity, ease: 'easeInOut' }}
              onClick={claim}
              disabled={claimed}
              className={`relative w-full overflow-hidden rounded-2xl py-4 text-base font-semibold text-ink-900 shadow-glow transition ${
                claimed ? 'bg-felt-600/40 text-gold-300' : 'bg-gold-sheen'
              }`}
            >
              {claimed ? '✓ Награда зачислена' : 'Забрать награду'}
            </motion.button>
          )}
          {showAgain && (
            <PremiumButton full variant={won ? 'ghost' : 'gold'} onClick={onAgain}>
              {againLabel}
            </PremiumButton>
          )}
          <PremiumButton full variant="ghost" onClick={onMenu}>
            {menuLabel}
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
