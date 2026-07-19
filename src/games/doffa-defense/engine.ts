// DOFFA Defense — чистый TS-порт комнатного режима Java-версии
// (doffa-defense, core/src/main/java/com/doffa/defense/action/RoomScreen.java
// + encounter/*). Никакого DOM/React — только симуляция: движение, остановка
// = авто-атака ближайшего врага, 4 типа врагов (CHASE/KEEP_DISTANCE),
// сидированная генерация главы с баланс-гардами (index-1 не ELITE; RECOVERY
// гарантированно до мини-босса; две небоевые комнаты не подряд), мини-босс
// в середине и босс главы в конце с телеграфируемыми атаками (уклонение —
// полноправный исход), драфт способности 1-из-3 после боевых комнат.
//
// Детерминизм: вместо java.util.Random используется mulberry32 (32-битный
// PRNG, см. makeRng) — бит-в-бит поток Java не воспроизводится (другой
// алгоритм), но внутри TS-движка один сид всегда даёт одну и ту же главу,
// раскладку спавна, драфты и криты. Все числа (статы, веса, тайминги)
// перенесены из Java-источников без изменений; сознательные сокращения —
// в PORT_NOTES.md.

// ---------------------------------------------------------------------------
// PRNG: mulberry32 — маленький быстрый детерминированный генератор.
// ---------------------------------------------------------------------------

export interface Rng {
  /** Следующее float в [0, 1) — аналог java.util.Random#nextFloat. */
  next(): number;
  /** Целое в [0, bound) — аналог nextInt(bound). */
  nextInt(bound: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (bound) => Math.floor(next() * bound),
  };
}

// ---------------------------------------------------------------------------
// Константы боя (RoomScreen.java / PlayerController.java / PlayerLoadout.java)
// ---------------------------------------------------------------------------

export const PLAYER_MAX_HP = 100;
export const PLAYER_HIT_RADIUS = 22;
export const PLAYER_PROJECTILE_RADIUS = 8;
export const PLAYER_PROJECTILE_BASE_DAMAGE = 14;
export const ENEMY_PROJECTILE_RADIUS = 6;
export const PROJECTILE_SPREAD_DEGREES = 10;
export const PLAYER_PROJECTILE_SPEED = 520;

export const MOVE_SPEED_PX_PER_SEC = 220;
export const ATTACK_GRACE_SECONDS = 0.15;
export const ATTACK_INTERVAL_SECONDS = 0.35;
export const MOVE_INPUT_EPSILON = 0.001;

export const BASE_CRIT_MULTIPLIER = 1.5;
export const MIN_DAMAGE_TAKEN_MULTIPLIER = 0.2;
export const MIN_FIRE_INTERVAL_MULTIPLIER = 0.4;
export const MAX_LIFESTEAL_FRACTION = 0.9;

export const MELEE_CONTACT_RANGE_PX = 26;
export const KEEP_DISTANCE_INNER_FACTOR = 0.6;

/** Фиксированный шаг симуляции (1/60с) — render-цикл экрана копит реальный dt. */
export const FIXED_TIMESTEP = 1 / 60;

// Сиды забега — те же числа, что и в RoomScreen.java.
export const RUN_SEED = 202607173;
export const DRAFT_SEED = 202607171;
export const COMBAT_ROLL_SEED = 202607172;
export const CHAPTER_ROOM_COUNT = 6;

// ---------------------------------------------------------------------------
// Границы комнаты
// ---------------------------------------------------------------------------

export interface RoomBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function clampX(b: RoomBounds, x: number): number {
  return Math.max(b.minX, Math.min(b.maxX, x));
}
export function clampY(b: RoomBounds, y: number): number {
  return Math.max(b.minY, Math.min(b.maxY, y));
}

// ---------------------------------------------------------------------------
// Шаблоны комнат биома «Горная кофейня» (RoomTemplateCatalog.java, все 10)
// ---------------------------------------------------------------------------

export interface RoomTemplate {
  id: string;
  displayName: string;
  width: number;
  height: number;
  margin: number;
  spawnRadius: number;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  { id: 'standard_hall', displayName: 'Стандартный зал', width: 2400, height: 1400, margin: 80, spawnRadius: 520 },
  { id: 'wide_veranda', displayName: 'Широкая веранда', width: 3000, height: 1000, margin: 90, spawnRadius: 560 },
  { id: 'narrow_storeroom', displayName: 'Узкий склад зёрен', width: 1400, height: 2200, margin: 70, spawnRadius: 460 },
  { id: 'round_tasting_room', displayName: 'Круглый дегустационный зал', width: 1700, height: 1700, margin: 100, spawnRadius: 500 },
  { id: 'large_roastery_floor', displayName: 'Большой обжарочный цех', width: 3200, height: 1800, margin: 90, spawnRadius: 620 },
  { id: 'compact_pantry', displayName: 'Тесная кладовая', width: 1200, height: 1200, margin: 60, spawnRadius: 380 },
  { id: 'long_delivery_corridor', displayName: 'Длинный коридор поставок', width: 3400, height: 900, margin: 70, spawnRadius: 600 },
  { id: 'terraced_courtyard', displayName: 'Террасный двор', width: 2600, height: 2000, margin: 100, spawnRadius: 580 },
  { id: 'mountain_overlook', displayName: 'Смотровая площадка', width: 2000, height: 2000, margin: 110, spawnRadius: 540 },
  { id: 'packed_loading_dock', displayName: 'Загруженная погрузочная площадка', width: 2800, height: 1300, margin: 80, spawnRadius: 560 },
];

// ---------------------------------------------------------------------------
// Типы комнат и генератор главы (RoomGenerator.java, включая баланс-гарды
// из незакоммиченной версии: index-1 не ELITE + RECOVERY до мини-босса).
// ---------------------------------------------------------------------------

export type RoomType = 'NORMAL' | 'ELITE' | 'TREASURE' | 'RECOVERY' | 'MINI_BOSS' | 'CHAPTER_BOSS';

export interface RoomPlan {
  template: RoomTemplate;
  type: RoomType;
  roomSeed: number;
}

const MINIMUM_ROOM_COUNT = 3;
const NORMAL_WEIGHT = 0.55;
const ELITE_WEIGHT = 0.2;
const TREASURE_WEIGHT = 0.12;
// RECOVERY забирает оставшуюся вероятностную массу.

function isNonCombat(t: RoomType): boolean {
  return t === 'TREASURE' || t === 'RECOVERY';
}

