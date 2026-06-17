import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

const NETWORK = (process.env.SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta';
export const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');

// Load or generate server keypair
let serverKeypair: Keypair;
const privKeyEnv = process.env.SOLANA_PRIVATE_KEY;

if (privKeyEnv) {
  try {
    if (privKeyEnv.startsWith('[')) {
      // JSON array format: [1,2,3,...64 bytes]
      serverKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privKeyEnv) as number[]));
    } else {
      // Base64 format
      serverKeypair = Keypair.fromSecretKey(Buffer.from(privKeyEnv, 'base64'));
    }
  } catch {
    serverKeypair = Keypair.generate();
    console.log(`⚠  SOLANA_PRIVATE_KEY недействителен, сгенерирован новый ключ`);
  }
} else {
  serverKeypair = Keypair.generate();
  console.log(
    `💡 SOLANA_PRIVATE_KEY не задан. Сгенерирован временный кошелёк: ${serverKeypair.publicKey.toBase58()}`,
  );
  console.log(`   Установите SOLANA_PRIVATE_KEY для сохранения средств между перезапусками.`);
}

export const SERVER_WALLET = serverKeypair.publicKey.toBase58();

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
  expectedLamports: number,
): Promise<boolean> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) return false;

    // Check that fromAddress is in accountKeys and lamports match roughly
    const accounts = tx.transaction.message.staticAccountKeys ?? [];
    const fromIdx = accounts.findIndex((k) => k.toString() === expectedFrom);
    if (fromIdx === -1) return false;

    const preBalance = tx.meta?.preBalances?.[fromIdx] ?? 0;
    const postBalance = tx.meta?.postBalances?.[fromIdx] ?? 0;
    const spent = preBalance - postBalance;

    return spent >= expectedLamports; // allow for fees
  } catch {
    return false;
  }
}
