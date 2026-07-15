// Зёрна — внутренняя игровая валюта DOFFA (НЕ криптовалюта, не выводится).
// Копятся тапами по маскоту-чашке и тратятся на вход в матчи.
//
// ВАЖНО (безопасность/античит): истинный баланс зёрен живёт на СЕРВЕРЕ
// (server/src/services/beansService.ts). Этот стор — оптимистичный КЭШ для
// отзывчивости тапалки: тап начисляет зерно локально сразу же, а
// накопленная с прошлой сверки партия (см. `takePendingSync`) периодически
// отправляется на сервер (см. src/screens/BeansScreen.tsx, net/onlineStore.ts
// `syncBeans`) — сервер урезает её до правдоподобного максимума по своим
// часам и присылает авторитетный баланс через `syncFromServer`. Работает и
// без подключённого кошелька (полностью офлайн), просто без серверной сверки.
//
// Экономика v1 (легко расширяется под комбо/бонусы/задания/множители):
//   1 тап = +1 зерно, −1 энергия. Энергия ограничена и восстанавливается со временем.
//   Быстрые тапы подряд → комбо-множитель. Редко выпадает бонусное/золотое зерно.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Стоимость входа в матч (зёрна). Должна совпадать с серверной BEANS_ENTRY_FEE. */
export const MATCH_ENTRY_COST = 100;
/** Максимум энергии. */
export const ENERGY_MAX = 1000;
/** Энергия восстанавливается на 1 каждые N мс (здесь: ~3.6 сек → 1000 за час). */
export const ENERGY_REGEN_MS = 3600;
/** Базовое зерно за тап. */
const BASE_PER_TAP = 1;
/** Окно комбо: тапы чаще этого (мс) наращивают серию. */
const COMBO_WINDOW_MS = 450;
/** На каждые N тапов серии — +1 к множителю (кап COMBO_MAX). */
const COMBO_STEP = 12;
const COMBO_MAX = 5;

/** Результат одного тапа — для визуального отклика экрана. */
export interface TapResult {
  /** Начислено зёрен за этот тап (с учётом комбо/бонуса). */
  gained: number;
  /** Текущая серия комбо (для feedback). */
  combo: number;
  /** Активный множитель комбо. */
  multiplier: number;
  /** Выпало ли редкое золотое зерно. */
  golden: boolean;
  /** Тап не прошёл — нет энергии. */
  empty: boolean;
}

/** Запись в локальной истории зёрен (тренировка/вход в матч/возврат). */
export interface BeansEntry {
  id: number;
  date: number;
  kind: 'training' | 'entryFee' | 'refund';
  amount: number;
  note: string;
}

interface BeansState {
  /** Баланс зёрен (кэш; истина — сервер). */
  beans: number;
  /** Текущая энергия. */
  energy: number;
  /** Метка времени последнего пересчёта энергии (для регена). */
  lastEnergyTs: number;
  /** Метка последнего тапа (для комбо). */
  lastTapTs: number;
  /** Текущая серия комбо. */
  combo: number;
  /** Всего тапов за всё время (для будущих заданий/статистики). */
  totalTaps: number;
  /** Зёрна последней офлайн-тренировки — для оверлея результата (только после подтверждения сервера). */
  lastTrainingBeans: number;
  /** Локальная история начислений/списаний (кэш; сервер — этап 3+). */
  history: BeansEntry[];
  /** Тапов с прошлой сверки с сервером (см. src/screens/BeansScreen.tsx). */
  pendingTapped: number;
  /** Зёрен насчитано локально с прошлой сверки с сервером. */
  pendingGained: number;

  /** Пересчитать восстановленную энергию (idempotent, безопасно звать часто). */
  regen: () => void;
  /** Тап по маскоту. Возвращает результат для анимации. */
  tap: () => TapResult;
  /** Снимает и сбрасывает накопленные с прошлой сверки тап/зерно-счётчики. */
  takePendingSync: () => { tapped: number; gained: number };
  /**
   * Применяет ПОДТВЕРЖДЁННЫЙ сервером результат запроса тренировочных зёрен
   * (см. beans:awardTraining в net/onlineStore.ts). `granted` — сколько
   * реально начислено (0, если сервер отказал/rate-limit) — клиент никогда
   * не решает эту сумму сам.
   */
  applyTrainingResult: (granted: number, beans: number, energy: number) => void;
  /** Сбрасывает витрину последней тренировочной награды перед новой офлайн-партией. */
  resetLastTraining: () => void;
  /** Хватает ли зёрен на вход в матч. */
  canEnterMatch: () => boolean;
  /** Списать вход в матч (вернёт false, если не хватает). Сервер продублирует. */
  spendEntry: () => boolean;
  /** Синхронизация с сервером: единственный легитимный способ
   *  перезаписать баланс/энергию значениями, которым доверяет бэкенд. */
  syncFromServer: (data: Partial<Pick<BeansState, 'beans' | 'energy'>>) => void;
  reset: () => void;
}

