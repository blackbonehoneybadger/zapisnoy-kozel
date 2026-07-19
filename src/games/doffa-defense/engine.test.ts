// Тесты чистого движка DOFFA Defense — зеркало духа Java-тестов из
// doffa-defense (RoomGenerator/RoomEnemy/BossPhaseController/AbilityDraft):
// детерминизм по сиду, баланс-гарды генератора главы на ≥100 сидах,
// регрессия R-Stage5 (KEEP_DISTANCE сближается из-за пределов дальности),
// уклонение от телеграфированной атаки босса, драфт 3 разных карт,
// поджог обновляется (не складывается), пробитие тратит заряды.
import { describe, expect, it } from 'vitest';
import {
  ABILITY_CATALOG,
  ATTACK_GRACE_SECONDS,
  DefenseRun,
  EncounterDirector,
  FIXED_TIMESTEP,
  PLAYER_MAX_HP,
  RoomEnemy,
  ENEMY_CHEMICAL_RUNNER,
  ENEMY_TOXIC_THROWER,
  BossPhaseController,
  PlayerHealth,
  PlayerLoadout,
  basicRoster,
  chemicalBrewerBoss,
  generateChapter,
  makeRng,
  miniBossToxicOverseer,
  rollDraft,
  type RoomBounds,
} from './engine';

const BOUNDS: RoomBounds = { minX: 0, minY: 0, maxX: 2400, maxY: 1400 };

describe('генератор главы', () => {
  it('один сид — одна и та же глава (типы, шаблоны, сиды комнат)', () => {
    const a = generateChapter(42, 6);
    const b = generateChapter(42, 6);
    expect(a).toEqual(b);
    const c = generateChapter(43, 6);
    expect(c).not.toEqual(a);
  });

  it('первая комната NORMAL, середина MINI_BOSS, последняя CHAPTER_BOSS — на 200 сидах', () => {
    for (let seed = 0; seed < 200; seed++) {
      const chapter = generateChapter(seed, 6);
      expect(chapter[0].type).toBe('NORMAL');
      expect(chapter[3].type).toBe('MINI_BOSS');
      expect(chapter[5].type).toBe('CHAPTER_BOSS');
    }
  });

  it('баланс-гард: комната с индексом 1 никогда не ELITE — на 200 сидах', () => {
    for (let seed = 0; seed < 200; seed++) {
      const chapter = generateChapter(seed, 6);
      expect(chapter[1].type).not.toBe('ELITE');
    }
  });

  it('баланс-гард: RECOVERY гарантированно строго до мини-босса — на 200 сидах', () => {
    for (let seed = 0; seed < 200; seed++) {
      const chapter = generateChapter(seed, 6);
      const miniBossIndex = Math.floor(chapter.length / 2);
      const hasRecovery = chapter.slice(1, miniBossIndex).some((r) => r.type === 'RECOVERY');
      expect(hasRecovery, `seed ${seed}`).toBe(true);
    }
  });

  it('две небоевые комнаты (TREASURE/RECOVERY) не идут подряд — на 200 сидах', () => {
    const nonCombat = new Set(['TREASURE', 'RECOVERY']);
    for (let seed = 0; seed < 200; seed++) {
      const chapter = generateChapter(seed, 6);
      for (let i = 1; i < chapter.length; i++) {
        const both = nonCombat.has(chapter[i - 1].type) && nonCombat.has(chapter[i].type);
        expect(both, `seed ${seed}, rooms ${i - 1}/${i}`).toBe(false);
      }
    }
  });
});

