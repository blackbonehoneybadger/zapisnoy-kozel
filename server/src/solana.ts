import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { verify as edVerify } from 'node:crypto';

// По умолчанию — mainnet (реальные SOL). Для тестов: SOLANA_NETWORK=devnet.
const NETWORK = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta';
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl(NETWORK);
export const connection = new Connection(RPC_URL, 'confirmed');

// Комиссия площадки с банка партии (доля). По умолчанию 5%.
export const PLATFORM_FEE = Number(process.env.PLATFORM_FEE ?? '0.05');
// Куда уводить комиссию. Если не задан — остаётся на горячем кошельке сервера.
export const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '';

// Серверный «горячий» кошелёк: собирает ставки, платит выигрыши.
let serverKeypair: Keypair;
const privKeyEnv = process.env.SOLANA_PRIVATE_KEY;

if (privKeyEnv) {
  try {
    if (privKeyEnv.trim().startsWith('[')) {
      serverKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privKeyEnv) as number[]));
    } else {
      serverKeypair = Keypair.fromSecretKey(Buffer.from(privKeyEnv, 'base64'));
    }
  } catch (e) {
    throw new Error(`SOLANA_PRIVATE_KEY задан, но недействителен: ${(e as Error).message}`);
  }
} else if (NETWORK === 'mainnet-beta') {
  // На mainnet нельзя играть с временным кошельком без баланса — падаем явно.
  throw new Error(
    'SOLANA_PRIVATE_KEY обязателен на mainnet-beta (горячий кошелёк для выплат). Задайте переменную окружения.',
  );
} else {
  serverKeypair = Keypair.generate();
  console.log(
    `💡 SOLANA_PRIVATE_KEY не задан (devnet). Временный кошелёк: ${serverKeypair.publicKey.toBase58()}`,
  );
}

export const SERVER_WALLET = serverKeypair.publicKey.toBase58();
console.log(`◎ Solana: сеть ${NETWORK}, кошелёк сервера ${SERVER_WALLET}, комиссия ${PLATFORM_FEE * 100}%`);

/** Проверка подписи сообщения ed25519 (доказательство владения кошельком). */
export function verifySignature(address: string, message: string, signatureB64: string): boolean {
  try {
    const pubkeyBytes = new PublicKey(address).toBytes(); // 32 байта
    const sig = Buffer.from(signatureB64, 'base64');
    if (sig.length !== 64) return false;
    // Оборачиваем сырой ed25519-ключ в SPKI DER для node:crypto.
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

export async function sendSol(toAddress: string, lamports: number): Promise<string> {
  const to = new PublicKey(toAddress);
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: serverKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: serverKeypair.publicKey,
      toPubkey: to,
      lamports,
    }),
  );
  tx.sign(serverKeypair);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

export async function verifyPayment(
  signature: string,
  expectedFrom: string,
  expectedTo: string,
  expectedLamports: number,
): Promise<boolean> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) return false;

    const accounts = tx.transaction.message.staticAccountKeys ?? [];
    const fromIdx = accounts.findIndex((k) => k.toString() === expectedFrom);
    const toIdx = accounts.findIndex((k) => k.toString() === expectedTo);
    // Обязательно: и плательщик, и получатель (кошелёк сервера) присутствуют.
    if (fromIdx === -1 || toIdx === -1) return false;

    const pre = tx.meta?.preBalances ?? [];
    const post = tx.meta?.postBalances ?? [];
    const spent = (pre[fromIdx] ?? 0) - (post[fromIdx] ?? 0);
    const received = (post[toIdx] ?? 0) - (pre[toIdx] ?? 0);

    // Деньги действительно ушли от игрока И пришли на кошелёк сервера.
    return spent >= expectedLamports && received >= expectedLamports;
  } catch {
    return false;
  }
}
