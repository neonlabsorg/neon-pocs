import { FC } from 'react';
import { Props } from '../models';
import Header from './Header';
import Footer from './Footer';

const Layout: FC<Props> = ({ children }) => {

  return (<>
    <div className={'flex flex-col min-h-screen justify-between min-w-[640px] w-full'}>
      <Header />
      <main className={'flex flex-col min-h-full p-2 w-full mx-auto'}>
        {children}
      </main>
      <Footer />
    </div>
  </>);
};

export default Layout;
