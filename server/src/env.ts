/**
 * Типизированная загрузка окружения сервера (Zod).
 * Все секреты и флаги читаются только здесь — дальше через loadEnv().
 *
 * Variant A: SOL_STAKES_ENABLED и DOFFA_CLAIM_ENABLED по умолчанию false.
 */
import { z } from 'zod';

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(s)) return false;
  }
  return false;
}

function asInt(fallback: number) {
  return z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(String(v).trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  }, z.number().int().nonnegative());
}

function asFee(fallback: number) {
  return z.preprocess((v) => {
    const n = Number(String(v ?? fallback).trim());
    return Number.isFinite(n) && n >= 0 && n < 1 ? n : fallback;
  }, z.number().min(0).lt(1));
}

export type ServerEnv = {
  NODE_ENV: string;
  PORT: number;
  AUTH_SECRET: string;
  SOLANA_NETWORK: 'devnet' | 'mainnet-beta';
  SOLANA_RPC_URL: string;
  SOLANA_PRIVATE_KEY: string;
  SOL_STAKES_ENABLED: boolean;
  DOFFA_CLAIM_ENABLED: boolean;
  DATABASE_URL: string;
  POSTGRES_URL: string;
  DOFFA_MINT: string;
  DOFFA_REWARD_WALLET_ADDRESS: string;
  DOFFA_REWARD_WALLET_PRIVATE_KEY: string;
  DOFFA_REWARD_POOL_INITIAL: number;
  DOFFA_DAILY_REWARD_LIMIT: number;
  DOFFA_MIN_HOT_WALLET_BALANCE: number;
  DOFFA_REWARD_PER_WIN: number;
  CUPS_ENTRY_FEE: number;
  PLATFORM_FEE: number;
  PLATFORM_WALLET: string;
};

const DEFAULT_DEV_SECRET = 'doffa-crazy8-dev-secret-change-me';

let cached: ServerEnv | null = null;
let cachedFrom: NodeJS.ProcessEnv | null = null;

/** Сброс кэша — только для тестов. */
export function resetEnvCache(): void {
  cached = null;
  cachedFrom = null;
}

function buildSchema(nodeEnv: string) {
  const isProd = nodeEnv === 'production';

  return z
    .object({
      NODE_ENV: z.string().default(nodeEnv || 'development'),
      PORT: asInt(8080),
      AUTH_SECRET: isProd
        ? z
            .string({ required_error: 'AUTH_SECRET обязателен в production' })
            .min(16, 'AUTH_SECRET в production — минимум 16 символов')
            .refine((s) => s !== DEFAULT_DEV_SECRET, 'AUTH_SECRET не должен быть дефолтным в production')
        : z.string().default(DEFAULT_DEV_SECRET),
      SOLANA_NETWORK: isProd
        ? z.enum(['devnet', 'mainnet-beta'], {
            required_error: 'SOLANA_NETWORK обязателен в production',
            invalid_type_error: 'SOLANA_NETWORK: devnet | mainnet-beta',
          })
        : z.enum(['devnet', 'mainnet-beta']).default('mainnet-beta'),
      SOLANA_RPC_URL: z.string().optional().default(''),
      SOLANA_PRIVATE_KEY: z.string().optional().default(''),
      SOL_STAKES_ENABLED: z.preprocess((v) => {
        if (v === undefined || v === null || v === '') return false;
        return asBool(v);
      }, z.boolean()),
      DOFFA_CLAIM_ENABLED: z.preprocess((v) => {
        if (v === undefined || v === null || v === '') return false;
        return asBool(v);
      }, z.boolean()),
      DATABASE_URL: z.string().optional().default(''),
      POSTGRES_URL: z.string().optional().default(''),
      DOFFA_MINT: z.string().default('57aAfCuXx7uuc8g8P9kTxR65TKQtZsFDJeKhdD5xu6uo'),
      DOFFA_REWARD_WALLET_ADDRESS: z.string().optional().default(''),
      DOFFA_REWARD_WALLET_PRIVATE_KEY: z.string().optional().default(''),
      DOFFA_REWARD_POOL_INITIAL: asInt(1_000_000),
      DOFFA_DAILY_REWARD_LIMIT: asInt(0),
      DOFFA_MIN_HOT_WALLET_BALANCE: asInt(0),
      DOFFA_REWARD_PER_WIN: asInt(10),
      CUPS_ENTRY_FEE: asInt(100),
      PLATFORM_FEE: asFee(0.05),
      PLATFORM_WALLET: z.string().optional().default(''),
    })
    .superRefine((data, ctx) => {
      const needsHotWallet =
        isProd && data.SOLANA_NETWORK === 'mainnet-beta'
          ? true
          : (data.SOL_STAKES_ENABLED || data.DOFFA_CLAIM_ENABLED) &&
            data.SOLANA_NETWORK === 'mainnet-beta';

      if (needsHotWallet && !data.SOLANA_PRIVATE_KEY.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SOLANA_PRIVATE_KEY'],
          message:
            'SOLANA_PRIVATE_KEY обязателен на mainnet-beta в production (и при включённых stakes/claim).',
        });
      }
    });
}

