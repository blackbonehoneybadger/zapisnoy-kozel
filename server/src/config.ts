// Централизованная конфигурация DOFFA-экономики. Все секреты и параметры
// берутся ТОЛЬКО из серверных переменных окружения. Ничего из этого файла
// не должно попадать в клиент / APK / PWA / VITE_* / NEXT_PUBLIC_* / GitHub.
//
// По умолчанию реальные выплаты ВЫКЛЮЧЕНЫ (DOFFA_CLAIM_ENABLED=false):
// пока полноценная серверная система и Reward Vault не готовы — токены в сеть
// не отправляются, Claim работает в тестовом режиме через mock-провайдер.

/** SPL-mint токена DOFFA. */
export const DOFFA_MINT = process.env.DOFFA_MINT ?? '57aAfCuXx7uuc8g8P9kTxR65TKQtZsFDJeKhdD5xu6uo';

/** Адрес горячего кошелька выплат DOFFA (публичный). */
export const DOFFA_REWARD_WALLET_ADDRESS = process.env.DOFFA_REWARD_WALLET_ADDRESS ?? '';

/** Приватный ключ горячего кошелька выплат. ТОЛЬКО на сервере. */
export const DOFFA_REWARD_WALLET_PRIVATE_KEY = process.env.DOFFA_REWARD_WALLET_PRIVATE_KEY ?? '';

/** Заявленный размер общего фонда наград (для отображения/учёта). */
export const DOFFA_REWARD_POOL_INITIAL = toInt(process.env.DOFFA_REWARD_POOL_INITIAL, 1_000_000);

/**
 * Главный рубильник реальных выплат. false → тестовый режим (mock-провайдер,
 * токены не двигаются). Включать только когда готовы Reward Vault, hot wallet,
 * БД для идемпотентности Claim и мониторинг баланса.
 */
export const DOFFA_CLAIM_ENABLED = (process.env.DOFFA_CLAIM_ENABLED ?? 'false').trim() === 'true';

/** Дневной лимит суммы DOFFA к выплате на аккаунт (античит). 0 → без лимита. */
export const DOFFA_DAILY_REWARD_LIMIT = toInt(process.env.DOFFA_DAILY_REWARD_LIMIT, 0);

/**
 * Минимальный рабочий баланс горячего кошелька. Если баланс ниже —
 * выплаты приостанавливаются (статус награды → "review"), чтобы не уйти в минус.
 */
export const DOFFA_MIN_HOT_WALLET_BALANCE = toInt(process.env.DOFFA_MIN_HOT_WALLET_BALANCE, 0);

/** Награда DOFFA за подтверждённую сервером онлайн-победу (единицы токена). */
export const DOFFA_REWARD_PER_WIN = toInt(process.env.DOFFA_REWARD_PER_WIN, 10);

/** Стоимость входа в онлайн-матч Crazy 8 за зёрна (beans). */
export const BEANS_ENTRY_FEE = toInt(process.env.BEANS_ENTRY_FEE ?? process.env.CUPS_ENTRY_FEE, 100);

/**
 * Стоимость входа в матч DOFFA Bean Duel за зёрна — билет на вход, НЕ ставка
 * между игроками (проигравший не передаёт зёрна победителю). Отдельная от
 * BEANS_ENTRY_FEE константа: разные режимы, независимая настройка цены.
 */
export const BEAN_DUEL_ENTRY_FEE = toInt(process.env.BEAN_DUEL_ENTRY_FEE, 100);

/**
 * Legacy-механика ставок SOL (стол на реальные деньги вместо зёрен) — см.
 * docs/SOL_BETTING_LEGACY.md. Выключена по умолчанию в продакшене новой
 * версии: столы со ставкой не создаются, пока флаг не включён явно.
 * Код (payout, verifyPayment и т.д.) не удалён — сохранён на случай
 * будущего аудита/включения, но не участвует в основном пути игрока.
 */
export const SOL_BETTING_ENABLED = (process.env.SOL_BETTING_ENABLED ?? 'false').trim() === 'true';

function toInt(raw: string | undefined, fallback: number): number {
  const trimmed = (raw ?? '').trim();
  // Number('') === 0 (не NaN) — без этой проверки пустая/отсутствующая
  // переменная окружения тихо давала 0 вместо fallback на ЛЮБом toInt(...).
  if (trimmed === '') return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Сводка конфигурации для лога старта (без секретов). */
export function rewardConfigSummary(): string {
  return [
    `DOFFA_CLAIM_ENABLED=${DOFFA_CLAIM_ENABLED}`,
    `mint=${DOFFA_MINT.slice(0, 4)}…${DOFFA_MINT.slice(-4)}`,
    `pool=${DOFFA_REWARD_POOL_INITIAL}`,
    `perWin=${DOFFA_REWARD_PER_WIN}`,
    `beansEntry=${BEANS_ENTRY_FEE}`,
    `beanDuelEntry=${BEAN_DUEL_ENTRY_FEE}`,
    `dailyLimit=${DOFFA_DAILY_REWARD_LIMIT || '∞'}`,
    `solBetting=${SOL_BETTING_ENABLED ? 'ON (legacy)' : 'off'}`,
  ].join(' · ');
}
