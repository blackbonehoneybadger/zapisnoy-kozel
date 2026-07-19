// Экономика забегов DOFFA Defense — деньги/зёрна считаются здесь, поэтому
// покрыта юнит-тестами напрямую (без поднятия WS, как rewardBudgetService.test.ts).
//
// rewardBudgetService замокан частично: computeWinReward/recordBurn в проде
// пишут в server/data/*.json — общие файлы с параллельно бегущим
// rewardBudgetService.test.ts; два писателя из разных воркеров рвут JSON, а на
// Windows ещё и ловят EPERM при rmSync. Мок оставляет ЧЕСТНУЮ математику
// (splitReward/currentGrossRewardPerWin — чистые функции без файлов), но без
// побочек на диске: здесь проверяется проводка сумм и лимитов в runService,
// а сами файлы покрыты в rewardBudgetService.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryRepositories } from '../testUtils/inMemoryRepositories';
import { BeansService } from './beansService';
import { RunService, RUN_REWARD_MATCH_PREFIX } from './runService';
import { RUN_ENTRY_BEANS } from '../config';
import type { DoffaUser } from '../domain/types';
import type { Repositories } from '../repositories/types';

const { recordBurnCalls } = vi.hoisted(() => ({
  recordBurnCalls: [] as Array<{ matchId: string; amount: number }>,
}));

vi.mock('./rewardBudgetService', async (importActual) => {
  const actual = await importActual<typeof import('./rewardBudgetService')>();
  return {
    ...actual,
    // Реальная валовая сумма и 80/20-сплит (BETA_FIXED), но без записи
    // vault-состояния на диск и без общего с дуэлями дневного лимита —
    // забеговый дневной лимит глав проверяется собственным кодом runService.
    computeWinReward: async () => {
      const gross = actual.currentGrossRewardPerWin();
      const { playerAmount, burnAmount } = actual.splitReward(gross);
      return { gross, playerAmount, burnAmount };
    },
    recordBurn: (matchId: string, amount: number) => {
      recordBurnCalls.push({ matchId, amount });
      return { matchId, amount, status: 'planned' as const, createdAt: Date.now() };
    },
  };
});

const NOW = 1_700_000_000_000;

beforeEach(() => {
  recordBurnCalls.length = 0;
});

function makeUser(id: string, beans: number): DoffaUser {
  return {
    id,
    walletAddress: id,
    beansBalance: beans,
    energy: 1000,
    lastEnergyTs: NOW,
    pendingDoffa: 0,
    claimedDoffa: 0,
    createdAt: NOW,
    banned: false,
  };
}

/** Сервисы с управляемыми часами; now можно двигать между вызовами. */
function makeServices(repos: Repositories, beansBalance = 10_000, userId = 'runner') {
  let now = NOW;
  const beans = new BeansService(repos, () => now);
  const runs = new RunService(repos, beans, () => now);
  return {
    runs,
    userId,
    advanceMs: (ms: number) => {
      now += ms;
    },
    seedUser: async () => {
      await repos.users.upsert(makeUser(userId, beansBalance));
    },
  };
}

/** Правдоподобная длительность для N комнат (потолок — 40с/комнату с допуском). */
const plausibleMs = (rooms: number) => rooms * 40_000;

describe('RunService.startRun — плата за вход', () => {
  it('charges the entry fee server-side and creates an unfinished run record', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 150);
    await ctx.seedUser();

    const started = await ctx.runs.startRun(ctx.userId, ctx.userId);
    expect(started).not.toBeNull();
    expect(started!.runId).toMatch(/^run_/);
    expect(started!.beans).toBe(150 - RUN_ENTRY_BEANS); // 50

    const run = await repos.runs.get(started!.runId);
    expect(run).toBeDefined();
    expect(run!.userId).toBe(ctx.userId);
    expect(run!.finished).toBe(false);
    expect(run!.beansEntryFee).toBe(RUN_ENTRY_BEANS);

    const user = await repos.users.get(ctx.userId);
    expect(user!.beansBalance).toBe(50);
  });

  it('refuses to start when beans are insufficient — no charge, no run record', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 50);
    await ctx.seedUser();

    const started = await ctx.runs.startRun(ctx.userId, ctx.userId);
    expect(started).toBeNull();
    expect((await repos.users.get(ctx.userId))!.beansBalance).toBe(50);
    expect((await repos.runs.listByUser(ctx.userId)).length).toBe(0);
  });
});

