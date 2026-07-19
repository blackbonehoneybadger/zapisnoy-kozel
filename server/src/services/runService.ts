// Сервис забегов DOFFA Defense (одиночный roguelite-режим): авторитетная
// экономика «тап → зёрна → вход в забег → зёрна за комнаты + DOFFA за главу».
//
// Модель доверия — как у beansService.awardTraining + rewardService.recordMatchResult:
// клиент присылает только статистику забега (комнаты, боссы, длительность),
// а решение о начислении принимает исключительно сервер:
//  - вход списывается при run:start (chargeEntry) и не возвращается после
//    старта (как билет дуэли); если запись забега не создалась — refundEntry;
//  - потолок правдоподобия по времени: durationMs ≥ roomsCleared ×
//    RUN_MIN_SECONDS_PER_ROOM (с небольшим допуском DURATION_MARGIN). Нарушение
//    → зёрна не начисляются, а глава (если заявлена) уходит в review вместо
//    выплаты — тот же подход, что flags → review у дуэли;
//  - rate-limit завершений (RUN_FINISH_MIN_INTERVAL_MS) — аналог
//    MIN_TRAINING_INTERVAL_MS в BeansService;
//  - идемпотентность по runId: повторный finish возвращает сохранённый
//    результат без повторного начисления;
//  - DOFFA — только за ПОЛНОЕ прохождение главы и только при кошельке:
//    дневной лимит наградных глав (MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY,
//    тот же механизм и данные, что у дуэльного MAX_REWARDED_WINS_PER_USER_PER_DAY
//    — записи Reward в общем репозитории за 24ч с amount > 0), затем
//    computeWinReward (который дополнительно применяет ОБЩИЙ дневной лимит
//    наград — дуэли и забеги делят одну квоту), 80/20-сплит, recordBurn,
//    pendingDoffa += доля игрока. Claim-поток не меняется.
import { randomBytes } from 'node:crypto';
import type { Reward, RunRecord } from '../domain/types';
import type { Repositories } from '../repositories/types';
import {
  MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY,
  RUN_BEANS_CHAPTER,
  RUN_BEANS_MINI_BOSS,
  RUN_BEANS_PER_ROOM,
  RUN_ENTRY_BEANS,
  RUN_FINISH_MIN_INTERVAL_MS,
  RUN_MIN_SECONDS_PER_ROOM,
} from '../config';
import type { BeansService, BeansState } from './beansService';
import { computeWinReward, recordBurn } from './rewardBudgetService';

/** Префикс matchId у наград за забеги — отличает их от дуэльных в общем репозитории наград. */
export const RUN_REWARD_MATCH_PREFIX = 'run:';

/**
 * Допуск к потолку «не быстрее RUN_MIN_SECONDS_PER_ROOM на комнату»: честный
 * игрок с быстрым билдом или дрожанием таймера не должен ловить античит-флаг.
 */
const DURATION_MARGIN = 0.85;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunFinishInput {
  runId: string;
  roomsCleared: number;
  miniBossKilled: boolean;
  chapterComplete: boolean;
  durationMs: number;
  seed?: number;
}

export interface RunFinishResult extends BeansState {
  ok: boolean;
  /** Причина отказа в обработке (только когда ok=false). */
  reason?: 'rate_limited';
  runId: string;
  beansGranted: number;
  doffaGranted: number;
  /** Статус DOFFA-награды за главу (available/review/none). */
  rewardStatus?: 'none' | 'available' | 'review';
  flags?: string[];
}

export class RunService {
  // Rate-limit частоты завершений — в памяти процесса, как lastTrainingAward
  // в BeansService (это лишь троттлинг, переживать перезапуск не обязан).
  private readonly lastFinishAward = new Map<string, number>();

