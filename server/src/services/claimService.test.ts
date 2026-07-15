// Claim — единственный путь превратить доступную награду в выплату.
// Эти тесты бьют именно по требованиям анти-фарм/анти-дабл-спенд из ТЗ:
// повторный Claim невозможен, параллельные заявки на одну награду не
// платят дважды, дневной лимит соблюдается.
import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../testUtils/inMemoryRepositories';
import { ClaimService } from './claimService';
import { MockTransactionProvider, type SendResult, type TransactionProvider } from './transactionProvider';
import type { DoffaUser, Reward } from '../domain/types';

const NOW = 1_700_000_000_000;

function makeUser(id: string): DoffaUser {
  return {
    id,
    walletAddress: id,
    beansBalance: 0,
    energy: 1000,
    lastEnergyTs: NOW,
    pendingDoffa: 8,
    claimedDoffa: 0,
    createdAt: NOW,
    banned: false,
  };
}

function makeReward(id: string, userId: string, amount = 8): Reward {
  return {
    id,
    matchId: `match-${id}`,
    userId,
    walletAddress: userId,
    amount,
    status: 'available',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Провайдер, считающий реальные вызовы отправки — чтобы доказать "не платит дважды". */
class CountingMockProvider implements TransactionProvider {
  readonly kind = 'mock' as const;
  sendCount = 0;
  async canPayout(): Promise<boolean> {
    return true;
  }
  async sendReward(): Promise<SendResult> {
    this.sendCount++;
    return { signature: `MOCK_${this.sendCount}`, onChain: false };
  }
}

describe('ClaimService.claim — happy path', () => {
  it('pays out an available reward exactly once, with a clearly-mock signature', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('alice'));
    await repos.rewards.save(makeReward('rw1', 'alice'));
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);

    const outcome = await service.claim({ userId: 'alice', rewardId: 'rw1', walletAddress: 'alice', idempotencyKey: 'key-1' });
    expect(outcome.ok).toBe(true);
    expect(outcome.status).toBe('sent');
    expect(outcome.claim?.txSignature).toMatch(/^MOCK_/);
    expect(outcome.testMode).toBe(true); // DOFFA_CLAIM_ENABLED=false по умолчанию

    const user = await repos.users.get('alice');
    expect(user?.claimedDoffa).toBe(8);
  });
});

describe('ClaimService.claim — идемпотентность и защита от двойной выплаты', () => {
  it('repeating the SAME idempotencyKey returns the cached claim without paying again', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('bob'));
    await repos.rewards.save(makeReward('rw2', 'bob'));
    const provider = new CountingMockProvider();
    const service = new ClaimService(repos, provider, () => NOW);

    const first = await service.claim({ userId: 'bob', rewardId: 'rw2', walletAddress: 'bob', idempotencyKey: 'same-key' });
    const second = await service.claim({ userId: 'bob', rewardId: 'rw2', walletAddress: 'bob', idempotencyKey: 'same-key' });

    expect(first.claim?.id).toBe(second.claim?.id);
    expect(first.claim?.txSignature).toBe(second.claim?.txSignature);
    expect(provider.sendCount).toBe(1); // ровно один реальный вызов отправки
  });

  it('claiming an already-sent reward again (new idempotency key) returns the existing sent claim without paying twice', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('carol'));
    await repos.rewards.save(makeReward('rw3', 'carol'));
    const provider = new CountingMockProvider();
    const service = new ClaimService(repos, provider, () => NOW);

    await service.claim({ userId: 'carol', rewardId: 'rw3', walletAddress: 'carol', idempotencyKey: 'key-a' });
    const repeat = await service.claim({ userId: 'carol', rewardId: 'rw3', walletAddress: 'carol', idempotencyKey: 'key-b' });

    expect(repeat.ok).toBe(true);
    expect(repeat.status).toBe('sent');
    expect(provider.sendCount).toBe(1);
  });

  it('two concurrent claims for the SAME reward (different idempotency keys) never both pay', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('dave'));
    await repos.rewards.save(makeReward('rw4', 'dave'));
    const provider = new CountingMockProvider();
    const service = new ClaimService(repos, provider, () => NOW);

    const [a, b] = await Promise.all([
      service.claim({ userId: 'dave', rewardId: 'rw4', walletAddress: 'dave', idempotencyKey: 'race-1' }),
      service.claim({ userId: 'dave', rewardId: 'rw4', walletAddress: 'dave', idempotencyKey: 'race-2' }),
    ]);

    // Ровно ОДИН реальный вызов отправки — второй параллельный запрос либо
    // получил "processing" от in-process лока, либо (после первого
    // завершился) увидел уже занятую награду (getByReward) и не заплатил.
    expect(provider.sendCount).toBe(1);
    const results = [a, b];
    const sentCount = results.filter((r) => r.status === 'sent').length;
    expect(sentCount).toBe(1);
  });
});

describe('ClaimService.claim — проверки владения и статуса', () => {
  it('rejects a claim for a reward that belongs to a different user', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('eve'));
    await repos.rewards.save(makeReward('rw5', 'eve'));
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);

    const outcome = await service.claim({ userId: 'mallory', rewardId: 'rw5', walletAddress: 'eve', idempotencyKey: 'x' });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('failed');
  });

  it('rejects a claim when the wallet address does not match the reward', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('frank'));
    await repos.rewards.save(makeReward('rw6', 'frank'));
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);

    const outcome = await service.claim({ userId: 'frank', rewardId: 'rw6', walletAddress: 'someone-elses-wallet', idempotencyKey: 'x' });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('failed');
  });

  it('rejects a claim for a reward that does not exist', async () => {
    const repos = createInMemoryRepositories();
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);
    const outcome = await service.claim({ userId: 'ghost', rewardId: 'nope', walletAddress: 'ghost', idempotencyKey: 'x' });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('failed');
  });

  it('rejects a claim for a banned account', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert({ ...makeUser('banned-user'), banned: true });
    await repos.rewards.save(makeReward('rw7', 'banned-user'));
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);

    const outcome = await service.claim({ userId: 'banned-user', rewardId: 'rw7', walletAddress: 'banned-user', idempotencyKey: 'x' });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('review');
  });
});

describe('ClaimService.claim — дневной лимит DOFFA (DOFFA_DAILY_REWARD_LIMIT)', () => {
  it('is unlimited by default (0 = no limit)', async () => {
    const repos = createInMemoryRepositories();
    await repos.users.upsert(makeUser('greta'));
    await repos.rewards.save(makeReward('rw8', 'greta', 1000));
    const service = new ClaimService(repos, new MockTransactionProvider(), () => NOW);
    const outcome = await service.claim({ userId: 'greta', rewardId: 'rw8', walletAddress: 'greta', idempotencyKey: 'x' });
    expect(outcome.ok).toBe(true);
  });

  // Сценарий "лимит превышен" — см. claimService.dailyLimit.test.ts: он
  // требует другого значения DOFFA_DAILY_REWARD_LIMIT ДО первой загрузки
  // config.ts, а этот файл уже статически импортировал config через
  // ClaimService/MockTransactionProvider выше — модульный кэш ESM не даст
  // честно перечитать переменную окружения в рамках одного файла.
});
