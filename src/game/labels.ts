// Подписи кнопки «взять», подсказки хода и короткие ярлыки действий игроков —
// общие для офлайн- и онлайн-экрана.
import type { GameEventFlag, GameState } from './types';
import { mustTakeOnly } from './rules';
import { SUIT_SYMBOL } from './deck';

export interface TakeLabel {
  button: string;
  prompt?: string;
}

/** Склонение слова «карта» по числу: 1 карту, 2 карты, 5 карт. */
function cardWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'карту';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'карты';
  return 'карт';
}

export function getTakeLabel(state: GameState, canPlayAny: boolean): TakeLabel {
  const d = state.demand;
  if (mustTakeOnly(d)) {
    const src = d.drawSource === 'king' ? 'пиковый король' : 'семёрка';
    return { button: `Взять ${d.drawCount}`, prompt: `Штраф (${src}) — берите ${d.drawCount}` };
  }
  if (d.drawSource === 'six' && d.drawCount > 0) {
    return {
      button: `Взять ${d.drawCount}`,
      prompt: canPlayAny
        ? `Переведите шестёркой или возьмите ${d.drawCount}`
        : `Берите ${d.drawCount} ${cardWord(d.drawCount)}`,
    };
  }
  if (d.aceSkip) {
    return { button: 'Пропустить', prompt: canPlayAny ? 'Побейте тузом или пропустите' : 'Туз — пропуск хода' };
  }
  if (d.nineSuit) {
    if (state.drewThisTurn) {
      return { button: 'Пропустить', prompt: 'Накрыть нечем — ход переходит' };
    }
    return {
      button: 'Взять 1',
      prompt: canPlayAny ? `Накройте мастью ${SUIT_SYMBOL[d.nineSuit]} или переведите 9` : 'Нечем накрыть — тяните карту',
    };
  }
  if (state.drewThisTurn) return { button: 'Пропустить', prompt: 'Сыграйте взятую карту или пропустите' };
  return { button: 'Взять карту', prompt: canPlayAny ? undefined : 'Нет хода — возьмите карту' };
}

/**
 * Короткий (1-2 слова) ярлык последнего события — для маленькой подписи,
 * которая на мгновение появляется прямо над игроком (не над всем столом).
 */
export function actionLabel(evt: GameEventFlag): string {
  switch (evt.type) {
    case 'play':
      return 'ходит';
    case 'draw':
      return evt.amount && evt.amount > 1 ? `берёт ${evt.amount}` : 'берёт карту';
    case 'six':
      return 'кладёт 6';
    case 'seven':
      return 'кладёт 7';
    case 'king':
      return 'пик. король';
    case 'ace':
      return 'пропуск';
    case 'queen':
      return evt.suit ? `масть ${SUIT_SYMBOL[evt.suit]}` : 'меняет масть';
    case 'nine':
      return evt.suit ? `9${SUIT_SYMBOL[evt.suit]}` : 'девятка';
    case 'busted':
      return 'улетел';
    case 'reset':
      return 'обнулил счёт';
    case 'roundWin':
      return 'победа!';
    default:
      return '';
  }
}
