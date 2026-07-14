import { motion } from 'framer-motion';
import type { Card as CardType } from '../game/types';
import { CoffeeFace } from './coffee/CoffeeFace';
import { COFFEE } from './coffee/palette';

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
  normal: 'w-[4.6rem] h-[6.5rem]',
  small: 'w-12 h-[4.3rem]',
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
      <div className={`${dim} ${className} relative overflow-hidden rounded-[0.85rem] shadow-card`}>
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: COFFEE.ink,
            backgroundImage: "url('/art/card-back.webp'), url('/art/card-back.svg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/[0.08] to-transparent" />
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={playable ? { y: -14, scale: 1.05 } : undefined}
      whileTap={playable ? { scale: 0.97 } : undefined}
      animate={selected ? { y: -16 } : { y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      disabled={!onClick}
      className={`${dim} ${className} group relative overflow-hidden rounded-[0.85rem]
        shadow-card ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-40 saturate-[0.6]' : ''}
        ${playable ? 'ring-1 ring-[#C8963D]/70' : ''}
        ${selected ? 'ring-2 ring-[#C8963D] shadow-glow' : ''}`}
      style={{
        background: `linear-gradient(180deg, ${COFFEE.cream} 0%, #FFF6EA 55%, ${COFFEE.creamDeep} 100%)`,
      }}
    >
      {/* craft double frame */}
      <span
        className="pointer-events-none absolute inset-[3px] rounded-[0.65rem]"
        style={{ border: `1px solid ${COFFEE.gold}55` }}
      />
      <span
        className="pointer-events-none absolute inset-[6px] rounded-[0.5rem]"
        style={{ border: `1px solid ${COFFEE.ink}18` }}
      />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/65 to-transparent" />

      {playable && (
        <motion.span
          className="pointer-events-none absolute -inset-[3px] rounded-[1rem]"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.45, 0.8, 0.45] }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 26px 2px rgba(200,150,61,0.45)' }}
        />
      )}

      <CoffeeFace suit={card.suit} rank={card.rank} small={small} />
    </motion.button>
  );
}
