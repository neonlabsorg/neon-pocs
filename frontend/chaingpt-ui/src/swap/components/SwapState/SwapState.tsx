import { ScheduledTransactionStatus } from '@neonevm/solana-sign';
import { useMemo } from 'react';
import { PROXY_ENV, SOLANA_URL } from '../../../environments';
import { FormState } from '../../../models';
import './SwapState.css';

const Status = ({ formState, loading }: { formState: FormState, loading: boolean }) => {
  const status = useMemo(() => {
    const status = formState.status;
    switch (status) {
      case 'NotStarted':
      case 'InProgress':
        return 'loading';
      case 'Success':
        return 'success';
      case 'Empty':
      case 'Failed':
      case 'Skipped':
        return 'warning';
    }
    if (loading) {
      return 'loading';
    }
    return ``;
  }, [formState.status, loading]);

  return (
    <>
      <div className="form-state-loading">
        {status === 'loading' &&
          <img className="loading" src="/assets/icons/loading.svg" alt="Loading..." />}
        {status === 'success' && <img src="/assets/icons/check.svg" alt="Success" />}
        {status === 'warning' && <img src="/assets/icons/warning.svg" alt="Warning" />}
      </div>
    </>
  );
};

interface Props {
  formState: FormState,
  loading: boolean,
  setLoading: (size: boolean) => void,
  executeState: (state: FormState) => Promise<void>
  transactionCancel: (state: ScheduledTransactionStatus) => Promise<void>
}

function SwapState({ formState, loading, executeState, setLoading, transactionCancel }: Props) {
  const show = false;

  const canRestart = useMemo(() => {
    return !loading && ['Empty', 'Failed', 'Skipped', 'Empty'].includes(formState.status);
  }, [loading, formState]);

  const canStart = useMemo(() => {
    return !loading && ['NotStarted'].includes(formState.status);
  }, [loading, formState]);

  const explorerUrl = useMemo(() => {
    const solscan = `https://solscan.io/tx/${formState.signature}`;
    const solana = `https://explorer.solana.com/tx/${formState.signature}?cluster=custom&customUrl=${SOLANA_URL}`;
    switch (PROXY_ENV) {
      case 'mainnet':
        return solscan;
      case 'devnet':
        return `${solscan}?cluster=devnet`;
      default:
        return solana;
    }
  }, [formState.signature]);

  const handleCancel = async (trx: ScheduledTransactionStatus): Promise<void> => {
    if (!loading) {
      await transactionCancel(trx);
    }
  };

  const handleStart = async (): Promise<void> => {
    if (!loading) {
      formState.status = 'NotStarted';
      formState.isCompleted = false;
      formState.data = undefined;
      formState.signature = '';
      await executeState(formState);
      setLoading(false);
    }
  };

  const showLink = (trx: ScheduledTransactionStatus): boolean => {
    return ['devnet', 'mainnet'].includes(PROXY_ENV) && ['Success', 'Empty', 'Failed', 'Skipped'].includes(trx.status);
  };

  const txLink = (trx: ScheduledTransactionStatus): string => {
    const neon = PROXY_ENV === 'mainnet' ? 'neon' : 'neon-devnet';
    return `https://${neon}.blockscout.com/tx/${trx.transactionHash}`;
  };

  return (
    <div className="form-state">
      <div className="form-state-title">
        <div className="form-state-title-item title">
          <div className="form-state-number">{formState.id + 1}</div>
          <div className="title">{formState.title}</div>
          {formState.signature && formState.signature?.length > 0 && <a href={explorerUrl} target="_blank">
            <img src="/assets/solscan.webp" width={18} height={18} alt="" />
          </a>}
        </div>
        <div className="form-state-title-item loading">
          {canRestart &&
            <button className={'button-restart'} onClick={handleStart}>Restart</button>}
          {canStart &&
            <button className={'button-restart'} onClick={handleStart}>Start</button>}
          <Status formState={formState} loading={loading} />
        </div>
      </div>
      {!!formState.data && formState.data?.transactions?.length > 0 && <>
        <div className="form-state-body">
          {formState.data.transactions.map((trx, key) => {
            return <div className="form-state-transaction" key={key}>
              <div className="transaction-item">
                {showLink(trx) ?
                  <a href={txLink(trx)}
                     target="_blank">{trx.transactionHash}</a>
                  : <span>{trx.transactionHash}</span>}
              </div>
              <div className="transaction-item">
                {show && trx.status === 'NotStarted' &&
                  <button onClick={() => handleCancel(trx)}>x</button>}
                <div>{trx.status}</div>
              </div>
            </div>;
          })}
        </div>
      </>}
    </div>
  );
}

export default SwapState;