describe('RoomEnemy / KEEP_DISTANCE', () => {
  it('регрессия R-Stage5: дальнобойный враг сближается, когда дальше дальности атаки', () => {
    // Метатель: дальность 420. Ставим его за 800px от игрока — он должен идти к игроку.
    const thrower = new RoomEnemy(ENEMY_TOXIC_THROWER, 1000, 700);
    const startDist = Math.abs(1000 - 200);
    for (let i = 0; i < 60; i++) {
      thrower.update(FIXED_TIMESTEP, 200, 700, BOUNDS);
    }
    const endDist = Math.abs(thrower.x - 200);
    expect(endDist).toBeLessThan(startDist);
  });

  it('дальнобойный враг стреляет, только когда игрок в дальности', () => {
    const thrower = new RoomEnemy(ENEMY_TOXIC_THROWER, 500, 700); // 300px < 420
    thrower.update(FIXED_TIMESTEP, 200, 700, BOUNDS);
    expect(thrower.firedProjectileThisUpdate).toBe(true);
  });

  it('ближний боец CHASE наносит контактный урон только в радиусе касания', () => {
    const runner = new RoomEnemy(ENEMY_CHEMICAL_RUNNER, 220, 700); // 20px < 26
    runner.update(FIXED_TIMESTEP, 200, 700, BOUNDS);
    expect(runner.meleeAttackedThisUpdate).toBe(true);
  });

  it('поджог обновляется к более сильному, а не складывается', () => {
    const brewer = new RoomEnemy(basicRoster()[2], 500, 500);
    brewer.applyBurn(6, 2.5);
    brewer.applyBurn(4, 1.5); // слабее — не должно ни сложиться, ни понизить
    const hpBefore = brewer.currentHp;
    brewer.update(1, 5000, 5000, BOUNDS); // 1 секунда горения
    expect(hpBefore - brewer.currentHp).toBeCloseTo(6, 3); // dps = 6, не 10
  });
});

describe('телеграфированные атаки босса', () => {
  it('атака попадает, если игрок в радиусе, и мажет, если игрок вышел (уклонение — полноправный исход)', () => {
    const def = miniBossToxicOverseer(); // slam: телеграф 0.8с, радиус 150
    const boss = new BossPhaseController(def, 1200, 700);
    // Игрок рядом (100px) — босс начинает телеграф.
    boss.update(FIXED_TIMESTEP, 1100, 700, BOUNDS);
    expect(boss.isTelegraphing).toBe(true);

    // Сценарий А: игрок стоит — досчитываем телеграф, атака попадает.
    const bossA = new BossPhaseController(def, 1200, 700);
    let landed = false;
    for (let t = 0; t < 1.0; t += FIXED_TIMESTEP) {
      bossA.update(FIXED_TIMESTEP, 1100, 700, BOUNDS);
      if (bossA.attackLandedThisUpdate) landed = true;
    }
    expect(landed).toBe(true);

    // Сценарий B: игрок отбежал за пределы радиуса к разрешению — промах.
    const bossB = new BossPhaseController(def, 1200, 700);
    landed = false;
    for (let t = 0; t < 1.0; t += FIXED_TIMESTEP) {
      bossB.update(FIXED_TIMESTEP, 2000, 700, BOUNDS); // 800px > 150
      if (bossB.attackLandedThisUpdate) landed = true;
    }
    expect(landed).toBe(false);
  });

  it('босс главы переходит во вторую фазу при падении HP до 50%', () => {
    const boss = new BossPhaseController(chemicalBrewerBoss(), 1200, 700);
    expect(boss.currentPhaseIndex).toBe(0);
    boss.applyDamage(226); // 450 - 226 = 224 < 225 (50%)
    boss.update(FIXED_TIMESTEP, 2000, 700, BOUNDS);
    expect(boss.currentPhaseIndex).toBe(1);
    expect(boss.phaseJustChanged).toBe(true);
  });
});

describe('драфт способностей', () => {
  it('предлагает 3 разные карты из каталога 26', () => {
    expect(ABILITY_CATALOG).toHaveLength(26);
    const rng = makeRng(123);
    const draft = rollDraft(rng);
    expect(draft).toHaveLength(3);
    expect(new Set(draft.map((a) => a.id)).size).toBe(3);
  });

  it('драфт детерминирован по сиду', () => {
    expect(rollDraft(makeRng(7)).map((a) => a.id)).toEqual(rollDraft(makeRng(7)).map((a) => a.id));
  });
});

