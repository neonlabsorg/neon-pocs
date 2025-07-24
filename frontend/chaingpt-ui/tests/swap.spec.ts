import { afterEach, beforeAll, describe, it } from '@jest/globals';
import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  delay,
  log,
  logJson,
  NeonAddress,
  NeonProxyRpcApi,
  PreparatorySolanaTransaction,
  prepareSolanaInstruction,
  ScheduledTransaction,
  ScheduledTreeAccount,
  solanaAirdrop,
  SolanaNeonAccount,
  TransactionData
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { config } from 'dotenv';
import process from 'node:process';
import bs58 from 'bs58';
import {
  approveTokensForSwapTransactionData,
  approveTokenV1Instruction,
  approveTokenV2Instruction,
  pancakeSwapTransactionData,
  transferTokenToNeonTransactionData,
  transferTokenToSolanaTransactionData
} from '../src/api/swap';
import { PancakePair, SwapTokenData } from '../src/models';
import {
  sendSolanaTransaction,
  tokenAccountBalance,
  transferTokenToMemberWallet
} from '../src/utils/solana';
import { tokens } from '../src/data/tokens';

config({ path: './tests/.env' });

const { swap, tokensV2, tokensV1 } = tokens(process.env.PROXY_ENV!);

const NEON_API_RPC_SOL_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

const DURATION = 3e5;
const DELAY = 1e3;

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let solanaUser: SolanaNeonAccount;
let signer: Signer;
let chainId: number;

const solanaPayer = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));

beforeAll(async () => {
  const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));// new Keypair();
  connection = new Connection(SOLANA_URL);
  proxyApi = new NeonProxyRpcApi(NEON_API_RPC_SOL_URL);
  const params = await proxyApi.init(keypair);
  neonEvmProgram = params.programAddress;
  chainId = params.chainId;
  solanaUser = params.solanaUser;
  signer = solanaUser.signer!;

  await solanaAirdrop(connection, keypair.publicKey, 1e9);
  for (const token of tokensV2) {
    await transferTokenToMemberWallet(connection, solanaPayer, keypair.publicKey, token, 1);
  }
});

afterEach(async () => {
  await delay(1e3);
});

describe('Check Swap with Solana singer', () => {
  it(`Should Swap tokens v1 (from, to) with gas fee estimation`, async () => {
    const [tokenFrom, tokenTo] = tokensV1;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));

    const params: SwapTokenData = {
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId
    };

    const claimTransaction = transferTokenToNeonTransactionData(params);
    const approveSwapTransaction = approveTokensForSwapTransactionData(params);
    const swapTransaction = pancakeSwapTransactionData(params);
    const transferSolanaTransaction = await transferTokenToSolanaTransactionData(params);

    const approveInstruction = await approveTokenV1Instruction(connection, solanaUser, neonEvmProgram, tokenFrom, amountFrom);

    const preparatorySolanaTransactions: PreparatorySolanaTransaction[] = [];
    const instructions: TransactionInstruction[] = [];
    if (approveInstruction) {
      preparatorySolanaTransactions.push({
        instructions: [prepareSolanaInstruction(approveInstruction!)]
      });
      instructions.push(approveInstruction);
    }

    const transactionsData: TransactionData[] = [
      claimTransaction,
      approveSwapTransaction,
      swapTransaction,
      transferSolanaTransaction
    ];

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData,
      preparatorySolanaTransactions
    });

    const { transactions, scheduledTransaction } = await proxyApi.createMultipleTransaction({
      nonce,
      transactionGas,
      transactionsData,
      solanaInstructions: instructions
    });

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest(params, scheduledTransaction, transactions);
    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });

  it(`Should Swap tokens v2 (from, to) with Gas Fee estimation`, async () => {
    const [tokenFrom, tokenTo] = tokensV2;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const params: SwapTokenData = {
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId
    };

    const approveInstruction = await approveTokenV2Instruction(connection, solanaUser, neonEvmProgram, tokenFrom, amountFrom);
    const preparatorySolanaTransactions: PreparatorySolanaTransaction[] = [];
    const instructions: TransactionInstruction[] = [];
    if (approveInstruction) {
      preparatorySolanaTransactions.push({
        instructions: [prepareSolanaInstruction(approveInstruction!)]
      });
      instructions.push(approveInstruction);
    }

    const approveSwapTransaction = approveTokensForSwapTransactionData(params);
    const swapTransaction = pancakeSwapTransactionData(params);

    const transactionsData: TransactionData[] = [
      approveSwapTransaction,
      swapTransaction
    ];

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: transactionsData,
      preparatorySolanaTransactions
    });

    const { scheduledTransaction, transactions } = await proxyApi.createMultipleTransaction({
      nonce,
      transactionGas,
      transactionsData,
      solanaInstructions: instructions
    });

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest(params, scheduledTransaction, transactions);

    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });
});

const swapTest = async (params: SwapTokenData, scheduledTransaction: Transaction, transactions: ScheduledTransaction[]): Promise<[ScheduledTreeAccount | null, bigint, bigint]> => {
  const {
    nonce,
    proxyApi,
    connection,
    solanaUser,
    tokenTo
  } = params;
  const balanceToBefore = await tokenAccountBalance(connection, solanaUser, tokenTo);
  await sendSolanaTransaction(connection, scheduledTransaction, [signer]);
  const resultsHash = await proxyApi.sendRawScheduledTransactions(transactions.map(i => i.serialize()));
  logJson(resultsHash);

  const start = Date.now();
  let treeAccountResult: ScheduledTreeAccount | null = null;
  while (DURATION > Date.now() - start) {
    const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
    log(result);
    treeAccountResult = result!;
    if (result === null || ['Success', 'Skipped', 'Failed'].includes(result.activeStatus)) {
      break;
    }
    await delay(DELAY);
  }
  const balanceToAfter = await tokenAccountBalance(connection, solanaUser, tokenTo);

  return [treeAccountResult, balanceToBefore, balanceToAfter];
};
