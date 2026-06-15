import { motion } from 'framer-motion';
import type { Card as CardType } from '../game/types';
import { SUIT_IS_RED, SUIT_SYMBOL } from '../game/deck';

interface Props {
  card?: CardType;
  faceDown?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizes = {
  normal: 'w-[4.5rem] h-[6.4rem] text-base',
  small: 'w-12 h-[4.3rem] text-xs',
};

export function Card({
  card,
  faceDown,
  playable,
  dimmed,
  selected,
  small,
  onClick,
  className = '',
}: Props) {
  const dim = small ? sizes.small : sizes.normal;

  if (faceDown || !card) {
    return (
      <div className={`${dim} ${className} rounded-xl relative overflow-hidden shadow-card`}>
        <div className="absolute inset-0 bg-gradient-to-br from-felt-700 to-felt-900" />
        <div className="absolute inset-[3px] rounded-lg border border-gold-600/40" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(231,193,104,0.25) 0 6px, transparent 6px 12px)',
          }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-gold-400/80 text-lg font-display">К</span>
        </div>
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  const color = red ? 'text-rose-600' : 'text-graphite-900';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={playable ? { y: -10, scale: 1.04 } : undefined}
      whileTap={playable ? { scale: 0.97 } : undefined}
      animate={selected ? { y: -16 } : { y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      disabled={!onClick}
      className={`${dim} ${className} relative rounded-xl bg-gradient-to-b from-[#fffdf6] to-[#f3ead4]
        shadow-card overflow-hidden ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-45 saturate-50' : ''}
        ${playable ? 'ring-1 ring-gold-400/70' : ''}
        ${selected ? 'ring-2 ring-gold-400 shadow-glow' : ''}`}
    >
      <span className="pointer-events-none absolute inset-[2.5px] rounded-lg border border-gold-600/50" />
      {playable && (
        <span className="pointer-events-none absolute inset-0 rounded-xl shadow-[0_0_18px_rgba(231,193,104,0.45)]" />
      )}

      <span className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${color}`}>
        <span className="font-bold">{card.rank}</span>
        <span className={small ? 'text-[10px]' : 'text-sm'}>{symbol}</span>
      </span>

      <span
        className={`absolute inset-0 grid place-items-center ${color} ${
          small ? 'text-2xl' : 'text-4xl'
        } opacity-90`}
      >
        {symbol}
      </span>

      <span
        className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${color}`}
      >
        <span className="font-bold">{card.rank}</span>
        <span className={small ? 'text-[10px]' : 'text-sm'}>{symbol}</span>
      </span>
    </motion.button>
  );
}
