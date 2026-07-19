// Composition root DOFFA-экономики. Собирает репозитории, провайдер выплат и
// сервисы в единый набор. Импортируется точкой входа (index.ts) на этапе
// подключения к WebSocket-командам reward:list / reward:claim / reward:status /
// reward:history. Пока не подключён — живой игровой поток не затронут.
import { createFileRepositories } from '../repositories/fileRepositories';
import { createTransactionProvider } from './transactionProvider';
import { RewardService } from './rewardService';
import { ClaimService } from './claimService';
import { BeansService } from './beansService';
import { RunService } from './runService';
import { rewardConfigSummary } from '../config';

export function createEconomy() {
  const repositories = createFileRepositories();
  const provider = createTransactionProvider();
  const rewards = new RewardService(repositories);
  const claims = new ClaimService(repositories, provider);
  const beans = new BeansService(repositories);
  const runs = new RunService(repositories, beans);
  return { repositories, provider, rewards, claims, beans, runs, summary: rewardConfigSummary() };
}

export type Economy = ReturnType<typeof createEconomy>;
