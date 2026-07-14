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
import { isOnlineConnected, sendOnline } from '../net/wsBridge';

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

export interface ServerRewardItem {
  id: string;
  amount: number;
  matchId: string;
  status: string;
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
  /** Серверные available-награды (для reward:claim). */
  available: ServerRewardItem[];
  history: RewardEntry[];
  /**
   * Офлайн-тренировка против ботов: начисляет ТОЛЬКО тренировочные Cups.
   * НЕ начисляет DOFFA и НЕ создаёт заявку на вывод. Возвращает сумму Cups.
   */
  awardTraining: (won: boolean) => number;
  /**
   * Синхронизация с сервером: единственный легитимный способ изменить DOFFA/Cups
   * и список available-наград на клиенте.
   */
  setServerRewards: (
    r: Partial<Pick<RewardsState, 'cups' | 'doffa' | 'doffaClaimed' | 'available'>>,
  ) => void;
  /**
   * Кэш-отметка о заявке на вывод. НАСТОЯЩИЙ Claim выполняет сервер (mock пока
   * DOFFA_CLAIM_ENABLED=false). Здесь только локальное отражение + отправка WS.
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
      available: [],
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
          available: r.available ?? s.available,
        })),

      claim: (wallet) => {
        const s = get();
        const amount = s.doffa;
        if (amount <= 0) return 0;

        // Онлайн: серверный mock-claim (DOFFA_CLAIM_ENABLED=false → testMode).
        if (isOnlineConnected() && s.available.length > 0) {
          const reward = s.available[0];
          const idempotencyKey = `claim:${reward.id}:${wallet}`;
          sendOnline({ t: 'reward:claim', rewardId: reward.id, idempotencyKey });
          // Оптимистичный кэш — финальный список придёт в reward:list.
          set({
            doffa: Math.max(0, s.doffa - reward.amount),
            doffaClaimed: s.doffaClaimed + reward.amount,
            claimWallet: wallet,
            history: [
              entry('claim', reward.amount, `Заявка · ${wallet.slice(0, 4)}…${wallet.slice(-4)}`),
              ...s.history,
            ].slice(0, 50),
          });
          return reward.amount;
        }

        set((st) => ({
          doffa: 0,
          doffaClaimed: st.doffaClaimed + amount,
          claimWallet: wallet,
          history: [
            entry('claim', amount, `Заявка на вывод · ${wallet.slice(0, 4)}…${wallet.slice(-4)}`),
            ...st.history,
          ].slice(0, 50),
        }));
        return amount;
      },

      reset: () =>
        set({
          cups: 0,
          doffa: 0,
          doffaClaimed: 0,
          claimWallet: null,
          lastTrainingCups: 0,
          available: [],
          history: [],
        }),
    }),
    // v2: сбрасываем прежний кэш, где офлайн-победы нелегитимно копили DOFFA.
    { name: 'doffa-crazy8-rewards-v2' },
  ),
);