describe('полный забег (DefenseRun)', () => {
  /** Гоняет забег, мгновенно зачищая комнаты и выбирая первую карту драфта. */
  function playRunToEnd(run: DefenseRun): string[] {
    const log: string[] = [];
    let guard = 0;
    while (run.phase !== 'dead' && run.phase !== 'complete' && guard++ < 100) {
      if (run.phase === 'combat') {
        for (const e of run.encounter.enemies) e.applyDamage(1e9);
        if (run.boss) run.boss.applyDamage(1e9);
        run.tick(FIXED_TIMESTEP);
      } else if (run.phase === 'draft') {
        log.push(run.draftOptions[0].id);
        run.pickDraft(0);
      } else if (run.phase === 'recovery') {
        run.confirmRecovery();
      }
    }
    return log;
  }

  it('один сид — одинаковая глава и одинаковые драфты (сквозной детерминизм)', () => {
    const a = new DefenseRun({ runSeed: 99 });
    const b = new DefenseRun({ runSeed: 99 });
    expect(a.chapter).toEqual(b.chapter);
    const draftsA = playRunToEnd(a);
    const draftsB = playRunToEnd(b);
    expect(a.phase).toBe('complete');
    expect(b.phase).toBe('complete');
    expect(draftsA).toEqual(draftsB);
    expect(draftsA.length).toBeGreaterThan(0);
  });

  it('спавн комнаты детерминирован сидом комнаты', () => {
    const dirA = new EncounterDirector(BOUNDS);
    const dirB = new EncounterDirector(BOUNDS);
    dirA.spawnWave(basicRoster(), 1200, 700, 520, 555);
    dirB.spawnWave(basicRoster(), 1200, 700, 520, 555);
    expect(dirA.enemies.map((e) => [e.x, e.y])).toEqual(dirB.enemies.map((e) => [e.x, e.y]));
  });

  it('стоя на месте, игрок начинает авто-атаку после грейс-периода', () => {
    const run = new DefenseRun({ runSeed: 5 });
    run.setMoveInput(0, 0);
    // Прокручиваем грейс + интервал атаки.
    for (let t = 0; t < ATTACK_GRACE_SECONDS + 0.4; t += FIXED_TIMESTEP) {
      run.tick(FIXED_TIMESTEP);
    }
    expect(run.attacking).toBe(true);
    expect(run.projectiles.length).toBeGreaterThan(0);
  });

  it('снаряд с пробитием тратит заряды и пробивает первого врага', () => {
    const run = new DefenseRun({ runSeed: 5 });
    run.loadout.addPierceCount(1);
    // Выстраиваем двух врагов на одной линии выстрела вправо.
    const enemies = run.encounter.enemies;
    enemies[0].x = run.playerX + 100;
    enemies[0].y = run.playerY;
    enemies[1].x = run.playerX + 200;
    enemies[1].y = run.playerY;
    enemies[2].x = -10000;
    enemies[3].x = -10000;
    run.setMoveInput(0, 0);
    const hp0 = enemies[0].currentHp;
    const hp1 = enemies[1].currentHp;
    for (let t = 0; t < 1.0; t += FIXED_TIMESTEP) {
      run.tick(FIXED_TIMESTEP);
    }
    // Первый враг получил урон и снаряд прошёл сквозь него во второго.
    expect(enemies[0].currentHp).toBeLessThan(hp0);
    expect(enemies[1].currentHp).toBeLessThan(hp1);
  });

  it('смерть игрока переводит забег в фазу dead', () => {
    const run = new DefenseRun({ runSeed: 5 });
    run.health.applyDamage(PLAYER_MAX_HP * 2);
    run.tick(FIXED_TIMESTEP);
    expect(run.phase).toBe('dead');
  });

  it('карта +max HP лечит на ту же величину; похищение жизни лечит от нанесённого урона', () => {
    const health = new PlayerHealth(100);
    const loadout = new PlayerLoadout();
    health.applyDamage(40);
    const mug = ABILITY_CATALOG.find((a) => a.id === 'defense_big_mug')!;
    mug.apply(loadout, health);
    expect(health.maxHp).toBe(120);
    expect(health.currentHp).toBe(80);

    loadout.addLifestealFraction(0.05);
    expect(loadout.lifesteal).toBeCloseTo(0.05, 6);
  });
});
