import type { Rank, Suit } from '../../game/types';
import { COFFEE, suitTone } from './palette';
import { SuitGlyph } from './SuitGlyph';

/** Французская раскладка пипов для 6–10 (нормализовано 0..1 в зоне лица). */
const PIP: Record<'6' | '7' | '8' | '9' | '10', { x: number; y: number; flip?: boolean }[]> = {
  '6': [
    { x: 0.28, y: 0.18 },
    { x: 0.72, y: 0.18 },
    { x: 0.28, y: 0.5 },
    { x: 0.72, y: 0.5 },
    { x: 0.28, y: 0.82, flip: true },
    { x: 0.72, y: 0.82, flip: true },
  ],
  '7': [
    { x: 0.28, y: 0.16 },
    { x: 0.72, y: 0.16 },
    { x: 0.5, y: 0.34 },
    { x: 0.28, y: 0.5 },
    { x: 0.72, y: 0.5 },
    { x: 0.28, y: 0.84, flip: true },
    { x: 0.72, y: 0.84, flip: true },
  ],
  '8': [
    { x: 0.28, y: 0.14 },
    { x: 0.72, y: 0.14 },
    { x: 0.5, y: 0.32 },
    { x: 0.28, y: 0.5 },
    { x: 0.72, y: 0.5 },
    { x: 0.5, y: 0.68, flip: true },
    { x: 0.28, y: 0.86, flip: true },
    { x: 0.72, y: 0.86, flip: true },
  ],
  '9': [
    { x: 0.28, y: 0.12 },
    { x: 0.72, y: 0.12 },
    { x: 0.28, y: 0.32 },
    { x: 0.72, y: 0.32 },
    { x: 0.5, y: 0.5 },
    { x: 0.28, y: 0.68, flip: true },
    { x: 0.72, y: 0.68, flip: true },
    { x: 0.28, y: 0.88, flip: true },
    { x: 0.72, y: 0.88, flip: true },
  ],
  '10': [
    { x: 0.28, y: 0.1 },
    { x: 0.72, y: 0.1 },
    { x: 0.5, y: 0.26 },
    { x: 0.28, y: 0.38 },
    { x: 0.72, y: 0.38 },
    { x: 0.28, y: 0.62, flip: true },
    { x: 0.72, y: 0.62, flip: true },
    { x: 0.5, y: 0.74, flip: true },
    { x: 0.28, y: 0.9, flip: true },
    { x: 0.72, y: 0.9, flip: true },
  ],
};