describe('RunService.finishRun — зёрна за забег', () => {
  it('awards per-room beans plus mini-boss and chapter bonuses with server-side math', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const result = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: started.runId,
      roomsCleared: 6,
      miniBossKilled: true,
      chapterComplete: true,
      durationMs: plausibleMs(6),
      seed: 202607173,
    });
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    // 6×5 (комнаты) + 10 (мини-босс) + 15 (глава) = 55
    expect(result!.beansGranted).toBe(55);
    // 1000 − 100 (вход) + 55
    expect(result!.beans).toBe(955);
    expect((await repos.users.get(ctx.userId))!.beansBalance).toBe(955);
  });

  it('awards only cleared rooms on death (no mini-boss/chapter bonuses)', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const result = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: started.runId,
      roomsCleared: 2,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(2),
    });
    expect(result!.beansGranted).toBe(10);
    expect(result!.doffaGranted).toBe(0);
    expect(result!.rewardStatus).toBe('none');
  });
});

describe('RunService.finishRun — античит-потолки', () => {
  it('rejects an implausibly fast run: no beans, flagged, chapter goes to review instead of paying', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const result = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: started.runId,
      roomsCleared: 6,
      miniBossKilled: true,
      chapterComplete: true,
      durationMs: 30_000, // «прошёл» 6 комнат за 30с — физически невозможно (потолок 40с/комнату)
    });
    expect(result!.ok).toBe(true);
    expect(result!.beansGranted).toBe(0);
    expect(result!.doffaGranted).toBe(0);
    expect(result!.flags).toContain('implausible_duration');
    expect(result!.rewardStatus).toBe('review');

    // Зёрна не начислены (только вход списан), pendingDoffa не тронут.
    expect((await repos.users.get(ctx.userId))!.beansBalance).toBe(900);
    expect((await repos.users.get(ctx.userId))!.pendingDoffa).toBe(0);
    // Запись для модерации — amount 0, статус review, в дневной лимит не считается.
    const review = await repos.rewards.getByMatch(`${RUN_REWARD_MATCH_PREFIX}${started.runId}`);
    expect(review).toBeDefined();
    expect(review!.amount).toBe(0);
    expect(review!.status).toBe('review');
    // recordBurn не вызывался — сжигать нечего, награда не назначена.
    expect(recordBurnCalls.some((c) => c.matchId.startsWith(RUN_REWARD_MATCH_PREFIX))).toBe(false);
  });

  it('rate-limits a second finish within RUN_FINISH_MIN_INTERVAL_MS', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();

    const first = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;
    const firstResult = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: first.runId,
      roomsCleared: 1,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(1),
    });
    expect(firstResult!.beansGranted).toBe(5);

    // Второй забег сразу после (без advanceMs) — rate-limit, награда теряется.
    const second = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;
    const secondResult = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: second.runId,
      roomsCleared: 1,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(1),
    });
    expect(secondResult!.ok).toBe(false);
    expect(secondResult!.reason).toBe('rate_limited');
    expect(secondResult!.beansGranted).toBe(0);
    expect((await repos.users.get(ctx.userId))!.beansBalance).toBe(1000 - 200 + 5);

    // После интервала тот же забег завершить можно (rate-limit не закрывает забег).
    ctx.advanceMs(20_000);
    const retry = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: second.runId,
      roomsCleared: 1,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(1),
    });
    expect(retry!.ok).toBe(true);
    expect(retry!.beansGranted).toBe(5);
  });

  it('is idempotent per runId: a repeated finish returns the stored result without double-granting', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const input = {
      runId: started.runId,
      roomsCleared: 3,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(3),
    };
    const first = await ctx.runs.finishRun(ctx.userId, ctx.userId, input);
    expect(first!.beansGranted).toBe(15);
    const balanceAfterFirst = (await repos.users.get(ctx.userId))!.beansBalance;

    // Дубль сразу после (внутри rate-limit окна) — возвращает сохранённый
    // результат, а не отказ и не повторное начисление.
    const repeat = await ctx.runs.finishRun(ctx.userId, ctx.userId, input);
    expect(repeat!.ok).toBe(true);
    expect(repeat!.beansGranted).toBe(15);
    expect((await repos.users.get(ctx.userId))!.beansBalance).toBe(balanceAfterFirst);
  });

  it('returns null for an unknown or foreign runId', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const ghost = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: 'run_nonexistent',
      roomsCleared: 1,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(1),
    });
    expect(ghost).toBeNull();

    const foreign = await ctx.runs.finishRun('someone-else', 'someone-else', {
      runId: started.runId,
      roomsCleared: 1,
      miniBossKilled: false,
      chapterComplete: false,
      durationMs: plausibleMs(1),
    });
    expect(foreign).toBeNull();
    expect((await repos.runs.get(started.runId))!.finished).toBe(false);
  });
});

