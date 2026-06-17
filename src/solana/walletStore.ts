import { create } from 'zustand';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { connection, getProvider } from './index';

interface WalletStore {
  address: string | null;
  balance: number | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  sendBet: (toAddress: string, lamports: number) => Promise<string>;
  /** Подписать произвольное сообщение (для входа). Возвращает подпись в base64. */
  signMessage: (message: string) => Promise<string>;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  address: null,
  balance: null,
  connecting: false,
  error: null,

  connect: async () => {
    const provider = getProvider();
    if (!provider) {
      set({ error: 'Установите Phantom или Solflare кошелёк' });
      return;
    }
    set({ connecting: true, error: null });
    try {
      const resp = await provider.connect();
      const address = resp.publicKey.toString();
      set({ address, connecting: false, error: null });
      await get().refreshBalance();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка подключения кошелька';
      set({ connecting: false, error: msg });
    }
  },

  disconnect: () => {
    const provider = getProvider();
    provider?.disconnect().catch(() => null);
    set({ address: null, balance: null, error: null });
  },

  refreshBalance: async () => {
    const { address } = get();
    if (!address) return;
    try {
      const lamports = await connection.getBalance(new PublicKey(address));
      set({ balance: lamports / 1_000_000_000 });
    } catch {
      // silently fail — network may be unavailable
    }
  },

  sendBet: async (toAddress: string, lamports: number): Promise<string> => {
    const { address } = get();
    const provider = getProvider();
    if (!provider || !address) throw new Error('Кошелёк не подключён');

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: new PublicKey(address),
    }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(address),
        toPubkey: new PublicKey(toAddress),
        lamports,
      }),
    );

    const signed = await provider.signTransaction(tx);
    const rawTx = signed.serialize();
    const signature = await connection.sendRawTransaction(rawTx);
    await connection.confirmTransaction(signature, 'confirmed');

    // Refresh balance after bet
    await get().refreshBalance();

    return signature;
  },

  signMessage: async (message: string): Promise<string> => {
    const provider = getProvider();
    const { address } = get();
    if (!provider || !address) throw new Error('Кошелёк не подключён');
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded, 'utf8');
    let bin = '';
    signature.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  },
}));
