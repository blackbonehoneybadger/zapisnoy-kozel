// Сервис зёрен (этап 3): авторитетный баланс зёрен + энергии тапалки на
// сервере. Клиент тапает оптимистично для отзывчивости (см. src/store/
// beansStore.ts), но периодически шлёт партию тапов на сверку — сервер
// сам считает регенерацию энергии по своим часам и урезает отчёт клиента
// до правдоподобного максимума, прежде чем зачислить зёрна. Это не полная
// детерминированная симуляция (не пересчитывает комбо/золотые зёрна тап-в-
// тап — это убило бы отзывчивость тапалки сетевой задержкой), а разумный
// анти-чит потолок: см. docs/ANTI_CHEAT.md.
import type { DoffaUser } from '../domain/types';
import type { Repositories } from '../repositories/types';

/** Максимум энергии. Должно совпадать с клиентским ENERGY_MAX (beansStore.ts). */
export const ENERGY_MAX = 1000;
/** Энергия восстанавливается на 1 каждые N мс. Должно совпадать с клиентом. */
export const ENERGY_REGEN_MS = 3600;
/** Минимальный физически правдоподобный интервал между тапами (мс). */
const MIN_TAP_INTERVAL_MS = 70;
/** Потолок зёрен за один тап (макс. комбо ×5 + шанс золотого зерна +24). */
const MAX_BEANS_PER_TAP = 29;
/** Тренировочные зёрна за офлайн-партию против ботов. */
export const TRAINING_BEANS_PER_GAME = 10;
/** Тренировочные зёрна сверху за офлайн-победу. */
export const TRAINING_BEANS_PER_WIN = 25;
/** Минимальный интервал между начислениями тренировочных зёрен одному игроку. */
const MIN_TRAINING_INTERVAL_MS = 15_000;

export interface BeansState {
  beans: number;
  energy: number;
}

function toState(user: DoffaUser): BeansState {
  return { beans: user.beansBalance, energy: user.energy };
}

export class BeansService {
  // Античит-лимит частоты тренировочных наград — в памяти процесса, не
  // персистентно (переживать перезапуск сервера не обязано, это лишь троттлинг).
  private readonly lastTrainingAward = new Map<string, number>();

  constructor(private readonly repos: Repositories, private readonly now: () => number = Date.now) {}

  /** Гарантирует существование пользователя с корректными полями зёрен/энергии. */
  async ensureUser(userId: string, wallet?: string): Promise<DoffaUser> {
    let user = await this.repos.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        walletAddress: wallet,
        beansBalance: 0,
        energy: ENERGY_MAX,
        lastEnergyTs: this.now(),
        pendingDoffa: 0,
        claimedDoffa: 0,
        createdAt: this.now(),
        banned: false,
      };
      await this.repos.users.upsert(user);
    } else if (wallet && user.walletAddress !== wallet) {
      user.walletAddress = wallet;
      await this.repos.users.upsert(user);
    }
    return user;
  }

  /** Пересчитывает регенерацию энергии по серверным часам (без начисления зёрен). */
  private regen(user: DoffaUser): DoffaUser {
    if (user.energy >= ENERGY_MAX) {
      user.lastEnergyTs = this.now();
      return user;
    }
    const elapsed = this.now() - user.lastEnergyTs;
    const restored = Math.floor(elapsed / ENERGY_REGEN_MS);
    if (restored > 0) {
      user.energy = Math.min(ENERGY_MAX, user.energy + restored);
      user.lastEnergyTs = user.lastEnergyTs + restored * ENERGY_REGEN_MS;
    }
    return user;
  }

  /** Текущий авторитетный баланс (с регеном по факту запроса). */
  async getState(userId: string, wallet?: string): Promise<BeansState> {
    const user = this.regen(await this.ensureUser(userId, wallet));
    await this.repos.users.upsert(user);
    return toState(user);
  }

  /**
   * Сверка партии тапов от клиента. `tapped` — сколько тапов клиент насчитал
   * с прошлой сверки, `claimedGain` — сколько зёрен клиент начислил себе за
   * них локально, `elapsedMs` — сколько реального времени прошло. Сервер
   * урезает и то, и другое до правдоподобного максимума по своим часам,
   * прежде чем применить.
   */
  async applyTapSync(
    userId: string,
    wallet: string | undefined,
    tapped: number,
    claimedGain: number,
    elapsedMs: number,
  ): Promise<BeansState> {
    const user = this.regen(await this.ensureUser(userId, wallet));

    const safeTapped = Math.max(0, Math.floor(Number.isFinite(tapped) ? tapped : 0));
    const safeElapsed = Math.max(0, Math.floor(Number.isFinite(elapsedMs) ? elapsedMs : 0));
    const safeClaimed = Math.max(0, Math.floor(Number.isFinite(claimedGain) ? claimedGain : 0));

    // Потолок №1: физически невозможно натапать больше, чем позволяет время.
    const maxByTime = safeElapsed > 0 ? Math.ceil(safeElapsed / MIN_TAP_INTERVAL_MS) : safeTapped;
    // Потолок №2: не больше, чем накоплено энергии на сервере.
    const grantedTaps = Math.min(safeTapped, maxByTime, user.energy);
    // Потолок №3: зёрна за тап ограничены максимумом комбо+бонуса.
    const maxBeans = grantedTaps * MAX_BEANS_PER_TAP;
    const grantedBeans = Math.min(safeClaimed, maxBeans);

    user.energy = Math.max(0, user.energy - grantedTaps);
    user.beansBalance += grantedBeans;
    await this.repos.users.upsert(user);
    return toState(user);
  }

  /**
   * Тренировочные зёрна за офлайн-партию против ботов. Только сервер решает
   * сумму и может отказать (rate-limit) — клиент никогда не начисляет их сам.
   */
  async awardTraining(userId: string, wallet: string | undefined, won: boolean): Promise<{ granted: number } & BeansState> {
    const user = this.regen(await this.ensureUser(userId, wallet));

    const last = this.lastTrainingAward.get(userId) ?? 0;
    const now = this.now();
    if (now - last < MIN_TRAINING_INTERVAL_MS) {
      return { granted: 0, ...toState(user) };
    }
    this.lastTrainingAward.set(userId, now);

    const granted = TRAINING_BEANS_PER_GAME + (won ? TRAINING_BEANS_PER_WIN : 0);
    user.beansBalance += granted;
    await this.repos.users.upsert(user);
    return { granted, ...toState(user) };
  }

  /** Атомарно списывает плату за вход, если хватает баланса. */
  async chargeEntry(userId: string, wallet: string | undefined, amount: number): Promise<BeansState | null> {
    const user = this.regen(await this.ensureUser(userId, wallet));
    if (user.beansBalance < amount) {
      await this.repos.users.upsert(user); // сохраняем реген, даже если списание не прошло
      return null;
    }
    user.beansBalance -= amount;
    await this.repos.users.upsert(user);
    return toState(user);
  }

  /** Возвращает ранее списанную плату за вход (матч не состоялся). */
  async refundEntry(userId: string, wallet: string | undefined, amount: number): Promise<BeansState> {
    const user = await this.ensureUser(userId, wallet);
    user.beansBalance += amount;
    await this.repos.users.upsert(user);
    return toState(user);
  }
}