describe('RunService.finishRun — DOFFA за главу', () => {
  it('pays the 80/20 split for a chapter completion: pendingDoffa +8, burn 2 recorded, Reward available', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const result = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
      runId: started.runId,
      roomsCleared: 6,
      miniBossKilled: true,
      chapterComplete: true,
      durationMs: plausibleMs(6),
      seed: 202607173,
    });
    // BETA_FIXED: валовая 10 → игроку 8, на сжигание 2.
    expect(result!.doffaGranted).toBe(8);
    expect(result!.rewardStatus).toBe('available');
    expect((await repos.users.get(ctx.userId))!.pendingDoffa).toBe(8);

    const reward = await repos.rewards.getByMatch(`${RUN_REWARD_MATCH_PREFIX}${started.runId}`);
    expect(reward).toBeDefined();
    expect(reward!.amount).toBe(8);
    expect(reward!.status).toBe('available');
    expect(reward!.matchId).toBe(`run:${started.runId}`);

    // Доля сжигания ушла в burn-журнал с привязкой к забегу.
    const mine = recordBurnCalls.filter((c) => c.matchId === `run:${started.runId}`);
    expect(mine.length).toBe(1);
    expect(mine[0].amount).toBe(2);
  });

  it('rewards the 5th chapter of the day but not the 6th (MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY)', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 100_000);
    await ctx.seedUser();

    const finishChapter = async () => {
      const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;
      const result = await ctx.runs.finishRun(ctx.userId, ctx.userId, {
        runId: started.runId,
        roomsCleared: 6,
        miniBossKilled: true,
        chapterComplete: true,
        durationMs: plausibleMs(6),
      });
      ctx.advanceMs(20_000); // больше RUN_FINISH_MIN_INTERVAL_MS между завершениями
      return result!;
    };

    for (let i = 0; i < 5; i++) {
      const r = await finishChapter();
      expect(r.doffaGranted, `глава ${i + 1} должна быть наградной`).toBe(8);
      expect(r.rewardStatus).toBe('available');
    }
    expect((await repos.users.get(ctx.userId))!.pendingDoffa).toBe(40);

    const sixth = await finishChapter();
    expect(sixth.doffaGranted).toBe(0);
    expect(sixth.rewardStatus).toBe('none');
    expect(sixth.beansGranted).toBe(55); // зёрна за главу начисляются и сверх лимита

    // Новых Reward-записей на 6-ю главу нет — осталось ровно 5 наградных.
    const rewards = await repos.rewards.listByUser(ctx.userId, 50);
    expect(rewards.filter((r) => r.amount > 0).length).toBe(5);
    expect((await repos.users.get(ctx.userId))!.pendingDoffa).toBe(40);
    // Сжигание записано ровно для 5 наградных глав.
    expect(recordBurnCalls.filter((c) => c.matchId.startsWith(RUN_REWARD_MATCH_PREFIX)).length).toBe(5);
  });

  it('without a wallet grants beans only — no DOFFA, no reward record', async () => {
    const repos = createInMemoryRepositories();
    const ctx = makeServices(repos, 1000);
    await ctx.seedUser();
    const started = (await ctx.runs.startRun(ctx.userId, ctx.userId))!;

    const result = await ctx.runs.finishRun(ctx.userId, undefined, {
      runId: started.runId,
      roomsCleared: 6,
      miniBossKilled: true,
      chapterComplete: true,
      durationMs: plausibleMs(6),
    });
    expect(result!.beansGranted).toBe(55);
    expect(result!.doffaGranted).toBe(0);
    expect(result!.rewardStatus).toBe('none');
    expect((await repos.rewards.listByUser(ctx.userId, 50)).length).toBe(0);
    expect((await repos.users.get(ctx.userId))!.pendingDoffa).toBe(0);
    expect(recordBurnCalls.some((c) => c.matchId.startsWith(RUN_REWARD_MATCH_PREFIX))).toBe(false);
  });
});
