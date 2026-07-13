// Награды экосистемы DOFFA: Cups — внутренняя игровая энергия (начисляется за
// каждую партию), DOFFA — настоящая награда (начисляется за победы).
// Балансы и история живут в localStorage; «Забрать награду» закрепляет
// накопленный DOFFA за подключённым Solana-кошельком. Реальный вывод токена
// в сеть делает команда DOFFA по этим заявкам — игра сама ключами не владеет.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Cups за любую сыгранную партию. */
export const CUPS_PER_GAME = 10;
/** Cups сверху за победу. */
export const CUPS_PER_WIN = 25;
/** DOFFA за победу над ботами. */
export const DOFFA_PER_WIN = 10;

export interface RewardEntry {
  id: number;
  date: number; // timestamp
  kind: 'cups' | 'doffa' | 'claim';
  amount: number;
  note: string;
}

export interface RewardsState {
  /** Игровая энергия. */
  cups: number;
  /** Накопленный DOFFA, ещё не забранный. */
  doffa: number;
  /** DOFFA, закреплённый за кошельком (заявки на вывод). */
  doffaClaimed: number;
  /** Кошелёк, за которым закреплены заявки (последний использованный). */
  claimWallet: string | null;
  /** Выигрыш последней завершённой партии — для оверлея победы. */
  lastWinDoffa: number;
  history: RewardEntry[];
  /** Начислить награды за завершённую партию. Возвращает DOFFA за победу. */
  awardGame: (won: boolean) => number;
  /** Закрепить весь доступный DOFFA за кошельком. Возвращает сумму заявки. */
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
      lastWinDoffa: 0,
      history: [],

      awardGame: (won) => {
        const cupsGain = CUPS_PER_GAME + (won ? CUPS_PER_WIN : 0);
        const doffaGain = won ? DOFFA_PER_WIN : 0;
        set((s) => {
          const items: RewardEntry[] = [
            entry('cups', cupsGain, won ? 'Партия сыграна · победа' : 'Партия сыграна'),
          ];
          if (doffaGain > 0) items.unshift(entry('doffa', doffaGain, 'Победа в партии'));
          return {
            cups: s.cups + cupsGain,
            doffa: s.doffa + doffaGain,
            lastWinDoffa: doffaGain,
            history: [...items, ...s.history].slice(0, 50),
          };
        });
        return doffaGain;
      },

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
        set({ cups: 0, doffa: 0, doffaClaimed: 0, claimWallet: null, lastWinDoffa: 0, history: [] }),
    }),
    { name: 'doffa-crazy8-rewards-v1' },
  ),
);
