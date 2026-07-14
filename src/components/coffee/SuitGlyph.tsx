import type { Suit } from '../../game/types';
import { COFFEE, suitTone } from './palette';

type GlyphProps = {
  suit: Suit;
  size?: number | string;
  className?: string;
  title?: string;
};

/** Черви — чашка с latte-heart. */
function CupHeart({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M18 28c0-6.5 5-12 11-12h14c6 0 11 5.5 11 12v10c0 10-8 18-18 18S18 48 18 38V28z" />
      <path
        d="M54 30h6c5.5 0 10 4 10 9.5S65.5 49 60 49h-6"
        fill="none"
        stroke={fill}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M32 24c0 4 3.2 6.5 6.2 9 3-2.5 6.2-5 6.2-9 0-2.6-1.9-4.2-4.2-4.2-1.4 0-2.7.7-3.5 1.8-.8-1.1-2.1-1.8-3.5-1.8-2.3 0-4.2 1.6-4.2 4.2z"
        fill={COFFEE.cream}
      />
      <ellipse cx="36" cy="62" rx="16" ry="3.2" opacity="0.28" />
    </g>
  );
}

/** Бубны — орнаментальный ромб. */
function OrnateDiamond({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M36 8 L64 36 L36 64 L8 36 Z" />
      <path d="M36 16 L56 36 L36 56 L16 36 Z" fill={COFFEE.cream} opacity="0.92" />
      <path d="M36 22 L50 36 L36 50 L22 36 Z" />
      <circle cx="36" cy="36" r="4.5" fill={COFFEE.cream} />
      <path
        d="M36 12v8M36 52v8M12 36h8M52 36h8"
        stroke={fill}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Трефы — три кофейных зерна. */
function BeanClub({ fill }: { fill: string }) {
  const bean = (cx: number, cy: number, rot: number) => (
    <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <ellipse cx="0" cy="0" rx="11" ry="15" fill={fill} />
      <path
        d="M0 -12c-3 4.5-3 19.5 0 24"
        stroke={COFFEE.cream}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </g>
  );
  return (
    <g>
      {bean(36, 22, -18)}
      {bean(22, 42, 28)}
      {bean(50, 42, -32)}
      <rect x="33" y="48" width="6" height="14" rx="2" fill={fill} />
    </g>
  );
}

/** Пики — стилизованный наконечник/крона. */
function SpearSpade({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M36 6 C22 22 12 34 12 44 c0 10 8 16 18 16 2.5 0 4.5-.6 6-1.6 1.5 1 3.5 1.6 6 1.6 10 0 18-6 18-16 0-10-10-22-24-38z" />
      <path
        d="M36 28c-4 6-6 12-6 16 0 4 2.4 7 6 7s6-3 6-7c0-4-2-10-6-16z"
        fill={COFFEE.cream}
        opacity="0.22"
      />
      <path d="M30 58h12l-2 10h-8z" />
      <rect x="33" y="66" width="6" height="8" rx="1.5" />
    </g>
  );
}

/** SVG-масть кофейной колоды (viewBox 0 0 72 72). */
export function SuitGlyph({ suit, size = 24, className = '', title }: GlyphProps) {
  const fill = suitTone(suit);
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 72 72"
      className={className}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {suit === 'hearts' && <CupHeart fill={fill} />}
      {suit === 'diamonds' && <OrnateDiamond fill={fill} />}
      {suit === 'clubs' && <BeanClub fill={fill} />}
      {suit === 'spades' && <SpearSpade fill={fill} />}
    </svg>
  );
}
