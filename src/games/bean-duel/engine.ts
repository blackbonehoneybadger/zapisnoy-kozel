// DOFFA Bean Duel — чистый игровой движок (без React/DOM). Дуэль один на
// один: маскот-чашка DOFFA против маскота-чашки соперника на небольшой
// арене. Победа зависит от управления, реакции и уклонения — НЕ от размера
// ставки: проигравший ничего не передаёт победителю (см. docs в модуле).
//
// Модель боя v1 (две способности):
//   - Игрок ведёт своего бойца пальцем/мышью (следование за указателем).
//   - «Рывок» (ближний бой) — короткий бросок в сторону движения: во время
//     рывка боец наносит урон при касании соперника и невосприимчив к
//     чужому рывку И к чужому «Броску зерна». Простое касание БЕЗ рывка
//     урона не наносит — это и есть уклонение: чтобы не получить урон,
//     нужно НЕ стоять на пути чужого рывка/зерна (или увернуться рывком).
//   - «Бросок зерна» (дальний бой) — снаряд летит по направлению взгляда
//     бойца, наносит меньше урона, чем рывок, но достаёт на дистанции и
//     не требует сближения; свой, более долгий, кулдаун.
//   - Матч идёт MATCH_DURATION_MS или до нуля HP одного из бойцов.
//   - При равенстве по истечении времени — победа у того, чьё HP выше
//     (ничья, если равны).

export interface Vec2 {
  x: number;
  y: number;
}

export type FighterId = 'player' | 'bot';

export interface Fighter {
  pos: Vec2;
  /** Направление последнего движения — используется для броска рывком. */
  facing: Vec2;
  hp: number;
  /** Мс до конца текущего рывка (0 — не в рывке). */
  dashingMs: number;
  /** Мс до готовности следующего рывка. */
  dashCooldownMs: number;
  /** Мс неуязвимости (во время своего рывка). */
  invulnerableMs: number;
  /** Мс лёгкого отброса/стана после получения удара (не может двигаться/рывковать). */
  stunMs: number;
  /** Мс до готовности следующего «Броска зерна». */
  throwCooldownMs: number;
}

/** Летящее зерно — снаряд способности «Бросок зерна». */
export interface Projectile {
  id: number;
  owner: FighterId;
  pos: Vec2;
  vel: Vec2;
}

export type DuelPhase = 'countdown' | 'playing' | 'over';

export interface DuelState {
  arena: { w: number; h: number };
  fighters: Record<FighterId, Fighter>;
  projectiles: Projectile[];
  /** Счётчик для стабильных id новых снарядов (детерминированно, без Math.random/Date.now). */
  nextProjectileId: number;
  timeLeftMs: number;
  phase: DuelPhase;
  winner: FighterId | 'draw' | null;
  /** Счётчик обратного отсчёта перед стартом (сек), для UI. */
  countdown: number;
  /** Последнее событие для звука/фидбека UI (сбрасывается каждый кадр после чтения). */
  lastHit: { target: FighterId; at: number } | null;
}

export const ARENA = { w: 300, h: 460 };
export const FIGHTER_RADIUS = 22;
export const MATCH_DURATION_MS = 75_000;
export const COUNTDOWN_S = 3;

const MOVE_SPEED = 0.16; // px/ms обычное перемещение к цели
const DASH_SPEED = 0.62; // px/ms во время рывка
const DASH_DURATION_MS = 220;
export const DASH_COOLDOWN_MS = 1400;
const DASH_DAMAGE = 34;
const HIT_STUN_MS = 260;
export const MAX_HP = 100;

// «Бросок зерна» — дальнобойная способность: слабее рывка, но не требует
// сближения и имеет более долгий кулдаун (нельзя спамить издалека).
export const PROJECTILE_RADIUS = 7;
export const THROW_SPEED = 0.5; // px/ms
export const THROW_COOLDOWN_MS = 2200;
const THROW_DAMAGE = 16;
const THROW_STUN_MS = 160;
const THROW_SPAWN_OFFSET = FIGHTER_RADIUS + PROJECTILE_RADIUS + 2;

