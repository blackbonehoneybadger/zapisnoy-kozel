/**
 * PostgreSQL repositories (Neon / any Postgres via DATABASE_URL).
 * Falls back is handled by createRepositories() — this module assumes a URL.
 */
import { neon } from '@neondatabase/serverless';
import type { ClaimRecord, DoffaUser, MatchResult, Reward, RewardStatus } from '../domain/types';
import type {
  ClaimRepository,
  MatchRepository,
  Repositories,
  RewardRepository,
  UserRepository,
} from './types';

/** Neon tagged-template SQL (generics of neon() are awkward for class fields). */
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

function mapUser(r: Record<string, unknown>): DoffaUser {
  return {
    id: String(r.id),
    telegramId: r.telegram_id ? String(r.telegram_id) : undefined,
    walletAddress: r.wallet_address ? String(r.wallet_address) : undefined,
    cupsBalance: Number(r.cups_balance) || 0,
    pendingDoffa: Number(r.pending_doffa) || 0,
    claimedDoffa: Number(r.claimed_doffa) || 0,
    energy: Number(r.energy ?? 1000),
    lastEnergyTs: Number(r.last_energy_ts ?? 0),
    totalTaps: Number(r.total_taps ?? 0),
    createdAt: Number(r.created_at) || Date.now(),
    banned: Boolean(r.banned),
  };
}

function mapMatch(r: Record<string, unknown>): MatchResult {
  return {
    matchId: String(r.match_id),
    players: (r.players as string[]) ?? [],
    winnerWallet: String(r.winner_wallet ?? ''),
    startedAt: Number(r.started_at),
    finishedAt: Number(r.finished_at),
    cupsEntryFee: Number(r.cups_entry_fee) || 0,
    doffaReward: Number(r.doffa_reward) || 0,
    rewardStatus: String(r.reward_status) as RewardStatus,
    flags: (r.flags as string[] | null) ?? undefined,
  };
}