function rollRoomType(rng: Rng, previousType: RoomType): RoomType {
  const roll = rng.next();
  let type: RoomType;
  if (roll < NORMAL_WEIGHT) type = 'NORMAL';
  else if (roll < NORMAL_WEIGHT + ELITE_WEIGHT) type = 'ELITE';
  else if (roll < NORMAL_WEIGHT + ELITE_WEIGHT + TREASURE_WEIGHT) type = 'TREASURE';
  else type = 'RECOVERY';

  if (isNonCombat(previousType) && isNonCombat(type)) {
    return rng.next() < 0.7 ? 'NORMAL' : 'ELITE';
  }
  return type;
}

/** Пост-проход по выброшенным типам: index-1 не ELITE; RECOVERY строго до мини-босса. */
function applyEarlyGameGuards(types: RoomType[], miniBossIndex: number): void {
  if (types.length > 1 && types[1] === 'ELITE') {
    types[1] = 'NORMAL';
  }
  ensureRecoveryBeforeMiniBoss(types, miniBossIndex);
}

function ensureRecoveryBeforeMiniBoss(types: RoomType[], miniBossIndex: number): void {
  if (miniBossIndex <= 1) return; // roomCount 3 — бросаемых комнат до мини-босса нет
  for (let i = 1; i < miniBossIndex; i++) {
    if (types[i] === 'RECOVERY') return;
  }
  for (let i = miniBossIndex - 1; i >= 1; i--) {
    if (!isNonCombat(types[i - 1]) && !isNonCombat(types[i + 1])) {
      types[i] = 'RECOVERY';
      return;
    }
  }
  // Патологический случай: конвертируем последний индекс диапазона и понижаем
  // небоевого соседа до NORMAL — инвариант «не подряд» восстановлен.
  const target = miniBossIndex - 1;
  types[target] = 'RECOVERY';
  if (target - 1 >= 1 && isNonCombat(types[target - 1])) {
    types[target - 1] = 'NORMAL';
  }
}

/** Детерминированная глава: сид → последовательность RoomPlan. */
export function generateChapter(
  runSeed: number,
  roomCount: number,
  templatePool: RoomTemplate[] = ROOM_TEMPLATES,
): RoomPlan[] {
  if (roomCount < MINIMUM_ROOM_COUNT) {
    throw new Error(`roomCount must be at least ${MINIMUM_ROOM_COUNT}`);
  }
  if (templatePool.length === 0) {
    throw new Error('templatePool must not be empty');
  }
  const rng = makeRng(runSeed);
  const lastIndex = roomCount - 1;
  const miniBossIndex = Math.floor(roomCount / 2);
  const templates: RoomTemplate[] = new Array(roomCount);
  const types: RoomType[] = new Array(roomCount);
  const roomSeeds: number[] = new Array(roomCount);
  for (let i = 0; i < roomCount; i++) {
    templates[i] = templatePool[rng.nextInt(templatePool.length)];
    let type: RoomType;
    if (i === 0) type = 'NORMAL';
    else if (i === lastIndex) type = 'CHAPTER_BOSS';
    else if (i === miniBossIndex) type = 'MINI_BOSS';
    else type = rollRoomType(rng, types[i - 1]);
    types[i] = type;
    roomSeeds[i] = rng.nextInt(0x7fffffff);
  }
  applyEarlyGameGuards(types, miniBossIndex);
  return types.map((type, i) => ({ template: templates[i], type, roomSeed: roomSeeds[i] }));
}

// ---------------------------------------------------------------------------
// Враги (EnemyCatalog.java / EnemyStats / EnemyDefinition / RoomEnemy.java)
// ---------------------------------------------------------------------------

export type EnemyRole = 'MELEE' | 'RANGED' | 'TANK';
export type EnemyMovementPattern = 'CHASE' | 'KEEP_DISTANCE';

export interface EnemyStats {
  maxHp: number;
  moveSpeedPxPerSec: number;
  contactDamage: number;
  attackDamage: number;
  attackRangePx: number;
  attackCooldownSeconds: number;
  projectileSpeedPxPerSec: number;
}

export interface EnemyDefinition {
  id: string;
  displayName: string;
  role: EnemyRole;
  movementPattern: EnemyMovementPattern;
  stats: EnemyStats;
  radiusPx: number;
  elite: boolean;
}

export const ENEMY_CHEMICAL_RUNNER: EnemyDefinition = {
  id: 'syndicate_chemical_runner',
  displayName: 'Химический курьер',
  role: 'MELEE',
  movementPattern: 'CHASE',
  stats: { maxHp: 28, moveSpeedPxPerSec: 130, contactDamage: 8, attackDamage: 0, attackRangePx: 0, attackCooldownSeconds: 0.6, projectileSpeedPxPerSec: 0 },
  radiusPx: 18,
  elite: false,
};

export const ENEMY_TOXIC_THROWER: EnemyDefinition = {
  id: 'syndicate_toxic_thrower',
  displayName: 'Токсичный метатель',
  role: 'RANGED',
  movementPattern: 'KEEP_DISTANCE',
  stats: { maxHp: 20, moveSpeedPxPerSec: 70, contactDamage: 0, attackDamage: 6, attackRangePx: 420, attackCooldownSeconds: 1.4, projectileSpeedPxPerSec: 340 },
  radiusPx: 16,
  elite: false,
};

export const ENEMY_ARMORED_BREWER: EnemyDefinition = {
  id: 'syndicate_armored_brewer',
  displayName: 'Бронированный варщик',
  role: 'TANK',
  movementPattern: 'CHASE',
  stats: { maxHp: 70, moveSpeedPxPerSec: 55, contactDamage: 14, attackDamage: 0, attackRangePx: 0, attackCooldownSeconds: 1.0, projectileSpeedPxPerSec: 0 },
  radiusPx: 24,
  elite: false,
};

export const ENEMY_MUTATED_DEALER: EnemyDefinition = {
  id: 'syndicate_mutated_dealer',
  displayName: 'Мутировавший делец',
  role: 'RANGED',
  movementPattern: 'KEEP_DISTANCE',
  stats: { maxHp: 90, moveSpeedPxPerSec: 90, contactDamage: 0, attackDamage: 11, attackRangePx: 460, attackCooldownSeconds: 0.9, projectileSpeedPxPerSec: 380 },
  radiusPx: 28,
  elite: true,
};

export function basicRoster(): EnemyDefinition[] {
  return [ENEMY_CHEMICAL_RUNNER, ENEMY_TOXIC_THROWER, ENEMY_ARMORED_BREWER, ENEMY_MUTATED_DEALER];
}

