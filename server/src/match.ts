// Авторитетная партия на сервере: переиспользует игровой движок клиента.
// Чужие руки скрываются перед отправкой — клиент видит только число карт.
import type { Card, GameSettings, GameState } from '../../src/game/types';
import { createInitialState, getCurrentPlayer } from '../../src/game/engine';

export interface SeatAssignment {
  userId: string | null;
  name: string;
  isBot: boolean;
}

/**
 * Создаёт стартовое состояние и переименовывает игроков под кресла стола:
 * раздача позиционная, поэтому достаточно подменить id/name/isBot по индексу.
 */
export function createMatch(seats: SeatAssignment[], settings: GameSettings): GameState {
  const state = createInitialState({ ...settings, playerCount: seats.length as 3 | 4 });
  state.players = state.players.map((p, i) => ({
    ...p,
    id: seats[i].userId ?? `bot-${i}`,
    name: seats[i].name,
    isBot: seats[i].isBot,
  }));
  return state;
}

/** Текущий игрок — бот? (для серверного авто-хода). */
export function currentIsBot(state: GameState): boolean {
  return getCurrentPlayer(state).isBot;
}

const HIDDEN: Card = { id: 'hidden', suit: 'spades', rank: '6' };

/**
 * Вид состояния для конкретного кресла: своя рука открыта, чужие — заглушки
 * (сохраняем только количество карт, чтобы аватары показывали число).
 */
export function redactFor(state: GameState, seatIndex: number): GameState {
  return {
    ...state,
    // сохраняем длину колоды (счётчик на столе), но не раскрываем карты
    deck: state.deck.map((_, j) => ({ ...HIDDEN, id: `d-${j}` })),
    discard: state.discard.slice(-1), // клиенту нужна только верхняя карта сброса
    players: state.players.map((p, i) =>
      i === seatIndex
        ? p
        : { ...p, hand: p.hand.map((_, j) => ({ ...HIDDEN, id: `h-${i}-${j}` })) },
    ),
  };
}
