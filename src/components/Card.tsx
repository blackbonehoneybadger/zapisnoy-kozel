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
        {/* рубашка «история кофе» — винтажная гравюра кофейного дерева и торговых
            путей (webp — арт Higgsfield, svg — офлайн-фоллбэк до кэширования) */}
        <div
          className="absolute inset-0 bg-[#e7d6ad]"
          style={{
            backgroundImage: "url('/art/card-back.webp'), url('/art/card-back.svg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* тёплое центральное свечение */}
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_42%,rgba(224,164,59,0.16),transparent_72%)]" />
        {/* верхний блик */}
        <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/[0.1] to-transparent" />
      </div>
    );
  }

  const red = SUIT_IS_RED[card.suit];
  const symbol = SUIT_SYMBOL[card.suit];
  // Винтажные чернила: тёплый бургунд вместо кислотно-красного, эспрессо
  // вместо типографской черноты — читаются как «красная/чёрная» масть,
  // но в палитре истории кофе.
  const color = red ? 'text-[#8c3229]' : 'text-[#2e2015]';

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
        bg-[linear-gradient(180deg,#fbf3e0_0%,#f3e6c4_58%,#e9d8ab_100%)]
        shadow-card ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-40 saturate-[0.6]' : ''}
        ${playable ? 'ring-1 ring-gold-400/60' : ''}
        ${selected ? 'ring-2 ring-gold-400 shadow-glow' : ''}`}
    >
      {/* тонкая фактура состаренной бумаги (Higgsfield) поверх паспарту-градиента */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.32] mix-blend-multiply"
        style={{
          backgroundImage: "url('/art/card-paper.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* тонкая внутренняя рамка */}
      <span className="pointer-events-none absolute inset-[2.5px] rounded-[0.65rem] border border-gold-600/35" />
      {/* верхний глянец */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[0.85rem] bg-gradient-to-b from-white/60 to-transparent" />
      {/* мягкий премиальный ореол доступной карты — мягко пульсирует, ярче при наведении */}
      {playable && (
        <motion.span
          className="pointer-events-none absolute -inset-[3px] rounded-[1rem]"
          initial={{ opacity: 0.55 }}
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 30px 2px rgba(224,164,59,0.55), 0 0 12px rgba(58,94,66,0.4)' }}
        />
      )}
      {/* внутренняя золотисто-мятная кромка доступной карты */}
      {playable && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[0.85rem]"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(242,217,160,0.7), inset 0 0 14px rgba(58,94,66,0.25)' }}
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