/** Базовый ростер + дубликат элиты — усиленный бой для комнаты ELITE. */
export function eliteRoster(): EnemyDefinition[] {
  return [...basicRoster(), ENEMY_MUTATED_DEALER];
}

/** Живой экземпляр врага в комнате (RoomEnemy.java). */
export class RoomEnemy {
  readonly definition: EnemyDefinition;
  x: number;
  y: number;
  currentHp: number;
  alive = true;
  facingX = -1;
  facingY = 0;
  meleeAttackedThisUpdate = false;
  firedProjectileThisUpdate = false;
  private attackCooldownTimer = 0;
  private burnDps = 0;
  private burnRemaining = 0;

  constructor(definition: EnemyDefinition, startX: number, startY: number) {
    this.definition = definition;
    this.x = startX;
    this.y = startY;
    this.currentHp = definition.stats.maxHp;
  }

  update(dt: number, playerX: number, playerY: number, bounds: RoomBounds): void {
    this.meleeAttackedThisUpdate = false;
    this.firedProjectileThisUpdate = false;
    if (!this.alive) return;

    if (this.burnRemaining > 0) {
      this.applyDamage(this.burnDps * dt);
      this.burnRemaining = Math.max(0, this.burnRemaining - dt);
      if (!this.alive) return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.0001) {
      this.facingX = dx / distance;
      this.facingY = dy / distance;
    }

    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    const stats = this.definition.stats;

    if (this.definition.movementPattern === 'CHASE') {
      if (distance > MELEE_CONTACT_RANGE_PX) {
        this.x = clampX(bounds, this.x + this.facingX * stats.moveSpeedPxPerSec * dt);
        this.y = clampY(bounds, this.y + this.facingY * stats.moveSpeedPxPerSec * dt);
      } else if (this.attackCooldownTimer <= 0) {
        this.meleeAttackedThisUpdate = true;
        this.attackCooldownTimer = stats.attackCooldownSeconds;
      }
    } else {
      // Сближаемся, когда дальше реальной дальности атаки (регрессия R-Stage5:
      // широкое «внешнее» кольцо оставляло врага застрявшим вне зоны огня).
      const inner = stats.attackRangePx * KEEP_DISTANCE_INNER_FACTOR;
      if (distance > stats.attackRangePx) {
        this.x = clampX(bounds, this.x + this.facingX * stats.moveSpeedPxPerSec * dt);
        this.y = clampY(bounds, this.y + this.facingY * stats.moveSpeedPxPerSec * dt);
      } else if (distance < inner) {
        this.x = clampX(bounds, this.x - this.facingX * stats.moveSpeedPxPerSec * dt);
        this.y = clampY(bounds, this.y - this.facingY * stats.moveSpeedPxPerSec * dt);
      }
      if (distance <= stats.attackRangePx && this.attackCooldownTimer <= 0) {
        this.firedProjectileThisUpdate = true;
        this.attackCooldownTimer = stats.attackCooldownSeconds;
      }
    }
  }

  /** Поджог обновляется к более сильному варианту, а не складывается — защита от runaway DPS. */
  applyBurn(dps: number, durationSeconds: number): void {
    if (!this.alive) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnRemaining = Math.max(this.burnRemaining, durationSeconds);
  }

  get isBurning(): boolean {
    return this.burnRemaining > 0;
  }

  applyDamage(amount: number): void {
    if (!this.alive) return;
    this.currentHp -= amount;
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.alive = false;
    }
  }
}

export interface EnemyProjectile {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speedPxPerSec: number;
  damage: number;
  alive: boolean;
}

/** Директор столкновения: спавн по сиду + тик (EncounterDirector.java). */
export class EncounterDirector {
  readonly enemies: RoomEnemy[] = [];
  readonly projectiles: EnemyProjectile[] = [];
  private bounds: RoomBounds;

  constructor(bounds: RoomBounds) {
    this.bounds = bounds;
  }

  spawnWave(roster: EnemyDefinition[], centerX: number, centerY: number, spawnRadius: number, seed: number): void {
    this.enemies.length = 0;
    this.projectiles.length = 0;
    const rng = makeRng(seed);
    const angleStep = (Math.PI * 2) / roster.length;
    for (let i = 0; i < roster.length; i++) {
      const angle = angleStep * i + (rng.next() - 0.5) * (angleStep * 0.5);
      const x = clampX(this.bounds, centerX + Math.cos(angle) * spawnRadius);
      const y = clampY(this.bounds, centerY + Math.sin(angle) * spawnRadius);
      this.enemies.push(new RoomEnemy(roster[i], x, y));
    }
  }

  update(dt: number, playerX: number, playerY: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, playerX, playerY, this.bounds);
      if (enemy.firedProjectileThisUpdate) {
        this.projectiles.push({
          x: enemy.x,
          y: enemy.y,
          dirX: enemy.facingX,
          dirY: enemy.facingY,
          speedPxPerSec: enemy.definition.stats.projectileSpeedPxPerSec,
          damage: enemy.definition.stats.attackDamage,
          alive: true,
        });
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dirX * p.speedPxPerSec * dt;
      p.y += p.dirY * p.speedPxPerSec * dt;
      if (p.x < this.bounds.minX || p.x > this.bounds.maxX || p.y < this.bounds.minY || p.y > this.bounds.maxY) {
        p.alive = false;
      }
      if (!p.alive) this.projectiles.splice(i, 1);
    }
  }

  findNearestAliveEnemy(x: number, y: number): RoomEnemy | null {
    let nearest: RoomEnemy | null = null;
    let nearestDistSq = Number.MAX_VALUE;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }
    return nearest;
  }

  isRoomCleared(): boolean {
    if (this.enemies.length === 0) return false;
    return this.enemies.every((e) => !e.alive);
  }
}

// ---------------------------------------------------------------------------
// Боссы (BossCatalog.java / BossPhaseController.java)
// ---------------------------------------------------------------------------

export interface BossAttack {
  id: string;
  displayName: string;
  telegraphSeconds: number;
  cooldownSeconds: number;
  damage: number;
  rangePx: number;
}

export interface BossPhase {
  id: string;
  hpFractionThreshold: number;
  moveSpeedPxPerSec: number;
  attacks: BossAttack[];
}

export interface BossDefinition {
  id: string;
  displayName: string;
  maxHp: number;
  radiusPx: number;
  engageRangePx: number;
  phases: BossPhase[];
  rewardDescription: string;
}

