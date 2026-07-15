// Расчёт награды DOFFA за подтверждённую победу в Bean Duel: режим
// BETA_FIXED/ADAPTIVE (см. server/src/config.ts REWARD_MODE), 80/20 (или
// сконфигурированное) разделение игрок/сжигание, дневной лимит наградных
// побед на игрока, журнал сжигания. Сервер — единственный, кто считает
// сумму; клиент никогда не присылает и не подтверждает её сам.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ADAPTIVE_EXPECTED_WINS_PER_DAY,
  ADAPTIVE_MAX_REWARD_PER_WIN,
  ADAPTIVE_MIN_REWARD_PER_WIN,
  ADAPTIVE_PLANNING_DAYS,
  BETA_GROSS_REWARD_PER_WIN,
  BURN_PERCENT,
  DOFFA_BURN_ENABLED,
  DOFFA_REWARD_POOL_INITIAL,
  MAX_REWARDED_WINS_PER_USER_PER_DAY,
  PLAYER_REWARD_PERCENT,
  REWARD_MODE,
} from '../config';
import type { Repositories } from '../repositories/types';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, '..', '..', 'data');
const VAULT_STATE_PATH = resolve(DATA_DIR, 'reward_vault_state.json');
const BURN_LEDGER_PATH = resolve(DATA_DIR, 'burn_ledger.json');

interface VaultState {
  /** Сколько DOFFA (валовых, до сжигания) назначено победителям с начала работы фонда. */
  totalGrossDistributed: number;
  /** Дата (YYYY-MM-DD, UTC), на которую зафиксирована текущая ADAPTIVE-награда. */
  adaptiveFixedForDate?: string;
  /** Зафиксированная на этот день валовая награда за победу (ADAPTIVE). */
  adaptiveRewardPerWin?: number;
}

function loadVaultState(): VaultState {
  try {
    return existsSync(VAULT_STATE_PATH)
      ? (JSON.parse(readFileSync(VAULT_STATE_PATH, 'utf8')) as VaultState)
      : { totalGrossDistributed: 0 };
  } catch (e) {
    console.error('Не удалось прочитать состояние Reward Vault:', e);
    return { totalGrossDistributed: 0 };
  }
}

