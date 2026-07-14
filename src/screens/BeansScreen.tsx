// Экран «Накопить зёрна» — фирменная тапалка DOFFA. Игрок тапает по маскоту-
// чашке и копит зёрна (внутренняя валюта для входа в матчи). Мотив, палитра и
// анимации — в бренде doffa.coffee (эспрессо/крем/золото/медь/лес, тёплое свечение).
//
// Что моковое сейчас: баланс зёрен и энергия живут в localStorage-кэше
// (beansStore). Истинный баланс — будущий серверный (beansStore.syncFromServer +
// WS-команды). Экономика v1: 1 тап = +1 зерно −1 энергия, комбо-множитель,
// редкие золотые зёрна. Легко расширяется под задания/бонусы/множители.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PremiumButton } from '../components/PremiumButton';
import { DoffaMascot } from '../components/DoffaMascot';
import { DoffaEmblem } from '../components/DoffaEmblem';
import { haptics } from '../game/haptics';
import {
  useBeansStore,
  MATCH_ENTRY_COST,
  ENERGY_MAX,
} from '../store/beansStore';
import type { Screen } from '../App';

interface Props {
  navigate: (s: Screen) => void;
  onPlay: () => void;
}

/** Одна вспышка feedback при тапе (летящее зерно + «+N»). */
interface Burst {
  id: number;
  gained: number;
  golden: boolean;
  /** Горизонтальный разброс старта, px. */
  dx: number;
}

let burstSeq = 0;

export function BeansScreen({ navigate, onPlay }: Props) {
  const beans = useBeansStore((s) => s.beans);
  const energy = useBeansStore((s) => s.energy);
  const combo = useBeansStore((s) => s.combo);
  const tap = useBeansStore((s) => s.tap);
  const regen = useBeansStore((s) => s.regen);
  const canEnter = useBeansStore((s) => s.canEnterMatch());

  const [tapSignal, setTapSignal] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [comboFlash, setComboFlash] = useState(0);
  const [needBeans, setNeedBeans] = useState(false);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lowEnergy = energy <= 0;
  const energyPct = Math.round((energy / ENERGY_MAX) * 100);

  // Тик регена энергии — раз в секунду обновляет полоску, даже без тапов.
  useEffect(() => {
    regen();
    const t = setInterval(regen, 1000);
    return () => clearInterval(t);
  }, [regen]);

  const handleTap = () => {
    const res = tap();
    if (res.empty) {
      haptics.penalty?.();
      setTapSignal((n) => n + 1); // лёгкая реакция даже без энергии
      return;
    }
    // Гаптика: обычный тап — лёгкий; золотое зерно — «особый».
    if (res.golden) haptics.special?.();
    else haptics.tap?.();

    setTapSignal((n) => n + 1);
    // Ограничиваем число одновременных частиц ради плавности.
    setBursts((list) => [
      ...list.slice(-11),
      { id: ++burstSeq, gained: res.gained, golden: res.golden, dx: (burstSeq % 5) * 14 - 28 },
    ]);
    if (res.multiplier > 1) {
      setComboFlash(res.multiplier);
      if (comboTimer.current) clearTimeout(comboTimer.current);
      comboTimer.current = setTimeout(() => setComboFlash(0), 700);
    }
  };

  const removeBurst = (id: number) => setBursts((l) => l.filter((b) => b.id !== id));

  const handlePlay = () => {
    if (!canEnter) {
      setNeedBeans(true);
      haptics.penalty?.();
      return;
    }
    haptics.tap?.();
    onPlay();
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col px-5 pb-28 pt-4 safe-top">
      {/* ВЕРХНЯЯ ЗОНА: баланс зёрен + энергия */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3.5 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-sheen text-ink-900">
            <BeanIcon />
          </span>
          <div className="leading-tight">
            {/* Живой счётчик: краткий «поп» при изменении (key по значению). */}
            <motion.div
              key={beans}
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="font-display text-xl gold-text tabular-nums"
            >
              {beans}
            </motion.div>
            <div className="text-[10px] uppercase tracking-wide text-white/40">зёрна</div>
          </div>
        </div>

        <div className="glass flex-1 rounded-2xl px-3.5 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-white/55">Энергия</span>
            <span className="tabular-nums text-gold-300/90">
              {energy} / {ENERGY_MAX}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: lowEnergy
                  ? 'linear-gradient(90deg,#6e7d5b,#3a5e42)'
                  : 'linear-gradient(90deg,#ecba54,#e0a43b,#bb5c3c)',
              }}
              animate={{ width: `${energyPct}%` }}
              transition={{ ease: 'easeOut', duration: 0.4 }}
            />
          </div>
        </div>
      </div>
      <p className="relative z-10 mt-2 text-center text-[11px] text-white/35">
        Зёрна нужны для входа в матчи
      </p>

      {/* ЦЕНТР: маскот-чашка (главный tappable-объект) */}
      <div className="relative flex flex-1 items-center justify-center">
        {/* combo-бейдж */}
        <AnimatePresence>
          {comboFlash > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="pointer-events-none absolute top-2 z-20 rounded-full bg-gold-sheen px-3 py-1 text-sm font-bold text-ink-900 shadow-glow"
            >
              Комбо ×{comboFlash}
            </motion.div>
          )}
        </AnimatePresence>

        {/* летящие зёрна + «+N» к счётчику (вверх-влево) */}
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <AnimatePresence>
            {bursts.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: b.dx, y: -10, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], x: b.dx * 0.3 - 120, y: -230, scale: 1 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                onAnimationComplete={() => removeBurst(b.id)}
                className="absolute flex items-center gap-1"
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                    b.golden ? 'bg-gold-sheen text-ink-900 shadow-glow' : 'bg-felt-600/60 text-gold-200'
                  }`}
                >
                  <BeanIcon small />
                </span>
                <span className={`font-display text-sm ${b.golden ? 'text-gold-300' : 'text-gold-200/80'}`}>
                  +{b.gained}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* сам маскот — нажимаемый */}
        <motion.button
          onPointerDown={handleTap}
          whileTap={{ scale: 0.97 }}
          aria-label="Тапнуть по чашке DOFFA"
          className="relative z-10 w-[78%] max-w-[320px] outline-none"
        >
          <DoffaMascot tapSignal={tapSignal} combo={combo} tired={lowEnergy} />
        </motion.button>
      </div>

      {/* ПОДСКАЗКА */}
      <p className="mb-3 text-center text-sm text-white/55">
        Тапай по чашке и копи зёрна для матчей
      </p>

      {/* 3 ИНФО-КАРТОЧКИ */}
      <div className="grid grid-cols-3 gap-2.5">
        <InfoCard label="Вход в матч" value={`${MATCH_ENTRY_COST}`} hint="зёрен" tone="amber" />
        <InfoCard label="Твой баланс" value={`${beans}`} hint="зёрен" tone="cream" />
        <InfoCard label="Награда" value="DOFFA" hint="за победы" tone="forest" />
      </div>

      {/* КНОПКИ */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 pb-4">
        <PremiumButton full variant="gold" onClick={handlePlay}>
          Играть
        </PremiumButton>
        <PremiumButton full variant="ghost" onClick={() => navigate('rewards')}>
          Задания
        </PremiumButton>
        <PremiumButton full variant="ghost" onClick={() => haptics.tap?.()}>
          Бонус дня
        </PremiumButton>
        <PremiumButton full variant="ghost" onClick={() => haptics.tap?.()}>
          Пригласить друга
        </PremiumButton>
      </div>

      {/* СОСТОЯНИЕ: мало энергии */}
      <AnimatePresence>
        {lowEnergy && <LowEnergySheet onTasks={() => navigate('rewards')} />}
      </AnimatePresence>

      {/* СОСТОЯНИЕ: недостаточно зёрен для входа */}
      <AnimatePresence>
        {needBeans && (
          <NeedBeansSheet
            beans={beans}
            onClose={() => setNeedBeans(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────── вспомогательные компоненты ─────────────── */

function InfoCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'amber' | 'cream' | 'forest';
}) {
  const color =
    tone === 'amber' ? 'text-gold-300' : tone === 'forest' ? 'text-emerald-300' : 'text-[#f3efe6]';
  return (
    <div className="glass rounded-2xl px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-0.5 font-display text-lg ${color}`}>{value}</div>
      <div className="text-[10px] text-white/35">{hint}</div>
    </div>
  );
}

