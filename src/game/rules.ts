// Правила: что и когда можно класть. Чистые функции без побочных эффектов.
import type { Card, Demand, GameState } from './types';

/** Верхняя карта сброса. */
export function topCard(state: GameState): Card {
  return state.discard[state.discard.length - 1];
}

export function isKingOfSpades(card: Card): boolean {
  return card.rank === 'K' && card.suit === 'spades';
}

/** Карта-перевод для штрафа шестёрок. */
export function countersSix(card: Card): boolean {
  return card.rank === '6';
}

/**
 * Можно ли сыграть карту прямо сейчас, с учётом активного «требования».
 * Это сердце правил — UI и боты используют только её.
 */
export function canPlayCard(state: GameState, card: Card): boolean {
  const d = state.demand;

  // 1. Активный штраф от шестёрки — перевести можно только шестёркой.
  if (d.drawSource === 'six' && d.drawCount > 0) {
    return card.rank === '6';
  }

  // 2. Непереводимый штраф (7 или пиковый король) — играть нельзя, только брать.
  if ((d.drawSource === 'seven' || d.drawSource === 'king') && d.drawCount > 0) {
    return false;
  }

  // 3. Пропуск от туза — отбиться можно только тузом.
  if (d.aceSkip) {
    return card.rank === 'A';
  }

  // 4. Активная девятка — кладём ту же масть или переводим другой девяткой.
  if (d.nineSuit) {
    return card.suit === d.nineSuit || card.rank === '9';
  }

  // 5. Обычный ход: дама ходит всегда; иначе совпадение масти или ранга.
  if (card.rank === 'Q') return true;
  const top = topCard(state);
  return card.suit === state.activeSuit || card.rank === top.rank;
}

/** Есть ли у игрока хотя бы один допустимый ход. */
export function hasPlayableCard(state: GameState, hand: Card[]): boolean {
  return hand.some((c) => canPlayCard(state, c));
}

/** Текущий игрок обязан только брать карты (непереводимый штраф). */
export function mustTakeOnly(demand: Demand): boolean {
  return (
    (demand.drawSource === 'seven' || demand.drawSource === 'king') &&
    demand.drawCount > 0
  );
}

export const EMPTY_DEMAND: Demand = {
  drawCount: 0,
  drawSource: null,
  aceSkip: false,
  nineSuit: null,
};
