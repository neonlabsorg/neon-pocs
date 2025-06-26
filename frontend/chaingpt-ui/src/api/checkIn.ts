// checkin.ts
import { TransactionData } from '@neonevm/solana-sign';
import { checkInAbi } from '../data/checkIn';
import { CheckInData } from '../models';
import { Interface, Contract } from 'ethers';

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

export async function getTotalCheckIns(data: CheckInData): Promise<any> {
  const { solanaUser, checkIn, provider } = data;
  const contract = new Contract(checkIn, checkInAbi, provider);
  const total = await contract.getTotalCheckIns(solanaUser.neonWallet);
  console.log(`\nTotal check ins by the user wallet ${solanaUser.neonWallet}:`);

  let timeArray = [];

  for (let i = 0; i < Number(total); i++) {
    const timestampStr = await contract.checkIns(solanaUser.neonWallet, i);
    const timestamp = parseInt(timestampStr, 10);
    const date = new Date(timestamp * 1000);
    const time = date.toUTCString();
    timeArray.push(time);
    console.log(`${i + 1}. Check In by ${solanaUser.neonWallet} = ${time}`);
  }

  return timeArray;
}
