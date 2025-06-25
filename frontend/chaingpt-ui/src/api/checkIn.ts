// checkin.ts
import { TransactionData } from '@neonevm/solana-sign';
import { checkInAbi } from '../data/checkIn';
import { CheckInData } from '../models';
import { Interface } from 'ethers';

export async function checkIn(data: CheckInData): Promise<TransactionData> {
  const { solanaUser, checkIn } = data;
  const iface = new Interface(checkInAbi);
  const calldata = iface.encodeFunctionData('checkIn', []);

  return {
    from: solanaUser.neonWallet,
    to: checkIn,
    data: calldata
  };
}

export async function getTotalCheckIns(CheckIn: any, neonWallet: string) {
  const total = await CheckIn.getTotalCheckIns(neonWallet);
  console.log(`\nTotal check ins by the user wallet ${neonWallet}:`);

  for (let i = 0; i < Number(total); i++) {
    const timestampStr = await CheckIn.checkIns(neonWallet, i);
    const timestamp = parseInt(timestampStr, 10);
    const date = new Date(timestamp * 1000);
    const time = date.toUTCString();
    console.log(`${i + 1}. Check In by ${neonWallet} = ${time}`);
  }
}
