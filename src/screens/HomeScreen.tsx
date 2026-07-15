// Главный экран DOFFA Games. Единственный публичный игровой режим —
// DOFFA Bean Duel; старый Crazy 8 полностью скрыт (см. ENABLE_CRAZY8_CLASSIC
// и docs/CRAZY8_ARCHIVE.md) и на этом экране никак не упоминается, кроме
// служебной dev-ссылки, видимой только при явно включённом флаге.
import { motion } from 'framer-motion';
import { Hero3DCard } from '../components/Hero3DCard';
import { PremiumButton } from '../components/PremiumButton';
import { haptics } from '../lib/haptics';
import { useBeansStore } from '../store/beansStore';
import { useRewardsStore } from '../store/rewardsStore';
import { ENABLE_CRAZY8_CLASSIC } from '../config/features';
import type { Screen } from '../App';

interface Props {
  navigate: (s: Screen) => void;
  /** Запускает DOFFA Bean Duel — основной игровой режим. */
  onPlay: () => void;
  /** Запускает офлайн-партию Crazy 8 против ботов. Задано ТОЛЬКО при ENABLE_CRAZY8_CLASSIC. */
  onPlayClassic?: () => void;
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
  { label: 'Накопить зёрна', screen: 'beans', hint: 'Тапалка DOFFA' },
  { label: 'Награды', screen: 'rewards', hint: 'История начислений' },
  { label: 'Профиль', screen: 'profile', hint: 'Кошелёк, DOFFA' },
];

export function HomeScreen({ navigate, onPlay, onPlayClassic }: Props) {
  const beans = useBeansStore((s) => s.beans);
  const doffa = useRewardsStore((s) => s.doffa);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between px-7 py-8 safe-top safe-bottom">
      {/* баланс зёрен + доступная награда DOFFA — ведёт в профиль */}
      <div className="z-20 flex h-9 w-full items-start justify-end">
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
            <span className="text-white/70">{beans}</span>
            <span className="text-white/35">Зёрна</span>
          </span>
          <span className="h-3 w-px bg-white/[0.1]" />
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            <span className="text-gold-300">{doffa}</span>
            <span className="text-white/35">DOFFA</span>
          </span>
        </motion.button>
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
          DOFFA Games
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 font-display text-[3.4rem] font-semibold leading-[0.92] tracking-tight"
        >
          <span className="gold-text">Bean</span>
          <br />
          <span className="text-[#f3efe6]">Duel</span>
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
          Быстрая дуэль один на один. Уклоняйся, атакуй, побеждай за 60–90 секунд.
        </motion.p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <motion.div custom={0} variants={item} initial="hidden" animate="show">
          <PremiumButton full variant="gold" onClick={onPlay}>
            Играть в Bean Duel
          </PremiumButton>
        </motion.div>

        <div className="mt-3 overflow-hidden rounded-2xl glass">
          {secondary.map((b, i) => (
            <motion.button
              key={b.screen}
              custom={i + 1}
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

        {/* Служебные dev-ссылки на старый Crazy 8 — видны ТОЛЬКО при явном
            VITE_ENABLE_CRAZY8_CLASSIC=true (локальная разработка/тесты). */}
        {ENABLE_CRAZY8_CLASSIC && (
          <div className="mt-3 flex justify-center gap-3 text-[10px] uppercase tracking-widest text-white/20">
            {onPlayClassic && (
              <button onClick={onPlayClassic} className="hover:text-white/40">
                Crazy 8 · офлайн (dev)
              </button>
            )}
            <button onClick={() => navigate('online')} className="hover:text-white/40">
              Crazy 8 · онлайн (dev)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
