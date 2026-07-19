// Награда DOFFA — единственная сущность в этом сторе.
//
// Зёрна (внутренняя игровая энергия, НЕ криптовалюта) не хранятся здесь —
// единственный источник истины по зёрнам см. features/beans/beansStore.ts.
// Этот стор отвечает ТОЛЬКО за DOFFA: клиент НИКОГДА не начисляет и не
// подтверждает DOFFA сам. `available` (список наград к получению) и
// `history` заполняются ТОЛЬКО ответами сервера (reward:list/reward:history,
// см. net/onlineStore.ts) — реальный Claim тоже выполняет сервер
// (reward:claim → reward:claimResult), здесь только отражение его исхода.
//
// localStorage — только КЭШ интерфейса (мгновенный рендер до первого ответа
// сервера после переподключения); источник истины всегда живёт на сервере.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RewardEntry {
  id: string;
  date: number; // timestamp
  kind: 'doffa' | 'claim';
  amount: number;
  note: string;
}

/** Награда за один матч Bean Duel, ожидающая получения (см. server/src/domain/types.ts Reward). */
export interface AvailableReward {
  id: string;
  matchId: string;
  amount: number;
  status: 'none' | 'available' | 'processing' | 'sent' | 'failed' | 'review';
  createdAt: number;
}

export interface RewardsState {
  /** Сумма доступных к получению наград (сумма amount из available). Только для чтения — считается из available. */
  doffa: number;
  /** DOFFA, по которому создана заявка на вывод (кэш последнего успешного Claim). */
  doffaClaimed: number;
  /** Кошелёк последней заявки. */
  claimWallet: string | null;
  history: RewardEntry[];
  /** Список отдельных наград к получению — приходит с сервера (reward:list). */
  available: AvailableReward[];

  /** Заменяет список доступных наград данными сервера и пересчитывает `doffa`. */
  setAvailable: (list: AvailableReward[]) => void;
  /** Заменяет историю данными сервера (reward:history) — реальные Claim/награды, не локальная выдумка. */
  setServerHistory: (items: { id: string; date: number; kind: 'doffa' | 'claim'; amount: number; note: string }[]) => void;
  /**
   * Применяет исход успешного Claim: убирает награду из `available`,
   * увеличивает `doffaClaimed`. Вызывается ТОЛЬКО после reward:claimResult
   * с ok=true — сервер уже подтвердил и провёл выплату (пусть и в тестовом
   * режиме, см. testMode в reward:claimResult).
   */
  markClaimed: (rewardId: string, amount: number, wallet: string) => void;
  reset: () => void;
}

function sumAvailable(list: AvailableReward[]): number {
  return list.filter((r) => r.status === 'available').reduce((sum, r) => sum + r.amount, 0);
}

export const useRewardsStore = create<RewardsState>()(
  persist(
    (set) => ({
      doffa: 0,
      doffaClaimed: 0,
      claimWallet: null,
      history: [],
      available: [],

      setAvailable: (list) => set({ available: list, doffa: sumAvailable(list) }),

      setServerHistory: (items) => set({ history: items }),

      markClaimed: (rewardId, amount, wallet) =>
        set((s) => {
          const available = s.available.filter((r) => r.id !== rewardId);
          return {
            available,
            doffa: sumAvailable(available),
            doffaClaimed: s.doffaClaimed + amount,
            claimWallet: wallet,
          };
        }),

      reset: () => set({ doffa: 0, doffaClaimed: 0, claimWallet: null, history: [], available: [] }),
    }),
    // v4: заменена локальная выдумка Claim на реальный список наград/историю с сервера.
    { name: 'doffa-crazy8-rewards-v4' },
  ),
);
