import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TransactionData } from '@neonevm/solana-sign';
import Layout from '../layout/Layout.tsx';
import SwapForm from '../swap/SwapForm.tsx';
import FormTabs from '../swap/components/FormTabs/FormTabs.tsx';
import { useProxyConnection } from '../wallet/Connection.tsx';
import { CheckInData } from '../models';
import './App.css';
import { checkIn } from '../api/checkIn.ts';

function App() {
  const { publicKey } = useWallet();
  const { getWalletBalance } = useProxyConnection();

  const checkInMethod = async (params: CheckInData): Promise<TransactionData> => {
    const checkInTransaction = await checkIn(params);
    return checkInTransaction;
  };

  useEffect(() => {
    getWalletBalance().catch(console.log);
  }, [getWalletBalance, publicKey]);

  return (
    <>
      <Layout>
        <div className='max-w-[624px]'>
          <FormTabs></FormTabs>
          <SwapForm dataMethod={checkInMethod}></SwapForm>
        </div>
      </Layout>
    </>
  );
}

export default App;
