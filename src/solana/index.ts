import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import type { Cluster } from '@solana/web3.js';

export const SOLANA_NETWORK: Cluster =
  ((import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? 'devnet') as Cluster;

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
