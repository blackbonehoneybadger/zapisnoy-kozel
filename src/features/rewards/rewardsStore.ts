// Награда DOFFA — единственная сущность в этом сторе (этап 2+).
//
// Зёрна (внутренняя игровая энергия, НЕ криптовалюта) больше не хранятся
// здесь — единственный источник истины по зёрнам см. store/beansStore.ts.
// Этот стор отвечает ТОЛЬКО за DOFFA: клиент НИКОГДА не начисляет DOFFA сам.
// Поле `doffa` (доступно к получению) заполняется ТОЛЬКО сервером после
// подтверждённой онлайн-победы (этап 3+). До подключения серверной
// экономики оно остаётся 0.
//
// localStorage здесь — только КЭШ интерфейса. Истинный баланс (этап 3+) живёт
// на сервере; клиент будет синхронизировать его через `setServerRewards`.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RewardEntry {
  id: number;
  date: number; // timestamp
  kind: 'doffa' | 'claim';
  amount: number;
  note: string;
}

export interface RewardsState {
  /** Доступный к получению DOFFA. Заполняется ТОЛЬКО сервером. */
  doffa: number;
  /** DOFFA, по которому создана заявка на вывод (кэш серверного статуса). */
  doffaClaimed: number;
  /** Кошелёк последней заявки. */
  claimWallet: string | null;
  history: RewardEntry[];
  /**
   * Синхронизация с сервером (этап 3+): единственный легитимный способ
   * изменить баланс DOFFA на клиенте. Пока сервер не шлёт эти данные —
   * не вызывается.
   */
  setServerRewards: (r: Partial<Pick<RewardsState, 'doffa' | 'doffaClaimed'>>) => void;
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
      doffa: 0,
      doffaClaimed: 0,
      claimWallet: null,
      history: [],

      setServerRewards: (r) =>
        set((s) => ({
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

      reset: () => set({ doffa: 0, doffaClaimed: 0, claimWallet: null, history: [] }),
    }),
    // v3: убраны Cups — единая валюта «Зёрна» теперь только в beansStore.
    { name: 'doffa-crazy8-rewards-v3' },
  ),
);
