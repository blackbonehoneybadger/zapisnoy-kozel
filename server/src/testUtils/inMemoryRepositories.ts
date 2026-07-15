// Лёгкая in-memory реализация Repositories для юнит-тестов сервисов —
// без файловой системы, быстро и изолированно между тестами.
import type { ClaimRecord, DoffaUser, MatchResult, Reward } from '../domain/types';
import type { Repositories } from '../repositories/types';

export function createInMemoryRepositories(): Repositories {
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
        users.set(user.id, user);
        return user;
      },
      async adjustBeans(id, delta) {
        const u = users.get(id);
        if (!u) return undefined;
        u.beansBalance += delta;
        return u;
      },
    },
    matches: {
      async get(matchId) {
        return matches.get(matchId);
      },
      async save(match) {
        matches.set(match.matchId, match);
        return match;
      },
      async listByUser(userId, limit = 50) {
        return [...matches.values()].filter((m) => m.players.includes(userId)).slice(0, limit);
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
      async listByUser(userId, limit = 50) {
        return [...rewards.values()]
          .filter((r) => r.userId === userId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
      },
      async save(reward) {
        rewards.set(reward.id, reward);
        return reward;
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
      async listByUser(userId, limit = 50) {
        return [...claims.values()].filter((c) => c.userId === userId).slice(0, limit);
      },
      async save(claim) {
        claims.set(claim.id, claim);
        return claim;
      },
    },
  };
}