/** Иконка зерна (маленькая, для счётчика и частиц). */
function BeanIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="7" ry="10" fill="currentColor" transform="rotate(-24 12 12)" />
      <path d="M12 3c-3 5-3 13 0 18" stroke="#1b140c" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** Шторка «мало энергии». */
function LowEnergySheet({ onTasks }: { onTasks: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-40 px-5 pb-6 safe-bottom"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        className="glass-strong mx-auto max-w-md rounded-3xl border border-emerald-600/20 p-5 text-center"
      >
        <DoffaEmblem size={40} className="mx-auto mb-1 opacity-80" />
        <h3 className="font-display text-xl text-[#f3efe6]">Энергия закончилась</h3>
        <p className="mb-4 mt-1 text-xs text-white/50">
          Чашка устала. Энергия восстанавливается со временем — загляни позже или
          забери бонус.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <PremiumButton full variant="ghost" onClick={() => {}}>
            Подождать
          </PremiumButton>
          <PremiumButton full variant="gold" onClick={onTasks}>
            Бонус
          </PremiumButton>
          <PremiumButton full variant="ghost" onClick={onTasks}>
            Задания
          </PremiumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Шторка «недостаточно зёрен». */
function NeedBeansSheet({ beans, onClose }: { beans: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.86, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.86, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center"
      >
        <h3 className="font-display text-2xl gold-text">Недостаточно зёрен</h3>
        <p className="mb-1 mt-2 text-sm text-white/60">
          Для входа в матч нужно {MATCH_ENTRY_COST} зёрен.
        </p>
        <p className="mb-5 text-xs text-white/40">У тебя сейчас {beans}.</p>
        <PremiumButton full variant="gold" onClick={onClose}>
          Накопить зёрна
        </PremiumButton>
      </motion.div>
    </motion.div>
  );
}
