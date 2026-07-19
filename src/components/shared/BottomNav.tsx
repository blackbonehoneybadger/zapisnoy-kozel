// Нижнее меню DOFFA Games: Играть · Зёрна · Награды · Профиль.
// Показывается только на «хабовых» экранах (см. App). Активная вкладка
// подсвечивается золотом; «Зёрна» выделена фирменной иконкой-зерном.
import { motion } from 'framer-motion';
import { haptics } from '../../lib/haptics';
import type { Screen } from '../../app/App';

interface Props {
  screen: Screen;
  navigate: (s: Screen) => void;
}

interface Item {
  key: string;
  label: string;
  target: Screen;
  /** Экраны, при которых вкладка считается активной. */
  active: Screen[];
  icon: (active: boolean) => React.ReactNode;
}

const items: Item[] = [
  {
    key: 'play',
    label: 'Играть',
    target: 'home',
    active: ['home'],
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="13" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 3h9a2 2 0 0 1 2 2v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'beans',
    label: 'Зёрна',
    target: 'beans',
    active: ['beans'],
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="12" rx="7" ry="10" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" transform="rotate(-24 12 12)" />
        <path d="M12 3c-3 5-3 13 0 18" stroke={a ? '#1b140c' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" opacity={a ? 0.6 : 1} />
      </svg>
    ),
  },
  {
    key: 'rewards',
    label: 'Награды',
    target: 'profile',
    active: ['rewards', 'claim'],
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 9h12v3a6 6 0 0 1-12 0V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6 11H4.5a2 2 0 0 1 0-4H6M18 11h1.5a2 2 0 0 0 0-4H18M9 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'Профиль',
    target: 'profile',
    active: ['profile'],
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 20c1.2-4 4-5.5 7-5.5s5.8 1.5 7 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomNav({ screen, navigate }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav className="glass-strong pointer-events-auto flex w-full max-w-md items-stretch justify-around rounded-2xl px-2 py-1.5 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.7)]">
        {items.map((it) => {
          const active = it.active.includes(screen);
          return (
            <button
              key={it.key}
              onClick={() => {
                haptics.tap?.();
                navigate(it.target);
              }}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 outline-none"
              aria-label={it.label}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-xl bg-white/[0.06]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={active ? 'text-gold-300' : 'text-white/45'}>{it.icon(active)}</span>
              <span className={`text-[10px] ${active ? 'font-medium text-gold-200' : 'text-white/45'}`}>
                {it.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
