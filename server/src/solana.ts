import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { verify as edVerify } from 'node:crypto';
import { loadEnv, solStakesEnabled } from './env';

function rpcUrl(): string {
  const e = loadEnv();
  return e.SOLANA_RPC_URL || clusterApiUrl(e.SOLANA_NETWORK);
}

let _connection: Connection | null = null;
export function getConnection(): Connection {
  if (!_connection) _connection = new Connection(rpcUrl(), 'confirmed');
  return _connection;
}

/** @deprecated Предпочитайте getConnection(). Proxy для старых импортов. */
export const connection = new Proxy({} as Connection, {
  get(_t, prop, receiver) {
    return Reflect.get(getConnection(), prop, receiver);
  },
});

export function getPlatformFee(): number {
  return loadEnv().PLATFORM_FEE;
}

export function getPlatformWallet(): string {
  return loadEnv().PLATFORM_WALLET;
}

/** Совместимость: снимок при первом импорте. Предпочитайте getPlatformFee(). */
export const PLATFORM_FEE = loadEnv().PLATFORM_FEE;
export const PLATFORM_WALLET = loadEnv().PLATFORM_WALLET;

let serverKeypair: Keypair | null = null;
let loggedWallet = false;

function ensureKeypair(): Keypair {
  if (serverKeypair) return serverKeypair;

  const e = loadEnv();
  const privKeyEnv = e.SOLANA_PRIVATE_KEY.trim();

  if (privKeyEnv) {
    try {
      if (privKeyEnv.startsWith('[')) {
        serverKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privKeyEnv) as number[]));
      } else {
        serverKeypair = Keypair.fromSecretKey(Buffer.from(privKeyEnv, 'base64'));
      }
    } catch (err) {
      throw new Error(`SOLANA_PRIVATE_KEY задан, но недействителен: ${(err as Error).message}`);
    }
  } else if (e.SOLANA_NETWORK === 'mainnet-beta' && (e.SOL_STAKES_ENABLED || e.DOFFA_CLAIM_ENABLED)) {
    throw new Error(
      'SOLANA_PRIVATE_KEY обязателен на mainnet-beta при SOL_STAKES_ENABLED или DOFFA_CLAIM_ENABLED.',
    );
  } else {
    serverKeypair = Keypair.generate();
    console.log(
      `💡 SOLANA_PRIVATE_KEY не задан (${e.SOLANA_NETWORK}, stakes=${e.SOL_STAKES_ENABLED}). Временный кошелёк: ${serverKeypair.publicKey.toBase58()}`,
    );
  }

  if (!loggedWallet) {
    loggedWallet = true;
    console.log(
      `◎ Solana: сеть ${e.SOLANA_NETWORK}, кошелёк сервера ${serverKeypair.publicKey.toBase58()}, комиссия ${e.PLATFORM_FEE * 100}%, stakes=${e.SOL_STAKES_ENABLED}`,
    );
  }
  return serverKeypair;
}

export function getServerWallet(): string {
  return ensureKeypair().publicKey.toBase58();
}

/** Проверка подписи сообщения ed25519 (доказательство владения кошельком). */
export function verifySignature(address: string, message: string, signatureB64: string): boolean {
  try {
    const pubkeyBytes = new PublicKey(address).toBytes();
    const sig = Buffer.from(signatureB64, 'base64');
    if (sig.length !== 64) return false;
    const der = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(pubkeyBytes),
    ]);
    const keyObject = {
      key: der,
      format: 'der' as const,
      type: 'spki' as const,
    };
    return edVerify(null, Buffer.from(message, 'utf8'), keyObject, sig);
  } catch {
    return false;
  }
}

function assertStakesEnabled(op: string): void {
  if (!solStakesEnabled()) {
    throw new Error(`SOL stakes отключены (SOL_STAKES_ENABLED=false): ${op}`);
  }
}

export async function sendSol(toAddress: string, lamports: number): Promise<string> {
  assertStakesEnabled('sendSol');
  const kp = ensureKeypair();
  const to = new PublicKey(toAddress);
  const { blockhash } = await getConnection().getLatestBlockhash();
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: kp.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: to,
      lamports,
    }),
  );
  tx.sign(kp);
  const signature = await getConnection().sendRawTransaction(tx.serialize());
  try {
    await getConnection().confirmTransaction(signature, 'confirmed');
  } catch (e) {
    const st = await getConnection().getSignatureStatuses([signature]);
    const info = st.value[0];
    const landed =
      !!info &&
      !info.err &&
      (info.confirmationStatus === 'confirmed' || info.confirmationStatus === 'finalized');
    if (!landed) {
      const err = new Error(`Выплата не подтверждена: ${(e as Error).message}`) as Error & {
        signature?: string;
      };
      err.signature = signature;
      throw err;
    }
  }
  return signature;
}

export async function verifyPayment(
  signature: string,
  expectedFrom: string,
  expectedTo: string,
  expectedLamports: number,
): Promise<boolean> {
  if (!solStakesEnabled()) return false;
  try {
    const tx = await getConnection().getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) return false;

    const accounts = tx.transaction.message.staticAccountKeys ?? [];
    const fromIdx = accounts.findIndex((k) => k.toString() === expectedFrom);
    const toIdx = accounts.findIndex((k) => k.toString() === expectedTo);
    if (fromIdx === -1 || toIdx === -1) return false;

    const pre = tx.meta?.preBalances ?? [];
    const post = tx.meta?.postBalances ?? [];
    const spent = (pre[fromIdx] ?? 0) - (post[fromIdx] ?? 0);
    const received = (post[toIdx] ?? 0) - (pre[toIdx] ?? 0);

    return spent >= expectedLamports && received >= expectedLamports;
  } catch {
    return false;
  }
}

export function solanaNetwork(): 'devnet' | 'mainnet-beta' {
  return loadEnv().SOLANA_NETWORK;
}
