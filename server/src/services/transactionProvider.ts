// Провайдер отправки токена DOFFA. Абстракция, чтобы Claim-сервис не зависел
// от способа выплаты.
//
//   MockTransactionProvider  — этап 4: НИЧЕГО не отправляет в сеть, возвращает
//                              явно тестовую подпись. Используется, пока
//                              DOFFA_CLAIM_ENABLED=false.
//   SolanaSplTransactionProvider — этап 5: реальная SPL-выплата с hot wallet.
//                              Требует @solana/spl-token, associated token
//                              accounts и настроенный Reward Vault. Включается
//                              только при DOFFA_CLAIM_ENABLED=true.
import { randomBytes } from 'node:crypto';
import { DOFFA_CLAIM_ENABLED, DOFFA_REWARD_WALLET_ADDRESS, DOFFA_REWARD_WALLET_PRIVATE_KEY } from '../config';

export interface SendResult {
  signature: string;
  /** true — реальная транзакция в сети; false — тестовая (mock). */
  onChain: boolean;
}

export interface TransactionProvider {
  readonly kind: 'mock' | 'solana-spl';
  /** Достаточно ли средств/готовности для выплаты (баланс hot wallet и т.п.). */
  canPayout(amount: number): Promise<boolean>;
  /** Отправить `amount` DOFFA на `toWallet`. Бросает при ошибке. */
  sendReward(toWallet: string, amount: number): Promise<SendResult>;
}

/** Тестовый провайдер: токены не двигаются, подпись помечена как mock. */
export class MockTransactionProvider implements TransactionProvider {
  readonly kind = 'mock' as const;
  async canPayout(): Promise<boolean> {
    return true;
  }
  async sendReward(_toWallet: string, _amount: number): Promise<SendResult> {
    // Явно тестовая «подпись», чтобы её нельзя было принять за реальную.
    return { signature: `MOCK_${randomBytes(24).toString('base64url')}`, onChain: false };
  }
}

/**
 * Заглушка реального SPL-провайдера (этап 5). Пока не реализована выплата
 * SPL-токена: нужна зависимость @solana/spl-token, ATA получателя и рабочий
 * Reward Vault. Оставлена как точка расширения; при вызове честно сообщает,
 * что реальные выплаты ещё не подключены.
 */
export class SolanaSplTransactionProvider implements TransactionProvider {
  readonly kind = 'solana-spl' as const;
  async canPayout(): Promise<boolean> {
    return false;
  }
  async sendReward(_toWallet: string, _amount: number): Promise<SendResult> {
    throw new Error('SPL-выплата DOFFA ещё не реализована (этап 5): подключите @solana/spl-token и Reward Vault.');
  }
}

/**
 * Выбирает провайдера по конфигурации. Реальный провайдер включается ТОЛЬКО
 * при DOFFA_CLAIM_ENABLED=true и заданном горячем кошельке; иначе — mock.
 */
export function createTransactionProvider(): TransactionProvider {
  const ready = DOFFA_CLAIM_ENABLED && !!DOFFA_REWARD_WALLET_PRIVATE_KEY && !!DOFFA_REWARD_WALLET_ADDRESS;
  return ready ? new SolanaSplTransactionProvider() : new MockTransactionProvider();
}