function mapReward(r: Record<string, unknown>): Reward {
  return {
    id: String(r.id),
    matchId: String(r.match_id),
    userId: String(r.user_id),
    walletAddress: String(r.wallet_address),
    amount: Number(r.amount),
    status: String(r.status) as RewardStatus,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function mapClaim(r: Record<string, unknown>): ClaimRecord {
  return {
    id: String(r.id),
    rewardId: String(r.reward_id),
    userId: String(r.user_id),
    walletAddress: String(r.wallet_address),
    amount: Number(r.amount),
    idempotencyKey: String(r.idempotency_key),
    status: String(r.status) as RewardStatus,
    txSignature: r.tx_signature ? String(r.tx_signature) : undefined,
    reason: r.reason ? String(r.reason) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

class PgUserRepository implements UserRepository {
  constructor(private readonly sql: Sql) {}

  async get(id: string) {
    const rows = (await this.sql`SELECT * FROM doffa_users WHERE id = ${id} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getByWallet(wallet: string) {
    const rows = (await this
      .sql`SELECT * FROM doffa_users WHERE wallet_address = ${wallet} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async upsert(user: DoffaUser) {
    const now = Date.now();
    await this.sql`
      INSERT INTO doffa_users (
        id, telegram_id, wallet_address, cups_balance, pending_doffa, claimed_doffa,
        energy, last_energy_ts, total_taps, banned, created_at, updated_at
      ) VALUES (
        ${user.id}, ${user.telegramId ?? null}, ${user.walletAddress ?? null},
        ${user.cupsBalance}, ${user.pendingDoffa}, ${user.claimedDoffa},
        ${user.energy ?? 1000}, ${user.lastEnergyTs ?? now}, ${user.totalTaps ?? 0},
        ${user.banned}, ${user.createdAt}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        telegram_id = EXCLUDED.telegram_id,
        wallet_address = EXCLUDED.wallet_address,
        cups_balance = EXCLUDED.cups_balance,
        pending_doffa = EXCLUDED.pending_doffa,
        claimed_doffa = EXCLUDED.claimed_doffa,
        energy = EXCLUDED.energy,
        last_energy_ts = EXCLUDED.last_energy_ts,
        total_taps = EXCLUDED.total_taps,
        banned = EXCLUDED.banned,
        updated_at = EXCLUDED.updated_at
    `;
    return (await this.get(user.id))!;
  }

  async adjustCups(id: string, delta: number) {
    const rows = (await this.sql`
      UPDATE doffa_users
      SET cups_balance = GREATEST(0, cups_balance + ${delta}),
          updated_at = ${Date.now()}
      WHERE id = ${id}
      RETURNING *
    `) as Record<string, unknown>[];
    return rows[0] ? mapUser(rows[0]) : undefined;
  }
}

class PgMatchRepository implements MatchRepository {
  constructor(private readonly sql: Sql) {}
  async get(matchId: string) {
    const rows = (await this
      .sql`SELECT * FROM doffa_matches WHERE match_id = ${matchId} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapMatch(rows[0]) : undefined;
  }
  async save(match: MatchResult) {
    await this.sql`
      INSERT INTO doffa_matches (
        match_id, players, winner_wallet, started_at, finished_at,
        cups_entry_fee, doffa_reward, reward_status, flags
      ) VALUES (
        ${match.matchId}, ${match.players}, ${match.winnerWallet},
        ${match.startedAt}, ${match.finishedAt}, ${match.cupsEntryFee},
        ${match.doffaReward}, ${match.rewardStatus}, ${match.flags ?? null}
      )
      ON CONFLICT (match_id) DO UPDATE SET
        players = EXCLUDED.players,
        winner_wallet = EXCLUDED.winner_wallet,
        finished_at = EXCLUDED.finished_at,
        cups_entry_fee = EXCLUDED.cups_entry_fee,
        doffa_reward = EXCLUDED.doffa_reward,
        reward_status = EXCLUDED.reward_status,
        flags = EXCLUDED.flags
    `;
    return match;
  }
  async listByUser(userId: string, limit = 50) {
    const rows = (await this.sql`
      SELECT * FROM doffa_matches
      WHERE ${userId} = ANY(players)
      ORDER BY finished_at DESC
      LIMIT ${limit}
    `) as Record<string, unknown>[];
    return rows.map(mapMatch);
  }
}

class PgRewardRepository implements RewardRepository {
  constructor(private readonly sql: Sql) {}
  async get(id: string) {
    const rows = (await this.sql`SELECT * FROM doffa_rewards WHERE id = ${id} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapReward(rows[0]) : undefined;
  }
  async getByMatch(matchId: string) {
    const rows = (await this
      .sql`SELECT * FROM doffa_rewards WHERE match_id = ${matchId} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapReward(rows[0]) : undefined;
  }
  async listAvailable(userId: string) {
    const rows = (await this.sql`
      SELECT * FROM doffa_rewards WHERE user_id = ${userId} AND status = 'available'
      ORDER BY created_at DESC
    `) as Record<string, unknown>[];
    return rows.map(mapReward);
  }
  async listByUser(userId: string, limit = 50) {
    const rows = (await this.sql`
      SELECT * FROM doffa_rewards WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
    return rows.map(mapReward);
  }
  async save(reward: Reward) {
    try {
      await this.sql`
        INSERT INTO doffa_rewards (
          id, match_id, user_id, wallet_address, amount, status, created_at, updated_at
        ) VALUES (
          ${reward.id}, ${reward.matchId}, ${reward.userId}, ${reward.walletAddress},
          ${reward.amount}, ${reward.status}, ${reward.createdAt}, ${reward.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          amount = EXCLUDED.amount,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (e) {
      // Unique match_id: concurrent gameOver award — keep first reward.
      const existing = await this.getByMatch(reward.matchId);
      if (existing) return existing;
      throw e;
    }
    return (await this.get(reward.id)) ?? reward;
  }
}

class PgClaimRepository implements ClaimRepository {
  constructor(private readonly sql: Sql) {}
  async get(id: string) {
    const rows = (await this.sql`SELECT * FROM doffa_claims WHERE id = ${id} LIMIT 1`) as Record<
      string,
      unknown
    >[];
    return rows[0] ? mapClaim(rows[0]) : undefined;
  }
  async getByReward(rewardId: string) {
    const rows = (await this.sql`
      SELECT * FROM doffa_claims WHERE reward_id = ${rewardId}
      ORDER BY created_at DESC LIMIT 1
    `) as Record<string, unknown>[];
    return rows[0] ? mapClaim(rows[0]) : undefined;
  }
  async getByIdempotencyKey(key: string) {
    const rows = (await this.sql`
      SELECT * FROM doffa_claims WHERE idempotency_key = ${key} LIMIT 1
    `) as Record<string, unknown>[];
    return rows[0] ? mapClaim(rows[0]) : undefined;
  }
  async listByUser(userId: string, limit = 50) {
    const rows = (await this.sql`
      SELECT * FROM doffa_claims WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
    return rows.map(mapClaim);
  }
  async save(claim: ClaimRecord) {
    await this.sql`
      INSERT INTO doffa_claims (
        id, reward_id, user_id, wallet_address, amount, idempotency_key,
        status, tx_signature, reason, created_at, updated_at
      ) VALUES (
        ${claim.id}, ${claim.rewardId}, ${claim.userId}, ${claim.walletAddress},
        ${claim.amount}, ${claim.idempotencyKey}, ${claim.status},
        ${claim.txSignature ?? null}, ${claim.reason ?? null},
        ${claim.createdAt}, ${claim.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        tx_signature = EXCLUDED.tx_signature,
        reason = EXCLUDED.reason,
        updated_at = EXCLUDED.updated_at
    `;
    return claim;
  }
}

export function createPgRepositories(databaseUrl: string): Repositories {
  const sql = neon(databaseUrl) as unknown as Sql;
  return {
    users: new PgUserRepository(sql),
    matches: new PgMatchRepository(sql),
    rewards: new PgRewardRepository(sql),
    claims: new PgClaimRepository(sql),
  };
}
