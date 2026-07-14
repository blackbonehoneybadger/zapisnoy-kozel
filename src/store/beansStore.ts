// Зёрна — внутренняя игровая валюта DOFFA (НЕ криптовалюта, не выводится).
// Копятся тапами по маскоту-чашке и тратятся на вход в матчи.
//
// ВАЖНО (безопасность/античит): истинный баланс зёрен должен жить на СЕРВЕРЕ.
// Этот стор — только КЭШ интерфейса для отзывчивости тапалки. Клиент не должен
// быть источником истины: локальный тап начисляет зерно оптимистично, а сервер
// (beans:tap → beans:state) валидирует и перезаписывает баланс.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isOnlineConnected, sendOnline } from '../net/wsBridge';

/** Стоимость входа в матч (зёрна). Должна совпадать с серверной CUPS_ENTRY_FEE. */
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

  /** Пересчитать восстановленную энергию (idempotent, безопасно звать часто). */
  regen: () => void;
  /** Тап по маскоту. Возвращает результат для анимации. */
  tap: () => TapResult;
  /** Хватает ли зёрен на вход в матч. */
  canEnterMatch: () => boolean;
  /** Списать вход в матч (вернёт false, если не хватает). Сервер продублирует. */
  spendEntry: () => boolean;
  /** Синхронизация с сервером: единственный легитимный способ
   *  перезаписать баланс/энергию значениями, которым доверяет бэкенд. */
  syncFromServer: (
    data: Partial<Pick<BeansState, 'beans' | 'energy' | 'totalTaps' | 'combo'>>,
  ) => void;
  reset: () => void;
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

      regen: () => {
        // При онлайн-сессии энергия авторитетна на сервере — локальный реген
        // только для офлайн-кэша UI между beans:state.
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
          if (isOnlineConnected()) sendOnline({ t: 'beans:tap', count: 1 });
          return { gained: 0, combo: 0, multiplier: 1, golden: false, empty: true };
        }

        // Комбо: продолжаем серию, если тап в окне; иначе сбрасываем.
        const combo = now - s.lastTapTs <= COMBO_WINDOW_MS ? s.combo + 1 : 1;
        const multiplier = Math.min(COMBO_MAX, 1 + Math.floor(combo / COMBO_STEP));
        // Редкое золотое зерно (~2.5%) — крупный бонус и особый feedback.
        const golden = deterministicChance(s.totalTaps, now);
        const gained = BASE_PER_TAP * multiplier + (golden ? 24 : 0);

        // Оптимистичный кэш; сервер перезапишет через beans:state.
        set({
          beans: s.beans + gained,
          energy: r.energy - 1,
          lastEnergyTs: r.ts,
          lastTapTs: now,
          combo,
          totalTaps: s.totalTaps + 1,
        });

        if (isOnlineConnected()) {
          sendOnline({ t: 'beans:tap', count: 1 });
        }

        return { gained, combo, multiplier, golden, empty: false };
      },

      canEnterMatch: () => get().beans >= MATCH_ENTRY_COST,

      spendEntry: () => {
        // Офлайн / локальный UI. Онлайн-вход списывает сервер на table:start.
        const s = get();
        if (s.beans < MATCH_ENTRY_COST) return false;
        set({ beans: s.beans - MATCH_ENTRY_COST });
        return true;
      },

      syncFromServer: (data) =>
        set((st) => ({
          beans: data.beans ?? st.beans,
          energy: data.energy ?? st.energy,
          totalTaps: data.totalTaps ?? st.totalTaps,
          combo: data.combo ?? st.combo,
          lastEnergyTs: Date.now(),
        })),

      reset: () =>
        set({ beans: 0, energy: ENERGY_MAX, lastEnergyTs: Date.now(), lastTapTs: 0, combo: 0, totalTaps: 0 }),
    }),
    // Имя только UI-кэш; при online auth сервер перезапишет баланс.
    { name: 'doffa-crazy8-beans-v1' },
  ),
);

// Псевдослучайность без Math.random в hot-path: смешиваем счётчик тапов и время.
// Даёт ~2.5% золотых зёрен, но детерминирована по входу (тестопригодно).
function deterministicChance(seed: number, now: number): boolean {
  const x = Math.sin(seed * 12.9898 + now * 0.0001) * 43758.5453;
  return x - Math.floor(x) > 0.975;
}
