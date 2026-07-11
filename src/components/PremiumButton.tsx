import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { haptics } from '../game/haptics';

type Variant = 'gold' | 'ghost' | 'danger';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  full?: boolean;
  className?: string;
  icon?: ReactNode;
}

const base =
  'relative inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-[0.95rem] font-medium tracking-wide transition-all duration-300 select-none disabled:opacity-40 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  gold: 'text-ink-900 bg-gold-sheen shadow-gold hover:shadow-glow',
  ghost:
    'text-gold-200 bg-white/[0.03] border border-white/[0.08] hover:border-gold-500/30 hover:bg-white/[0.05]',
  danger: 'text-wine-400 bg-wine-700/25 border border-wine-500/25 hover:bg-wine-700/40',
};

export function PremiumButton({
  children,
  onClick,
  variant = 'gold',
  disabled,
  full,
  className = '',
  icon,
}: Props) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.975 }}
      onClick={() => {
        if (disabled) return;
        haptics.tap();
        onClick?.();
      }}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {variant === 'gold' && (
        <>
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/35 blur-md animate-shimmer" />
          </span>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/30 to-transparent" />
        </>
      )}
      {icon}
      <span className="relative">{children}</span>
    </motion.button>
  );
}
