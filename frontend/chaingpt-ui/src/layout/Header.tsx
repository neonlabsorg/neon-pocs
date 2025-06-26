import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useProxyConnection } from '../wallet/Connection.tsx';
import { PROXY_ENV } from '../environments';
import './layout.css';

const Header = () => {
  const { walletBalance } = useProxyConnection();

  return (
    <header className={'z-10 flex flex-row justify-center transition'}>
      <div className={'items-left flex w-full max-w-2xl flex-row justify-between p-2'}>
        <div className='logo'>
          <img src='/assets/logo.svg' width='32' height='32' alt='Neon' />
          <span>
            <strong>ChainGPT Demo</strong> (<span className='capitalize'>{PROXY_ENV}</span>)
          </span>
        </div>
        <div className={'flex flex-row items-center gap-[8px]'}>
          <div className='balance'>
            {walletBalance > 0 && `${(walletBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`}
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
};

export default Header;