function FaceArt({ suit, rank }: { suit: Suit; rank: 'J' | 'Q' | 'K' }) {
  const tone = suitTone(suit);
  const label = rank === 'J' ? 'JACK' : rank === 'Q' ? 'QUEEN' : 'KING';
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" aria-hidden>
      <rect x="8" y="8" width="104" height="144" rx="6" fill="none" stroke={tone} strokeWidth="2.2" />
      <rect x="14" y="14" width="92" height="132" rx="4" fill="none" stroke={COFFEE.gold} strokeWidth="1" opacity="0.7" />

      {/* craft brew vignette */}
      <g transform="translate(60 78)" fill={tone}>
        {rank === 'J' && (
          <>
            {/* scoop + beans */}
            <ellipse cx="0" cy="8" rx="22" ry="10" fill="none" stroke={tone} strokeWidth="2.4" />
            <path d="M-18 4c4-14 32-14 36 0" fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="-8" cy="4" rx="5" ry="7" transform="rotate(-20)" />
            <ellipse cx="6" cy="2" rx="5" ry="7" transform="rotate(15)" />
            <path d="M22 6l18 22" stroke={tone} strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        )}
        {rank === 'Q' && (
          <>
            {/* elegant cup */}
            <path d="M-16-6h28c2 0 6 4 6 10v14c0 10-8 18-20 18s-20-8-20-18V4c0-6 4-10 6-10z" />
            <path d="M18-2h5c5 0 9 4 9 9s-4 9-9 9h-5" fill="none" stroke={tone} strokeWidth="3" />
            <path d="M-6-14c0 3 2.4 5 4.6 7 2.2-2 4.6-4 4.6-7 0-2-1.5-3.2-3.2-3.2-1 0-2 .5-2.6 1.4-.6-.9-1.6-1.4-2.6-1.4-1.7 0-3.2 1.2-3.2 3.2z" fill={COFFEE.cream} />
            <path d="M-18 48h36M-10 48v8h20v-8" stroke={tone} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {/* crown dots */}
            <circle cx="-14" cy="-28" r="2.4" fill={COFFEE.gold} />
            <circle cx="0" cy="-32" r="2.8" fill={COFFEE.gold} />
            <circle cx="14" cy="-28" r="2.4" fill={COFFEE.gold} />
          </>
        )}
        {rank === 'K' && (
          <>
            {/* portafilter king */}
            <path d="M-20-20h40v10c0 4-4 8-8 8h-24c-4 0-8-4-8-8z" />
            <rect x="-8" y="-10" width="16" height="28" rx="3" />
            <path d="M8 4h22c4 0 8 4 8 9v4H8z" />
            <circle cx="0" cy="-28" r="7" fill="none" stroke={COFFEE.gold} strokeWidth="2.4" />
            <path d="M-10-28h20M0-36v16" stroke={COFFEE.gold} strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="-12" cy="36" rx="6" ry="8" transform="rotate(-25 -12 36)" />
            <ellipse cx="10" cy="34" rx="6" ry="8" transform="rotate(20 10 34)" />
          </>
        )}
      </g>

      <text
        x="60"
        y="148"
        textAnchor="middle"
        fill={tone}
        fontFamily="Montserrat, Inter, sans-serif"
        fontSize="8"
        fontWeight="600"
        letterSpacing="2"
      >
        {label}
      </text>
      {/* corner mini suit hints drawn by parent */}
    </svg>
  );
}

function AceArt({ suit, small }: { suit: Suit; small?: boolean }) {
  return (
    <div className="absolute inset-[12%] grid place-items-center">
      <SuitGlyph suit={suit} size={small ? 36 : 72} className="max-h-full max-w-[85%]" />
    </div>
  );
}

function NumberPips({ suit, rank, small }: { suit: Suit; rank: keyof typeof PIP; small?: boolean }) {
  const layout = PIP[rank];
  const pip = small ? 14 : 22;
  return (
    <div className="absolute inset-[14%_16%]">
      {layout.map((p, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transform: `translate(-50%, -50%)${p.flip ? ' rotate(180deg)' : ''}`,
          }}
        >
          <SuitGlyph suit={suit} size={pip} />
        </div>
      ))}
    </div>
  );
}

/** Внутреннее лицо кофейной карты (поверх кремового полотна). */
export function CoffeeFace({
  suit,
  rank,
  small,
}: {
  suit: Suit;
  rank: Rank;
  small?: boolean;
}) {
  const tone = suitTone(suit);
  const indexSize = small ? 'text-[11px]' : 'text-[15px]';
  const indexGlyph = small ? 11 : 15;

  const Index = ({ flip }: { flip?: boolean }) => (
    <span
      className={`absolute flex flex-col items-center leading-none ${flip ? 'bottom-1 right-1.5 rotate-180' : 'left-1.5 top-1'}`}
      style={{ color: tone, fontFamily: 'Montserrat, Inter, sans-serif' }}
    >
      <span className={`${indexSize} font-semibold tracking-tight`}>{rank}</span>
      <SuitGlyph suit={suit} size={indexGlyph} className="mt-0.5" />
    </span>
  );

  return (
    <>
      <Index />
      <Index flip />

      {rank === 'A' && <AceArt suit={suit} small={small} />}
      {(rank === 'J' || rank === 'Q' || rank === 'K') && (
        <div className="absolute inset-[12%_14%]">
          <FaceArt suit={suit} rank={rank} />
        </div>
      )}
      {rank in PIP && <NumberPips suit={suit} rank={rank as keyof typeof PIP} small={small} />}
    </>
  );
}
