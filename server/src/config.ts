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

// ─── DOFFA Bean Duel: Reward Vault, 80/20 split, burn, режим награды ───────
// (см. server/src/services/rewardBudgetService.ts — расчёт суммы награды).

/**
 * Распределение ОБЩЕЙ (валовой) награды за победу в Bean Duel: доля игроку /
 * доля на сжигание, в процентах. Должны в сумме давать 100 — проверяется
 * validateRewardSplit() при старте сервера (см. index.ts).
 */
export const PLAYER_REWARD_PERCENT = toInt(process.env.PLAYER_REWARD_PERCENT, 80);
export const BURN_PERCENT = toInt(process.env.BURN_PERCENT, 20);

/**
 * Включает реальное сжигание доли BURN_PERCENT. По умолчанию false — доля
 * учитывается (резервируется в журнале сжигания), но НИКАКАЯ транзакция не
 * отправляется и не имитируется; статус записи — "Planned", а не "Burned".
 * Реализация реальной отправки в сеть — отдельная будущая задача.
 */
export const DOFFA_BURN_ENABLED = (process.env.DOFFA_BURN_ENABLED ?? 'false').trim() === 'true';
/** Приватный ключ кошелька сжигания. ТОЛЬКО на сервере — никогда в клиенте, VITE_* или APK. */
export const DOFFA_BURN_WALLET_PRIVATE_KEY = process.env.DOFFA_BURN_WALLET_PRIVATE_KEY ?? '';

/**
 * Режим расчёта награды за победу в Bean Duel:
 *  - BETA_FIXED — фиксированная сумма на старте проекта (мало игроков),
 *    с дневным лимитом наградных побед на игрока (см. MAX_REWARDED_WINS_PER_USER_PER_DAY).
 *  - ADAPTIVE — сумма считается из остатка Reward Vault, планового периода и
 *    среднесуточной активности (см. rewardBudgetService.ts), фиксируется на
 *    сутки — не пересчитывается на каждый матч.
 * Включать ADAPTIVE — отдельное решение владельца при достаточной активности
 * (ориентир из ТЗ: ≥50 уникальных активных игроков/сутки ИЛИ ≥100
 * подтверждённых наградных побед/сутки).
 */
export type RewardMode = 'BETA_FIXED' | 'ADAPTIVE';
export const REWARD_MODE: RewardMode =
  (process.env.REWARD_MODE ?? 'BETA_FIXED').trim() === 'ADAPTIVE' ? 'ADAPTIVE' : 'BETA_FIXED';

/** BETA_FIXED: валовая (до 80/20-разделения) награда за одну подтверждённую победу. */
export const BETA_GROSS_REWARD_PER_WIN = toInt(process.env.BETA_GROSS_REWARD_PER_WIN, 10);
/** BETA_FIXED: дневной лимит наградных побед на игрока — остальные победы идут только в рейтинг/статистику. */
export const MAX_REWARDED_WINS_PER_USER_PER_DAY = toInt(process.env.MAX_REWARDED_WINS_PER_USER_PER_DAY, 5);

// ─── DOFFA Defense: экономика одиночного забега (run:*, см. services/runService.ts) ─
// Петля: тапалка → зёрна → вход в забег за зёрна → зёрна за комнаты +
// DOFFA за полное прохождение главы (эквивалент победы в Bean Duel).

/** Плата за вход в забег DOFFA Defense (зёрна), списывается сервером при run:start. */
export const RUN_ENTRY_BEANS = toInt(process.env.RUN_ENTRY_BEANS, 100);
/** Зёрна за каждую зачищенную комнату забега. */
export const RUN_BEANS_PER_ROOM = toInt(process.env.RUN_BEANS_PER_ROOM, 5);
/** Зёрна сверху за убийство мини-босса. */
export const RUN_BEANS_MINI_BOSS = toInt(process.env.RUN_BEANS_MINI_BOSS, 10);
/** Зёрна сверху за полное прохождение главы. */
export const RUN_BEANS_CHAPTER = toInt(process.env.RUN_BEANS_CHAPTER, 15);
/**
 * Античит-потолок правдоподобия: длительность забега не может быть меньше
 * roomsCleared × этой величины (с небольшим допуском в самом сервисе).
 * Нарушение → награда не платится, глава уходит в review (см. runService).
 */
export const RUN_MIN_SECONDS_PER_ROOM = toInt(process.env.RUN_MIN_SECONDS_PER_ROOM, 40);
/** Минимальный интервал между завершениями забегов одного игрока (rate-limit, анти-фарм). */
export const RUN_FINISH_MIN_INTERVAL_MS = toInt(process.env.RUN_FINISH_MIN_INTERVAL_MS, 15_000);
/**
 * Дневной лимит НАГРАДНЫХ пройденных глав на игрока — сверх лимита глава
 * даёт только зёрна/статистику, без DOFFA. Тот же механизм и те же данные,
 * что у MAX_REWARDED_WINS_PER_USER_PER_DAY для дуэлей (записи Reward в общем
 * репозитории за 24ч; у забегов matchId имеет префикс "run:"). Общий лимит
 * наград MAX_REWARDED_WINS_PER_USER_PER_DAY дополнительно действует через
 * computeWinReward — он считает и дуэльные, и забеговые награды вместе.
 */
export const MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY = toInt(process.env.MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY, 5);

/** ADAPTIVE: горизонт планирования бюджета Reward Vault (дней) при расчёте суточной суммы. */
export const ADAPTIVE_PLANNING_DAYS = toInt(process.env.ADAPTIVE_PLANNING_DAYS, 90);
/** ADAPTIVE: минимальная и максимальная валовая награда за победу — защита от резких скачков. */
export const ADAPTIVE_MIN_REWARD_PER_WIN = toInt(process.env.ADAPTIVE_MIN_REWARD_PER_WIN, 1);
export const ADAPTIVE_MAX_REWARD_PER_WIN = toInt(process.env.ADAPTIVE_MAX_REWARD_PER_WIN, 50);
/** ADAPTIVE: ожидаемое среднесуточное число подтверждённых наградных побед (для расчёта суммы на победу). */
export const ADAPTIVE_EXPECTED_WINS_PER_DAY = toInt(process.env.ADAPTIVE_EXPECTED_WINS_PER_DAY, 100);

/** Проверяет, что PLAYER_REWARD_PERCENT + BURN_PERCENT = 100. Вызывается при старте сервера. */
export function validateRewardSplit(): void {
  if (PLAYER_REWARD_PERCENT + BURN_PERCENT !== 100) {
    throw new Error(
      `PLAYER_REWARD_PERCENT (${PLAYER_REWARD_PERCENT}) + BURN_PERCENT (${BURN_PERCENT}) должны давать 100`,
    );
  }
}

/** Экспортирован для юнит-тестов (config.test.ts) — сам парсинг не зависит от конкретной переменной. */
export function toInt(raw: string | undefined, fallback: number): number {
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
    `rewardMode=${REWARD_MODE}`,
    `split=${PLAYER_REWARD_PERCENT}/${BURN_PERCENT}`,
    `burn=${DOFFA_BURN_ENABLED ? 'ON' : 'off (Planned)'}`,
    `runEntry=${RUN_ENTRY_BEANS}`,
    `runBeans=${RUN_BEANS_PER_ROOM}/${RUN_BEANS_MINI_BOSS}/${RUN_BEANS_CHAPTER}`,
    `runPace=${RUN_MIN_SECONDS_PER_ROOM}s/room·${RUN_FINISH_MIN_INTERVAL_MS}ms`,
    `chaptersPerDay=${MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY}`,
  ].join(' · ');
}
