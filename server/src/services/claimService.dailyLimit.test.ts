// Отдельный файл специально ради изоляции модульного кэша: DOFFA_DAILY_
// REWARD_LIMIT читается config.ts один раз при первом импорте, поэтому
// переменная окружения должна быть выставлена ДО первой загрузки — здесь
// нет ни одного статического импорта claimService/config, только
// динамические, вызванные после process.env.DOFFA_DAILY_REWARD_LIMIT.
import { describe, expect, it } from 'vitest';

describe('ClaimService.claim — дневной лимит DOFFA (DOFFA_DAILY_REWARD_LIMIT, изолированно)', () => {
  it('routes a claim exceeding the configured daily limit to "review" instead of paying', async () => {
    process.env.DOFFA_DAILY_REWARD_LIMIT = '10';

    const { createInMemoryRepositories } = await import('../testUtils/inMemoryRepositories');
    const { ClaimService } = await import('./claimService');
    const { MockTransactionProvider } = await import('./transactionProvider');

    const NOW = 1_700_000_000_000;
    const repos = createInMemoryRepositories();
    await repos.users.upsert({
      id: 'henry',
      walletAddress: 'henry',
      beansBalance: 0,
      energy: 1000,
      lastEnergyTs: NOW,
      pendingDoffa: 5,
      claimedDoffa: 9,
      createdAt: NOW,
      banned: false,
    });
    await repos.claims.save({
      id: 'earlier-claim',
      rewardId: 'earlier-reward',
      userId: 'henry',
      walletAddress: 'henry',
      amount: 9, // уже почти выбрал лимит 10 сегодня
      idempotencyKey: 'earlier',
      status: 'sent',
      createdAt: NOW,
      updatedAt: NOW,
    });
    await repos.rewards.save({
      id: 'rw9',
      matchId: 'match-rw9',
      userId: 'henry',
      walletAddress: 'henry',
      amount: 5, // 9 + 5 = 14 > 10
      status: 'available',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);
    const outcome = await service.claim({ userId: 'henry', rewardId: 'rw9', walletAddress: 'henry', idempotencyKey: 'over-limit' });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('review');

    delete process.env.DOFFA_DAILY_REWARD_LIMIT;
  });
});
