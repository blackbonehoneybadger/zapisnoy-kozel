import { motion } from 'framer-motion';
import { GoatEmblem } from '../components/GoatEmblem';
import { PremiumButton } from '../components/PremiumButton';
import type { Screen } from '../App';

interface Props {
  navigate: (s: Screen) => void;
  onPlay: () => void;
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.08 } }),
};

export function HomeScreen({ navigate, onPlay }: Props) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between px-6 py-10 safe-top safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 -z-10 blur-2xl bg-gold-500/20 rounded-full" />
          <div className="grid h-32 w-32 place-items-center rounded-[2rem] glass-strong">
            <GoatEmblem size={96} className="animate-float" />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xs uppercase tracking-[0.4em] text-gold-500/70"
        >
          Карточная игра
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-2 font-display text-5xl font-bold leading-none"
        >
          <span className="gold-text">Записной</span>
          <br />
          <span className="text-white">Козёл</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 max-w-xs text-sm text-white/50"
        >
          Избавься от карт первым. Шестёрки, тузы и пиковый король решают исход.
        </motion.p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {[
          { label: 'Играть', action: onPlay, variant: 'gold' as const },
          { label: 'Правила', action: () => navigate('rules'), variant: 'ghost' as const },
          { label: 'Статистика', action: () => navigate('stats'), variant: 'ghost' as const },
          { label: 'Настройки', action: () => navigate('settings'), variant: 'ghost' as const },
        ].map((b, i) => (
          <motion.div key={b.label} custom={i} variants={item} initial="hidden" animate="show">
            <PremiumButton full variant={b.variant} onClick={b.action}>
              {b.label}
            </PremiumButton>
          </motion.div>
        ))}
        <p className="pt-3 text-center text-[11px] text-white/30">v1.0 · играй офлайн · добавь на экран «Домой»</p>
      </div>
    </div>
  );
}
