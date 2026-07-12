// Подписи кнопки «взять» и подсказки хода — общие для офлайн- и онлайн-экрана.
import type { GameState } from './types';
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