function vecLen(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function vecNorm(v: Vec2): Vec2 {
  const len = vecLen(v);
  return len > 0.0001 ? { x: v.x / len, y: v.y / len } : { x: 0, y: -1 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampToArena(pos: Vec2): Vec2 {
  return {
    x: clamp(pos.x, FIGHTER_RADIUS, ARENA.w - FIGHTER_RADIUS),
    y: clamp(pos.y, FIGHTER_RADIUS, ARENA.h - FIGHTER_RADIUS),
  };
}

function makeFighter(pos: Vec2): Fighter {
  return {
    pos,
    facing: { x: 0, y: -1 },
    hp: MAX_HP,
    dashingMs: 0,
    dashCooldownMs: 0,
    invulnerableMs: 0,
    stunMs: 0,
    throwCooldownMs: 0,
  };
}

export function createInitialState(): DuelState {
  return {
    arena: ARENA,
    fighters: {
      player: makeFighter({ x: ARENA.w / 2, y: ARENA.h - 90 }),
      bot: makeFighter({ x: ARENA.w / 2, y: 90 }),
    },
    projectiles: [],
    nextProjectileId: 1,
    timeLeftMs: MATCH_DURATION_MS,
    phase: 'countdown',
    winner: null,
    countdown: COUNTDOWN_S,
    lastHit: null,
  };
}

/** Ввод игрока за этот кадр. */
export interface DuelInput {
  /** Точка на арене, к которой тянется боец игрока (null — стоит на месте). */
  target: Vec2 | null;
  /** Кнопка рывка нажата ИМЕННО в этом кадре (edge-triggered, не удержание). */
  dashPressed: boolean;
  /** Кнопка «Бросок зерна» нажата ИМЕННО в этом кадре (edge-triggered). */
  throwPressed: boolean;
}

/** Один шаг симуляции. Чистая функция: state + input + dt → новый state. */
export function stepDuel(state: DuelState, input: DuelInput, dtMs: number): DuelState {
  if (state.phase === 'countdown') {
    const countdown = state.countdown - dtMs / 1000;
    if (countdown <= 0) {
      return { ...state, phase: 'playing', countdown: 0 };
    }
    return { ...state, countdown };
  }
  if (state.phase === 'over') return state;

  const fighters: Record<FighterId, Fighter> = {
    player: { ...state.fighters.player },
    bot: { ...state.fighters.bot },
  };

  // Ввод бота: простой ИИ — преследует игрока, иногда рвётся в его сторону,
  // а на средней дистанции кидает зерно вместо сближения.
  const botTarget = state.fighters.player.pos;
  const botToPlayer = { x: botTarget.x - fighters.bot.pos.x, y: botTarget.y - fighters.bot.pos.y };
  const botDist = vecLen(botToPlayer);
  const botWantsDash = fighters.bot.dashCooldownMs <= 0 && botDist < 130 && botDist > 10;
  const botWantsThrow = fighters.bot.throwCooldownMs <= 0 && botDist >= 70 && botDist < 260;

  updateFighter(fighters.player, input.target, input.dashPressed, dtMs);
  updateFighter(fighters.bot, botDist > 4 ? botTarget : null, botWantsDash, dtMs);

  // «Бросок зерна» — спавн снаряда по направлению взгляда бойца (facing уже
  // обновлён на этом кадре внутри updateFighter выше).
  const projectiles: Projectile[] = state.projectiles.map((p) => ({ ...p }));
  let nextProjectileId = state.nextProjectileId;
  const trySpawnThrow = (f: Fighter, wants: boolean, owner: FighterId) => {
    if (!wants || f.stunMs > 0 || f.dashingMs > 0 || f.throwCooldownMs > 0) return;
    f.throwCooldownMs = THROW_COOLDOWN_MS;
    projectiles.push({
      id: nextProjectileId++,
      owner,
      pos: { x: f.pos.x + f.facing.x * THROW_SPAWN_OFFSET, y: f.pos.y + f.facing.y * THROW_SPAWN_OFFSET },
      vel: { x: f.facing.x * THROW_SPEED, y: f.facing.y * THROW_SPEED },
    });
  };
  trySpawnThrow(fighters.player, input.throwPressed, 'player');
  trySpawnThrow(fighters.bot, botWantsThrow, 'bot');

  let lastHit: DuelState['lastHit'] = null;

  // Полёт и попадание снарядов: снаряд поглощается при вылете за арену или
  // при попадании во ВРАЖЕСКОГО бойца (свой снаряд его не задевает); цель в
  // рывке (неуязвима) снаряд не получает — тот же принцип, что и с рывком.
  const survivors: Projectile[] = [];
  for (const p of projectiles) {
    const pos = { x: p.pos.x + p.vel.x * dtMs, y: p.pos.y + p.vel.y * dtMs };
    const outOfBounds = pos.x < -20 || pos.x > ARENA.w + 20 || pos.y < -20 || pos.y > ARENA.h + 20;
    if (outOfBounds) continue;
    const targetId: FighterId = p.owner === 'player' ? 'bot' : 'player';
    const target = fighters[targetId];
    const dToTarget = vecLen({ x: pos.x - target.pos.x, y: pos.y - target.pos.y });
    if (dToTarget < FIGHTER_RADIUS + PROJECTILE_RADIUS && target.invulnerableMs <= 0) {
      target.hp = Math.max(0, target.hp - THROW_DAMAGE);
      target.stunMs = Math.max(target.stunMs, THROW_STUN_MS);
      lastHit = { target: targetId, at: Date.now() };
      continue; // снаряд израсходован
    }
    survivors.push({ ...p, pos });
  }

  // Столкновение вплотную (рывок): урон наносит ТОЛЬКО тот, кто сейчас в
  // рывке, невосприимчивой стороне (rывок = неуязвимость) урон не проходит.
  const dist = vecLen({ x: fighters.player.pos.x - fighters.bot.pos.x, y: fighters.player.pos.y - fighters.bot.pos.y });
  if (dist < FIGHTER_RADIUS * 1.7) {
    const playerHits = fighters.player.dashingMs > 0 && fighters.bot.invulnerableMs <= 0;
    const botHits = fighters.bot.dashingMs > 0 && fighters.player.invulnerableMs <= 0;
    if (playerHits && !botHits) {
      fighters.bot.hp = Math.max(0, fighters.bot.hp - DASH_DAMAGE);
      fighters.bot.stunMs = HIT_STUN_MS;
      fighters.bot.dashingMs = 0;
      lastHit = { target: 'bot', at: Date.now() };
    } else if (botHits && !playerHits) {
      fighters.player.hp = Math.max(0, fighters.player.hp - DASH_DAMAGE);
      fighters.player.stunMs = HIT_STUN_MS;
      fighters.player.dashingMs = 0;
      lastHit = { target: 'player', at: Date.now() };
    }
    // Оба рвутся одновременно — взаимная неуязвимость, обмен без урона (clash).
  }

  const timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);
  let phase: DuelPhase = 'playing';
  let winner: DuelState['winner'] = null;
  if (fighters.player.hp <= 0 || fighters.bot.hp <= 0) {
    phase = 'over';
    winner = fighters.player.hp <= 0 && fighters.bot.hp <= 0
      ? 'draw'
      : fighters.player.hp <= 0
        ? 'bot'
        : 'player';
  } else if (timeLeftMs <= 0) {
    phase = 'over';
    winner = fighters.player.hp === fighters.bot.hp ? 'draw' : fighters.player.hp > fighters.bot.hp ? 'player' : 'bot';
  }

  return { ...state, fighters, projectiles: survivors, nextProjectileId, timeLeftMs, phase, winner, lastHit };
}

function updateFighter(f: Fighter, target: Vec2 | null, dashPressed: boolean, dtMs: number): void {
  f.dashingMs = Math.max(0, f.dashingMs - dtMs);
  f.dashCooldownMs = Math.max(0, f.dashCooldownMs - dtMs);
  f.invulnerableMs = Math.max(0, f.invulnerableMs - dtMs);
  f.stunMs = Math.max(0, f.stunMs - dtMs);
  f.throwCooldownMs = Math.max(0, f.throwCooldownMs - dtMs);

  if (f.stunMs > 0) return; // оглушён — не двигается, не рвётся

  if (target) {
    const dir = vecNorm({ x: target.x - f.pos.x, y: target.y - f.pos.y });
    if (vecLen({ x: target.x - f.pos.x, y: target.y - f.pos.y }) > 2) {
      f.facing = dir;
    }
  }

  if (dashPressed && f.dashCooldownMs <= 0 && f.dashingMs <= 0) {
    f.dashingMs = DASH_DURATION_MS;
    f.dashCooldownMs = DASH_COOLDOWN_MS;
    f.invulnerableMs = DASH_DURATION_MS;
  }

  const speed = f.dashingMs > 0 ? DASH_SPEED : MOVE_SPEED;
  if (f.dashingMs > 0) {
    // Во время рывка летит по направлению facing независимо от текущей цели.
    f.pos = clampToArena({ x: f.pos.x + f.facing.x * speed * dtMs, y: f.pos.y + f.facing.y * speed * dtMs });
  } else if (target) {
    const toTarget = { x: target.x - f.pos.x, y: target.y - f.pos.y };
    const d = vecLen(toTarget);
    if (d > 2) {
      const dir = vecNorm(toTarget);
      const step = Math.min(d, speed * dtMs);
      f.pos = clampToArena({ x: f.pos.x + dir.x * step, y: f.pos.y + dir.y * step });
    }
  }
}
