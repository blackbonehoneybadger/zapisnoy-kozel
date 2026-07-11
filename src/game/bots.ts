// Логика ботов трёх уровней сложности. Бот возвращает только валидные ходы.
import type { Card, Difficulty, GameState, MoveAction, Suit } from './types';
import { SUITS } from './deck';
import { canPlayCard, mustTakeOnly } from './rules';
import { cardPoints } from './scoring';

function playableCards(state: GameState, hand: Card[]): Card[] {
  return hand.filter((c) => canPlayCard(state, c));
}

/** Масть, которой у бота больше всего карт (для выбора дамой). */
function richestSuit(hand: Card[], exclude?: Card): Suit {
  const counts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
  for (const c of hand) {
    if (exclude && c.id === exclude.id) continue;
    counts[c.suit]++;
  }
  let best: Suit = SUITS[0];
  for (const s of SUITS) if (counts[s] > counts[best]) best = s;
  return best;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function withSuit(card: Card, hand: Card[], difficulty: Difficulty): MoveAction {
  if (card.rank === 'Q') {
    const suit = difficulty === 'easy' ? randomItem(SUITS) : richestSuit(hand, card);
    return { type: 'play', cardId: card.id, chosenSuit: suit };
  }
  return { type: 'play', cardId: card.id };
}

/** Считает карты следующего соперника (для агрессии на Hard). */
function nextOpponentHandSize(state: GameState): number {
  const n = state.players.length;
  let idx = state.currentPlayerIndex;
  for (let step = 0; step < n; step++) {
    idx = (idx + 1) % n;
    if (!state.players[idx].busted) return state.players[idx].hand.length;
  }
  return 99;
}

const ATTACK_RANKS = new Set(['6', '7', 'A']);

/** Выбирает ход бота по уровню сложности. */
export function decideBotMove(state: GameState, difficulty: Difficulty): MoveAction {
  const hand = state.players[state.currentPlayerIndex].hand;

  // Непереводимый штраф — остаётся только брать.
  if (mustTakeOnly(state.demand)) return { type: 'take' };

  const options = playableCards(state, hand);
  if (options.length === 0) return { type: 'take' };

  // Easy — играет случайной подходящей картой.
  if (difficulty === 'easy') {
    return withSuit(randomItem(options), hand, difficulty);
  }

  // Normal / Hard — стараются сбрасывать «дорогие» карты.
  const sorted = [...options].sort((a, b) => cardPoints(b) - cardPoints(a));

  if (difficulty === 'normal') {
    return withSuit(sorted[0], hand, difficulty);
  }

  // Hard — агрессия против соперника с малым числом карт + придержать защиту.
  const opp = nextOpponentHandSize(state);
  if (opp <= 2) {
    const attack = sorted.find((c) => ATTACK_RANKS.has(c.rank) || (c.rank === 'K' && c.suit === 'spades'));
    if (attack) return withSuit(attack, hand, difficulty);
  }

  // Если есть чем побольше «насолить» и много карт — всё равно сбрасываем дорогую,
  // но придерживаем одиночную шестёрку как контр-карту, если есть выбор.
  const sixes = sorted.filter((c) => c.rank === '6');
  if (sixes.length === 1 && sorted.length > 1) {
    const alt = sorted.find((c) => c.rank !== '6');
    if (alt) return withSuit(alt, hand, difficulty);
  }

  return withSuit(sorted[0], hand, difficulty);
}