export function miniBossToxicOverseer(): BossDefinition {
  return {
    id: 'boss_toxic_overseer',
    displayName: 'Токсичный надзиратель',
    maxHp: 180,
    radiusPx: 34,
    engageRangePx: 180,
    phases: [
      {
        id: 'overseer_phase_1',
        hpFractionThreshold: 1.0,
        moveSpeedPxPerSec: 75,
        attacks: [{ id: 'overseer_slam', displayName: 'Токсичный замах', telegraphSeconds: 0.8, cooldownSeconds: 2.0, damage: 16, rangePx: 150 }],
      },
    ],
    rewardDescription: 'Чертёж усиленного фильтра (открывает редкую способность в будущей мете)',
  };
}

export function chemicalBrewerBoss(): BossDefinition {
  return {
    id: 'boss_chemical_brewer',
    displayName: 'Химический Варщик',
    maxHp: 450,
    radiusPx: 48,
    engageRangePx: 220,
    phases: [
      {
        id: 'brewer_phase_1',
        hpFractionThreshold: 1.0,
        moveSpeedPxPerSec: 70,
        attacks: [
          { id: 'brewer_slam', displayName: 'Токсичный замах', telegraphSeconds: 0.9, cooldownSeconds: 2.2, damage: 18, rangePx: 150 },
          { id: 'brewer_barrage', displayName: 'Химический шквал', telegraphSeconds: 1.3, cooldownSeconds: 3.0, damage: 14, rangePx: 700 },
        ],
      },
      {
        id: 'brewer_phase_2',
        hpFractionThreshold: 0.5,
        moveSpeedPxPerSec: 95,
        attacks: [
          { id: 'brewer_slam', displayName: 'Токсичный замах', telegraphSeconds: 0.9, cooldownSeconds: 2.2, damage: 18, rangePx: 150 },
          { id: 'brewer_barrage', displayName: 'Химический шквал', telegraphSeconds: 1.3, cooldownSeconds: 3.0, damage: 14, rangePx: 700 },
          { id: 'brewer_pool', displayName: 'Ядовитая лужа', telegraphSeconds: 1.6, cooldownSeconds: 4.0, damage: 22, rangePx: 350 },
        ],
      },
    ],
    rewardDescription: 'Формула редкого купажа (открывает уникальный косметический скин бариста)',
  };
}

/** Контроллер фаз и телеграфируемых атак одного босса (BossPhaseController.java). */
export class BossPhaseController {
  readonly definition: BossDefinition;
  x: number;
  y: number;
  currentHp: number;
  alive = true;
  currentPhaseIndex = 0;
  phaseJustChanged = false;
  attackLandedThisUpdate = false;
  pendingAttackDamage = 0;
  facingX = -1;
  facingY = 0;
  private attackCooldowns = new Map<string, number>();
  private telegraphingAttack: BossAttack | null = null;
  private telegraphRemaining = 0;
  private burnDps = 0;
  private burnRemaining = 0;

  constructor(definition: BossDefinition, startX: number, startY: number) {
    this.definition = definition;
    this.x = startX;
    this.y = startY;
    this.currentHp = definition.maxHp;
  }

  update(dt: number, playerX: number, playerY: number, bounds: RoomBounds): void {
    this.attackLandedThisUpdate = false;
    this.phaseJustChanged = false;
    if (!this.alive) return;

    if (this.burnRemaining > 0) {
      this.applyDamage(this.burnDps * dt);
      this.burnRemaining = Math.max(0, this.burnRemaining - dt);
      if (!this.alive) return;
    }

    this.updatePhase();
    if (this.phaseJustChanged) {
      // Один кадр паузы на смену фазы — игрок должен заметить переход.
      return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.0001) {
      this.facingX = dx / distance;
      this.facingY = dy / distance;
    }

    const phase = this.definition.phases[this.currentPhaseIndex];
    for (const attack of phase.attacks) {
      const remaining = this.attackCooldowns.get(attack.id) ?? 0;
      if (remaining > 0) {
        this.attackCooldowns.set(attack.id, Math.max(0, remaining - dt));
      }
    }

    if (this.telegraphingAttack) {
      this.telegraphRemaining -= dt;
      if (this.telegraphRemaining <= 0) {
        this.resolveAttack(this.telegraphingAttack, distance);
        this.telegraphingAttack = null;
      }
      return;
    }

    if (distance > this.definition.engageRangePx) {
      this.x = clampX(bounds, this.x + this.facingX * phase.moveSpeedPxPerSec * dt);
      this.y = clampY(bounds, this.y + this.facingY * phase.moveSpeedPxPerSec * dt);
    }

    for (const attack of phase.attacks) {
      if ((this.attackCooldowns.get(attack.id) ?? 0) <= 0) {
        this.telegraphingAttack = attack;
        this.telegraphRemaining = attack.telegraphSeconds;
        break;
      }
    }
  }

  private updatePhase(): void {
    const fraction = this.currentHp / this.definition.maxHp;
    let newIndex = 0;
    for (let i = 0; i < this.definition.phases.length; i++) {
      if (fraction <= this.definition.phases[i].hpFractionThreshold) newIndex = i;
    }
    if (newIndex !== this.currentPhaseIndex) {
      this.currentPhaseIndex = newIndex;
      this.phaseJustChanged = true;
      this.telegraphingAttack = null;
    }
  }

  private resolveAttack(attack: BossAttack, distanceAtResolve: number): void {
    if (distanceAtResolve <= attack.rangePx) {
      this.attackLandedThisUpdate = true;
      this.pendingAttackDamage = attack.damage;
    }
    this.attackCooldowns.set(attack.id, attack.cooldownSeconds);
  }

  applyBurn(dps: number, durationSeconds: number): void {
    if (!this.alive) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnRemaining = Math.max(this.burnRemaining, durationSeconds);
  }

  get isBurning(): boolean {
    return this.burnRemaining > 0;
  }

  applyDamage(amount: number): void {
    if (!this.alive) return;
    this.currentHp -= amount;
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.alive = false;
      this.telegraphingAttack = null;
    }
  }

  get isTelegraphing(): boolean {
    return this.telegraphingAttack !== null;
  }

  get telegraphingAttackName(): string | null {
    return this.telegraphingAttack ? this.telegraphingAttack.displayName : null;
  }

  get telegraphingAttackRangePx(): number {
    return this.telegraphingAttack ? this.telegraphingAttack.rangePx : 0;
  }

  /** 0 в начале телеграфа → 1 к моменту разрешения атаки. */
  get telegraphProgress01(): number {
    if (!this.telegraphingAttack || this.telegraphingAttack.telegraphSeconds <= 0) return 0;
    const elapsed = this.telegraphingAttack.telegraphSeconds - this.telegraphRemaining;
    return Math.max(0, Math.min(1, elapsed / this.telegraphingAttack.telegraphSeconds));
  }
}

