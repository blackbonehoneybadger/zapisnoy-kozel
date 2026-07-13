// Награды экосистемы DOFFA.
//
// РАЗДЕЛЕНИЕ СУЩНОСТЕЙ (этап 2):
//   Cups  — внутренняя игровая энергия. Не криптовалюта, не выводится.
//           Офлайн-тренировка против ботов начисляет ТОЛЬКО тренировочные Cups.
//   DOFFA — настоящая награда на Solana. Клиент НИКОГДА не начисляет DOFFA сам.
//           Поле `doffa` (доступно к получению) заполняется ТОЛЬКО сервером
//           после подтверждённой онлайн-победы (этап 3+). До подключения
//           серверной экономики оно остаётся 0 в офлайн-режиме.
//
// localStorage здесь — только КЭШ интерфейса. Истинный баланс (этап 3+) живёт
// на сервере; клиент будет синхронизировать его через `setServerRewards`.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Тренировочные Cups за любую офлайн-партию против ботов. */
export const CUPS_PER_GAME = 10;
/** Тренировочные Cups сверху за офлайн-победу. */
export const CUPS_PER_WIN = 25;

export interface RewardEntry {
  id: number;
  date: number; // timestamp
  kind: 'cups' | 'doffa' | 'claim';
  amount: number;
  note: string;
}

export interface RewardsState {
  /** Игровая энергия (кэш; серверная истина — этап 3+). */
  cups: number;
  /** Доступный к получению DOFFA. Заполняется ТОЛЬКО сервером. */
  doffa: number;
  /** DOFFA, по которому создана заявка на вывод (кэш серверного статуса). */
  doffaClaimed: number;
  /** Кошелёк последней заявки. */
  claimWallet: string | null;
  /** Тренировочные Cups последней офлайн-победы — для оверлея. */
  lastTrainingCups: number;
  history: RewardEntry[];
  /**
   * Офлайн-тренировка против ботов: начисляет ТОЛЬКО тренировочные Cups.
   * НЕ начисляет DOFFA и НЕ создаёт заявку на вывод. Возвращает сумму Cups.
   */
  awardTraining: (won: boolean) => number;
  /**
   * Синхронизация с сервером (этап 3+): единственный легитимный способ
   * изменить баланс DOFFA/Cups на клиенте. Пока сервер не шлёт эти данные —
   * не вызывается.
   */
  setServerRewards: (r: Partial<Pick<RewardsState, 'cups' | 'doffa' | 'doffaClaimed'>>) => void;
  /**
   * Кэш-отметка о заявке на вывод. НАСТОЯЩИЙ Claim выполняет сервер (этап 4+);
   * здесь только локальное отражение статуса. Возвращает сумму заявки.
   */
  claim: (wallet: string) => number;
  reset: () => void;
}

function entry(kind: RewardEntry['kind'], amount: number, note: string): RewardEntry {
  return { id: Date.now() + Math.floor(Math.random() * 1000), date: Date.now(), kind, amount, note };
}

export const useRewardsStore = create<RewardsState>()(
  persist(
    (set, get) => ({
      cups: 0,
      doffa: 0,
      doffaClaimed: 0,
      claimWallet: null,
      lastTrainingCups: 0,
      history: [],

      awardTraining: (won) => {
        const cupsGain = CUPS_PER_GAME + (won ? CUPS_PER_WIN : 0);
        set((s) => ({
          cups: s.cups + cupsGain,
          lastTrainingCups: cupsGain,
          history: [
            entry('cups', cupsGain, won ? 'Тренировка · победа' : 'Тренировка'),
            ...s.history,
          ].slice(0, 50),
        }));
        return cupsGain;
      },

      setServerRewards: (r) =>
        set((s) => ({
          cups: r.cups ?? s.cups,
          doffa: r.doffa ?? s.doffa,
          doffaClaimed: r.doffaClaimed ?? s.doffaClaimed,
        })),

      claim: (wallet) => {
        const amount = get().doffa;
        if (amount <= 0) return 0;
        set((s) => ({
          doffa: 0,
          doffaClaimed: s.doffaClaimed + amount,
          claimWallet: wallet,
          history: [
            entry('claim', amount, `Заявка на вывод · ${wallet.slice(0, 4)}…${wallet.slice(-4)}`),
            ...s.history,
          ].slice(0, 50),
        }));
        return amount;
      },

      reset: () =>
        set({ cups: 0, doffa: 0, doffaClaimed: 0, claimWallet: null, lastTrainingCups: 0, history: [] }),
    }),
    // v2: сбрасываем прежний кэш, где офлайн-победы нелегитимно копили DOFFA.
    { name: 'doffa-crazy8-rewards-v2' },
  ),
);
