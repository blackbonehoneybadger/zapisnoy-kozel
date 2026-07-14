import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BeansService, ENERGY_MAX } from './beansService.js';
import type { ClaimRecord, DoffaUser, MatchResult, Reward } from '../domain/types.js';
import type { Repositories } from '../repositories/types.js';

function memoryRepos(): Repositories {
  const users = new Map<string, DoffaUser>();
  const matches = new Map<string, MatchResult>();
  const rewards = new Map<string, Reward>();
  const claims = new Map<string, ClaimRecord>();
  return {
    users: {
      async get(id) {
        return users.get(id);
      },
      async getByWallet(wallet) {
        return [...users.values()].find((u) => u.walletAddress === wallet);
      },
      async upsert(user) {
        users.set(user.id, { ...user });
        return users.get(user.id)!;
      },
      async adjustCups(id, delta) {
        const u = users.get(id);
        if (!u) return undefined;
        u.cupsBalance = Math.max(0, u.cupsBalance + delta);
        users.set(id, u);
        return { ...u };
      },
    },
    matches: {
      async get(id) {
        return matches.get(id);
      },
      async save(m) {
        matches.set(m.matchId, m);
        return m;
      },
      async listByUser() {
        return [];
      },
    },
    rewards: {
      async get(id) {
        return rewards.get(id);
      },
      async getByMatch(matchId) {
        return [...rewards.values()].find((r) => r.matchId === matchId);
      },
      async listAvailable(userId) {
        return [...rewards.values()].filter((r) => r.userId === userId && r.status === 'available');
      },
      async listByUser(userId) {
        return [...rewards.values()].filter((r) => r.userId === userId);
      },
      async save(r) {
        rewards.set(r.id, r);
        return r;
      },
    },
    claims: {
      async get(id) {
        return claims.get(id);
      },
      async getByReward(rewardId) {
        return [...claims.values()].find((c) => c.rewardId === rewardId);
      },
      async getByIdempotencyKey(key) {
        return [...claims.values()].find((c) => c.idempotencyKey === key);
      },
      async listByUser(userId) {
        return [...claims.values()].filter((c) => c.userId === userId);
      },
      async save(c) {
        claims.set(c.id, c);
        return c;
      },
    },
  };
}

describe('BeansService', () => {
  it('tap grants beans and spends energy', async () => {
    let now = 1_000_000;
    const beans = new BeansService(memoryRepos(), () => now);
    const r = await beans.tap('wallet1', 3);
    assert.equal(r.ok, true);
    assert.ok(r.gained >= 3);
    assert.equal(r.energy, ENERGY_MAX - 3);
    assert.equal(r.totalTaps, 3);
    const bal = await beans.balance('wallet1');
    assert.equal(bal.beans, r.beans);
  });

  it('spendEntry fails without enough beans', async () => {
    const beans = new BeansService(memoryRepos());
    const spend = await beans.spendEntry('poor');
    assert.equal(spend.ok, false);
    assert.equal(spend.beans, 0);
  });

  it('spendEntry deducts cupsEntryFee', async () => {
    const repos = memoryRepos();
    await repos.users.upsert({
      id: 'rich',
      walletAddress: 'rich',
      cupsBalance: 250,
      pendingDoffa: 0,
      claimedDoffa: 0,
      energy: ENERGY_MAX,
      lastEnergyTs: Date.now(),
      totalTaps: 0,
      createdAt: Date.now(),
      banned: false,
    });
    const beans = new BeansService(repos);
    const spend = await beans.spendEntry('rich', 100);
    assert.equal(spend.ok, true);
    assert.equal(spend.beans, 150);
  });
});