// ---------------------------------------------------------------------------
// Снаряды игрока (ActionProjectile.java / PlayerWeapon.java)
// ---------------------------------------------------------------------------

export interface ActionProjectile {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  alive: boolean;
  pierceRemaining: number;
}

// ---------------------------------------------------------------------------
// Лоадаут и здоровье игрока (PlayerLoadout.java / PlayerHealth.java)
// ---------------------------------------------------------------------------

export class PlayerLoadout {
  private damageBonus = 0;
  private speedBonus = 0;
  private critChance = 0;
  private critMultiplierBonus = 0;
  private projectileCountBonus = 0;
  private pierceCountBonus = 0;
  private burnDamagePerSecond = 0;
  private burnDurationSeconds = 0;
  private damageReduction = 0;
  private regenPerSecond = 0;
  private dodgeInvulnerabilitySeconds = 0;
  private lifestealFraction = 0;
  private fireRateReduction = 0;

  addDamageBonus(d: number) { this.damageBonus += d; }
  addSpeedBonus(d: number) { this.speedBonus += d; }
  addCritChance(d: number) { this.critChance += d; }
  addCritMultiplierBonus(d: number) { this.critMultiplierBonus += d; }
  addProjectileCount(d: number) { this.projectileCountBonus += d; }
  addPierceCount(d: number) { this.pierceCountBonus += d; }
  addBurn(dps: number, dur: number) {
    this.burnDamagePerSecond = Math.max(this.burnDamagePerSecond, dps);
    this.burnDurationSeconds = Math.max(this.burnDurationSeconds, dur);
  }
  addDamageReduction(d: number) { this.damageReduction += d; }
  addRegenPerSecond(d: number) { this.regenPerSecond += d; }
  addDodgeInvulnerabilitySeconds(d: number) { this.dodgeInvulnerabilitySeconds += d; }
  addLifestealFraction(d: number) { this.lifestealFraction = Math.min(MAX_LIFESTEAL_FRACTION, this.lifestealFraction + d); }
  addFireRateReduction(d: number) { this.fireRateReduction += d; }

  get damageMultiplier() { return 1 + this.damageBonus; }
  get moveSpeedMultiplier() { return 1 + this.speedBonus; }
  get critChanceClamped() { return Math.max(0, Math.min(1, this.critChance)); }
  get critMultiplier() { return BASE_CRIT_MULTIPLIER + this.critMultiplierBonus; }
  get projectileCount() { return 1 + this.projectileCountBonus; }
  get pierceCount() { return this.pierceCountBonus; }
  get burnDps() { return this.burnDamagePerSecond; }
  get burnDuration() { return this.burnDurationSeconds; }
  get damageTakenMultiplier() { return Math.max(MIN_DAMAGE_TAKEN_MULTIPLIER, 1 - this.damageReduction); }
  get regen() { return this.regenPerSecond; }
  get dodgeInvulnerability() { return this.dodgeInvulnerabilitySeconds; }
  get lifesteal() { return this.lifestealFraction; }
  get fireIntervalMultiplier() { return Math.max(MIN_FIRE_INTERVAL_MULTIPLIER, 1 - this.fireRateReduction); }
}

export class PlayerHealth {
  maxHp: number;
  currentHp: number;

  constructor(maxHp: number) {
    this.maxHp = maxHp;
    this.currentHp = maxHp;
  }

  applyDamage(amount: number): void {
    if (this.currentHp <= 0) return;
    this.currentHp = Math.max(0, this.currentHp - amount);
  }

