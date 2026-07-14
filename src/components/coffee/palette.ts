/** DOFFA craft coffee deck — 4-color palette from design reference. */
export const COFFEE = {
  cream: '#FFFCF7',
  creamDeep: '#F7F0E4',
  ink: '#5A2A1A',
  gold: '#C8963D',
  goldSoft: '#D4A954',
  black: '#1A0F0A',
} as const;

/** Ink vs gold by suit (coffee-red = ink/gold, coffee-black = espresso). */
export function suitTone(suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'): string {
  if (suit === 'diamonds') return COFFEE.gold;
  if (suit === 'hearts') return COFFEE.ink;
  return COFFEE.black;
}
