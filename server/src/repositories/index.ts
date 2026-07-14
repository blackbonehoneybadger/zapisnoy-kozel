/** Выбор хранилища: Postgres если DATABASE_URL/POSTGRES_URL, иначе JSON-файлы. */
import { loadEnv } from '../env';
import { createFileRepositories } from './fileRepositories';
import { createPgRepositories } from './pgRepositories';
import type { Repositories } from './types';

export function createRepositories(): Repositories {
  const url = (loadEnv().DATABASE_URL || loadEnv().POSTGRES_URL || '').trim();
  if (url) {
    console.log('◎ Repositories: PostgreSQL (DATABASE_URL)');
    return createPgRepositories(url);
  }
  console.log('◎ Repositories: file JSON (server/data/doffa-*.json)');
  return createFileRepositories();
}

export type { Repositories } from './types';