function beansEntry(kind: BeansEntry['kind'], amount: number, note: string): BeansEntry {
  return { id: Date.now() + Math.floor(Math.random() * 1000), date: Date.now(), kind, amount, note };
}

/** Сколько энергии восстановилось с прошлой метки (без мутаций). */
function computeRegen(energy: number, lastTs: number, now: number): { energy: number; ts: number } {
  if (energy >= ENERGY_MAX) return { energy, ts: now };
  const elapsed = now - lastTs;
  const restored = Math.floor(elapsed / ENERGY_REGEN_MS);
  if (restored <= 0) return { energy, ts: lastTs };
  return {
    energy: Math.min(ENERGY_MAX, energy + restored),
    // Переносим «остаток» времени, чтобы реген не терял дробную часть.
    ts: lastTs + restored * ENERGY_REGEN_MS,
  };
}

export const useBeansStore = create<BeansState>()(
  persist(
    (set, get) => ({
      beans: 0,
      energy: ENERGY_MAX,
      lastEnergyTs: Date.now(),
      lastTapTs: 0,
      combo: 0,
      totalTaps: 0,
      lastTrainingBeans: 0,
      history: [],
      pendingTapped: 0,
      pendingGained: 0,

      regen: () => {
        const s = get();
        const r = computeRegen(s.energy, s.lastEnergyTs, Date.now());
        if (r.energy !== s.energy || r.ts !== s.lastEnergyTs) {
          set({ energy: r.energy, lastEnergyTs: r.ts });
        }
      },

      tap: () => {
        const now = Date.now();
        const s = get();
        // Сначала догоняем реген, чтобы тап учитывал восстановленную энергию.
        const r = computeRegen(s.energy, s.lastEnergyTs, now);
        if (r.energy <= 0) {
          set({ energy: 0, lastEnergyTs: r.ts, combo: 0 });
          return { gained: 0, combo: 0, multiplier: 1, golden: false, empty: true };
        }

        // Комбо: продолжаем серию, если тап в окне; иначе сбрасываем.
        const combo = now - s.lastTapTs <= COMBO_WINDOW_MS ? s.combo + 1 : 1;
        const multiplier = Math.min(COMBO_MAX, 1 + Math.floor(combo / COMBO_STEP));
        // Редкое золотое зерно (~2.5%) — крупный бонус и особый feedback.
        const golden = deterministicChance(s.totalTaps, now);
        const gained = BASE_PER_TAP * multiplier + (golden ? 24 : 0);

        set({
          beans: s.beans + gained,
          energy: r.energy - 1,
          lastEnergyTs: r.ts,
          lastTapTs: now,
          combo,
          totalTaps: s.totalTaps + 1,
          pendingTapped: s.pendingTapped + 1,
          pendingGained: s.pendingGained + gained,
        });
        return { gained, combo, multiplier, golden, empty: false };
      },

      takePendingSync: () => {
        const { pendingTapped, pendingGained } = get();
        set({ pendingTapped: 0, pendingGained: 0 });
        return { tapped: pendingTapped, gained: pendingGained };
      },

      applyTrainingResult: (granted, beans, energy) =>
        set((s) => ({
          beans,
          energy,
          lastEnergyTs: Date.now(),
          lastTrainingBeans: granted,
          history:
            granted > 0
              ? [beansEntry('training', granted, 'Тренировка'), ...s.history].slice(0, 50)
              : s.history,
        })),

      resetLastTraining: () => set({ lastTrainingBeans: 0 }),

      canEnterMatch: () => get().beans >= MATCH_ENTRY_COST,

      spendEntry: () => {
        const s = get();
        if (s.beans < MATCH_ENTRY_COST) return false;
        set({ beans: s.beans - MATCH_ENTRY_COST });
        return true;
      },

      syncFromServer: (data) =>
        set((s) => ({
          beans: data.beans ?? s.beans,
          energy: data.energy ?? s.energy,
          lastEnergyTs: Date.now(),
        })),

      reset: () =>
        set({
          beans: 0,
          energy: ENERGY_MAX,
          lastEnergyTs: Date.now(),
          lastTapTs: 0,
          combo: 0,
          totalTaps: 0,
          lastTrainingBeans: 0,
          history: [],
          pendingTapped: 0,
          pendingGained: 0,
        }),
    }),
    { name: 'doffa-crazy8-beans-v1' },
  ),
);

// Псевдослучайность без Math.random в hot-path: смешиваем счётчик тапов и время.
// Даёт ~2.5% золотых зёрен, но детерминирована по входу (тестопригодно).
function deterministicChance(seed: number, now: number): boolean {
  const x = Math.sin(seed * 12.9898 + now * 0.0001) * 43758.5453;
  return x - Math.floor(x) > 0.975;
}
