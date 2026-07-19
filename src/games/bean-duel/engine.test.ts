// Тесты чистого движка Bean Duel — того же самого кода, что гоняет сервер
// в авторитетном PvP (см. server/src/duel.ts stepDuelPvP). Эти тесты
// проверяют именно то свойство, ради которого сервер использует этот
// движок: результат детерминирован из состояния/ввода, а не из того, что
// заявляет клиент.
import { describe, expect, it } from 'vitest';
import {
  ARENA,
  COUNTDOWN_S,
  DASH_COOLDOWN_MS,
  FIGHTER_RADIUS,
  MATCH_DURATION_MS,
  MAX_HP,
  PROJECTILE_RADIUS,
  THROW_COOLDOWN_MS,
  createInitialState,
  stepDuel,
  stepDuelPvP,
  type DuelInput,
  type DuelInputs,
} from './engine';

const noInput = (): DuelInput => ({ target: null, dashPressed: false, throwPressed: false });
const noInputs = (): DuelInputs => ({ player: noInput(), bot: noInput() });

function runCountdown(state = createInitialState()) {
  // Проходим обратный отсчёт мелкими шагами — так же, как реальный тик-цикл.
  let s = state;
  const tickMs = 50;
  const ticksNeeded = Math.ceil((COUNTDOWN_S * 1000) / tickMs) + 1;
  for (let i = 0; i < ticksNeeded && s.phase === 'countdown'; i++) {
    s = stepDuelPvP(s, noInputs(), tickMs);
  }
  return s;
}

describe('createInitialState', () => {
  it('starts in countdown with full HP, no winner, no projectiles', () => {
    const s = createInitialState();
    expect(s.phase).toBe('countdown');
    expect(s.winner).toBeNull();
    expect(s.fighters.player.hp).toBe(MAX_HP);
    expect(s.fighters.bot.hp).toBe(MAX_HP);
    expect(s.projectiles).toEqual([]);
    expect(s.timeLeftMs).toBe(MATCH_DURATION_MS);
  });

  it('places fighters within the arena bounds', () => {
    const s = createInitialState();
    for (const f of [s.fighters.player, s.fighters.bot]) {
      expect(f.pos.x).toBeGreaterThanOrEqual(0);
      expect(f.pos.x).toBeLessThanOrEqual(ARENA.w);
      expect(f.pos.y).toBeGreaterThanOrEqual(0);
      expect(f.pos.y).toBeLessThanOrEqual(ARENA.h);
    }
  });
});

describe('countdown -> playing transition', () => {
  it('does not start playing before COUNTDOWN_S has elapsed', () => {
    const s = stepDuelPvP(createInitialState(), noInputs(), 500);
    expect(s.phase).toBe('countdown');
  });

  it('transitions to playing once COUNTDOWN_S has elapsed, HP unaffected', () => {
    const s = runCountdown();
    expect(s.phase).toBe('playing');
    expect(s.fighters.player.hp).toBe(MAX_HP);
    expect(s.fighters.bot.hp).toBe(MAX_HP);
  });

  it('input is ignored during countdown (no movement, no ability use)', () => {
    const initial = createInitialState();
    const withInput: DuelInputs = {
      player: { target: { x: 0, y: 0 }, dashPressed: true, throwPressed: true },
      bot: noInput(),
    };
    const s = stepDuelPvP(initial, withInput, 100);
    expect(s.fighters.player.pos).toEqual(initial.fighters.player.pos);
    expect(s.projectiles).toEqual([]);
  });
});

