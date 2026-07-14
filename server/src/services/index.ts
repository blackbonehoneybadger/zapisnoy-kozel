// Composition root DOFFA-экономики. Собирает репозитории, провайдер выплат и
// сервисы в единый набор. Импортируется точкой входа (index.ts) на этапе
// подключения к WebSocket-командам reward:list / reward:claim / reward:status /
// reward:history. Пока не подключён — живой игровой поток не затронут.
import { createRepositories } from '../repositories';
import { createTransactionProvider } from './transactionProvider';
import { RewardService } from './rewardService';
import { ClaimService } from './claimService';
import { BeansService } from './beansService';
import { rewardConfigSummary } from '../config';

export function createEconomy() {
  const repositories = createRepositories();
  const provider = createTransactionProvider();
  const rewards = new RewardService(repositories);
  const claims = new ClaimService(repositories, provider);
  const beans = new BeansService(repositories);
  return { repositories, provider, rewards, claims, beans, summary: rewardConfigSummary() };
}

export type Economy = ReturnType<typeof createEconomy>;
