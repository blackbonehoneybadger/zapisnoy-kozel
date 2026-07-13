// Игровой движок «Записной Козёл».
// Здесь сосредоточена ВСЯ логика правил. UI и боты вызывают только эти функции
// и никогда не меняют состояние напрямую.
import type {
  Card,
  GameSettings,
  GameState,
  LogEntry,
  MoveAction,
  Player,
  RoundResult,
  Suit,
} from './types';
import { createDeck, isSpecialStarter, shuffle, SUIT_LABEL, SUITS } from './deck';
import { canPlayCard, EMPTY_DEMAND, isKingOfSpades } from './rules';
import { applyLimit, calculateScore } from './scoring';

let logSeq = 1;

const BOT_NAMES = ['Бот Мира', 'Бот Лев', 'Бот Ника'];

function log(
  state: GameState,
  text: string,
  kind: LogEntry['kind'] = 'info',
): void {
  state.log = [{ id: logSeq++, text, kind }, ...state.log].slice(0, 40);
}

function clone(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    discard: [...state.discard],
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    demand: { ...state.demand },
    log: state.log,
    settings: { ...state.settings },
    roundResults: state.roundResults ? [...state.roundResults] : null,
  };
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function makePlayers(settings: GameSettings): Player[] {
  const players: Player[] = [
    { id: 'you', name: 'Вы', isBot: false, hand: [], score: 0, busted: false },
  ];
  for (let i = 0; i < settings.playerCount - 1; i++) {
    players.push({
      id: `bot-${i}`,
      name: BOT_NAMES[i] ?? `Бот ${i + 1}`,
      isBot: true,
      hand: [],
      score: 0,
      busted: false,
    });
  }
  return players;
}

/** Снимает с колоды первую «обычную» карту для стартового сброса. */
function drawStarter(deck: Card[]): Card {
  const stash: Card[] = [];
  let starter: Card | undefined;
  while (deck.length) {
    const c = deck.pop()!;
    if (!isSpecialStarter(c)) {
      starter = c;
      break;
    }
    stash.push(c);
  }
  // Спец-карты возвращаем в колоду и перемешиваем.
  deck.push(...stash);
  const reshuffled = shuffle(deck);
  deck.length = 0;
  deck.push(...reshuffled);
  return starter ?? deck.pop()!;
}

function dealHands(state: GameState): void {
  for (let i = 0; i < state.settings.startingCards; i++) {
    for (const p of state.players) {
      if (p.busted) continue;
      const c = state.deck.pop();
      if (c) p.hand.push(c);
    }
  }
}

/** Создаёт начальное состояние новой партии. */
export function createInitialState(settings: GameSettings): GameState {
  logSeq = 1;
  const players = makePlayers(settings);
  const state: GameState = {
    deck: shuffle(createDeck()),
    discard: [],
    players,
    currentPlayerIndex: 0,
    activeSuit: 'hearts',
    demand: { ...EMPTY_DEMAND },
    phase: 'playing',
    settings,
    log: [],
    roundResults: null,
    roundNumber: 1,
    winnerId: null,
    lastEvent: null,
    drewThisTurn: false,
  };
  dealHands(state);
  const starter = drawStarter(state.deck);
  state.discard.push(starter);
  state.activeSuit = starter.suit;
  log(state, `Партия началась. Раздаём по ${settings.startingCards} карт.`, 'info');
  return state;
}

/** Перемешивает сброс (кроме верхней карты) обратно в колоду, если та пуста. */
function refillDeckIfNeeded(state: GameState): void {
  if (state.deck.length > 0) return;
  if (state.discard.length <= 1) return;
  const top = state.discard.pop()!;
  const recycled = shuffle(state.discard);
  state.deck = recycled;
  state.discard = [top];
  log(state, 'Колода закончилась — сброс перемешан заново.', 'info');
}

/** Берёт n карт из колоды в руку игрока. */
export function drawCards(state: GameState, playerIndex: number, n: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    refillDeckIfNeeded(state);
    const c = state.deck.pop();
    if (!c) break;
    state.players[playerIndex].hand.push(c);
    drawn.push(c);
  }
  return drawn;
}

/** Передаёт ход следующему не выбывшему игроку. */
export function nextTurn(state: GameState): void {
  const n = state.players.length;
  let idx = state.currentPlayerIndex;
  for (let step = 0; step < n; step++) {
    idx = (idx + 1) % n;
    if (!state.players[idx].busted) break;
  }
  state.currentPlayerIndex = idx;
  state.drewThisTurn = false;
}

/**
 * Применяет эффект спец-карты: настраивает «требование» к следующему игроку
 * и меняет активную масть.
 */
