// Колода: создание, перемешивание, раздача.
import type { Card, Rank, Suit } from './types';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_LABEL: Record<Suit, string> = {
  hearts: 'Черви',
  diamonds: 'Бубны',
  clubs: 'Трефы',
  spades: 'Пики',
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  hearts: true,
  diamonds: true,
  clubs: false,
  spades: false,
};

/** Полная колода из 36 карт. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, suit, rank });
    }
  }
  return deck;
}

/** Перемешивание Фишера–Йейтса (чистая функция — не мутирует вход). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Карта, которую нельзя класть в сброс первой (спец-эффект на старте). */
export function isSpecialStarter(card: Card): boolean {
  if (card.rank === '6' || card.rank === '7' || card.rank === '9') return true;
  if (card.rank === 'Q' || card.rank === 'A') return true;
  if (card.rank === 'K' && card.suit === 'spades') return true;
  return false;
}
