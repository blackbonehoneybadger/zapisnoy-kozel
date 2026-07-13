import { motion } from 'framer-motion';
import { Hero3DCard } from '../components/Hero3DCard';
import { PremiumButton } from '../components/PremiumButton';
import { haptics } from '../game/haptics';
import { useRewardsStore } from '../store/rewardsStore';
import type { Screen } from '../App';

interface Props {
  navigate: (s: Screen) => void;
  onPlay: () => void;
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.25 + i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

const secondary: { label: string; screen: Screen; hint: string }[] = [
  { label: 'Профиль', screen: 'profile', hint: 'Кошелёк, награды, Cups' },
  { label: 'Правила', screen: 'rules', hint: 'Как играть' },
  { label: 'Статистика', screen: 'stats', hint: 'Победы и партии' },
  { label: 'Настройки', screen: 'settings', hint: 'Боты, лимит, звук' },
];

export function HomeScreen({ navigate, onPlay }: Props) {
  const cups = useRewardsStore((s) => s.cups);
  const doffa = useRewardsStore((s) => s.doffa);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between px-7 py-8 safe-top safe-bottom">
      {/* балансы наград — тихая плашка над hero, ведёт в профиль */}
      <div className="z-20 flex h-9 w-full items-start justify-end">
        {(cups > 0 || doffa > 0) && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => {
              haptics.tap();
              navigate('profile');
            }}
            className="glass flex items-center gap-3 rounded-full px-4 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/70">{cups}</span>
              <span className="text-white/35">Cups</span>
            </span>
            <span className="h-3 w-px bg-white/[0.1]" />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
              <span className="text-gold-300">{doffa}</span>
              <span className="text-white/35">DOFFA</span>
            </span>
          </motion.button>
        )}
      </div>
      <div className="relative flex w-full flex-1 flex-col items-center justify-center text-center">
        {/* парящие 3D-карты за заголовком (Three.js, лениво) */}
        <Hero3DCard className="absolute inset-0 z-0" />

        <div className="relative z-10 flex flex-col items-center">
        {/* эмблема в обрамлении */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 -z-10 rounded-full bg-gold-500/20 blur-[40px] animate-breathe" />
          <div className="absolute -inset-3 rounded-[2.4rem] border border-gold-500/15" />
          <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full glass-strong">
            <img
              src="/art/doffa-logo.webp"
              alt="DOFFA"
              className="h-[94%] w-[94%] animate-float object-contain"
            />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="text-[0.65rem] uppercase tracking-luxe text-gold-500/70"
        >
          DOFFA · Espresso Bar
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 font-display text-[3.4rem] font-semibold leading-[0.92] tracking-tight"
        >
          <span className="gold-text">DOFFA</span>
          <br />
          <span className="text-[#f3efe6]">Crazy 8</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.32 }}
          className="mt-5 h-px w-24 bg-champagne-line"
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 max-w-[17rem] text-balance text-sm leading-relaxed text-white/45"
        >
          Избавься от карт первым. Шестёрки, тузы и пиковый король решают исход.
        </motion.p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <motion.div custom={0} variants={item} initial="hidden" animate="show">
          <PremiumButton full variant="gold" onClick={onPlay}>
            Играть бесплатно
          </PremiumButton>
        </motion.div>

        <motion.div custom={1} variants={item} initial="hidden" animate="show" className="mt-3">
          <PremiumButton
            full
            variant="ghost"
            onClick={() => {
              haptics.tap();
              navigate('online');
            }}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Играть на DOFFA
          </PremiumButton>
        </motion.div>

        <div className="mt-3 overflow-hidden rounded-2xl glass">
          {secondary.map((b, i) => (
            <motion.button
              key={b.screen}
              custom={i + 2}
              variants={item}
              initial="hidden"
              animate="show"
              onClick={() => {
                haptics.tap();
                navigate(b.screen);
              }}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.04] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-white/[0.05]"
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium text-white/85">{b.label}</span>
                <span className="text-[11px] text-white/35">{b.hint}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gold-500/60">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          ))}
        </div>

        <p className="pt-4 text-center text-[11px] tracking-wide text-white/25">
          v1.0 · играй офлайн · добавь на экран «Домой»
        </p>
      </div>
    </div>
  );
}