function saveVaultState(state: VaultState): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(VAULT_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Не удалось сохранить состояние Reward Vault:', e);
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Валовая (до 80/20) награда за победу в текущем режиме.
 *  - BETA_FIXED — статичная константа из конфигурации.
 *  - ADAPTIVE — вычисляется из остатка Reward Vault / планового периода /
 *    ожидаемой суточной активности, клампится в [min, max] и ФИКСИРУЕТСЯ на
 *    календарные сутки (UTC): пересчёт происходит не чаще раза в день, а не
 *    на каждый матч — требование "не пересчитывать хаотично".
 */
export function currentGrossRewardPerWin(): number {
  if (REWARD_MODE === 'BETA_FIXED') return BETA_GROSS_REWARD_PER_WIN;

  const state = loadVaultState();
  const today = todayKey();
  if (state.adaptiveFixedForDate === today && typeof state.adaptiveRewardPerWin === 'number') {
    return state.adaptiveRewardPerWin;
  }

  const vaultRemaining = Math.max(0, DOFFA_REWARD_POOL_INITIAL - state.totalGrossDistributed);
  const dailyBudget = vaultRemaining / Math.max(1, ADAPTIVE_PLANNING_DAYS);
  const raw = dailyBudget / Math.max(1, ADAPTIVE_EXPECTED_WINS_PER_DAY);
  const rewardPerWin = Math.floor(clamp(raw, ADAPTIVE_MIN_REWARD_PER_WIN, ADAPTIVE_MAX_REWARD_PER_WIN));

  state.adaptiveFixedForDate = today;
  state.adaptiveRewardPerWin = rewardPerWin;
  saveVaultState(state);
  return rewardPerWin;
}

/** 80/20 (или сконфигурированное PLAYER_REWARD_PERCENT/BURN_PERCENT) разделение валовой награды. */
export function splitReward(gross: number): { playerAmount: number; burnAmount: number } {
  const playerAmount = Math.floor((gross * PLAYER_REWARD_PERCENT) / 100);
  // Остаток — на сжигание: playerAmount + burnAmount === gross всегда, без потери округления.
  const burnAmount = gross - playerAmount;
  return { playerAmount, burnAmount };
}

export interface RewardComputation {
  gross: number;
  playerAmount: number;
  burnAmount: number;
  /** Причина, по которой награда не назначена (gross=0), если так. */
  reason?: 'daily_limit';
}

/**
 * Считает награду за подтверждённую победу конкретного игрока: сначала
 * проверяет дневной лимит наградных побед (сверх лимита — победа даёт
 * только статистику, без DOFFA), затем берёт текущую валовую сумму и делит
 * по 80/20. Использует уже сохранённые Reward-записи игрока за сутки —
 * отдельного счётчика вести не нужно.
 */
export async function computeWinReward(userId: string, repos: Repositories): Promise<RewardComputation> {
  if (MAX_REWARDED_WINS_PER_USER_PER_DAY > 0) {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const rewardsToday = (await repos.rewards.listByUser(userId, 200)).filter(
      (r) => r.createdAt >= since && r.amount > 0,
    );
    if (rewardsToday.length >= MAX_REWARDED_WINS_PER_USER_PER_DAY) {
      return { gross: 0, playerAmount: 0, burnAmount: 0, reason: 'daily_limit' };
    }
  }

  const gross = currentGrossRewardPerWin();
  const { playerAmount, burnAmount } = splitReward(gross);

  if (gross > 0) {
    const state = loadVaultState();
    state.totalGrossDistributed += gross;
    saveVaultState(state);
  }

  return { gross, playerAmount, burnAmount };
}

// ─── Журнал сжигания (burn ledger) ──────────────────────────────────────
export type BurnStatus = 'planned' | 'testing' | 'burned';

export interface BurnLedgerEntry {
  matchId: string;
  amount: number;
  status: BurnStatus;
  createdAt: number;
  /** Подпись транзакции сжигания — ТОЛЬКО когда реально отправлено в сеть. */
  txSignature?: string;
}

function loadBurnLedger(): BurnLedgerEntry[] {
  try {
    return existsSync(BURN_LEDGER_PATH) ? (JSON.parse(readFileSync(BURN_LEDGER_PATH, 'utf8')) as BurnLedgerEntry[]) : [];
  } catch (e) {
    console.error('Не удалось прочитать журнал сжигания:', e);
    return [];
  }
}

/**
 * Резервирует долю BURN_PERCENT для матча в журнале сжигания. Пока
 * DOFFA_BURN_ENABLED=false (по умолчанию) — статус "planned": сумма
 * учтена, но НИКАКАЯ транзакция не создаётся и не имитируется, txSignature
 * не выставляется. Реальная отправка сжигания в сеть — отдельная будущая
 * задача (см. docs/BURN_LEDGER.md); до её реализации статус "burned" здесь
 * не используется вообще, чтобы не заявить о несуществующем сжигании.
 */
export function recordBurn(matchId: string, amount: number): BurnLedgerEntry {
  const entry: BurnLedgerEntry = {
    matchId,
    amount,
    status: DOFFA_BURN_ENABLED ? 'testing' : 'planned',
    createdAt: Date.now(),
  };
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const ledger = loadBurnLedger();
    ledger.push(entry);
    const trimmed = ledger.length > 5000 ? ledger.slice(-5000) : ledger;
    writeFileSync(BURN_LEDGER_PATH, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Не удалось записать журнал сжигания:', e);
  }
  return entry;
}

/** Сводка сжигания для лога старта: сконфигурированная доля и текущее состояние флага. */
export function burnConfigSummary(): string {
  return `burnShare=${BURN_PERCENT}% · burnStatus=${DOFFA_BURN_ENABLED ? 'testing (real send TODO)' : 'planned (no tx)'}`;
}