/** Загрузить и закэшировать env. Повторный вызов для process.env возвращает кэш. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached && cachedFrom === source) return cached;

  const nodeEnv = (source.NODE_ENV ?? 'development').trim() || 'development';
  const schema = buildSchema(nodeEnv);

  // В production SOLANA_NETWORK должен быть явно задан (не полагаемся на default в parse input).
  if (nodeEnv === 'production' && !(source.SOLANA_NETWORK ?? '').trim()) {
    throw new Error('SOLANA_NETWORK обязателен в production (devnet | mainnet-beta)');
  }
  if (nodeEnv === 'production' && !(source.AUTH_SECRET ?? '').trim()) {
    throw new Error('AUTH_SECRET обязателен в production');
  }

  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Некорректное окружение сервера: ${detail}`);
  }

  const data = parsed.data;
  const env: ServerEnv = {
    NODE_ENV: data.NODE_ENV,
    PORT: data.PORT,
    AUTH_SECRET: data.AUTH_SECRET,
    SOLANA_NETWORK: data.SOLANA_NETWORK,
    SOLANA_RPC_URL: data.SOLANA_RPC_URL,
    SOLANA_PRIVATE_KEY: data.SOLANA_PRIVATE_KEY,
    SOL_STAKES_ENABLED: data.SOL_STAKES_ENABLED,
    DOFFA_CLAIM_ENABLED: data.DOFFA_CLAIM_ENABLED,
    DATABASE_URL: data.DATABASE_URL,
    POSTGRES_URL: data.POSTGRES_URL || data.DATABASE_URL,
    DOFFA_MINT: data.DOFFA_MINT,
    DOFFA_REWARD_WALLET_ADDRESS: data.DOFFA_REWARD_WALLET_ADDRESS,
    DOFFA_REWARD_WALLET_PRIVATE_KEY: data.DOFFA_REWARD_WALLET_PRIVATE_KEY,
    DOFFA_REWARD_POOL_INITIAL: data.DOFFA_REWARD_POOL_INITIAL,
    DOFFA_DAILY_REWARD_LIMIT: data.DOFFA_DAILY_REWARD_LIMIT,
    DOFFA_MIN_HOT_WALLET_BALANCE: data.DOFFA_MIN_HOT_WALLET_BALANCE,
    DOFFA_REWARD_PER_WIN: data.DOFFA_REWARD_PER_WIN,
    CUPS_ENTRY_FEE: data.CUPS_ENTRY_FEE,
    PLATFORM_FEE: data.PLATFORM_FEE,
    PLATFORM_WALLET: data.PLATFORM_WALLET,
  };

  if (source === process.env) {
    cached = env;
    cachedFrom = source;
  }
  return env;
}

/** Удобные геттеры флагов Variant A. */
export function solStakesEnabled(): boolean {
  return loadEnv().SOL_STAKES_ENABLED;
}

export function doffaClaimEnabled(): boolean {
  return loadEnv().DOFFA_CLAIM_ENABLED;
}
