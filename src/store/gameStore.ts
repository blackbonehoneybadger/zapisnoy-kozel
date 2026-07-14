// Связующее звено между движком и UI: хранит активную партию,
// проигрывает звуки, ведёт ботов по таймеру и пишет статистику.
import { create } from 'zustand';
import type { GameState, MoveAction, Suit } from '../game/types';
import {
  applyMove,
  createInitialState,
  getCurrentPlayer,
  startNextRound,
} from '../game/engine';
import { decideBotMove } from '../game/bots';
import { currentSettings } from './settingsStore';
import { useStatsStore } from './statsStore';
import { useRewardsStore } from './rewardsStore';
import {
  drawCardSound,
  loseSound,
  penaltySound,
  playCardSound,
  specialSound,
  winSound,
} from '../game/sound';
import { haptics } from '../game/haptics';

interface GameStore {
  game: GameState | null;
  recorded: boolean;
  start: () => void;
  playCard: (cardId: string, chosenSuit?: Suit) => void;
  take: () => void;
  nextRound: () => void;
  quit: () => void;
}

let botTimer: ReturnType<typeof setTimeout> | null = null;

function clearBotTimer(): void {
  if (botTimer) {
    clearTimeout(botTimer);
    botTimer = null;
  }
}

function playEventSound(state: GameState): void {
  const evt = state.lastEvent;
  if (!evt) return;
  switch (evt.type) {
    case 'play':
      playCardSound();
      haptics.play();
      break;
    case 'queen':
      specialSound();
      haptics.special();
      break;
    case 'six':
    case 'seven':
    case 'king':
    case 'ace':
    case 'nine':
      specialSound();
      haptics.special();
      break;
    case 'draw':
      if ((evt.amount ?? 1) > 1) {
        penaltySound();
        haptics.penalty();
      } else {
        drawCardSound();
        haptics.draw();
      }
      break;
    case 'busted':
      loseSound();
      haptics.lose();
      break;
    case 'reset':
    case 'roundWin':
      winSound();
      haptics.win();
      break;
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  // Фиксирует новое состояние, играет звук, ведёт ботов и пишет статистику.
  function commit(next: GameState): void {
    playEventSound(next);

    if (next.phase === 'gameOver' && !get().recorded) {
      const human = next.players.find((p) => p.id === 'you');
      const won = next.winnerId === 'you';
      useStatsStore.getState().recordGame({
        won,
        finalScore: human?.score ?? 0,
        rounds: next.roundNumber,
        players: next.players.length,
        flewAway: human?.busted ?? false,
      });
      // Офлайн-тренировка против ботов: только тренировочные Cups, без DOFFA.
      useRewardsStore.getState().awardTraining(won);
      if (won) {
        winSound();
        haptics.win();
      } else {
        loseSound();
        haptics.lose();
      }
      set({ game: next, recorded: true });
      clearBotTimer();
      return;
    }

    set({ game: next });
    scheduleBot();
  }

  // Если ходит бот — планируем его ход с задержкой для «живого» темпа.
  function scheduleBot(): void {
    clearBotTimer();
    const state = get().game;
    if (!state || state.phase !== 'playing') return;
    const player = getCurrentPlayer(state);
    if (!player.isBot) return;
    botTimer = setTimeout(() => {
      const cur = get().game;
      if (!cur || cur.phase !== 'playing') return;
      const mover = getCurrentPlayer(cur);
      if (!mover.isBot) return;
      const action = decideBotMove(cur, cur.settings.difficulty);
      commit(applyMove(cur, action));
    }, 850);
  }

  return {
    game: null,
    recorded: false,
    start: () => {
      clearBotTimer();
      const state = createInitialState(currentSettings());
      set({ game: state, recorded: false });
      scheduleBot();
    },
    playCard: (cardId, chosenSuit) => {
      const state = get().game;
      if (!state || state.phase !== 'playing') return;
      if (getCurrentPlayer(state).isBot) return;
      const action: MoveAction = { type: 'play', cardId, chosenSuit };
      commit(applyMove(state, action));
    },
    take: () => {
      const state = get().game;
      if (!state || state.phase !== 'playing') return;
      if (getCurrentPlayer(state).isBot) return;
      commit(applyMove(state, { type: 'take' }));
    },
    nextRound: () => {
      const state = get().game;
      if (!state) return;
      commit(startNextRound(state));
    },
    quit: () => {
      clearBotTimer();
      set({ game: null, recorded: false });
    },
  };
});
