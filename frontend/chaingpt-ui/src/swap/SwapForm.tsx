import { useConnection } from '@solana/wallet-adapter-react';
import {
  delay,
  log,
  NeonAddress,
  ScheduledTransactionStatus,
  TransactionData
} from '@neonevm/solana-sign';
import { useRef, useState } from 'react';
import SwapState from './components/SwapState/SwapState';
import { useProxyConnection } from '../wallet/Connection';
import { FormState, CheckInData, CheckInResponse } from '../models';
import './SwapForm.css';
import { addressesDevnet } from '../data/addresses.devnet';

const DURATION = 3e5;
const DELAY = 1e3;

interface Props {
  dataMethod(params: CheckInData): Promise<TransactionData>;
}

export const SwapForm = (props: Props) => {
  const { dataMethod } = props;
  const { connection } = useConnection();
  const { solanaUser, proxyApi, chainId, neonEvmProgram, sendTransaction, provider } =
    useProxyConnection();
  const [loading, setLoading] = useState<boolean>(false);
  const [transactionStates, setTransactionStates] = useState<FormState[]>([]);
  const transactionsRef = useRef<FormState[]>([]);
  const [error, setError] = useState<string>(``);

  const changeTransactionStates = (state: FormState): void => {
    setTransactionStates((prev) =>
      prev.map((st) => {
        if (st.id === state.id) {
          return state;
        }
        return st;
      })
    );
  };

  const addTransactionStates = (states: FormState[]): void => {
    setTransactionStates((_) => states);
  };

  const checkIn = async (nonce: number): Promise<CheckInResponse> => {
    const checkIn: NeonAddress = addressesDevnet.checkIn.checkIn;
    const params: CheckInData = {
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      checkIn,
      chainId
    };
    const transactionData = await dataMethod(params);

    const transactionGas = await proxyApi.estimateScheduledTransactionGas({
      solanaPayer: solanaUser.publicKey,
      transactions: [transactionData]
    });

    const { scheduledTransaction } = await proxyApi.createScheduledTransaction({
      transactionGas,
      transactionData,
      nonce
    });

    return { scheduledTransaction };
  };

  const cancelTransaction = async (_: ScheduledTransactionStatus) => {
    const { result } = await proxyApi.getPendingTransactions(solanaUser.publicKey);
    log(result);
  };

  const executeTransactionState = async (state: FormState): Promise<void> => {
    try {
      setLoading(true);
      setError('');
      const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
      const { scheduledTransaction } = await state.method(nonce);
      changeTransactionStates(state);
      if (scheduledTransaction.instructions.length > 0) {
        const signature = await sendTransaction(scheduledTransaction, 'confirmed', {
          skipPreflight: false
        });
        if (signature) {
          state.signature = signature;
          changeTransactionStates(state);
        }
      } else {
        state.status = 'Success';
      }

      const start = Date.now();
      while (DURATION > Date.now() - start) {
        const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
        if (result) {
          state.data = result;
          state.status = result.activeStatus;
          state.isCompleted = result.transactions.every((i) => i.status === 'Success');
          changeTransactionStates(state);
          if (['Success', 'Empty', 'Failed', 'Skipped'].includes(result.activeStatus)) {
            break;
          }
        } else {
          break;
        }
        await delay(DELAY);
      }
    } catch (e: any) {
      state.status = 'Failed';
      log(e.message);
      setError(e.message);
      setLoading(false);
    }
  };

  const executeTransactionsStates = async (transactionStates: FormState[]): Promise<void> => {
    for (let i = 0; i < transactionStates.length; i++) {
      const state = transactionStates[i];
      if (i > 0 && ['Failed', 'Skipped', 'NoStarted'].includes(transactionStates[i - 1].status)) {
        break;
      } else {
        log(`Run transaction ${state.title}`);
        await executeTransactionState(state);
        await delay(1e3);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const swapTokensState: FormState = {
        id: 0,
        title: `Check In`,
        status: `NotStarted`,
        signature: ``,
        isCompleted: false,
        method: checkIn,
        data: undefined
      };
      transactionsRef.current = [swapTokensState];
      addTransactionStates(transactionsRef.current);
      await executeTransactionsStates(transactionsRef.current);
      setLoading(false);
    } catch (e: any) {
      log(e.message);
      if (transactionsRef.current.some((i) => !i.data)) {
        transactionsRef.current = [];
        addTransactionStates(transactionsRef.current);
      }
      setLoading(false);
    }
  };

  return (
    <>
      {transactionStates.length > 0 && (
        <div className='form-group'>
          <div className='form-field'>
            {transactionStates.map((state, key) => {
              return (
                <SwapState
                  key={key}
                  formState={state}
                  loading={loading}
                  executeState={executeTransactionState}
                  setLoading={setLoading}
                  transactionCancel={cancelTransaction}
                ></SwapState>
              );
            })}
          </div>
        </div>
      )}
      {error.length > 0 && <div className='form-error'>{error}</div>}
      <div className='form-group'>
        <div className='form-field'>
          <button className='form-button' onClick={handleSubmit}>
            Check In
          </button>
        </div>
      </div>
    </>
  );
};

export default SwapForm;
