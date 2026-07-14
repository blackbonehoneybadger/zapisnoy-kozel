// Фирменный маскот DOFFA — живая кофейная чашка, из которой торчат ноги.
// Смысловая ДНК логотипа doffa.coffee (чашка + ноги + горы + тепло), но это
// игровой персонаж, а не вставленный логотип. Полностью на SVG + Framer Motion,
// без внешних ассетов (временная качественная версия — см. docs/TAP_MASCOT_ASSETS.md).
//
// Состояния:
//   idle  — «дышит», пар поднимается, ноги покачиваются, кофе колышется.
//   tap   — чашка сжимается и качается, ноги вскидываются, кофе плещется,
//           из-за края вылетает рука и «выбрасывает» зёрна (частицы рисует экран).
//   tired — мало энергии: приглушённая анимация, чашка «устала».
//
// Управление тапом — императивно через tapSignal (меняется на каждый тап),
// чтобы не пересоздавать дерево и держать 60fps.
import { useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

interface Props {
  /** Растёт на каждый тап — триггер tap-анимации. */
  tapSignal: number;
  /** Сила комбо (1..5) — усиливает раскачку. */
  combo?: number;
  /** Мало/нет энергии — «уставший» вид. */
  tired?: boolean;
  className?: string;
}

export function DoffaMascot({ tapSignal, combo = 1, tired = false, className = '' }: Props) {
  const cup = useAnimationControls();
  const legs = useAnimationControls();
  const arm = useAnimationControls();
  const coffee = useAnimationControls();

  // Реакция на тап: параллельная «сочная» последовательность.
  useEffect(() => {
    if (tapSignal === 0) return;
    const amp = Math.min(1 + combo * 0.12, 1.7); // комбо усиливает амплитуду
    cup.start({
      rotate: [0, -7 * amp, 6 * amp, -3, 0],
      scaleY: [1, 0.9, 1.04, 1],
      scaleX: [1, 1.06, 0.98, 1],
      transition: { duration: 0.5, ease: 'easeOut' },
    });
    legs.start({
      rotate: [0, -18 * amp, 12 * amp, 0],
      y: [0, -6 * amp, 0],
      transition: { duration: 0.5, ease: 'easeOut' },
    });
    coffee.start({
      scaleY: [1, 1.35, 0.85, 1],
      y: [0, -2, 0],
      transition: { duration: 0.45, ease: 'easeOut' },
    });
    // Рука выскакивает из-за дальнего края и «бросает» зёрна, затем прячется.
    arm.start({
      opacity: [0, 1, 1, 0],
      x: [0, 14, 20, 24],
      y: [6, -10, -16, -6],
      rotate: [30, -10, -30, 10],
      transition: { duration: 0.5, times: [0, 0.25, 0.6, 1], ease: 'easeOut' },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapSignal]);

  const idleDur = tired ? 5.5 : 3.6;

  return (
    <div className={`relative select-none ${className}`}>
      {/* тёплое свечение под чашкой */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{
          background: tired
            ? 'radial-gradient(circle at 50% 60%, rgba(110,125,91,0.25), transparent 68%)'
            : 'radial-gradient(circle at 50% 58%, rgba(224,164,59,0.42), rgba(58,94,66,0.18) 55%, transparent 72%)',
        }}
      />

      <motion.svg
        viewBox="0 0 300 340"
        className="h-full w-full overflow-visible"
        // idle «дыхание» всего маскота
        animate={{ scale: tired ? [1, 1.005, 1] : [1, 1.02, 1], y: [0, -3, 0] }}
        transition={{ duration: idleDur, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <radialGradient id="mascotRing" cx="50%" cy="42%" r="60%">
            <stop offset="0" stopColor="#2a2016" />
            <stop offset="0.7" stopColor="#1e1710" />
            <stop offset="1" stopColor="#16110b" />
          </radialGradient>
          <linearGradient id="cupBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7efd8" />
            <stop offset="1" stopColor="#e7d6ad" />
          </linearGradient>
          <linearGradient id="cupGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2d9a0" />
            <stop offset="0.5" stopColor="#e0a43b" />
            <stop offset="1" stopColor="#bb5c3c" />
          </linearGradient>
          <radialGradient id="coffee" cx="50%" cy="40%" r="65%">
            <stop offset="0" stopColor="#6b3f24" />
            <stop offset="0.6" stopColor="#3a2416" />
            <stop offset="1" stopColor="#24160d" />
          </radialGradient>
          <linearGradient id="jeans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f6f6a" />
            <stop offset="1" stopColor="#2c5450" />
          </linearGradient>
        </defs>

        {/* эмблемный круг с намёком на горы */}
        <circle cx="150" cy="150" r="132" fill="url(#mascotRing)" stroke="url(#cupGold)" strokeWidth="3" opacity="0.9" />
        <path
          d="M40 196 L96 128 L134 172 L172 116 L226 190 Z"
          fill="#3a5e42"
          opacity="0.18"
        />
        <circle cx="206" cy="96" r="16" fill="#e0a43b" opacity="0.22" />

        {/* пар — три завитка (idle) */}
        {!tired &&
          [0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M${128 + i * 22} 78 c-8 -10 8 -18 0 -30`}
              fill="none"
              stroke="#f2d9a0"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.5"
              animate={{ opacity: [0, 0.55, 0], y: [6, -14, -24] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            />
          ))}

        {/* блюдце */}
        <ellipse cx="150" cy="250" rx="96" ry="20" fill="#e7d6ad" />
        <ellipse cx="150" cy="246" rx="96" ry="18" fill="url(#cupBody)" />
        <ellipse cx="150" cy="244" rx="70" ry="11" fill="#000" opacity="0.12" />
        {/* зерно на блюдце (декор) */}
        <ellipse cx="214" cy="250" rx="9" ry="6" fill="url(#cupGold)" transform="rotate(-20 214 250)" />
        <path d="M214 245 q-2 5 0 10" stroke="#1b140c" strokeWidth="1.4" fill="none" />

        {/* рука — выезжает из-за дальнего края при тапе (частично видна) */}
        <motion.g animate={arm} initial={{ opacity: 0 }} style={{ transformOrigin: '196px 150px' }}>
          <path d="M196 150 q22 -6 40 -22" stroke="#e7d6ad" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="236" cy="128" r="9" fill="#f3e9ce" />
        </motion.g>

        {/* КОРПУС ЧАШКИ (качается/сжимается при тапе) */}
        <motion.g animate={cup} style={{ transformOrigin: '150px 200px' }}>
          {/* ручка */}
          <path d="M232 176 a30 30 0 0 1 0 52" fill="none" stroke="url(#cupGold)" strokeWidth="12" />
          {/* тело */}
          <path d="M78 158 h144 v24 a72 60 0 0 1 -144 0 z" fill="url(#cupBody)" stroke="url(#cupGold)" strokeWidth="3" />
          {/* верхний эллипс-кромка */}
          <ellipse cx="150" cy="158" rx="72" ry="20" fill="#efe2bf" stroke="url(#cupGold)" strokeWidth="3" />
          {/* кофе */}
          <motion.ellipse animate={coffee} style={{ transformOrigin: '150px 158px' }} cx="150" cy="158" rx="60" ry="15" fill="url(#coffee)" />
          {/* крема-завиток */}
          <motion.path
            animate={coffee}
            style={{ transformOrigin: '150px 158px' }}
            d="M120 158 q30 -10 60 0 q-30 10 -60 0"
            fill="none"
            stroke="#8a5232"
            strokeWidth="2.4"
            opacity="0.7"
          />

          {/* НОГИ — свисают через переднюю кромку, покачиваются (idle) / вскидываются (tap) */}
          <motion.g
            animate={legs}
            initial={{ rotate: 0 }}
            style={{ transformOrigin: '150px 176px' }}
          >
            <motion.g
              animate={{ rotate: tired ? [0, 1.5, 0] : [0, 4, -3, 0] }}
              transition={{ duration: idleDur, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '150px 176px' }}
            >
              {/* левая нога */}
              <g>
                <path d="M126 176 q-6 34 -2 56" stroke="url(#jeans)" strokeWidth="18" strokeLinecap="round" fill="none" />
                {/* кроссовок */}
                <path d="M112 230 q-4 10 6 14 q16 4 22 -4 l-2 -12 z" fill="#241b12" />
                <path d="M114 244 q14 6 26 0" stroke="#f3e9ce" strokeWidth="3" fill="none" />
                <path d="M120 224 l8 6" stroke="#bb5c3c" strokeWidth="2.2" />
              </g>
              {/* правая нога */}
              <g>
                <path d="M170 176 q8 34 2 56" stroke="url(#jeans)" strokeWidth="18" strokeLinecap="round" fill="none" />
                <path d="M158 230 q-4 10 6 14 q16 4 22 -4 l-2 -12 z" fill="#241b12" />
                <path d="M160 244 q14 6 26 0" stroke="#f3e9ce" strokeWidth="3" fill="none" />
                <path d="M166 224 l8 6" stroke="#bb5c3c" strokeWidth="2.2" />
              </g>
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.svg>
    </div>
  );
}
