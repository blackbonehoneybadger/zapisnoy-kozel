// Эффекты победы, общие для офлайн- и онлайн-экранов: кубок и конфетти.
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export function Trophy({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="drop-shadow-[0_4px_12px_rgba(153,69,255,0.5)]">
      <defs>
        <linearGradient id="trophyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8c7ff" />
          <stop offset="0.5" stopColor="#9945ff" />
          <stop offset="1" stopColor="#19d68a" />
        </linearGradient>
      </defs>
      <g stroke="url(#trophyGrad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12v4.5a6 6 0 0 1-12 0V4Z" fill="url(#trophyGrad)" fillOpacity="0.14" />
        <path d="M6 6H4a2.5 2.5 0 0 0 0 5h2.4" />
        <path d="M18 6h2a2.5 2.5 0 0 1 0 5h-2.4" />
        <path d="M12 14.5V18" />
        <path d="M8.5 21h7" />
        <path d="M9.5 21c0-1.8 1-2.8 2.5-2.8s2.5 1 2.5 2.8" />
      </g>
    </svg>
  );
}

const CONFETTI_COLORS = ['#9945ff', '#c4a5ff', '#19d68a', '#8ef2c9', '#f3efe6'];

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 30,
        delay: Math.random() * 1.4,
        dur: 2.4 + Math.random() * 2.2,
        rot: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: p.rot }}
          animate={{ y: '110vh', x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rot + 360 }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity }}
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}80`,
          }}
          className={`absolute top-0 ${p.round ? 'h-1.5 w-1.5 rounded-full' : 'h-2.5 w-1.5 rounded-sm'}`}
        />
      ))}
    </div>
  );
}
