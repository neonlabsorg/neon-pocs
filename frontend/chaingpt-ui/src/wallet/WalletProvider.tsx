import { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SOLANA_URL } from '../environments';
import { Props } from '../models';

import '@solana/wallet-adapter-react-ui/styles.css';
import { ProxyConnectionProvider } from './Connection.tsx';

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const endpoint = SOLANA_URL;
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ProxyConnectionProvider>
            {children}
          </ProxyConnectionProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
