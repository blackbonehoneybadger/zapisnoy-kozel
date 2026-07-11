// Аккаунты привязаны к адресу кошелька Solana — без логина/пароля.
// Личность доказывается подписью сообщения (см. solana.ts verifySignature).
// Токен сессии подписывается HMAC. Хранение — JSON-файл рядом с сервером.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(here, '..', 'data', 'accounts.json');

const SECRET = process.env.AUTH_SECRET ?? 'zapisnoy-kozel-dev-secret-change-me';

export interface Account {
  /** Адрес кошелька (base58) — он же id пользователя. */
  address: string;
  name: string;
  createdAt: number;
  /** Избранные игроки (адреса) для быстрых приглашений. */
  friends: string[];
}

let accounts: Account[] = [];

function load(): void {
  if (existsSync(DB_PATH)) {
    try {
      accounts = JSON.parse(readFileSync(DB_PATH, 'utf8'));
    } catch {
      accounts = [];
    }
  }
}

function persist(): void {
  try {
    writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error('Не удалось сохранить аккаунты:', e);
  }
}

load();

/** Короткое имя по умолчанию из адреса: 7xKf…9aBc. */
export function shortAddress(address: string): string {
  if (address.length <= 9) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function makeToken(id: string): string {
  const payload = Buffer.from(`${id}.${Date.now()}`).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const id = decoded.split('.')[0];
  return accounts.some((a) => a.address === id) ? id : null;
}

export function accountById(id: string): Account | undefined {
  return accounts.find((a) => a.address === id);
}

/** Находит аккаунт по кошельку или создаёт новый. */
export function upsertByWallet(address: string): Account {
  let account = accounts.find((a) => a.address === address);
  if (!account) {
    account = {
      address,
      name: shortAddress(address),
      createdAt: Date.now(),
      friends: [],
    };
    accounts.push(account);
    persist();
  }
  return account;
}

export function setName(address: string, name: string): Account | undefined {
  const account = accountById(address);
  if (!account) return undefined;
  const clean = name.trim().slice(0, 20);
  account.name = clean || shortAddress(address);
  persist();
  return account;
}

export function addFriend(address: string, friend: string): void {
  const account = accountById(address);
  if (!account || friend === address) return;
  if (!account.friends.includes(friend)) {
    account.friends.push(friend);
    persist();
  }
}

export function removeFriend(address: string, friend: string): void {
  const account = accountById(address);
  if (!account) return;
  account.friends = account.friends.filter((f) => f !== friend);
  persist();
}

export function friendsOf(address: string): string[] {
  return accountById(address)?.friends ?? [];
}

export function tokenFor(id: string): string {
  return makeToken(id);
}