  /** Реген/похищение — не воскрешает мёртвого героя. */
  heal(amount: number): void {
    if (this.currentHp <= 0 || amount <= 0) return;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  /** Рост максимума HP лечит на ту же величину — общая конвенция рогаликов. */
  increaseMaxHp(amount: number): void {
    this.maxHp += amount;
    this.currentHp += amount;
  }

  get isDead(): boolean {
    return this.currentHp <= 0;
  }
}

// ---------------------------------------------------------------------------
// Каталог способностей — все 26 карт (AbilityCatalog.java), эффекты подключены
// к тем же восьми осям статов, что и в Java-версии.
// ---------------------------------------------------------------------------

export type AbilityCategory =
  | 'ATTACK' | 'SPEED' | 'CRIT' | 'PROJECTILE' | 'ELEMENTAL' | 'DEFENSE' | 'REGEN' | 'MOVEMENT';

export interface Ability {
  id: string;
  displayName: string;
  description: string;
  category: AbilityCategory;
  apply: (loadout: PlayerLoadout, health: PlayerHealth) => void;
}

export const ABILITY_CATALOG: Ability[] = [
  { id: 'attack_double_espresso', displayName: 'Двойной эспрессо', description: '+15% урона от атаки', category: 'ATTACK', apply: (l) => l.addDamageBonus(0.15) },
  { id: 'attack_triple_ristretto', displayName: 'Тройной ристретто', description: '+25% урона от атаки', category: 'ATTACK', apply: (l) => l.addDamageBonus(0.25) },
  { id: 'attack_dark_roast', displayName: 'Тёмная обжарка', description: '+10% урона от атаки', category: 'ATTACK', apply: (l) => l.addDamageBonus(0.10) },
  { id: 'attack_express_line', displayName: 'Экспресс-линия', description: '-15% времени между выстрелами', category: 'ATTACK', apply: (l) => l.addFireRateReduction(0.15) },
  { id: 'attack_quick_pour', displayName: 'Быстрая подача', description: '-10% времени между выстрелами', category: 'ATTACK', apply: (l) => l.addFireRateReduction(0.10) },

  { id: 'speed_fast_service', displayName: 'Быстрая раздача', description: '+12% скорости передвижения', category: 'SPEED', apply: (l) => l.addSpeedBonus(0.12) },
  { id: 'speed_light_tray', displayName: 'Лёгкий поднос', description: '+8% скорости передвижения', category: 'SPEED', apply: (l) => l.addSpeedBonus(0.08) },

  { id: 'crit_fine_grind', displayName: 'Острый помол', description: '+12% шанс критического удара', category: 'CRIT', apply: (l) => l.addCritChance(0.12) },
  { id: 'crit_precise_pour', displayName: 'Точный пуровер', description: '+8% шанс критического удара', category: 'CRIT', apply: (l) => l.addCritChance(0.08) },
  { id: 'crit_steam_burst', displayName: 'Взрыв пара', description: '+30% множитель критического урона', category: 'CRIT', apply: (l) => l.addCritMultiplierBonus(0.30) },

  { id: 'projectile_fan_shot', displayName: 'Веерный выстрел', description: '+1 снаряд за выстрел', category: 'PROJECTILE', apply: (l) => l.addProjectileCount(1) },
  { id: 'projectile_wide_spout', displayName: 'Широкий раструб', description: '+1 снаряд за выстрел', category: 'PROJECTILE', apply: (l) => l.addProjectileCount(1) },
  { id: 'projectile_piercing_blend', displayName: 'Пробивной купаж', description: '+1 пробитие снарядов', category: 'PROJECTILE', apply: (l) => l.addPierceCount(1) },
  { id: 'projectile_steel_filter', displayName: 'Стальной фильтр', description: '+1 пробитие снарядов', category: 'PROJECTILE', apply: (l) => l.addPierceCount(1) },

  { id: 'elemental_scorching_blend', displayName: 'Обжигающий бленд', description: 'Выстрелы поджигают врагов', category: 'ELEMENTAL', apply: (l) => l.addBurn(6, 2.5) },
  { id: 'elemental_double_roast', displayName: 'Двойная обжарка', description: 'Усиливает поджог врагов', category: 'ELEMENTAL', apply: (l) => l.addBurn(4, 1.5) },

  { id: 'defense_armored_apron', displayName: 'Бронированный фартук', description: '-10% получаемого урона', category: 'DEFENSE', apply: (l) => l.addDamageReduction(0.10) },
  { id: 'defense_leather_sleeve', displayName: 'Кожаный нарукавник', description: '-6% получаемого урона', category: 'DEFENSE', apply: (l) => l.addDamageReduction(0.06) },
  { id: 'defense_big_mug', displayName: 'Большая кружка', description: '+20 к максимальному запасу сил', category: 'DEFENSE', apply: (_l, h) => h.increaseMaxHp(20) },
  { id: 'defense_double_portion', displayName: 'Двойная порция', description: '+15 к максимальному запасу сил', category: 'DEFENSE', apply: (_l, h) => h.increaseMaxHp(15) },

  { id: 'regen_warm_cup', displayName: 'Тёплая кружка', description: '+1 восстановление сил в секунду', category: 'REGEN', apply: (l) => l.addRegenPerSecond(1) },
  { id: 'regen_bean_warmer', displayName: 'Грелка для зёрен', description: '+0.6 восстановление сил в секунду', category: 'REGEN', apply: (l) => l.addRegenPerSecond(0.6) },
  { id: 'regen_coffee_to_go', displayName: 'Кофе с собой', description: '+5% похищения жизни от урона', category: 'REGEN', apply: (l) => l.addLifestealFraction(0.05) },
  { id: 'regen_bracing_sip', displayName: 'Бодрящий глоток', description: '+8% похищения жизни от урона', category: 'REGEN', apply: (l) => l.addLifestealFraction(0.08) },

  { id: 'movement_tray_maneuver', displayName: 'Манёвр с подносом', description: '+0.15с неуязвимости при рывке', category: 'MOVEMENT', apply: (l) => l.addDodgeInvulnerabilitySeconds(0.15) },
  { id: 'movement_slick_floor', displayName: 'Скользкий пол', description: '+0.1с неуязвимости при рывке', category: 'MOVEMENT', apply: (l) => l.addDodgeInvulnerabilitySeconds(0.10) },
];

export const DRAFT_SIZE = 3;

/** Драфт 1-из-3: Фишер-Йейтс по сидированному RNG, без повторов в одном драфте (AbilityDraftSystem.java). */
export function rollDraft(rng: Rng, catalog: Ability[] = ABILITY_CATALOG): Ability[] {
  if (catalog.length < DRAFT_SIZE) {
    throw new Error(`catalog must contain at least ${DRAFT_SIZE} abilities`);
  }
  const shuffled = [...catalog];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, DRAFT_SIZE);
}

// ---------------------------------------------------------------------------
// Оркестратор забега (логика RoomScreen.java без рендера/рекламы/меты).
// Фазы: combat → draft | recovery → следующая комната → … → complete | dead.
// ---------------------------------------------------------------------------

export type RunPhase = 'combat' | 'draft' | 'recovery' | 'dead' | 'complete';

export interface RunOptions {
  runSeed?: number;
  draftSeed?: number;
  combatRollSeed?: number;
  roomCount?: number;
  templatePool?: RoomTemplate[];
}

export class DefenseRun {
  readonly chapter: RoomPlan[];
  /** Сид забега, из которого сгенерирована глава (для серверной сверки). */
  readonly runSeed: number;
  roomIndex = 0;
  phase: RunPhase = 'combat';
  paused = false;

  // Статистика забега для серверной экономики (см. net/onlineStore finishRun):
  // заполняется движком по факту, клиент её не «придумывает».
  /** Сколько комнат полностью завершено (боевая зачистка / драфт / восстановление). */
  roomsCleared = 0;
  /** Мини-босс середины главы убит. */
  miniBossKilled = false;

  // Игрок
  playerX = 0;
  playerY = 0;
  facingX = 1;
  facingY = 0;
  moving = false;
  attacking = false;
  firedThisUpdate = false;
  invulnerabilityTimer = 0;
  readonly health = new PlayerHealth(PLAYER_MAX_HP);
  readonly loadout = new PlayerLoadout();

  // Комната
  bounds: RoomBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  template: RoomTemplate;
  encounter: EncounterDirector;
  boss: BossPhaseController | null = null;
  projectiles: ActionProjectile[] = [];

  // Драфт/счёт
  draftOptions: Ability[] = [];
  abilitiesPicked = 0;

  private stoppedSeconds = 0;
  private attackCooldownTimer = 0;
  private wasMovingLastFrame = false;
  private aimDirX = 1;
  private aimDirY = 0;
  private moveDirX = 0;
  private moveDirY = 0;
  private draftRng: Rng;
  private combatRng: Rng;
  private accumulator = 0;

