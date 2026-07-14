// Фирменный маскот DOFFA — настоящий логотип DOFFA Espresso Bar (детальные
// кеды, джинсы, чашка, «DOFFA» / «ESPRESSO BAR Since 2021», зёрна, горы,
// орлы) вместо упрощённого рисунка. Логотип — растровый актив, поэтому
// анимируем весь объект целиком (сжатие/раскачка/подпрыгивание), плюс
// добавляем «полевые» эффекты вокруг него: расходящиеся кольца и вспышка
// света (bloom) при тапе — ощущение тактильного, живого премиального объекта.
//
// Состояния:
//   idle  — «дышит», лёгкий bob, пар поднимается, мягкая пульсация ореола.
//   tap   — сжатие + покачивание (имитация подпрыгивания ножек и колебания
//           жидкости в чашке без покадровой прорисовки), кольца поля и вспышка.
//   tired — мало энергии: приглушённые цвета и анимация.
import { useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

interface Props {
  /** Растёт на каждый тап — триггер tap-анимации. */
  tapSignal: number;
  /** Сила комбо (1..5) — усиливает раскачку и кольца поля. */
  combo?: number;
  /** Мало/нет энергии — «уставший» вид. */
  tired?: boolean;
  className?: string;
}

export function DoffaMascot({ tapSignal, combo = 1, tired = false, className = '' }: Props) {
  const logo = useAnimationControls();
  const ringA = useAnimationControls();
  const ringB = useAnimationControls();
  const ringC = useAnimationControls();
  const bloom = useAnimationControls();

  // Реакция на тап: сжатие/покачивание логотипа + расходящиеся кольца поля + вспышка.
  useEffect(() => {
    if (tapSignal === 0) return;
    const amp = Math.min(1 + combo * 0.14, 1.9); // комбо усиливает амплитуду

    logo.start({
      rotate: [0, -5 * amp, 4 * amp, -1.5, 0],
      scaleY: [1, 0.88, 1.08, 0.98, 1],
      scaleX: [1, 1.09, 0.95, 1.02, 1],
      y: [0, -8 * amp, 2, 0],
      transition: { duration: 0.55, ease: 'easeOut' },
    });
    // Быстрая ударная волна прямо от центра — самая заметная, сразу за тапом.
    ringA.start({
      scale: [0.5, 1.9 + combo * 0.12],
      opacity: [0.95, 0],
      transition: { duration: 0.55, ease: 'easeOut' },
    });
    ringB.start({
      scale: [0.5, 2.5 + combo * 0.16],
      opacity: [0.75, 0],
      transition: { duration: 0.75, delay: 0.06, ease: 'easeOut' },
    });
    // Третье, широкое «полевое» кольцо — медленнее и мягче, усиливает ощущение поля.
    ringC.start({
      scale: [0.5, 3.1 + combo * 0.2],
      opacity: [0.5, 0],
      transition: { duration: 0.95, delay: 0.1, ease: 'easeOut' },
    });
    bloom.start({
      opacity: [0, 0.9, 0],
      scale: [0.8, 1.25, 1.35],
      transition: { duration: 0.45, ease: 'easeOut' },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapSignal]);

  const idleDur = tired ? 5.5 : 3.6;

  return (
    <div className={`relative select-none ${className}`}>
      {/* тёплое свечение под логотипом */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{
          background: tired
            ? 'radial-gradient(circle at 50% 55%, rgba(110,125,91,0.28), transparent 68%)'
            : 'radial-gradient(circle at 50% 52%, rgba(224,164,59,0.45), rgba(58,94,66,0.18) 55%, transparent 72%)',
        }}
      />

      {/* кольца «поля», расходящиеся от логотипа при тапе — толстые, светящиеся, хорошо читаются */}
      <motion.span
        aria-hidden
        initial={{ scale: 0.5, opacity: 0 }}
        animate={ringA}
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: '0 0 22px 6px rgba(255,221,150,0.9), 0 0 0 3px rgba(255,238,200,0.95)' }}
      />
      <motion.span
        aria-hidden
        initial={{ scale: 0.5, opacity: 0 }}
        animate={ringB}
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: '0 0 30px 8px rgba(224,164,59,0.7), 0 0 0 3px rgba(224,164,59,0.75)' }}
      />
      <motion.span
        aria-hidden
        initial={{ scale: 0.5, opacity: 0 }}
        animate={ringC}
        className="pointer-events-none absolute inset-0 rounded-full blur-md"
        style={{ boxShadow: '0 0 0 5px rgba(242,217,160,0.5)' }}
      />
      {/* вспышка света (bloom) в момент тапа */}
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={bloom}
        className="pointer-events-none absolute inset-0 rounded-full blur-xl"
        style={{ background: 'radial-gradient(circle, rgba(255,250,235,1), rgba(255,221,150,0.55) 45%, rgba(224,164,59,0.25) 65%, transparent 78%)' }}
      />

      {/* пар — три завитка (idle), примерно над чашкой в логотипе */}
      {!tired && (
        <svg viewBox="0 0 300 340" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M${128 + i * 22} 118 c-8 -10 8 -18 0 -30`}
              fill="none"
              stroke="#f2d9a0"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.45"
              animate={{ opacity: [0, 0.5, 0], y: [6, -14, -24] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            />
          ))}
        </svg>
      )}

      {/* настоящий логотип DOFFA Espresso Bar — анимируется целиком */}
      <motion.div
        className="relative h-full w-full overflow-visible rounded-full"
        animate={{
          scale: tired ? [1, 1.005, 1] : [1, 1.018, 1],
          y: [0, -3, 0],
        }}
        transition={{ duration: idleDur, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.img
          src="/art/doffa-logo.webp"
          alt="DOFFA Espresso Bar"
          animate={logo}
          draggable={false}
          className="h-full w-full rounded-full object-cover shadow-[0_18px_50px_-14px_rgba(0,0,0,0.7)]"
          style={{
            filter: tired ? 'saturate(0.45) brightness(0.82)' : 'saturate(1.05) contrast(1.03)',
          }}
        />
        {/* тонкое золотое кольцо поверх логотипа для премиальной окантовки */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 0 0 2px rgba(224,164,59,0.55), inset 0 2px 10px rgba(0,0,0,0.35)' }}
        />
      </motion.div>
    </div>
  );
}
