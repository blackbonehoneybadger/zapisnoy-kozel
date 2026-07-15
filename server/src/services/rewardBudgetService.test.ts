// Расчёт награды и разделение 80/20 — деньги считаются здесь, поэтому
// покрыты юнит-тестами напрямую (без поднятия сервера/WS, см. также
// server/src/duel.ts, где эти функции вызываются по факту победы).
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../testUtils/inMemoryRepositories';
import type { Reward } from '../domain/types';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, '..', '..', 'data');
const VAULT_STATE_PATH = resolve(DATA_DIR, 'reward_vault_state.json');
const BURN_LEDGER_PATH = resolve(DATA_DIR, 'burn_ledger.json');

function resetLedgerFiles(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(VAULT_STATE_PATH, JSON.stringify({ totalGrossDistributed: 0 }));
  writeFileSync(BURN_LEDGER_PATH, '[]');
}

beforeEach(() => {
  resetLedgerFiles();
});
afterEach(() => {
  for (const p of [VAULT_STATE_PATH, BURN_LEDGER_PATH]) {
    if (existsSync(p)) rmSync(p);
  }
});

describe('splitReward (80/20 by default)', () => {
  it('splits the gross reward using PLAYER_REWARD_PERCENT/BURN_PERCENT, no rounding loss', async () => {
    const { splitReward } = await import('./rewardBudgetService');
    const { playerAmount, burnAmount } = splitReward(10);
    expect(playerAmount).toBe(8); // floor(10 * 80/100)
    expect(burnAmount).toBe(2);
    expect(playerAmount + burnAmount).toBe(10); // always reconstitutes the gross, regardless of rounding
  });

  it('reconstitutes the gross amount exactly even for values that do not divide evenly', async () => {
    const { splitReward } = await import('./rewardBudgetService');
    for (const gross of [1, 3, 7, 11, 13, 17, 99]) {
      const { playerAmount, burnAmount } = splitReward(gross);
      expect(playerAmount + burnAmount).toBe(gross);
    }
  });

  it('splitReward(0) yields no reward and no burn', async () => {
    const { splitReward } = await import('./rewardBudgetService');
    expect(splitReward(0)).toEqual({ playerAmount: 0, burnAmount: 0 });
  });
});

describe('currentGrossRewardPerWin (BETA_FIXED)', () => {
  it('returns the configured BETA_GROSS_REWARD_PER_WIN by default', async () => {
    const { currentGrossRewardPerWin } = await import('./rewardBudgetService');
    expect(currentGrossRewardPerWin()).toBe(10);
  });
});

describe('computeWinReward — daily rewarded-win limit (anti-farm)', () => {
  it('grants the split reward for a fresh player with no prior wins today', async () => {
    const { computeWinReward } = await import('./rewardBudgetService');
    const repos = createInMemoryRepositories();
    const result = await computeWinReward('player-a', repos);
    expect(result.gross).toBe(10);
    expect(result.playerAmount).toBe(8);
    expect(result.burnAmount).toBe(2);
    expect(result.reason).toBeUndefined();
  });

  it('stops granting rewards once MAX_REWARDED_WINS_PER_USER_PER_DAY (default 5) is reached', async () => {
    const { computeWinReward } = await import('./rewardBudgetService');
    const repos = createInMemoryRepositories();
    const userId = 'grinder';
    const now = Date.now();
    // Заранее насытим 5 наградных побед за сегодня — ровно на лимите.
    for (let i = 0; i < 5; i++) {
      const reward: Reward = {
        id: `rw_${i}`,
        matchId: `m_${i}`,
        userId,
        walletAddress: userId,
        amount: 8,
        status: 'available',
        createdAt: now,
        updatedAt: now,
      };
      await repos.rewards.save(reward);
    }
    const sixthWin = await computeWinReward(userId, repos);
    expect(sixthWin.gross).toBe(0);
    expect(sixthWin.playerAmount).toBe(0);
    expect(sixthWin.reason).toBe('daily_limit');
  });

  it('does not count rewards older than 24h against the daily limit', async () => {
    const { computeWinReward } = await import('./rewardBudgetService');
    const repos = createInMemoryRepositories();
    const userId = 'stale-wins';
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 5; i++) {
      await repos.rewards.save({
        id: `old_${i}`,
        matchId: `m_${i}`,
        userId,
        walletAddress: userId,
        amount: 8,
        status: 'available',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      });
    }
    const result = await computeWinReward(userId, repos);
    expect(result.gross).toBeGreaterThan(0); // старые победы не считаются — лимит не исчерпан
  });

  it('a zero-amount reward record (a suspicious/unrewarded win) does not count toward the daily limit', async () => {
    const { computeWinReward } = await import('./rewardBudgetService');
    const repos = createInMemoryRepositories();
    const userId = 'mixed';
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await repos.rewards.save({
        id: `zero_${i}`,
        matchId: `m_${i}`,
        userId,
        walletAddress: userId,
        amount: 0, // не наградная запись
        status: 'none',
        createdAt: now,
        updatedAt: now,
      });
    }
    const result = await computeWinReward(userId, repos);
    expect(result.gross).toBeGreaterThan(0);
  });
});

describe('recordBurn — honest burn ledger (never fabricates a transaction)', () => {
  it('records status "planned" and no txSignature while DOFFA_BURN_ENABLED is off (default)', async () => {
    const { recordBurn } = await import('./rewardBudgetService');
    const entry = recordBurn('match-1', 2);
    expect(entry.status).toBe('planned');
    expect(entry.txSignature).toBeUndefined();
    expect(entry.amount).toBe(2);
    expect(entry.matchId).toBe('match-1');
  });

  it('never sets status "burned" — that status is reserved for a real, unimplemented send path', async () => {
    const { recordBurn } = await import('./rewardBudgetService');
    for (let i = 0; i < 10; i++) {
      const entry = recordBurn(`match-${i}`, 1);
      expect(entry.status).not.toBe('burned');
    }
  });
});
