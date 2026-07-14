// Централизованная конфигурация DOFFA-экономики.
// Значения читаются через loadEnv() — секреты не должны попадать в клиент.
//
// Variant A: DOFFA_CLAIM_ENABLED по умолчанию false — реальные SPL-выплаты выкл.

import { loadEnv } from './env';

function env() {
  return loadEnv();
}

/** SPL-mint токена DOFFA. */
export const DOFFA_MINT = env().DOFFA_MINT;

/** Адрес горячего кошелька выплат DOFFA (публичный). */
export const DOFFA_REWARD_WALLET_ADDRESS = env().DOFFA_REWARD_WALLET_ADDRESS;

/** Приватный ключ горячего кошелька выплат. ТОЛЬКО на сервере. */
export const DOFFA_REWARD_WALLET_PRIVATE_KEY = env().DOFFA_REWARD_WALLET_PRIVATE_KEY;

/** Заявленный размер общего фонда наград. */
export const DOFFA_REWARD_POOL_INITIAL = env().DOFFA_REWARD_POOL_INITIAL;

/**
 * Главный рубильник реальных выплат. false → mock.
 * Не включать, пока нет Reward Vault / идемпотентности Claim.
 */
export const DOFFA_CLAIM_ENABLED = env().DOFFA_CLAIM_ENABLED;

/** Дневной лимит суммы DOFFA к выплате на аккаунт. 0 → без лимита. */
export const DOFFA_DAILY_REWARD_LIMIT = env().DOFFA_DAILY_REWARD_LIMIT;

/** Минимальный рабочий баланс горячего кошелька. */
export const DOFFA_MIN_HOT_WALLET_BALANCE = env().DOFFA_MIN_HOT_WALLET_BALANCE;

/** Награда DOFFA за подтверждённую сервером онлайн-победу. */
export const DOFFA_REWARD_PER_WIN = env().DOFFA_REWARD_PER_WIN;

/** Стоимость входа в онлайн-матч за Cups. */
export const CUPS_ENTRY_FEE = env().CUPS_ENTRY_FEE;

/** Сводка конфигурации для лога старта (без секретов). */
export function rewardConfigSummary(): string {
  const e = loadEnv();
  return [
    `DOFFA_CLAIM_ENABLED=${e.DOFFA_CLAIM_ENABLED}`,
    `SOL_STAKES_ENABLED=${e.SOL_STAKES_ENABLED}`,
    `mint=${e.DOFFA_MINT.slice(0, 4)}…${e.DOFFA_MINT.slice(-4)}`,
    `pool=${e.DOFFA_REWARD_POOL_INITIAL}`,
    `perWin=${e.DOFFA_REWARD_PER_WIN}`,
    `cupsEntry=${e.CUPS_ENTRY_FEE}`,
    `dailyLimit=${e.DOFFA_DAILY_REWARD_LIMIT || '∞'}`,
  ].join(' · ');
}