export function applySpecialCardEffect(
  state: GameState,
  card: Card,
  chosenSuit: Suit | undefined,
  playerName: string,
): void {
  const d = state.demand;
  const carriedSix = d.drawSource === 'six' ? d.drawCount : 0;
  const carriedAce = d.aceSkip;

  // По умолчанию сбрасываем требования и берём масть карты.
  state.demand = { ...EMPTY_DEMAND };
  state.activeSuit = card.suit;

  if (card.rank === '6') {
    state.demand.drawSource = 'six';
    state.demand.drawCount = carriedSix + 2;
    log(
      state,
      `${playerName} кладёт 6 — следующий берёт ${state.demand.drawCount}. Можно перевести шестёркой.`,
      'special',
    );
    state.lastEvent = { type: 'six', playerId: '', amount: state.demand.drawCount, ts: Date.now() };
    return;
  }

  if (card.rank === '7') {
    state.demand.drawSource = 'seven';
    state.demand.drawCount = 1;
    log(state, `${playerName} кладёт 7 — следующий берёт 1 (без перевода).`, 'special');
    state.lastEvent = { type: 'seven', playerId: '', amount: 1, ts: Date.now() };
    return;
  }

  if (isKingOfSpades(card)) {
    state.demand.drawSource = 'king';
    state.demand.drawCount = 4;
    log(state, `${playerName} кладёт пикового короля — следующий берёт 4 (без перевода).`, 'special');
    state.lastEvent = { type: 'king', playerId: '', amount: 4, ts: Date.now() };
    return;
  }

  if (card.rank === 'A') {
    state.demand.aceSkip = true;
    log(
      state,
      carriedAce
        ? `${playerName} переводит туза — пропуск идёт дальше.`
        : `${playerName} кладёт туза — следующий пропускает ход.`,
      'special',
    );
    state.lastEvent = { type: 'ace', playerId: '', ts: Date.now() };
    return;
  }

  if (card.rank === 'Q') {
    // Масть выбирает игрок, но её нужно валидировать: клиент (или атакующий на
    // сервере) мог прислать мусор — тогда activeSuit стал бы «BOGUS» и стол
    // залипал (ни одна карта не совпадает по масти). Кривое значение → масть дамы.
    const suit = chosenSuit && SUITS.includes(chosenSuit) ? chosenSuit : card.suit;
    state.activeSuit = suit;
    log(state, `${playerName} кладёт даму и выбирает масть: ${SUIT_LABEL[suit]}.`, 'special');
    state.lastEvent = { type: 'queen', playerId: '', suit, ts: Date.now() };
    return;
  }

  if (card.rank === '9') {
    state.demand.nineSuit = card.suit;
    log(state, `${playerName} кладёт 9${suitGlyph(card.suit)} — сразу накройте мастью ${SUIT_LABEL[card.suit]} или другой 9.`, 'special');
    state.lastEvent = { type: 'nine', playerId: '', suit: card.suit, ts: Date.now() };
    return;
  }

  // Обычная карта (8, 10, J, обычный король).
  state.lastEvent = { type: 'play', playerId: '', ts: Date.now() };
}

/** Проверяет, закончился ли раунд (кто-то остался без карт). */
export function checkRoundEnd(state: GameState): boolean {
  return state.players.some((p) => !p.busted && p.hand.length === 0);
}

function endRound(state: GameState, winnerIndex: number): void {
  const limit = state.settings.scoreLimit;
  const results: RoundResult[] = [];
  for (const p of state.players) {
    if (p.busted) {
      results.push({ playerId: p.id, name: p.name, gained: 0, total: p.score, busted: true, reset: false });
      continue;
    }
    const gained = p.hand.length === 0 ? 0 : calculateScore(p.hand);
    const raw = p.score + gained;
    const { score, busted, reset } = applyLimit(raw, limit);
    p.score = score;
    if (busted) p.busted = true;
    results.push({ playerId: p.id, name: p.name, gained, total: score, busted, reset });
    if (reset) log(state, `${p.name}: ровно ${limit} — счёт обнулён до 0!`, 'win');
    if (busted) log(state, `${p.name} «улетел» (${raw} > ${limit}) и выбывает.`, 'penalty');
  }

  const winnerName = state.players[winnerIndex].name;
  log(state, `Раунд завершён. ${winnerName} вышел первым (0 очков).`, 'win');
  state.lastEvent = { type: 'roundWin', playerId: state.players[winnerIndex].id, ts: Date.now() };
  state.roundResults = results;

  const alive = state.players.filter((p) => !p.busted);
  if (alive.length <= 1) {
    state.phase = 'gameOver';
    state.winnerId = alive[0]?.id ?? null;
    if (alive[0]) log(state, `🏆 ${alive[0].name} — победитель партии!`, 'win');
  } else {
    state.phase = 'roundOver';
  }
}

