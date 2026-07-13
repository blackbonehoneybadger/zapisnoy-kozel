// Настройки игры с сохранением в localStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameSettings } from '../game/types';
import { setSoundEnabled } from '../game/sound';
import { setHapticsEnabled } from '../game/haptics';

export const DEFAULT_SETTINGS: GameSettings = {
  scoreLimit: 101,
  playerCount: 4,
  startingCards: 6,
  difficulty: 'normal',
  soundEnabled: true,
};

interface SettingsState extends GameSettings {
  update: (patch: Partial<GameSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) =>
        set((s) => {
          const next = { ...s, ...patch };
          setSoundEnabled(next.soundEnabled);
          setHapticsEnabled(next.soundEnabled);
          return next;
        }),
    }),
    {
      name: 'doffa-crazy8-settings-v1',
      onRehydrateStorage: () => (state) => {
        if (state) {
          setSoundEnabled(state.soundEnabled);
          setHapticsEnabled(state.soundEnabled);
        }
      },
    },
  ),
);

export function currentSettings(): GameSettings {
  const s = useSettingsStore.getState();
  return {
    scoreLimit: s.scoreLimit,
    playerCount: s.playerCount,
    startingCards: s.startingCards,
    difficulty: s.difficulty,
    soundEnabled: s.soundEnabled,
  };
}
