// Интерфейсы репозиториев (этап 9). Бизнес-логика зависит только от них, а не
// от способа хранения. Текущая реализация — файловая (fileRepositories.ts);
// позже её можно заменить на PostgreSQL без изменения сервисов и игры.
import type { ClaimRecord, DoffaUser, MatchResult, Reward, RunRecord } from '../domain/types';

export interface UserRepository {
  get(id: string): Promise<DoffaUser | undefined>;
  getByWallet(wallet: string): Promise<DoffaUser | undefined>;
  upsert(user: DoffaUser): Promise<DoffaUser>;
  /** Атомарно изменить баланс зёрен (может быть отрицательным — списание). */
  adjustBeans(id: string, delta: number): Promise<DoffaUser | undefined>;
}

export interface MatchRepository {
  get(matchId: string): Promise<MatchResult | undefined>;
  save(match: MatchResult): Promise<MatchResult>;
  listByUser(userId: string, limit?: number): Promise<MatchResult[]>;
}

export interface RewardRepository {
  get(id: string): Promise<Reward | undefined>;
  getByMatch(matchId: string): Promise<Reward | undefined>;
  listAvailable(userId: string): Promise<Reward[]>;
  listByUser(userId: string, limit?: number): Promise<Reward[]>;
  save(reward: Reward): Promise<Reward>;
}

export interface ClaimRepository {
  get(id: string): Promise<ClaimRecord | undefined>;
  getByReward(rewardId: string): Promise<ClaimRecord | undefined>;
  getByIdempotencyKey(key: string): Promise<ClaimRecord | undefined>;
  listByUser(userId: string, limit?: number): Promise<ClaimRecord[]>;
  save(claim: ClaimRecord): Promise<ClaimRecord>;
}

export interface RunRepository {
  get(runId: string): Promise<RunRecord | undefined>;
  save(run: RunRecord): Promise<RunRecord>;
  listByUser(userId: string, limit?: number): Promise<RunRecord[]>;
}

export interface Repositories {
  users: UserRepository;
  matches: MatchRepository;
  rewards: RewardRepository;
  claims: ClaimRepository;
  runs: RunRepository;
}
