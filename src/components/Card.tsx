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
  normal: 'w-[4.6rem] h-[6.5rem] text-base',
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
      <div className={`${dim} ${className} relative overflow-hidden rounded-[0.85rem] shadow-card`}>
        {/* AI-рубашка (public/art/card-back.*). Фоллбэк — обсидиан */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/art/card-back.jpg'), url('/art/card-back.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* обсидиан-фоллбэк */}
        <div
          className="absolute inset-0 bg-[linear-gradient(150deg,#15181c_0%,#0c0e11_55%,#090a0c_100%)]"
          style={{ mixBlendMode: 'multiply' }}
        />
        {/* мягкое центральное свечение */}
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_42%,rgba(153,69,255,0.18),transparent_70%)]" />
        {/* двойная шампань-рамка */}
        <div className="absolute inset-[3px] rounded-[0.6rem] border border-gold-600/35" />
        <div className="absolute inset-[6px] rounded-[0.45rem] border border-gold-700/25" />
        {/* эмблема-герб поверх AI-текстуры */}
        <div className="absolute inset-0 grid place-items-center">
          <svg width={small ? 18 : 26} height={small ? 18 : 26} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 2l2.4 5.6L20 8.2l-4 4.1 1 6L12 15.4 7 18.3l1-6-4-4.1 5.6-.6L12 2z"
              fill="none"
              stroke="url(#cardGold)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="cardGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c4a5ff" />
                <stop offset="1" stopColor="#19d68a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        {/* верхний блик */}
        <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/[0.06] to-transparent" />
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  const color = red ? 'text-[#b8313f]' : 'text-[#1a1d22]';

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
        bg-[linear-gradient(180deg,#fffefb_0%,#fbf6ea_60%,#f1e8d4_100%)]
        shadow-card ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-40 saturate-[0.6]' : ''}
        ${playable ? 'ring-1 ring-gold-400/60' : ''}
        ${selected ? 'ring-2 ring-gold-400 shadow-glow' : ''}`}
    >
      {/* тонкая внутренняя рамка */}
      <span className="pointer-events-none absolute inset-[2.5px] rounded-[0.65rem] border border-gold-600/30" />
      {/* верхний глянец */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/70 to-transparent" />
      {/* мягкое свечение при доступности */}
      {playable && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-[0.85rem]"
          initial={{ opacity: 0.4 }}
          whileHover={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ boxShadow: '0 0 28px rgba(153,69,255,0.55), 0 0 8px rgba(25,214,138,0.35)' }}
        />
      )}

      <span className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${color}`}>
        <span className="font-semibold tracking-tight">{card.rank}</span>
        <span className={small ? 'text-[10px]' : 'text-sm'}>{symbol}</span>
      </span>

      <span
        className={`absolute inset-0 grid place-items-center ${color} ${
          small ? 'text-2xl' : 'text-[2.6rem]'
        } opacity-90 drop-shadow-[0_1px_0_rgba(0,0,0,0.06)]`}
      >
        {symbol}
      </span>

      <span
        className={`absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none ${color}`}
      >
        <span className="font-semibold tracking-tight">{card.rank}</span>
        <span className={small ? 'text-[10px]' : 'text-sm'}>{symbol}</span>
      </span>
    </motion.button>
  );
}
