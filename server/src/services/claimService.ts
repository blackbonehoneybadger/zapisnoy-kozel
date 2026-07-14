// Сервис Claim (этапы 4–5): единственный путь превратить доступную награду в
// заявку/выплату. Защищён идемпотентностью и статусами, чтобы исключить
// двойную выплату. Реальную отправку токена делает TransactionProvider —
// mock (тестовый режим) или SPL (за флагом DOFFA_CLAIM_ENABLED).
import { randomBytes } from 'node:crypto';
import type { ClaimRecord, RewardStatus } from '../domain/types';
import type { Repositories } from '../repositories/types';
import type { TransactionProvider } from './transactionProvider';
import { DOFFA_CLAIM_ENABLED, DOFFA_DAILY_REWARD_LIMIT } from '../config';

export interface ClaimOutcome {
  ok: boolean;
  status: RewardStatus;
  claim?: ClaimRecord;
  /** Причина отказа/статуса для показа игроку. */
  message?: string;
  /** Тестовый режим — выплаты ещё не активированы. */
  testMode: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class ClaimService {
  // In-process лок на награду: закрывает окно гонки между проверкой статуса и
  // записью заявки в ОДНОМ процессе (JS однопоточен, add/has до первого await
  // атомарны). Межпроцессная атомарность требует БД (уникальный индекс на
  // rewardId / атомарный переход available→processing) — см. docs/ANTI_CHEAT.md.
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly repos: Repositories,
    private readonly provider: TransactionProvider,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Забрать награду. Идемпотентно: повторный вызов с тем же idempotencyKey или
   * по уже обработанной награде возвращает существующую заявку, не платя дважды.
   */
  async claim(input: {
    userId: string;
    rewardId: string;
    walletAddress: string;
    idempotencyKey: string;
  }): Promise<ClaimOutcome> {
    const testMode = !DOFFA_CLAIM_ENABLED || this.provider.kind === 'mock';

    // 1. Идемпотентность по ключу — до любых изменений.
    const byKey = await this.repos.claims.getByIdempotencyKey(input.idempotencyKey);
    if (byKey) return { ok: byKey.status === 'sent', status: byKey.status, claim: byKey, testMode };

    // 2. Награда существует, принадлежит игроку и доступна.
    const reward = await this.repos.rewards.get(input.rewardId);
    if (!reward) return { ok: false, status: 'failed', message: 'Награда не найдена', testMode };
    if (reward.userId !== input.userId)
      return { ok: false, status: 'failed', message: 'Награда принадлежит другому игроку', testMode };
    if (reward.walletAddress !== input.walletAddress)
      return { ok: false, status: 'failed', message: 'Кошелёк не совпадает с наградой', testMode };

    // In-process лок на награду (P1): атомарно занимаем её до первого await ниже,
    // чтобы два конкурентных Claim одной награды не создали две выплаты. Полная
    // межпроцессная атомарность — через БД (см. docs/ANTI_CHEAT.md).
    if (this.inFlight.has(reward.id))
      return { ok: false, status: 'processing', message: 'Заявка уже обрабатывается', testMode };
    this.inFlight.add(reward.id);
    try {
    // 3. Одна заявка на награду. failed-заявка НЕ блокирует повтор (P2): после
    //    сбоя награда возвращается в available и её можно забрать снова с новым ключом.
    const byReward = await this.repos.claims.getByReward(reward.id);
    if (byReward && byReward.status !== 'failed')
      return { ok: byReward.status === 'sent', status: byReward.status, claim: byReward, testMode };

    if (reward.status !== 'available')
      return { ok: false, status: reward.status, message: 'Награда недоступна к получению', testMode };

    // 4. Аккаунт не заблокирован.
    const user = await this.repos.users.get(input.userId);
    if (!user) return { ok: false, status: 'failed', message: 'Аккаунт не найден', testMode };
    if (user.banned) return { ok: false, status: 'review', message: 'Аккаунт заблокирован', testMode };

    // 5. Дневной лимит DOFFA (античит).
    if (DOFFA_DAILY_REWARD_LIMIT > 0) {
      const since = this.now() - DAY_MS;
      const claimsToday = (await this.repos.claims.listByUser(input.userId, 200)).filter(
        (c) => c.createdAt >= since && c.status !== 'failed',
      );
      const sumToday = claimsToday.reduce((s, c) => s + c.amount, 0);
      if (sumToday + reward.amount > DOFFA_DAILY_REWARD_LIMIT)
        return { ok: false, status: 'review', message: 'Превышен дневной лимит наград', testMode };
    }

    // 6. Готовность выплаты (баланс hot wallet / Reward Vault).
    if (!(await this.provider.canPayout(reward.amount)) && !testMode)
      return { ok: false, status: 'review', message: 'Выплаты временно приостановлены', testMode };

    // 7. Создаём заявку в processing ДО отправки — защита от двойного нажатия
    //    и от рестарта во время выплаты (заявка остаётся processing и видна).
    const claim: ClaimRecord = {
      id: `cl_${randomBytes(9).toString('base64url')}`,
      rewardId: reward.id,
      userId: input.userId,
      walletAddress: input.walletAddress,
      amount: reward.amount,
      idempotencyKey: input.idempotencyKey,
      status: 'processing',
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    await this.repos.claims.save(claim);
    reward.status = 'processing';
    reward.updatedAt = this.now();
    await this.repos.rewards.save(reward);

    // 8. Отправка (mock или реальная SPL).
    try {
      const res = await this.provider.sendReward(input.walletAddress, reward.amount);
      claim.status = 'sent';
      claim.txSignature = res.signature;
      claim.updatedAt = this.now();
      await this.repos.claims.save(claim);
      reward.status = 'sent';
      reward.updatedAt = this.now();
      await this.repos.rewards.save(reward);
      // Переносим pending → claimed.
      if (user) {
        user.pendingDoffa = Math.max(0, user.pendingDoffa - reward.amount);
        user.claimedDoffa += reward.amount;
        await this.repos.users.upsert(user);
      }
      return { ok: true, status: 'sent', claim, testMode };
    } catch (e) {
      // Награда НЕ теряется: возвращаем в available, заявку помечаем failed.
      claim.status = 'failed';
      claim.reason = (e as Error).message;
      claim.updatedAt = this.now();
      await this.repos.claims.save(claim);
      reward.status = 'available';
      reward.updatedAt = this.now();
      await this.repos.rewards.save(reward);
      return { ok: false, status: 'failed', claim, message: 'Отправка временно не выполнена', testMode };
    }
    } finally {
      // Освобождаем награду для последующих попыток (в т.ч. после failed).
      this.inFlight.delete(reward.id);
    }
  }

  async status(claimId: string): Promise<ClaimRecord | undefined> {
    return this.repos.claims.get(claimId);
  }
}
