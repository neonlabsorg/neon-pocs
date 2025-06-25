import { claimTransactionData, erc20ForSPLContract } from '@neonevm/token-transfer-ethers';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import {
  NeonAddress,
  neonWalletProgramAddress,
  SolanaNeonAccount,
  TransactionData
} from '@neonevm/solana-sign';
import { authAccountAddress, erc20Abi, SPLToken, toFullAmount } from '@neonevm/token-transfer-core';
import { Contract, Interface, JsonRpcProvider, parseUnits } from 'ethers';
import { pancakeSwapRouterAbi } from '../data/pancakeSwapRouter';
import { CSPLToken, PancakePair, SwapTokenData } from '../models';
import { Big } from 'big.js';
import { pancakeSwapPairAbi } from '../data/pancakeSwapPair';

export function transferTokenToNeonTransactionData(data: SwapTokenData): TransactionData {
  const {
    solanaUser,
    tokenFrom,
    amountFrom
  } = data;
  const fullAmount = parseUnits(amountFrom.toString(), tokenFrom.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(tokenFrom.address_spl), solanaUser.publicKey);
  const climeData = claimTransactionData(tokenATA, solanaUser.neonWallet, fullAmount);

  return {
    from: solanaUser.neonWallet,
    to: tokenFrom.address,
    data: climeData
  };
}

export function approveTokensForSwapTransactionData(data: SwapTokenData): TransactionData {
  const {
    pancakeRouter,
    amountFrom,
    tokenFrom,
    solanaUser
  } = data;

  return {
    from: solanaUser.neonWallet,
    to: tokenFrom.address,
    data: erc20ForSPLContract().encodeFunctionData('approve', [pancakeRouter, parseUnits(amountFrom.toString(), tokenFrom.decimals)])
  };
}

export function pancakeSwapTransactionData(data: SwapTokenData): TransactionData {
  const {
    amountFrom,
    tokenFrom,
    tokenTo,
    solanaUser,
    pancakeRouter
  } = data;
  const pancaceSwapInterface = new Interface(pancakeSwapRouterAbi);
  const fullAmountFrom = toFullAmount(amountFrom, tokenFrom.decimals);
  const deadline = Math.round((Date.now()) / 1e3) + 10 * 60;
  const swapData = pancaceSwapInterface.encodeFunctionData('swapExactTokensForTokens', [fullAmountFrom, 0, [tokenFrom.address, tokenTo.address], solanaUser.neonWallet, deadline]);
  return {
    from: solanaUser.neonWallet,
    to: pancakeRouter,
    data: swapData
    // childTransaction: toBeHex(index)
  };
}

export async function transferTokenToSolanaTransactionData(data: SwapTokenData): Promise<TransactionData> {
  const {
    solanaUser,
    tokenFrom,
    tokenTo,
    amountFrom,
    provider,
    pancakePair,
    pancakeRouter
  } = data;
  const contract = new Contract(tokenTo.address, erc20Abi, provider);
  const balance = await contract.balanceOf(solanaUser.neonWallet);
  let amount = await estimateSwapAmount(provider, [tokenFrom, tokenTo], amountFrom.toString(), pancakeRouter, pancakePair);
  if (balance > BigInt(0)) {
    amount = amount + balance;
  }
  const tokenMint = new PublicKey(tokenTo.address_spl);
  const ata = getAssociatedTokenAddressSync(tokenMint, solanaUser.publicKey);
  const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ata.toBuffer(), amount]);

  return {
    from: solanaUser.neonWallet,
    to: tokenTo.address,
    data: transferSolanaData
  };
}

export async function approveTokenV1Instruction(connection: Connection, solanaUser: SolanaNeonAccount, neonEvmProgram: PublicKey, token: CSPLToken, amount: number): Promise<TransactionInstruction | null> {
  const fullAmount = toFullAmount(amount, token.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, token as SPLToken);
  const tokenATAAccount = await getAccount(connection, tokenATA);
  if (!(tokenATAAccount.delegate?.equals(delegatePDA) && tokenATAAccount.delegatedAmount > fullAmount)) {
    return createApproveInstruction(tokenATA, delegatePDA, solanaUser.publicKey, fullAmount);
  }
  return null;
}

export async function approveTokenV2Instruction(connection: Connection, solanaUser: SolanaNeonAccount, neonEvmProgram: PublicKey, token: CSPLToken, amount: number): Promise<TransactionInstruction | null> {
  const fullAmount = toFullAmount(amount, token.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const [delegatePDA] = neonWalletProgramAddress(token.address, neonEvmProgram);
  const tokenATAAccount = await getAccount(connection, tokenATA);
  if (!(tokenATAAccount.delegate?.equals(delegatePDA) && tokenATAAccount.delegatedAmount > fullAmount)) {
    return createApproveInstruction(tokenATA, delegatePDA, solanaUser.publicKey, fullAmount);
  }
  return null;
}

export async function createATAInstruction(connection: Connection, solanaUser: SolanaNeonAccount, token: CSPLToken): Promise<TransactionInstruction | null> {
  const tokenMint = new PublicKey(token.address_spl);
  const ata = getAssociatedTokenAddressSync(tokenMint, solanaUser.publicKey);

  const account = await connection.getAccountInfo(ata);
  let instruction = null;
  if (!account) {
    instruction = createAssociatedTokenAccountInstruction(solanaUser.publicKey, ata, solanaUser.publicKey, tokenMint);
  }
  return instruction;
}

export async function estimateSwapAmount(provider: JsonRpcProvider, tokenFromTo: CSPLToken[], amountFrom: string, pancakeRouter: NeonAddress, pancakePair: PancakePair): Promise<bigint> {
  try {
    const [tokenFrom] = tokenFromTo;
    const amountIn = new Big(amountFrom).times(new Big(10).pow(tokenFrom.decimals));
    const router = new Contract(pancakeRouter, pancakeSwapRouterAbi, provider);
    const pairContract = new Contract(pancakePair.pair, pancakeSwapPairAbi, provider);
    const [one, two] = await pairContract.getReserves();
    const [from, to] = tokenFrom.address === pancakePair.a ? [one, two] : [two, one];
    return router.getAmountOut(amountIn.toString(), from, to);
  } catch (e) {
    console.log(e);
  }
  return BigInt(0);
}
