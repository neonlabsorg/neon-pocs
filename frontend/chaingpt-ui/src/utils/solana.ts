import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  RpcResponseAndContext,
  SendOptions,
  Signer,
  SimulatedTransactionResponse,
  Transaction
} from '@solana/web3.js';
import { delay, log, logJson, SolanaTransactionSignature } from '@neonevm/solana-sign';
import { solanaTransactionLog } from '@neonevm/token-transfer-core';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { hexlify, zeroPadValue } from 'ethers';

export async function solanaAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  lamports: number,
  commitment: Commitment = 'finalized'
): Promise<number> {
  let balance = await connection.getBalance(publicKey);
  if (balance < lamports) {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature, commitment);
    balance = await connection.getBalance(publicKey);
  }
  log(`${publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}

export async function sendSolanaTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
  confirm = false,
  options?: SendOptions,
  name = ''
): Promise<SolanaTransactionSignature> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.sign(...signers);
  const { value } = await simulateTransaction(connection, transaction);
  logJson(value.err);
  logJson(value.logs);
  solanaTransactionLog(transaction);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  if (confirm) {
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
  }
  log(`Transaction${name ? ` ${name}` : ''} signature: ${signature}`);
  log(
    `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${process.env.SOLANA_URL}`
  );
  return { signature, blockhash, lastValidBlockHeight };
}

export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment = 'confirmed'
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  if (!transaction.recentBlockhash) {
    const { blockhash } = await connection.getLatestBlockhash(commitment);
    transaction.recentBlockhash = blockhash;
  }
  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString('base64');
  const config = { encoding: 'base64', commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args);
  if (res.error) {
    throw new Error(`failed to simulate transaction: ${res.error.message}`);
  }
  return res.result;
}

export function pubkeyToBytes32(pubkey: PublicKey): string {
  return zeroPadValue(hexlify(pubkey.toBytes()), 32);
}

export async function createAssociatedTokenAccount(
  connection: Connection,
  signer: Keypair,
  ownerKey: PublicKey,
  ataSolanaWallet: PublicKey,
  tokenMint: PublicKey
) {
  const account = await connection.getAccountInfo(ataSolanaWallet);
  if (!account) {
    console.log(`Create ATA for ${ownerKey.toBase58()}`);
    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        signer.publicKey,
        ataSolanaWallet,
        ownerKey,
        tokenMint
      )
    );
    await sendSolanaTransaction(connection, transaction, [signer]);
    await delay(10e3);
  } else {
    console.log(
      `Token account (${ataSolanaWallet.toBase58()}) for ${ownerKey.toBase58()} already exist...`
    );
  }
}
