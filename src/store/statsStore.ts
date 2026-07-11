// Хранилище статистики с сохранением в localStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GameHistoryItem {
  id: number;
  date: number; // timestamp
  won: boolean;
  finalScore: number; // итоговый счёт человека
  rounds: number;
  players: number;
  flewAway: boolean; // человек «улетел»
}

export interface StatsState {
  wins: number;
  losses: number;
  gamesPlayed: number;
  bestScore: number | null; // лучший (минимальный) итог человека
  timesFlewAway: number;
  history: GameHistoryItem[];
  recordGame: (item: Omit<GameHistoryItem, 'id' | 'date'>) => void;
  reset: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      bestScore: null,
      timesFlewAway: 0,
      history: [],
      recordGame: (item) =>
        set((s) => {
          const entry: GameHistoryItem = { ...item, id: Date.now(), date: Date.now() };
          const best =
            s.bestScore === null ? item.finalScore : Math.min(s.bestScore, item.finalScore);
          return {
            wins: s.wins + (item.won ? 1 : 0),
            losses: s.losses + (item.won ? 0 : 1),
            gamesPlayed: s.gamesPlayed + 1,
            bestScore: best,
            timesFlewAway: s.timesFlewAway + (item.flewAway ? 1 : 0),
            history: [entry, ...s.history].slice(0, 20),
          };
        }),
      reset: () =>
        set({
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
          bestScore: null,
          timesFlewAway: 0,
          history: [],
        }),
    }),
    { name: 'kozel-stats-v1' },
  ),
);