/** Начинает следующий раунд той же партии (счёт сохраняется). */
export function startNextRound(prev: GameState): GameState {
  if (prev.phase === 'gameOver') return prev;
  const state = clone(prev);
  state.deck = shuffle(createDeck());
  state.discard = [];
  state.demand = { ...EMPTY_DEMAND };
  for (const p of state.players) p.hand = [];
  dealHands(state);
  const starter = drawStarter(state.deck);
  state.discard.push(starter);
  state.activeSuit = starter.suit;
  state.roundResults = null;
  state.phase = 'playing';
  state.roundNumber += 1;
  state.drewThisTurn = false;

  // Первым ходит победитель прошлого раунда, если он в игре.
  const winnerId = state.lastEvent?.type === 'roundWin' ? state.lastEvent.playerId : null;
  const startIdx = state.players.findIndex((p) => p.id === winnerId && !p.busted);
  state.currentPlayerIndex = startIdx >= 0 ? startIdx : state.players.findIndex((p) => !p.busted);
  state.lastEvent = null;
  log(state, `Раунд ${state.roundNumber}. Раздача завершена.`, 'info');
  return state;
}

function placeCard(state: GameState, playerIndex: number, card: Card): void {
  const player = state.players[playerIndex];
  player.hand = player.hand.filter((c) => c.id !== card.id);
  state.discard.push(card);
}

/**
 * Главная точка входа: применяет действие текущего игрока и возвращает
 * НОВОЕ состояние. Действие должно быть валидным (UI/боты это гарантируют).
 */
export function applyMove(prev: GameState, action: MoveAction): GameState {
  if (prev.phase !== 'playing') return prev;
  const state = clone(prev);
  const idx = state.currentPlayerIndex;
  const player = state.players[idx];

  if (action.type === 'take') {
    handleTake(state, idx, player);
    return state;
  }

  // Разыгрываем карту.
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card || !canPlayCard(state, card)) {
    // Недопустимый ход игнорируем (защитная ветка).
    return prev;
  }

  placeCard(state, idx, card);
  const evtPlayerId = player.id;
  applySpecialCardEffect(state, card, action.chosenSuit, player.name);
  if (state.lastEvent) state.lastEvent.playerId = evtPlayerId;
  log(state, `${player.name} ходит: ${card.rank}${suitGlyph(card.suit)}.`, 'info');

  // Игрок избавился от всех карт — конец раунда.
  if (player.hand.length === 0) {
    endRound(state, idx);
    return state;
  }

  // Девятка требует немедленного накрытия тем же игроком — ход НЕ передаётся.
  if (state.demand.nineSuit !== null) {
    return state;
  }

  nextTurn(state);
  return state;
}

function handleTake(state: GameState, idx: number, player: Player): void {
  const d = state.demand;

  // 1. Штрафной набор (6 / 7 / пиковый король).
  if (d.drawCount > 0 && d.drawSource) {
    // Колода могла не выдать полный штраф (пустая + один верх сброса) — логируем
    // и анимируем ФАКТИЧЕСКОЕ число взятых карт, а не запрошенное.
    const got = drawCards(state, idx, d.drawCount).length;
    log(state, `${player.name} берёт ${got} ${plural(got)}.`, 'penalty');
    state.lastEvent = { type: 'draw', playerId: player.id, amount: got, ts: Date.now() };
    state.demand = { ...EMPTY_DEMAND };
    nextTurn(state);
    return;
  }

  // 2. Пропуск от туза — карт не берём, просто теряем ход.
  if (d.aceSkip) {
    log(state, `${player.name} пропускает ход (туз).`, 'penalty');
    state.lastEvent = { type: 'ace', playerId: player.id, ts: Date.now() };
    state.demand = { ...EMPTY_DEMAND };
    nextTurn(state);
    return;
  }

  // 3. Девятка: тот же игрок не смог накрыть — тянет 1 карту.
  if (d.nineSuit) {
    if (!state.drewThisTurn) {
      const [drawn] = drawCards(state, idx, 1);
      state.drewThisTurn = true;
      state.lastEvent = { type: 'draw', playerId: player.id, amount: 1, ts: Date.now() };
      if (drawn && canPlayCard(state, drawn)) {
        log(state, `${player.name} тянет карту — может накрыть!`, 'info');
        return; // ход остаётся у этого игрока
      }
      log(state, `${player.name} не смог накрыть девятку — тянет 1 и пасует.`, 'penalty');
    } else {
      log(state, `${player.name} пасует: накрыть нечем.`, 'info');
    }
    state.demand = { ...EMPTY_DEMAND };
    nextTurn(state);
    return;
  }

  // 4. Обычный ход: берём 1 карту.
  if (!state.drewThisTurn) {
    const [drawn] = drawCards(state, idx, 1);
    state.drewThisTurn = true;
    state.lastEvent = { type: 'draw', playerId: player.id, amount: 1, ts: Date.now() };
    if (drawn && canPlayCard(state, drawn)) {
      log(state, `${player.name} берёт карту и может ею сыграть.`, 'info');
      return; // ход остаётся у игрока — он решает, играть или пасовать
    }
    log(state, `${player.name} берёт карту — подходящей нет, ход переходит.`, 'info');
    nextTurn(state);
    return;
  }

  // 5. Уже брал в этот ход и пасует.
  log(state, `${player.name} пропускает ход.`, 'info');
  nextTurn(state);
}

function suitGlyph(suit: Suit): string {
  return suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : '♠';
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'карту';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'карты';
  return 'карт';
}