  constructor(options: RunOptions = {}) {
    const runSeed = options.runSeed ?? RUN_SEED;
    this.runSeed = runSeed;
    this.chapter = generateChapter(runSeed, options.roomCount ?? CHAPTER_ROOM_COUNT, options.templatePool ?? ROOM_TEMPLATES);
    this.draftRng = makeRng(options.draftSeed ?? DRAFT_SEED);
    this.combatRng = makeRng(options.combatRollSeed ?? COMBAT_ROLL_SEED);
    this.template = this.chapter[0].template;
    this.encounter = new EncounterDirector(this.bounds);
    this.setupCurrentRoom();
  }

  get currentPlan(): RoomPlan {
    return this.chapter[this.roomIndex];
  }

  get roomNumber(): number {
    return this.roomIndex + 1;
  }

  get totalRooms(): number {
    return this.chapter.length;
  }

  get isBossRoom(): boolean {
    return this.boss !== null;
  }

  /** Сколько врагов осталось в комнате (для HUD «волна»). */
  get enemiesRemaining(): number {
    if (this.boss) return this.boss.alive ? 1 : 0;
    return this.encounter.enemies.filter((e) => e.alive).length;
  }

  setMoveInput(x: number, y: number): void {
    this.moveDirX = x;
    this.moveDirY = y;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Накопительный вход от render-цикла: шагает симуляцию фиксированным dt. */
  advance(dtReal: number): void {
    if (this.paused || this.phase !== 'combat') return;
    this.accumulator = Math.min(this.accumulator + dtReal, FIXED_TIMESTEP * 8);
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.accumulator -= FIXED_TIMESTEP;
      this.tick(FIXED_TIMESTEP);
      if (this.phase !== 'combat') {
        this.accumulator = 0;
        break;
      }
    }
  }

  /** Один фиксированный шаг активного геймплея (tickGameplay в RoomScreen). */
  tick(dt: number): void {
    if (this.phase !== 'combat') return;

    const wasMoving = this.wasMovingLastFrame;
    this.updatePlayer(dt);
    if (this.moving && !wasMoving) {
      this.invulnerabilityTimer = this.loadout.dodgeInvulnerability;
    }
    this.wasMovingLastFrame = this.moving;
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);

    this.updateAimDirection();
    if (this.firedThisUpdate) {
      this.fireWeaponVolley();
    }
    this.updateProjectiles(dt);
    this.encounter.update(dt, this.playerX, this.playerY);
    if (this.boss) {
      this.boss.update(dt, this.playerX, this.playerY, this.bounds);
    }
    this.health.heal(this.loadout.regen * dt);
    this.resolveCombat();