describe('dash (ближний бой)', () => {
  it('a dash into contact range damages the opponent and grants invulnerability', () => {
    let s = runCountdown();
    // Ставим бойцов вплотную друг к другу так, чтобы рывок игрока сразу попал.
    s = {
      ...s,
      fighters: {
        player: { ...s.fighters.player, pos: { x: 150, y: 250 }, facing: { x: 0, y: -1 } },
        bot: { ...s.fighters.bot, pos: { x: 150, y: 240 } },
      },
    };
    const inputs: DuelInputs = { player: { target: null, dashPressed: true, throwPressed: false }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 16);

    expect(next.fighters.bot.hp).toBeLessThan(MAX_HP);
    expect(next.fighters.player.invulnerableMs).toBeGreaterThan(0);
    expect(next.lastHit).not.toBeNull();
    expect(next.lastHit?.target).toBe('bot');
  });

  it('respects its cooldown — a second dash immediately after does nothing extra', () => {
    let s = runCountdown();
    s = {
      ...s,
      fighters: {
        player: { ...s.fighters.player, pos: { x: 150, y: 250 } },
        bot: { ...s.fighters.bot, pos: { x: 150, y: 400 } }, // far away
      },
    };
    const dashInputs: DuelInputs = { player: { target: null, dashPressed: true, throwPressed: false }, bot: noInput() };
    const afterFirstDash = stepDuelPvP(s, dashInputs, 16);
    expect(afterFirstDash.fighters.player.dashCooldownMs).toBeGreaterThan(0);

    const afterSecondAttempt = stepDuelPvP(afterFirstDash, dashInputs, 16);
    // Кулдаун не сброшен повторным нажатием, движение всё ещё в первом рывке.
    expect(afterSecondAttempt.fighters.player.dashCooldownMs).toBeGreaterThan(0);
    expect(afterSecondAttempt.fighters.player.dashCooldownMs).toBeLessThanOrEqual(DASH_COOLDOWN_MS);
  });

  it('a fighter mid-dash (invulnerable) does not take damage from the opponent dashing into them', () => {
    let s = runCountdown();
    s = {
      ...s,
      fighters: {
        player: { ...s.fighters.player, pos: { x: 150, y: 250 }, invulnerableMs: 200, dashingMs: 100 },
        bot: { ...s.fighters.bot, pos: { x: 150, y: 240 }, dashingMs: 100 },
      },
    };
    const next = stepDuelPvP(s, noInputs(), 16);
    expect(next.fighters.player.hp).toBe(MAX_HP);
  });
});

describe('«Бросок зерна» (throw)', () => {
  it('spawns a projectile heading in the facing direction when thrown', () => {
    let s = runCountdown();
    s = { ...s, fighters: { ...s.fighters, player: { ...s.fighters.player, facing: { x: 0, y: -1 } } } };
    const inputs: DuelInputs = { player: { target: null, dashPressed: false, throwPressed: true }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 16);
    expect(next.projectiles.length).toBe(1);
    expect(next.projectiles[0].owner).toBe('player');
    expect(next.projectiles[0].vel.y).toBeLessThan(0); // летит вверх, к боту
    expect(next.fighters.player.throwCooldownMs).toBeGreaterThan(0);
  });

  it('respects THROW_COOLDOWN_MS — cannot spam a second projectile immediately', () => {
    let s = runCountdown();
    const inputs: DuelInputs = { player: { target: null, dashPressed: false, throwPressed: true }, bot: noInput() };
    const afterFirst = stepDuelPvP(s, inputs, 16);
    expect(afterFirst.projectiles.length).toBe(1);
    const afterSecondAttempt = stepDuelPvP(afterFirst, inputs, 16);
    expect(afterSecondAttempt.projectiles.length).toBe(1); // не два
    expect(afterSecondAttempt.fighters.player.throwCooldownMs).toBeGreaterThan(0);
    expect(afterSecondAttempt.fighters.player.throwCooldownMs).toBeLessThanOrEqual(THROW_COOLDOWN_MS);
  });

  it('a projectile that reaches the opponent damages them and is consumed', () => {
    let s = runCountdown();
    s = {
      ...s,
      fighters: {
        player: { ...s.fighters.player, pos: { x: 150, y: 300 }, facing: { x: 0, y: -1 } },
        bot: { ...s.fighters.bot, pos: { x: 150, y: 300 - FIGHTER_RADIUS - PROJECTILE_RADIUS + 1 } },
      },
    };
    const inputs: DuelInputs = { player: { target: null, dashPressed: false, throwPressed: true }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 16);
    expect(next.fighters.bot.hp).toBeLessThan(MAX_HP);
    expect(next.projectiles.length).toBe(0); // поглощён попаданием
  });

  it('does not damage the owner\'s own side', () => {
    let s = runCountdown();
    const inputs: DuelInputs = { player: { target: null, dashPressed: false, throwPressed: true }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 16);
    expect(next.fighters.player.hp).toBe(MAX_HP);
  });
});

