declare const APP_VERSION: string;

const Footer = () => {
  return (
    <footer className={'p-2'}>
      <div className={'flex flex-row items-center justify-between'}>
        <div className={'flex flex-row items-center'}>
          <a href="https://github.com/neonlabsorg/neon-solana-native-swap-demo" target="_blank"
             className={'github-link'}>
            <img src="/assets/icons/github.svg" alt="Github" />
            <span>v{APP_VERSION}</span>
          </a>
        </div>
        <div className={'flex flex-row items-center gap-[6px] text-gray-700'}>
          <span>NeonLabs &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