    if (this.health.isDead) {
      this.phase = 'dead';
      return;
    }
    if (this.isCurrentRoomCleared()) {
      this.draftOptions = rollDraft(this.draftRng);
      this.phase = 'draft';
    }
  }

  /** Выбор карты драфта (клавиши 1-3 / тап) — применяет эффект и двигает забег дальше. */
  pickDraft(index: number): void {
    if (this.phase !== 'draft') return;
    const chosen = this.draftOptions[index];
    if (!chosen) return;
    chosen.apply(this.loadout, this.health);
    this.abilitiesPicked++;
    this.proceedAfterRoomCompletion();
  }

  /** Подтверждение комнаты восстановления (Enter / тап). */
  confirmRecovery(): void {
    if (this.phase !== 'recovery') return;
    this.proceedAfterRoomCompletion();
  }

  private setupCurrentRoom(): void {
    const plan = this.currentPlan;
    this.template = plan.template;
    this.bounds = { minX: 0, minY: 0, maxX: this.template.width, maxY: this.template.height };
    this.encounter = new EncounterDirector(this.bounds);
    this.boss = null;
    this.projectiles = [];

    const centerX = this.template.width / 2;
    const centerY = this.template.height / 2;
    this.resetPlayerPosition(centerX, centerY);

    switch (plan.type) {
      case 'ELITE':
        this.encounter.spawnWave(eliteRoster(), centerX, centerY, this.template.spawnRadius, plan.roomSeed);
        this.phase = 'combat';
        break;
      case 'TREASURE':
        this.draftOptions = rollDraft(this.draftRng);
        this.phase = 'draft';
        break;
      case 'RECOVERY':
        this.health.heal(this.health.maxHp);
        this.phase = 'recovery';
        break;
      case 'MINI_BOSS':
        this.boss = new BossPhaseController(
          miniBossToxicOverseer(),
          centerX,
          clampY(this.bounds, centerY + this.template.spawnRadius),
        );
        this.phase = 'combat';
        break;
      case 'CHAPTER_BOSS':
        this.boss = new BossPhaseController(
          chemicalBrewerBoss(),
          centerX,
          clampY(this.bounds, centerY + this.template.spawnRadius),
        );
        this.phase = 'combat';
        break;
      case 'NORMAL':
      default:
        this.encounter.spawnWave(basicRoster(), centerX, centerY, this.template.spawnRadius, plan.roomSeed);
        this.phase = 'combat';
        break;
    }
  }

  private resetPlayerPosition(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
    this.stoppedSeconds = 0;
    this.attackCooldownTimer = 0;
    this.attacking = false;
    this.moving = false;
    this.firedThisUpdate = false;
  }

  private isCurrentRoomCleared(): boolean {
    if (this.boss) return !this.boss.alive;
    return this.encounter.isRoomCleared();
  }

  private proceedAfterRoomCompletion(): void {
    // Счётчик завершённых комнат и флаг мини-босса — единственная точка,
    // через которую проходит КАЖДАЯ завершённая комната (драфт/восстановление).
    this.roomsCleared += 1;
    if (this.currentPlan.type === 'MINI_BOSS') this.miniBossKilled = true;
    if (this.roomIndex >= this.chapter.length - 1) {
      this.phase = 'complete';
      return;
    }
    this.roomIndex++;
    this.setupCurrentRoom();
  }

  /** Движение + «стоишь = атакуешь» (PlayerController.java). */
  private updatePlayer(dt: number): void {
    this.firedThisUpdate = false;
    const magnitude = Math.sqrt(this.moveDirX * this.moveDirX + this.moveDirY * this.moveDirY);
    this.moving = magnitude > MOVE_INPUT_EPSILON;

    if (this.moving) {
      const nx = this.moveDirX / magnitude;
      const ny = this.moveDirY / magnitude;
      const speed = MOVE_SPEED_PX_PER_SEC * this.loadout.moveSpeedMultiplier;
      this.playerX = clampX(this.bounds, this.playerX + nx * speed * dt);
      this.playerY = clampY(this.bounds, this.playerY + ny * speed * dt);
      this.facingX = nx;
      this.facingY = ny;
      this.stoppedSeconds = 0;
      this.attackCooldownTimer = 0;
      this.attacking = false;
      return;
    }

    this.stoppedSeconds += dt;
    if (this.stoppedSeconds < ATTACK_GRACE_SECONDS) {
      this.attacking = false;
      return;
    }

    this.attacking = true;
    this.attackCooldownTimer -= dt;
    if (this.attackCooldownTimer <= 0) {
      this.firedThisUpdate = true;
      this.attackCooldownTimer = ATTACK_INTERVAL_SECONDS * this.loadout.fireIntervalMultiplier;
    }
  }

  /** Прицел — ближайший живой враг (или босс), иначе направление взгляда. */
  private updateAimDirection(): void {
    const nearest = this.encounter.findNearestAliveEnemy(this.playerX, this.playerY);
    if (nearest) {
      this.aimAt(nearest.x, nearest.y);
      return;
    }
    if (this.boss && this.boss.alive) {
      this.aimAt(this.boss.x, this.boss.y);
      return;
    }
    this.aimDirX = this.facingX;
    this.aimDirY = this.facingY;
  }

  private aimAt(targetX: number, targetY: number): void {
    const dx = targetX - this.playerX;
    const dy = targetY - this.playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.0001) {
      this.aimDirX = dx / dist;
      this.aimDirY = dy / dist;
    }
  }

  private fireWeaponVolley(): void {
    const count = this.loadout.projectileCount;
    const pierce = this.loadout.pierceCount;
    const baseAngle = Math.atan2(this.aimDirY, this.aimDirX);
    const spreadStep = (PROJECTILE_SPREAD_DEGREES * Math.PI) / 180;
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (start + i) * spreadStep;
      this.projectiles.push({
        x: this.playerX,
        y: this.playerY,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        alive: true,
        pierceRemaining: pierce,
      });
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dirX * PLAYER_PROJECTILE_SPEED * dt;
      p.y += p.dirY * PLAYER_PROJECTILE_SPEED * dt;
      if (p.x < this.bounds.minX || p.x > this.bounds.maxX || p.y < this.bounds.minY || p.y > this.bounds.maxY) {
        p.alive = false;
      }
      if (!p.alive) this.projectiles.splice(i, 1);
    }
  }

  private resolveCombat(): void {
    // Снаряды игрока → враги
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      for (const enemy of this.encounter.enemies) {
        if (!enemy.alive) continue;
        if (withinRange(p.x, p.y, enemy.x, enemy.y, PLAYER_PROJECTILE_RADIUS + enemy.definition.radiusPx)) {
          this.applyPlayerHitTo(enemy);
          if (!consumePierceCharge(p)) p.alive = false;
          break;
        }
      }
    }

    // Снаряды игрока → босс
    if (this.boss && this.boss.alive) {
      for (const p of this.projectiles) {
        if (!p.alive) continue;
        if (withinRange(p.x, p.y, this.boss.x, this.boss.y, PLAYER_PROJECTILE_RADIUS + this.boss.definition.radiusPx)) {
          this.applyPlayerHitTo(this.boss);
          if (!consumePierceCharge(p)) p.alive = false;
        }
      }
    }

    // Контактный урон врагов → игрок
    for (const enemy of this.encounter.enemies) {
      if (enemy.alive && enemy.meleeAttackedThisUpdate && this.invulnerabilityTimer <= 0) {
        this.applyPlayerDamage(enemy.definition.stats.contactDamage * this.loadout.damageTakenMultiplier);
      }
    }

    // Снаряды врагов → игрок
    for (const p of this.encounter.projectiles) {
      if (!p.alive) continue;
      if (withinRange(p.x, p.y, this.playerX, this.playerY, ENEMY_PROJECTILE_RADIUS + PLAYER_HIT_RADIUS)) {
        if (this.invulnerabilityTimer <= 0) {
          this.applyPlayerDamage(p.damage * this.loadout.damageTakenMultiplier);
        }
        p.alive = false;
      }
    }

    // Разрешившаяся телеграфированная атака босса → игрок
    if (this.boss && this.boss.attackLandedThisUpdate && this.invulnerabilityTimer <= 0) {
      this.applyPlayerDamage(this.boss.pendingAttackDamage * this.loadout.damageTakenMultiplier);
    }
  }

  private applyPlayerDamage(amount: number): void {
    this.health.applyDamage(amount);
  }

  private applyPlayerHitTo(target: RoomEnemy | BossPhaseController): void {
    let damage = PLAYER_PROJECTILE_BASE_DAMAGE * this.loadout.damageMultiplier;
    if (this.combatRng.next() < this.loadout.critChanceClamped) {
      damage *= this.loadout.critMultiplier;
    }
    target.applyDamage(damage);
    if (this.loadout.burnDps > 0) {
      target.applyBurn(this.loadout.burnDps, this.loadout.burnDuration);
    }
    if (this.loadout.lifesteal > 0) {
      this.health.heal(damage * this.loadout.lifesteal);
    }
  }
}

/** @return true, если снаряд пережил попадание (был заряд пробития). */
function consumePierceCharge(p: ActionProjectile): boolean {
  if (p.pierceRemaining <= 0) return false;
  p.pierceRemaining--;
  return true;
}

function withinRange(ax: number, ay: number, bx: number, by: number, range: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= range * range;
}

/** Подпись типа комнаты для HUD — строки как в RoomScreen.roomTypeLabel. */
export function roomTypeLabel(type: RoomType): string {
  switch (type) {
    case 'NORMAL': return 'Обычная';
    case 'ELITE': return 'Элитная';
    case 'TREASURE': return 'Сокровищница';
    case 'RECOVERY': return 'Восстановление';
    case 'MINI_BOSS': return 'Мини-босс';
    case 'CHAPTER_BOSS': return 'Босс главы';
    default: return type;
  }
}

/** Заголовок драфт-оверлея — строки как в RoomScreen.draftHeaderFor. */
export function draftHeaderFor(type: RoomType): string {
  switch (type) {
    case 'TREASURE': return 'СОКРОВИЩНИЦА';
    case 'MINI_BOSS': return 'МИНИ-БОСС ПОВЕРЖЕН';
    case 'CHAPTER_BOSS': return 'БОСС ГЛАВЫ ПОВЕРЖЕН';
    default: return 'КОМНАТА ЗАЧИЩЕНА';
  }
}
