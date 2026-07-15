// Связующее звено между движком и UI: хранит активную партию,
// проигрывает звуки, ведёт ботов по таймеру и пишет статистику.
import { create } from 'zustand';
import type { GameState, MoveAction, Suit } from '../engine/types';
import {
  applyMove,
  createInitialState,
  getCurrentPlayer,
  startNextRound,
} from '../engine/engine';
import { decideBotMove } from '../engine/bots';
import { currentSettings } from '../../../store/settingsStore';
import { useStatsStore } from './statsStore';
import { useBeansStore } from '../../../store/beansStore';
import { useOnlineStore } from '../../../net/onlineStore';
import {
  drawCardSound,
  loseSound,
  penaltySound,
  playCardSound,
  specialSound,
  winSound,
} from '../../../lib/sound';
import { haptics } from '../../../lib/haptics';

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

/** Бот «думает» 3–5 секунд — ощущается как живой соперник, а не автомат. */
function botThinkDelay(): number {
  return 3000 + Math.random() * 2000;
}

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
      // Офлайн-тренировка против ботов: только тренировочные зёрна, без DOFFA.
      // Сумму решает ИСКЛЮЧИТЕЛЬНО сервер (см. beans:awardTraining в
      // onlineStore) — если кошелёк не подключён/сервер недоступен, зёрна
      // не начисляются вовсе, а не выдумываются на клиенте.
      useOnlineStore.getState().requestTrainingAward(won);
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
    }, botThinkDelay());
  }

  return {
    game: null,
    recorded: false,
    start: () => {
      clearBotTimer();
      // Сбрасываем витрину прошлой тренировочной награды — иначе при офлайн
      // сервере оверлей мог бы показать устаревшее число из прошлой партии.
      useBeansStore.getState().resetLastTraining();
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
