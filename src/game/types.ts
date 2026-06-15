// Доменные типы игры «Записной Козёл».
// Вся игровая логика построена на этих типах — UI их только отображает.

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string; // уникальный идентификатор экземпляра карты
  suit: Suit;
  rank: Rank;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  /** Накопленный счёт партии (по правилам — чем меньше, тем лучше). */
  score: number;
  /** Игрок «улетел» (превысил лимит) и выбыл. */
  busted: boolean;
}

/**
 * «Требование» к текущему игроку, созданное спец-картой предыдущего хода.
 * - drawCount/drawSource — штрафной набор карт (6, 7, пиковый король).
 * - aceSkip — пропуск хода от туза.
 * - nineSuit — активная девятка, которую надо накрыть картой той же масти.
 */
export interface Demand {
  drawCount: number;
  drawSource: 'six' | 'seven' | 'king' | null;
  aceSkip: boolean;
  nineSuit: Suit | null;
}

export type GamePhase = 'playing' | 'roundOver' | 'gameOver';

export interface LogEntry {
  id: number;
  text: string;
  kind: 'info' | 'special' | 'penalty' | 'win';
}

export interface RoundResult {
  playerId: string;
  name: string;
  gained: number; // очки, набранные за раунд
  total: number; // общий счёт после раунда
  busted: boolean;
  reset: boolean; // сработало правило «ровно лимит → обнуление»
}

export interface GameSettings {
  scoreLimit: number; // лимит очков (по умолчанию 101)
  playerCount: 3 | 4; // всего игроков (1 человек + боты)
  startingCards: number; // карт на старте (по умолчанию 6)
  difficulty: Difficulty;
  soundEnabled: boolean;
}

export interface GameState {
  deck: Card[];
  discard: Card[]; // верхняя карта — последняя в массиве
  players: Player[];
  currentPlayerIndex: number;
  /** Масть, действующая прямо сейчас (дама может её менять). */
  activeSuit: Suit;
  demand: Demand;
  phase: GamePhase;
  settings: GameSettings;
  log: LogEntry[];
  roundResults: RoundResult[] | null;
  roundNumber: number;
  /** Победитель партии (последний не «улетевший») или null. */
  winnerId: string | null;
  /** Последнее игровое событие — служит триггером анимаций в UI. */
  lastEvent: GameEventFlag | null;
  /** Брал ли текущий игрок карту в этот ход (обычный добор). */
  drewThisTurn: boolean;
}

/** Кратковременный флаг для запуска анимаций спец-эффектов в UI. */
export interface GameEventFlag {
  type:
    | 'play'
    | 'draw'
    | 'six'
    | 'seven'
    | 'king'
    | 'ace'
    | 'queen'
    | 'nine'
    | 'busted'
    | 'reset'
    | 'roundWin';
  playerId: string;
  amount?: number;
  suit?: Suit;
  ts: number;
}

export type MoveAction =
  | { type: 'play'; cardId: string; chosenSuit?: Suit }
  | { type: 'take' };
