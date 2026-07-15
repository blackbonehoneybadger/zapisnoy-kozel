// Файловая реализация репозиториев (этап 9, временная). Каждая коллекция —
// JSON-файл в server/data/. Запись сериализуется, чтобы не терять данные при
// одновременных изменениях в одном процессе. Это НЕ production-хранилище: при
// росте нагрузки заменяется на PostgreSQL (интерфейсы в types.ts не меняются).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ClaimRecord, DoffaUser, MatchResult, Reward } from '../domain/types';
import type {
  ClaimRepository,
  MatchRepository,
  Repositories,
  RewardRepository,
  UserRepository,
} from './types';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, '..', '..', 'data');

/** Простое JSON-хранилище коллекции с сериализованной записью. */
class JsonCollection<T> {
  private items: T[] = [];
  private readonly path: string;
  private writing: Promise<void> = Promise.resolve();

  constructor(fileName: string, private readonly idOf: (item: T) => string) {
    this.path = resolve(DATA_DIR, fileName);
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      if (existsSync(this.path)) this.items = JSON.parse(readFileSync(this.path, 'utf8')) as T[];
    } catch {
      this.items = [];
    }
  }

  private persist(): Promise<void> {
    // Сериализуем записи: следующая ждёт предыдущую, снимок берём на момент записи.
    this.writing = this.writing.then(
      () =>
        new Promise<void>((done) => {
          try {
            writeFileSync(this.path, JSON.stringify(this.items, null, 2));
          } catch (e) {
            console.error(`Не удалось сохранить ${this.path}:`, e);
          }
          done();
        }),
    );
    return this.writing;
  }

  all(): T[] {
    return this.items;
  }

  find(id: string): T | undefined {
    return this.items.find((i) => this.idOf(i) === id);
  }

  async upsert(item: T): Promise<T> {
    const id = this.idOf(item);
    const idx = this.items.findIndex((i) => this.idOf(i) === id);
    if (idx === -1) this.items.push(item);
    else this.items[idx] = item;
    await this.persist();
    return item;
  }
}

class FileUserRepository implements UserRepository {
  constructor(private readonly c: JsonCollection<DoffaUser>) {}
  async get(id: string) {
    return this.c.find(id);
  }
  async getByWallet(wallet: string) {
    return this.c.all().find((u) => u.walletAddress === wallet);
  }
  async upsert(user: DoffaUser) {
    return this.c.upsert(user);
  }
  async adjustCups(id: string, delta: number) {
    const user = this.c.find(id);
    if (!user) return undefined;
    user.cupsBalance = Math.max(0, user.cupsBalance + delta);
    return this.c.upsert(user);
  }
}

class FileMatchRepository implements MatchRepository {
  constructor(private readonly c: JsonCollection<MatchResult>) {}
  async get(matchId: string) {
    return this.c.find(matchId);
  }
  async save(match: MatchResult) {
    return this.c.upsert(match);
  }
  async listByUser(userId: string, limit = 50) {
    return this.c
      .all()
      .filter((m) => m.players.includes(userId))
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, limit);
  }
}

class FileRewardRepository implements RewardRepository {
  constructor(private readonly c: JsonCollection<Reward>) {}
  async get(id: string) {
    return this.c.find(id);
  }
  async getByMatch(matchId: string) {
    return this.c.all().find((r) => r.matchId === matchId);
  }
  async listAvailable(userId: string) {
    return this.c.all().filter((r) => r.userId === userId && r.status === 'available');
  }
  async listByUser(userId: string, limit = 50) {
    return this.c
      .all()
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
  async save(reward: Reward) {
    return this.c.upsert(reward);
  }
}

class FileClaimRepository implements ClaimRepository {
  constructor(private readonly c: JsonCollection<ClaimRecord>) {}
  async get(id: string) {
    return this.c.find(id);
  }
  async getByReward(rewardId: string) {
    return this.c.all().find((cl) => cl.rewardId === rewardId);
  }
  async getByIdempotencyKey(key: string) {
    return this.c.all().find((cl) => cl.idempotencyKey === key);
  }
  async listByUser(userId: string, limit = 50) {
    return this.c
      .all()
      .filter((cl) => cl.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
  async save(claim: ClaimRecord) {
    return this.c.upsert(claim);
  }
}

/** Собирает файловые репозитории. Точка замены на PostgreSQL-реализацию. */
export function createFileRepositories(): Repositories {
  return {
    users: new FileUserRepository(new JsonCollection<DoffaUser>('doffa-users.json', (u) => u.id)),
    matches: new FileMatchRepository(new JsonCollection<MatchResult>('doffa-matches.json', (m) => m.matchId)),
    rewards: new FileRewardRepository(new JsonCollection<Reward>('doffa-rewards.json', (r) => r.id)),
    claims: new FileClaimRepository(new JsonCollection<ClaimRecord>('doffa-claims.json', (c) => c.id)),
  };
}
