import { addressesCurvestand } from './addresses.curvestand';
import { addressesDevnet } from './addresses.devnet';
import { CSPLToken } from '../models';

export const tokenIcons: Record<string, string> = {
  sol: 'sol.svg',
  neon: 'neon.svg',
  tstn: 'tstn.png',
  usdc: 'usdc.svg',
  usdt: 'usdt.svg',
  wsol: 'wsol.svg',
  wneon: 'wneon.svg'
};

export function tokens(env: string): { swap: any, tokensV1: CSPLToken[], tokensV2: CSPLToken[] } {
  let swap: any = addressesCurvestand.swap;
  let tokensV1: CSPLToken[] = addressesCurvestand.tokensV1;
  let tokensV2: CSPLToken[] = addressesCurvestand.tokensV2;

  if (env === 'devnet') {
    swap = addressesDevnet.swap;
    tokensV1 = addressesDevnet.tokensV1;
    tokensV2 = addressesDevnet.tokensV2;
  }

  return { swap, tokensV1, tokensV2 };
}
