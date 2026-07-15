// Подсчёт очков. Меняй значения здесь — они влияют на всю игру.
import type { Card, Rank } from './types';

/**
 * Стоимость карт при подсчёте очков в конце раунда.
 * По умолчанию (классические правила):
 *   6=6, 7=7, 8=8, 9=9, 10=10, J=2, Q=3, K=4, A=11
 */
export const CARD_POINTS: Record<Rank, number> = {
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 2,
  Q: 3,
  K: 4,
  A: 11,
};

/** Очки одной карты. */
export function cardPoints(card: Card): number {
  return CARD_POINTS[card.rank];
}

/** Сумма очков карт на руке (то, что добавляется проигравшему за раунд). */
export function calculateScore(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

/**
 * Применяет правило лимита к новому счёту игрока.
 * - score > limit  → «улетел» (busted).
 * - score === limit → обнуление до 0 (reset).
 * Возвращает финальный счёт и флаги.
 */
export function applyLimit(
  score: number,
  limit: number,
): { score: number; busted: boolean; reset: boolean } {
  if (score === limit) return { score: 0, busted: false, reset: true };
  if (score > limit) return { score, busted: true, reset: false };
  return { score, busted: false, reset: false };
}