describe('win conditions — server-authoritative, not client-claimable', () => {
  it('declares the fighter with remaining HP the winner when the opponent reaches 0', () => {
    let s = runCountdown();
    s = { ...s, fighters: { ...s.fighters, bot: { ...s.fighters.bot, hp: 1 } } };
    s = {
      ...s,
      fighters: {
        player: { ...s.fighters.player, pos: { x: 150, y: 250 } },
        bot: { ...s.fighters.bot, pos: { x: 150, y: 240 } },
      },
    };
    const inputs: DuelInputs = { player: { target: null, dashPressed: true, throwPressed: false }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 16);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe('player');
  });

  it('at time-out, the higher-HP fighter wins', () => {
    let s = runCountdown();
    s = { ...s, timeLeftMs: 10, fighters: { ...s.fighters, bot: { ...s.fighters.bot, hp: 40 } } };
    const next = stepDuelPvP(s, noInputs(), 50);
    expect(next.phase).toBe('over');
    expect(next.timeLeftMs).toBe(0);
    expect(next.winner).toBe('player'); // 100 HP > 40 HP
  });

  it('equal HP at time-out is a draw', () => {
    let s = runCountdown();
    s = { ...s, timeLeftMs: 10 };
    const next = stepDuelPvP(s, noInputs(), 50);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe('draw');
  });

  it('a finished match (phase over) ignores all further input — result cannot be altered post-hoc', () => {
    let s = runCountdown();
    s = { ...s, phase: 'over', winner: 'bot' };
    const inputs: DuelInputs = { player: { target: null, dashPressed: true, throwPressed: true }, bot: noInput() };
    const next = stepDuelPvP(s, inputs, 1000);
    expect(next).toBe(s); // resolveStep returns the same state unchanged once over
    expect(next.winner).toBe('bot');
  });

  it('the winner is derived purely from HP/time by the engine — a client cannot inject an arbitrary winner without going through real damage', () => {
    // Симулируем множество случайных, но детерминированных партий и проверяем
    // инвариант: winner === 'draw' | hp-сравнение всегда соответствует
    // реальным HP на момент окончания, никогда не берётся "с потолка".
    let s = runCountdown();
    let ticks = 0;
    while (s.phase === 'playing' && ticks < 20000) {
      const inputs: DuelInputs = {
        player: { target: s.fighters.bot.pos, dashPressed: ticks % 30 === 0, throwPressed: ticks % 45 === 0 },
        bot: { target: s.fighters.player.pos, dashPressed: ticks % 33 === 0, throwPressed: ticks % 50 === 0 },
      };
      s = stepDuelPvP(s, inputs, 16);
      ticks++;
    }
    expect(s.phase).toBe('over');
    if (s.fighters.player.hp <= 0 && s.fighters.bot.hp <= 0) {
      expect(s.winner).toBe('draw');
    } else if (s.fighters.player.hp <= 0) {
      expect(s.winner).toBe('bot');
    } else if (s.fighters.bot.hp <= 0) {
      expect(s.winner).toBe('player');
    } else if (s.timeLeftMs <= 0) {
      if (s.fighters.player.hp === s.fighters.bot.hp) expect(s.winner).toBe('draw');
      else expect(s.winner).toBe(s.fighters.player.hp > s.fighters.bot.hp ? 'player' : 'bot');
    }
  });
});

describe('stepDuel (local vs-bot) vs stepDuelPvP (server PvP) share the same core logic', () => {
  it('stepDuel moves the bot via built-in AI even with no explicit bot input (local prototype)', () => {
    let s = runCountdown(); // stepDuel also honors countdown via the same resolveStep
    const botPosBefore = s.fighters.bot.pos;
    const input: DuelInput = { target: null, dashPressed: false, throwPressed: false };
    const next = stepDuel(s, input, 200);
    // Бот преследует игрока сам — движок должен был сдвинуть его без внешнего ввода.
    expect(next.fighters.bot.pos).not.toEqual(botPosBefore);
  });

  it('stepDuelPvP never moves the bot side unless real input says so (no AI in PvP mode)', () => {
    const s = runCountdown();
    const botPosBefore = s.fighters.bot.pos;
    const next = stepDuelPvP(s, noInputs(), 200);
    expect(next.fighters.bot.pos).toEqual(botPosBefore);
  });
});
