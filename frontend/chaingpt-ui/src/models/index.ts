import React from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  NeonAddress,
  NeonProxyRpcApi,
  ScheduledTreeAccount,
  SolanaAddress,
  SolanaNeonAccount,
  TransactionStatus
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';

export type Props = {
  readonly children: React.ReactNode;
};

export interface TransactionGas {
  gasLimit: number[];
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

export interface CheckInCommonData {
  transactionGas: TransactionGas;
  proxyApi: NeonProxyRpcApi;
  provider: JsonRpcProvider;
  connection: Connection;
  solanaUser: SolanaNeonAccount;
  checkIn: NeonAddress;
  neonEvmProgram: PublicKey;
  chainId: number;
  nonce: number;
}

export type CheckInData = Omit<CheckInCommonData, 'transactionGas'>;

export interface CheckInResponse {
  scheduledTransaction: Transaction;
}

export interface FormState {
  id: number;
  title: string;
  isCompleted: boolean;
  signature?: string;
  status: TransactionStatus;
  method: (nonce: number) => Promise<CheckInResponse>;
  gas?: TransactionGas;
  data?: ScheduledTreeAccount;
}

export interface UITab {
  id: number;
  title: string;
  disabled: boolean;
}

export interface TransactionResponse {
  transaction: string;
  message?: string;
  payload?: any;
}

export interface TransactionStateResponse {
  lastTrx: number;
  network: SolanaEnvironment;
  token: SolanaAddress;
  wallet: SolanaAddress;
}

export const enum SolanaEnvironment {
  localnet = 'localnet',
  devnet = 'devnet',
  mainnet = 'mainnet'
}
