/**
 * Серверная тапалка зёрен (cupsBalance) + spendEntry.
 * Клиент — только оптимистичный кэш; истина здесь.
 */
import type { DoffaUser } from '../domain/types';
import type { Repositories } from '../repositories/types';
import { CUPS_ENTRY_FEE } from '../config';

export const ENERGY_MAX = 1000;
export const ENERGY_REGEN_MS = 3600;
const BASE_PER_TAP = 1;
const COMBO_WINDOW_MS = 450;
const COMBO_STEP = 12;
const COMBO_MAX = 5;

export interface BeansBalance {
  beans: number;
  energy: number;
  totalTaps: number;
  entryFee: number;
}

export interface ServerTapResult {
  ok: boolean;
  empty?: boolean;
  gained: number;
  beans: number;
  energy: number;
  totalTaps: number;
  combo: number;
  multiplier: number;
  golden: boolean;
  message?: string;
}

function regen(energy: number, lastTs: number, now: number): { energy: number; ts: number } {
  if (energy >= ENERGY_MAX) return { energy: ENERGY_MAX, ts: now };
  const elapsed = Math.max(0, now - (lastTs || now));
  const restored = Math.floor(elapsed / ENERGY_REGEN_MS);
  if (restored <= 0) return { energy, ts: lastTs || now };
  return {
    energy: Math.min(ENERGY_MAX, energy + restored),
    ts: (lastTs || now) + restored * ENERGY_REGEN_MS,
  };
}

function goldenChance(totalTaps: number, now: number): boolean {
  const x = (totalTaps * 2654435761 + Math.floor(now / 17)) >>> 0;
  return x % 40 === 0;
}

export class BeansService {
  private combo = new Map<string, { n: number; ts: number }>();

  constructor(private readonly repos: Repositories, private readonly now: () => number = Date.now) {}

  private async ensure(userId: string): Promise<DoffaUser> {
    let user = await this.repos.users.get(userId);
    const now = this.now();
    if (!user) {
      user = {
        id: userId,
        walletAddress: userId,
        cupsBalance: 0,
        pendingDoffa: 0,
        claimedDoffa: 0,
        energy: ENERGY_MAX,
        lastEnergyTs: now,
        totalTaps: 0,
        createdAt: now,
        banned: false,
      };
      await this.repos.users.upsert(user);
    }
    return user;
  }

  async balance(userId: string): Promise<BeansBalance> {
    const user = await this.ensure(userId);
    const now = this.now();
    const r = regen(user.energy ?? ENERGY_MAX, user.lastEnergyTs ?? now, now);
    if (r.energy !== (user.energy ?? ENERGY_MAX) || r.ts !== (user.lastEnergyTs ?? now)) {
      user.energy = r.energy;
      user.lastEnergyTs = r.ts;
      await this.repos.users.upsert(user);
    }
    return {
      beans: user.cupsBalance,
      energy: user.energy ?? ENERGY_MAX,
      totalTaps: user.totalTaps ?? 0,
      entryFee: CUPS_ENTRY_FEE,
    };
  }

  /** Batch of taps from client (anti-spam: clamp N). */
  async tap(userId: string, count = 1): Promise<ServerTapResult> {
    const n = Math.max(1, Math.min(20, Math.floor(count)));
    const user = await this.ensure(userId);
    if (user.banned) {
      return {
        ok: false,
        gained: 0,
        beans: user.cupsBalance,
        energy: user.energy ?? 0,
        totalTaps: user.totalTaps ?? 0,
        combo: 0,
        multiplier: 1,
        golden: false,
        message: 'Аккаунт заблокирован',
      };
    }

    const now = this.now();
    let energy = user.energy ?? ENERGY_MAX;
    let lastTs = user.lastEnergyTs ?? now;
    const rg = regen(energy, lastTs, now);
    energy = rg.energy;
    lastTs = rg.ts;

    let gainedTotal = 0;
    let combo = 0;
    let multiplier = 1;
    let golden = false;
    let applied = 0;

    for (let i = 0; i < n; i++) {
      if (energy <= 0) break;
      energy -= 1;
      applied += 1;
      const prev = this.combo.get(userId);
      combo = prev && now - prev.ts <= COMBO_WINDOW_MS ? prev.n + 1 : 1;
      this.combo.set(userId, { n: combo, ts: now });
      multiplier = Math.min(COMBO_MAX, 1 + Math.floor(combo / COMBO_STEP));
      const g = goldenChance((user.totalTaps ?? 0) + applied, now);
      if (g) golden = true;
      gainedTotal += BASE_PER_TAP * multiplier + (g ? 24 : 0);
    }

    user.cupsBalance += gainedTotal;
    user.energy = energy;
    user.lastEnergyTs = lastTs;
    user.totalTaps = (user.totalTaps ?? 0) + applied;
    await this.repos.users.upsert(user);

    return {
      ok: applied > 0,
      empty: applied === 0,
      gained: gainedTotal,
      beans: user.cupsBalance,
      energy: user.energy ?? 0,
      totalTaps: user.totalTaps ?? 0,
      combo,
      multiplier,
      golden,
    };
  }

  async spendEntry(
    userId: string,
    fee = CUPS_ENTRY_FEE,
  ): Promise<{ ok: boolean; beans: number; message?: string }> {
    const user = await this.ensure(userId);
    if (user.banned) return { ok: false, beans: user.cupsBalance, message: 'Аккаунт заблокирован' };
    if (user.cupsBalance < fee) {
      return { ok: false, beans: user.cupsBalance, message: `Нужно ${fee} зёрен для входа` };
    }
    const updated = await this.repos.users.adjustCups(userId, -fee);
    return { ok: true, beans: updated?.cupsBalance ?? user.cupsBalance - fee };
  }
}