  constructor(
    private readonly repos: Repositories,
    private readonly beans: BeansService,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Старт забега: атомарно списывает плату за вход и создаёт запись забега.
   * null — зёрен не хватило (клиент может продолжать играть офлайн, без наград).
   * Если запись забега не сохранилась — списанная плата возвращается: забег
   * серверной учётной записью так и не начался.
   */
  async startRun(userId: string, wallet: string | undefined): Promise<({ runId: string } & BeansState) | null> {
    const charged = await this.beans.chargeEntry(userId, wallet, RUN_ENTRY_BEANS);
    if (!charged) return null;
    const run: RunRecord = {
      runId: `run_${randomBytes(9).toString('base64url')}`,
      userId,
      startedAt: this.now(),
      beansEntryFee: RUN_ENTRY_BEANS,
      finished: false,
    };
    try {
      await this.repos.runs.save(run);
    } catch (e) {
      await this.beans.refundEntry(userId, wallet, RUN_ENTRY_BEANS);
      throw e;
    }
    return { runId: run.runId, ...charged };
  }

  /**
   * Завершение забега. null — забег не найден / принадлежит другому игроку
   * (точка входа отвечает ошибкой протокола). Идемпотентно по runId.
   */
  async finishRun(userId: string, wallet: string | undefined, input: RunFinishInput): Promise<RunFinishResult | null> {
    const run = await this.repos.runs.get(input.runId);
    if (!run || run.userId !== userId) return null;

    const state = await this.beans.getState(userId, wallet);

    // Идемпотентность: повторный finish по тому же забегу — тот же сохранённый
    // результат (сетевые ретраи/двойные тапы не начисляют второй раз). Проверка
    // идёт ДО rate-limit'а, чтобы честный дубль не выглядел отказом.
    if (run.finished) {
      return {
        ok: true,
        runId: run.runId,
        beansGranted: run.beansGranted ?? 0,
        doffaGranted: run.doffaGranted ?? 0,
        rewardStatus: run.rewardStatus,
        flags: run.flags,
        ...state,
      };
    }

    // Rate-limit завершений одного игрока (анти-фарм). Забег НЕ закрывается —
    // как и у awardTraining, награда за эту попытку просто теряется.
    const last = this.lastFinishAward.get(userId) ?? 0;
    const now = this.now();
    if (now - last < RUN_FINISH_MIN_INTERVAL_MS) {
      return { ok: false, reason: 'rate_limited', runId: run.runId, beansGranted: 0, doffaGranted: 0, ...state };
    }

    // Нормализация присланной статистики (клиенту не доверяем — только потолки).
    const roomsCleared = Math.max(0, Math.floor(Number.isFinite(input.roomsCleared) ? input.roomsCleared : 0));
    const durationMs = Math.max(0, Math.floor(Number.isFinite(input.durationMs) ? input.durationMs : 0));
    const miniBossKilled = input.miniBossKilled === true;
    const chapterComplete = input.chapterComplete === true;

    // Потолок правдоподобия: физически нельзя зачистить N комнат быстрее, чем
    // RUN_MIN_SECONDS_PER_ROOM на каждую (с допуском DURATION_MARGIN).
    const minPlausibleMs = roomsCleared * RUN_MIN_SECONDS_PER_ROOM * 1000 * DURATION_MARGIN;
    const flags: string[] = [];
    if (durationMs < minPlausibleMs) flags.push('implausible_duration');
    // Глава не может быть пройдена без единой зачищенной комнаты.
    if (chapterComplete && roomsCleared === 0) flags.push('chapter_without_rooms');

    const suspicious = flags.length > 0;
    // Любой обработанный finish (даже подозрительный) троттлит следующий.
    this.lastFinishAward.set(userId, now);

    // Зёрна считает только сервер; подозрительному забегу — 0 (отказ).
    const beansGranted = suspicious
      ? 0
      : roomsCleared * RUN_BEANS_PER_ROOM +
        (miniBossKilled ? RUN_BEANS_MINI_BOSS : 0) +
        (chapterComplete ? RUN_BEANS_CHAPTER : 0);

    run.finished = true;
    run.finishedAt = now;
    run.roomsCleared = roomsCleared;
    run.miniBossKilled = miniBossKilled;
    run.chapterComplete = chapterComplete;
    run.durationMs = durationMs;
    run.seed = Number.isFinite(input.seed) ? Math.floor(input.seed as number) : undefined;
    run.beansGranted = beansGranted;
    run.doffaGranted = 0;
    run.flags = flags.length > 0 ? flags : undefined;
    run.rewardStatus = 'none';

    // DOFFA — только за пройденную главу и только при кошельке.
    if (chapterComplete && wallet) {
      if (suspicious) {
        // Флаги → review вместо выплаты (как у дуэли): запись для модерации с
        // amount 0 — в дневной лимит не считается (там фильтр amount > 0),
        // pendingDoffa не трогаем, vault/burn не расходуем.
        run.rewardStatus = 'review';
        const reviewRecord: Reward = {
          id: `rw_${randomBytes(9).toString('base64url')}`,
          matchId: `${RUN_REWARD_MATCH_PREFIX}${run.runId}`,
          userId,
          walletAddress: wallet,
          amount: 0,
          status: 'review',
          createdAt: now,
          updatedAt: now,
        };
        await this.repos.rewards.save(reviewRecord);
      } else if (!(await this.chapterDailyLimitReached(userId))) {
        // Лимит глав не исчерпан — считаем награду тем же механизмом, что и
        // за победу в дуэли (внутри — общий дневной лимит наград и учёт vault).
        const computation = await computeWinReward(userId, this.repos);
        if (computation.playerAmount > 0) {
          if (computation.burnAmount > 0) recordBurn(`${RUN_REWARD_MATCH_PREFIX}${run.runId}`, computation.burnAmount);
          run.doffaGranted = computation.playerAmount;
          run.rewardStatus = 'available';
          const reward: Reward = {
            id: `rw_${randomBytes(9).toString('base64url')}`,
            matchId: `${RUN_REWARD_MATCH_PREFIX}${run.runId}`,
            userId,
            walletAddress: wallet,
            amount: computation.playerAmount,
            status: 'available',
            createdAt: now,
            updatedAt: now,
          };
          await this.repos.rewards.save(reward);
          const user = await this.beans.ensureUser(userId, wallet);
          user.pendingDoffa += computation.playerAmount;
          await this.repos.users.upsert(user);
        }
        // reason 'daily_limit' (общая квота наград на сутки исчерпана) или
        // нулевая награда → rewardStatus остаётся 'none', глава даёт только зёрна.
      }
      // Лимит наградных глав исчерпан → rewardStatus 'none', только зёрна.
    }

    if (beansGranted > 0) {
      const user = await this.beans.ensureUser(userId, wallet);
      user.beansBalance += beansGranted;
      await this.repos.users.upsert(user);
    }
    await this.repos.runs.save(run);

    const finalState = await this.beans.getState(userId, wallet);
    return {
      ok: true,
      runId: run.runId,
      beansGranted,
      doffaGranted: run.doffaGranted ?? 0,
      rewardStatus: run.rewardStatus,
      flags: run.flags,
      ...finalState,
    };
  }

  /**
   * Дневной лимит НАГРАДНЫХ глав — тот же механизм и данные, что у дуэльного
   * MAX_REWARDED_WINS_PER_USER_PER_DAY (см. computeWinReward): считаем записи
   * Reward игрока за последние 24ч с amount > 0, но только забеговые
   * (matchId с префиксом "run:"). Общий репозиторий — общее хранилище лимита,
   * параллельного счётчика не заводится.
   */
  private async chapterDailyLimitReached(userId: string): Promise<boolean> {
    if (MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY <= 0) return false;
    const since = this.now() - DAY_MS;
    const chaptersToday = (await this.repos.rewards.listByUser(userId, 200)).filter(
      (r) => r.createdAt >= since && r.amount > 0 && r.matchId.startsWith(RUN_REWARD_MATCH_PREFIX),
    );
    return chaptersToday.length >= MAX_REWARDED_CHAPTERS_PER_USER_PER_DAY;
  }
}
