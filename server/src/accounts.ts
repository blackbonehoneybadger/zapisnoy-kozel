// Аккаунты: регистрация, вход, токены. Без внешних зависимостей —
// хеширование scrypt и подпись токенов HMAC из встроенного node:crypto.
// Пользователи хранятся в JSON-файле рядом с сервером.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(here, '..', 'data', 'accounts.json');

// Секрет для подписи токенов. В проде задаётся через переменную окружения.
const SECRET = process.env.AUTH_SECRET ?? 'zapisnoy-kozel-dev-secret-change-me';

export interface Account {
  id: string;
  name: string;
  nameLower: string;
  salt: string;
  hash: string;
  createdAt: number;
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

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
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
  return accounts.some((a) => a.id === id) ? id : null;
}

export function accountById(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export interface AuthResult {
  ok: boolean;
  message?: string;
  account?: Account;
  token?: string;
}

export function register(name: string, password: string): AuthResult {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return { ok: false, message: 'Имя: от 2 до 20 символов' };
  }
  if (password.length < 4) {
    return { ok: false, message: 'Пароль: минимум 4 символа' };
  }
  if (accounts.some((a) => a.nameLower === trimmed.toLowerCase())) {
    return { ok: false, message: 'Это имя уже занято' };
  }
  const salt = randomBytes(16).toString('hex');
  const account: Account = {
    id: randomBytes(9).toString('base64url'),
    name: trimmed,
    nameLower: trimmed.toLowerCase(),
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
  accounts.push(account);
  persist();
  return { ok: true, account, token: makeToken(account.id) };
}

export function login(name: string, password: string): AuthResult {
  const account = accounts.find((a) => a.nameLower === name.trim().toLowerCase());
  if (!account) return { ok: false, message: 'Неверное имя или пароль' };
  const candidate = hashPassword(password, account.salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(account.hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, message: 'Неверное имя или пароль' };
  }
  return { ok: true, account, token: makeToken(account.id) };
}

export function tokenFor(id: string): string {
  return makeToken(id);
}
