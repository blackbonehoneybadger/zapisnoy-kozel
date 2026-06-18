#!/usr/bin/env node
/**
 * Утилиты для серверного кошелька Koziol.
 * Использование:
 *   node scripts/solana-wallet.mjs balance [address] [network]
 *   node scripts/solana-wallet.mjs generate
 *   node scripts/solana-wallet.mjs address <json-array-key>
 */
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';

const [,, cmd, arg1, arg2] = process.argv;

if (cmd === 'generate') {
  const kp = Keypair.generate();
  const arr = JSON.stringify(Array.from(kp.secretKey));
  console.log('\n=== Новый Solana кошелёк ===');
  console.log('Адрес:    ', kp.publicKey.toBase58());
  console.log('\nSolana_PRIVATE_KEY для Railway:');
  console.log(arr);
  console.log('\n⚠️  Сохрани приватный ключ — потеряешь ключ, потеряешь все SOL на нём.');

} else if (cmd === 'balance') {
  const address = arg1;
  const network = arg2 || 'mainnet-beta';
  if (!address) { console.error('Usage: node scripts/solana-wallet.mjs balance <address> [devnet|mainnet-beta]'); process.exit(1); }
  const conn = new Connection(clusterApiUrl(network), 'confirmed');
  const bal = await conn.getBalance(new PublicKey(address));
  console.log(`${address}`);
  console.log(`Баланс: ${bal / LAMPORTS_PER_SOL} SOL (${network})`);

} else if (cmd === 'address') {
  const keyJson = arg1;
  if (!keyJson) { console.error('Usage: node scripts/solana-wallet.mjs address <[1,2,3,...]>'); process.exit(1); }
  const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keyJson)));
  console.log('Адрес:', kp.publicKey.toBase58());

} else {
  console.log('Команды: generate | balance <addr> [network] | address <key>');
}
