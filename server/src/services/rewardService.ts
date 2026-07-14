// Сервис наград (этап 3): авторитетно фиксирует результат матча и создаёт
// награду DOFFA за подтверждённую сервером победу. Клиент НЕ участвует в
// расчёте суммы — сервер сам знает победителя и размер награды.
import { randomBytes } from 'node:crypto';
import type { MatchResult, Reward, RewardHistoryItem } from '../domain/types';
import type { Repositories } from '../repositories/types';
import { DOFFA_REWARD_PER_WIN } from '../config';

function id(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

export class RewardService {
  constructor(private readonly repos: Repositories, private readonly now: () => number = Date.now) {}

  /** Гарантирует существование аккаунта и (опц.) привязку кошелька. */
  async ensureUser(userId: string, wallet?: string) {
    let user = await this.repos.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        walletAddress: wallet,
        cupsBalance: 0,
        pendingDoffa: 0,
        claimedDoffa: 0,
        energy: 1000,
        lastEnergyTs: this.now(),
        totalTaps: 0,
        createdAt: this.now(),
        banned: false,
      };
      await this.repos.users.upsert(user);
    } else if (wallet && user.walletAddress !== wallet) {
      user.walletAddress = wallet;
      await this.repos.users.upsert(user);
    }
    return user;
  }

  /**
   * Фиксирует результат онлайн-матча. Если победитель — человек с кошельком и
   * назначена награда, создаёт Reward в статусе "available" и увеличивает
   * pendingDoffa. Идемпотентно по matchId (повторный вызов не дублирует награду).
   */
  async recordMatchResult(input: {
    matchId: string;
    players: string[];
    winnerId: string | null;
    winnerWallet: string;
    startedAt: number;
    finishedAt: number;
    cupsEntryFee: number;
    doffaReward?: number;
    flags?: string[];
  }): Promise<{ match: MatchResult; reward?: Reward }> {
    const existing = await this.repos.matches.get(input.matchId);
    if (existing) {
      const reward = await this.repos.rewards.getByMatch(input.matchId);
      return { match: existing, reward };
    }

    const suspicious = (input.flags?.length ?? 0) > 0;
    const reward = input.winnerWallet && !suspicious ? (input.doffaReward ?? DOFFA_REWARD_PER_WIN) : 0;

    const match: MatchResult = {
      matchId: input.matchId,
      players: input.players,
      winnerWallet: input.winnerWallet,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      cupsEntryFee: input.cupsEntryFee,
      doffaReward: reward,
      rewardStatus: reward > 0 ? 'available' : suspicious ? 'review' : 'none',
      flags: input.flags,
    };
    await this.repos.matches.save(match);

    if (reward > 0 && input.winnerId) {
      const rec: Reward = {
        id: id('rw'),
        matchId: match.matchId,
        userId: input.winnerId,
        walletAddress: input.winnerWallet,
        amount: reward,
        status: 'available',
        createdAt: this.now(),
        updatedAt: this.now(),
      };
      await this.repos.rewards.save(rec);
      const user = await this.ensureUser(input.winnerId, input.winnerWallet);
      user.pendingDoffa += reward;
      await this.repos.users.upsert(user);
      return { match, reward: rec };
    }
    return { match };
  }

  async listAvailable(userId: string): Promise<Reward[]> {
    return this.repos.rewards.listAvailable(userId);
  }

  /** История наград для профиля (награды + заявки). */
  async history(userId: string, limit = 50): Promise<RewardHistoryItem[]> {
    const [rewards, claims] = await Promise.all([
      this.repos.rewards.listByUser(userId, limit),
      this.repos.claims.listByUser(userId, limit),
    ]);
    const items: RewardHistoryItem[] = [
      ...rewards.map((r) => ({
        id: r.id,
        date: r.createdAt,
        kind: 'doffa' as const,
        amount: r.amount,
        note: 'Награда за онлайн-победу',
      })),
      ...claims.map((c) => ({
        id: c.id,
        date: c.createdAt,
        kind: 'claim' as const,
        amount: c.amount,
        note: `Заявка на вывод · ${c.walletAddress.slice(0, 4)}…${c.walletAddress.slice(-4)}`,
        txSignature: c.txSignature,
      })),
    ];
    return items.sort((a, b) => b.date - a.date).slice(0, limit);
  }
}
