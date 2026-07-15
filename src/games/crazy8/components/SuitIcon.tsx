// Иконки мастей в теме «история кофе»: сохраняем классический силуэт масти —
// критично для мгновенного распознавания во время игры — но вплетаем
// кофейную деталь (прожилка листа, трещина зерна, стебель) вместо плоского
// типографского глифа ♠♥♦♣. Векторные, без внешних зависимостей.
import type { Suit } from '../engine/types';

interface Props {
  suit: Suit;
  size?: number;
  className?: string;
}

const INK: Record<'red' | 'black', string> = {
  red: '#8c3229', // винтажный бургунд
  black: '#2e2015', // эспрессо
};

const SUIT_INK: Record<Suit, string> = {
  hearts: INK.red,
  diamonds: INK.red,
  clubs: INK.black,
  spades: INK.black,
};

export function SuitIcon({ suit, size = 16, className = '' }: Props) {
  const fill = SUIT_INK[suit];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {suit === 'hearts' && (
        <>
          <path
            d="M12 21.2 10.6 20C5.6 15.5 2.3 12.5 2.3 8.8 2.3 5.8 4.6 3.4 7.6 3.4c1.7 0 3.4.8 4.4 2.1 1-1.3 2.7-2.1 4.4-2.1 3 0 5.3 2.4 5.3 5.4 0 3.7-3.3 6.7-8.3 11.2Z"
            fill={fill}
          />
          {/* трещина кофейной ягоды вдоль оси */}
          <path d="M12 6.5c-1.6 3-1.6 9 0 12" stroke="#f2d9a0" strokeWidth="1" opacity="0.45" fill="none" />
        </>
      )}
      {suit === 'diamonds' && (
        <>
          <path d="M12 2 21 12 12 22 3 12Z" fill={fill} />
          {/* грань полированного зерна */}
          <path d="M12 2 21 12 12 22" fill="none" stroke="#f2d9a0" strokeWidth="0.8" opacity="0.4" />
        </>
      )}
      {suit === 'clubs' && (
        <>
          <circle cx="12" cy="7.4" r="3.6" fill={fill} />
          <circle cx="6.9" cy="12.2" r="3.6" fill={fill} />
          <circle cx="17.1" cy="12.2" r="3.6" fill={fill} />
          <path d="M12 12 10.2 22 13.8 22Z" fill={fill} />
          {/* прожилки-трещины на каждой доле — намёк на три зерна */}
          <path
            d="M12 5v4.8M5.1 11.6l3.6 1.6M18.9 11.6l-3.6 1.6"
            stroke="#f2d9a0"
            strokeWidth="0.8"
            opacity="0.4"
          />
        </>
      )}
      {suit === 'spades' && (
        <>
          <path
            d="M12 2.5C8.3 6.7 3.6 10.4 3.6 14.6a5 5 0 0 0 8.4 3.6 5 5 0 0 0 8.4-3.6c0-4.2-4.7-7.9-8.4-12.1Z"
            fill={fill}
          />
          <path d="M12 19 10.3 22 13.7 22Z" fill={fill} />
          {/* прожилка листа */}
          <path d="M12 6c-1.6 3-1.6 8 0 11" stroke="#f2d9a0" strokeWidth="1" opacity="0.45" fill="none" />
        </>
      )}
    </svg>
  );
}
