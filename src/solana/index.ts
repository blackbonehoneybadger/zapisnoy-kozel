import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import type { Cluster } from '@solana/web3.js';

// Значение из env обязательно чистим и валидируем: кривая вставка в Vercel
// (пробелы/переводы строки) заставляла clusterApiUrl бросать исключение на
// уровне модуля — всё приложение падало в чёрный экран до первого кадра.
const rawNetwork = ((import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? 'devnet').trim();
const KNOWN_CLUSTERS = ['devnet', 'testnet', 'mainnet-beta'] as const;
export const SOLANA_NETWORK: Cluster = (
  (KNOWN_CLUSTERS as readonly string[]).includes(rawNetwork) ? rawNetwork : 'devnet'
) as Cluster;

export const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), 'confirmed');

export interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString(): string; toBytes(): Uint8Array } | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string; toBytes(): Uint8Array } }>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  signMessage(msg: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    solflare?: PhantomProvider;
  }
}

export function getProvider(): PhantomProvider | null {
  return window.solana ?? window.solflare ?? null;
}

export { PublicKey, Transaction };
