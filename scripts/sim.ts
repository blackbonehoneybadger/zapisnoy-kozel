// Симуляция партий «все боты» для проверки движка (не входит в сборку).
import { createInitialState, applyMove, startNextRound, getCurrentPlayer } from '../src/game/engine';
import { decideBotMove } from '../src/game/bots';
import { canPlayCard } from '../src/game/rules';
import type { GameSettings, GameState } from '../src/game/types';

function makeAllBots(state: GameState): GameState {
  // Принудительно делаем человека ботом для автосимуляции.
  return { ...state, players: state.players.map((p) => ({ ...p, isBot: true })) };
}

function validateState(s: GameState): void {
  const totalCards =
    s.deck.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0);
  if (totalCards !== 36) throw new Error(`Карт не 36, а ${totalCards}`);
  // Активный игрок не должен быть выбывшим во время игры.
  if (s.phase === 'playing' && getCurrentPlayer(s).busted) {
    throw new Error('Ход у выбывшего игрока');
  }
}

function runGame(settings: GameSettings, seed: number): { rounds: number; winner: string | null } {
  let state = makeAllBots(createInitialState(settings));
  let safety = 0;
  while (state.phase !== 'gameOver') {
    safety++;
    if (safety > 200000) throw new Error(`Похоже на зацикливание (seed ${seed})`);
    if (state.phase === 'roundOver') {
      state = makeAllBots(startNextRound(state));
      continue;
    }
    validateState(state);
    const action = decideBotMove(state, state.settings.difficulty);
    // Проверяем валидность хода бота.
    if (action.type === 'play') {
      const card = getCurrentPlayer(state).hand.find((c) => c.id === action.cardId);
      if (!card || !canPlayCard(state, card)) {
        throw new Error(`Бот предложил недопустимый ход (seed ${seed})`);
      }
    }
    state = applyMove(state, action);
  }
  return { rounds: state.roundNumber, winner: state.winnerId };
}

const configs: GameSettings[] = [
  { scoreLimit: 101, playerCount: 3, startingCards: 6, difficulty: 'easy', soundEnabled: false },
  { scoreLimit: 101, playerCount: 4, startingCards: 6, difficulty: 'normal', soundEnabled: false },
  { scoreLimit: 151, playerCount: 4, startingCards: 8, difficulty: 'hard', soundEnabled: false },
];

let totalRounds = 0;
const N = 300;
for (let i = 0; i < N; i++) {
  const cfg = configs[i % configs.length];
  const r = runGame(cfg, i);
  totalRounds += r.rounds;
}
console.log(`OK: ${N} партий завершены без ошибок. Средняя длина: ${(totalRounds / N).toFixed(1)} раундов.`);
