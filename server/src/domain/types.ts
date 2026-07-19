// Доменные типы DOFFA-экономики (этап 3). Единый источник истины на сервере
// для пользователей, результатов матчей, наград и заявок на вывод.
//
// Ничего криптографического или связанного с хранением здесь нет — только
// формы данных. Хранение задаётся интерфейсами репозиториев, выплаты —
// сервисами. Это позволяет позже заменить файловое хранилище на PostgreSQL
// без изменения игровой логики.

/** Статус жизненного цикла награды за матч. */
export type RewardStatus =
  | 'none' // награды нет (поражение / неоплаченный матч)
  | 'available' // победа подтверждена, можно забрать
  | 'processing' // выплата инициирована, транзакция в процессе
  | 'sent' // токен отправлен, транзакция подтверждена
  | 'failed' // выплата не удалась (можно повторить, награда сохранена)
  | 'review'; // отправлено на ручную/автоматическую проверку (античит/лимит)

/** Единый аккаунт игрока в экосистеме DOFFA. */
export interface DoffaUser {
  /** Внутренний id (пока = адрес кошелька; при Telegram-связке станет отдельным). */
  id: string;
  /** Telegram id — заготовка под будущую Mini App. */
  telegramId?: string;
  /** Подключённый Solana-кошелёк (получатель DOFFA). */
  walletAddress?: string;
  /** Баланс зёрен — внутренняя игровая энергия (авторитетно на сервере). */
  beansBalance: number;
  /** Текущая энергия тапалки (авторитетно на сервере). */
  energy: number;
  /** Метка времени последнего пересчёта регенерации энергии. */
  lastEnergyTs: number;
  /** Накопленный доступный DOFFA (сумма available-наград). */
  pendingDoffa: number;
  /** Суммарно выплаченный DOFFA. */
  claimedDoffa: number;
  createdAt: number;
  banned: boolean;
}

/** Авторитетная запись результата онлайн-матча. */
export interface MatchResult {
  matchId: string;
  /** id участников (в порядке рассадки). */
  players: string[];
  /** Кошелёк победителя (получатель награды). Пусто, если победил бот/никто. */
  winnerWallet: string;
  startedAt: number;
  finishedAt: number;
  /** Списанная плата за вход (зёрна) с каждого игрока-человека. */
  beansEntryFee: number;
  /** Назначенная награда DOFFA победителю. */
  doffaReward: number;
  rewardStatus: RewardStatus;
  /** Отметки античита, из-за которых награда ушла в review (если есть). */
  flags?: string[];
}

/** Награда, привязанная к матчу и кошельку (единица получения). */
export interface Reward {
  id: string;
  matchId: string;
  userId: string;
  walletAddress: string;
  amount: number;
  status: RewardStatus;
  createdAt: number;
  updatedAt: number;
}

/** Заявка на вывод (Claim) конкретной награды. Одна на награду. */
export interface ClaimRecord {
  id: string;
  rewardId: string;
  userId: string;
  walletAddress: string;
  amount: number;
  /** Ключ идемпотентности: повторный Claim с тем же ключом не платит дважды. */
  idempotencyKey: string;
  status: RewardStatus;
  /** Подпись транзакции выплаты (когда отправлено). */
  txSignature?: string;
  /** Причина ошибки/review. */
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

/** Запись истории наград для профиля/экрана истории. */
export interface RewardHistoryItem {
  id: string;
  date: number;
  kind: 'beans' | 'doffa' | 'claim';
  amount: number;
  note: string;
  txSignature?: string;
}

/**
 * Авторитетная запись одиночного забега DOFFA Defense (см. services/runService.ts).
 * Создаётся при run:start (плата за вход уже списана), закрывается при
 * run:finish. Сохранённый результат делает повторный finish идемпотентным.
 */
export interface RunRecord {
  runId: string;
  userId: string;
  startedAt: number;
  finishedAt?: number;
  /** Списанная плата за вход (зёрна). */
  beansEntryFee: number;
  finished: boolean;
  // ── Статистика, присланная клиентом при завершении (НЕ доверяется blindly — см. runService). ──
  roomsCleared?: number;
  miniBossKilled?: boolean;
  chapterComplete?: boolean;
  durationMs?: number;
  /** Сид забега — заготовка под будущую серверную ре-симуляцию для проверки. */
  seed?: number;
  // ── Авторитетный результат (заполняет только сервер). ──
  beansGranted?: number;
  doffaGranted?: number;
  rewardStatus?: 'none' | 'available' | 'review';
  /** Отметки античита (например, implausible_duration) — глава уходит в review. */
  flags?: string[];
}
