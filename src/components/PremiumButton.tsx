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
  'relative inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 font-semibold tracking-wide transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  gold: 'text-ink-900 bg-gold-sheen shadow-gold hover:brightness-105',
  ghost: 'text-gold-400 glass hover:bg-white/[0.07]',
  danger: 'text-red-200 bg-red-900/40 border border-red-500/30 hover:bg-red-900/60',
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
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => {
        if (disabled) return;
        haptics.tap();
        onClick?.();
      }}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {variant === 'gold' && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/30 blur-md animate-shimmer" />
        </span>
      )}
      {icon}
      <span className="relative">{children}</span>
    </motion.button>
  );
}
