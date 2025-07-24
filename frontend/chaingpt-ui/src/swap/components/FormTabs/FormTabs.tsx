import { addressesDevnet } from '../../../data/addresses.devnet';

const FormTabs = () => {
  return (
    <div className='form-group'>
      <div className='form-label !mb-[10px]'>
        <label>
          CheckIn smart contract is deployed at address&nbsp;&nbsp;
          <a
            href='https://neon-devnet.blockscout.com/address/0x70A3e9fE5Ba7C88dFC05317e795a43d149c80793?tab=index'
            target='_blank'
            rel='noopener noreferrer'
          >
            {addressesDevnet.checkIn.checkIn}
          </a>
        </label>
      </div>
    </div>
  );
};

export default FormTabs;
