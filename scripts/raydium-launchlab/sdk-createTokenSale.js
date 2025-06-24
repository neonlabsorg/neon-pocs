// See documentation: https://docs.raydium.io/raydium/pool-creation/launchlab/launchlab-typescript-sdk
// See example: https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/src/launchpad/createMint.ts
import web3 from "@solana/web3.js"
import { NATIVE_MINT } from '@solana/spl-token'
import BN from "bn.js";
import {
    TxVersion,
    getPdaLaunchpadConfigId,
    LaunchpadConfig,
    LaunchpadPoolInitParam,
} from '@raydium-io/raydium-sdk-v2'

export async function createTokenSale(raydium, programId, platformId, mintA, pair = null) {
    const configId = getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey
    const configData = await raydium.connection.getAccountInfo(configId)
    if (!configData) throw new Error('config not found')
    const configInfo = LaunchpadConfig.decode(configData.data)
    const mintBInfo = await raydium.token.getTokenInfo(configInfo.mintB)
    const inAmount = new BN(1000)
    // console.log(raydium, 'raydium')
    // console.log(DEV_LAUNCHPAD_PROGRAM, 'DEV_LAUNCHPAD_PROGRAM')
    // console.log(configId, 'configId')
    // console.log(configData, 'configData')
    // console.log(configInfo, 'configInfo')
    // console.log(LaunchpadPoolInitParam, 'LaunchpadPoolInitParam')

    // Raydium UI usage: https://github.com/raydium-io/raydium-ui-v3-public/blob/master/src/store/useLaunchpadStore.ts#L329
    const { execute, transactions, extInfo } = await raydium.launchpad.createLaunchpad({
        programId,
        mintA,
        decimals: 6,
        name: 'Test Raydium Launchpad Mint',
        symbol: 'TRL',
        migrateType: 'cpmm', // 'amm' or 'cpmm' to specify which AMM type liquidity will be migrated to
        uri: 'https://test-raydium-launchlab.io',
        configId,
        configInfo, // optional, sdk will get data by configId if not provided
        mintBDecimals: mintBInfo.decimals, // default 9
        /** default platformId is Raydium platform, you can create your platform config in ./createPlatform.ts script */
        platformId: platformId, // new PublicKey('your platform id'), // default RAYDIUM platform on mainnet: 4Bu96XjU84XjPDSpveTVf6LYGCkfW5FK7SNkREWcEfV4
        txVersion: TxVersion.V0,
        slippage: new BN(100), // means 1%
        buyAmount: inAmount,
        createOnly: true, // true means create mint only, false will "create and buy together"
        extraSigners: (pair ? [pair] : []),
        // supply: new BN(1_000_000_000_000_000), // lauchpad mint supply amount, default: LaunchpadPoolInitParam.supply
        // totalSellA: new BN(793_100_000_000_000),  // lauchpad mint sell amount, default: LaunchpadPoolInitParam.totalSellA
        totalFundRaisingB: new BN(30_000_000_000),  // if mintB = SOL, means 1 SOL is needed to migrate liquidity to AMM, default: LaunchpadPoolInitParam.totalFundRaisingB
        // totalLockedAmount: new BN(0),  // total locked amount, default 0
        // cliffPeriod: new BN(0),  // unit: seconds, default 0
        // unlockPeriod: new BN(0),  // unit: seconds, default 0
        // shareFeeReceiver: new PublicKey('your share wallet'), // only works when createOnly=false
        // shareFeeRate: new BN(1000), // only works when createOnly=false
        // computeBudgetConfig: {
        //   units: 600000,
        //   microLamports: 46591500,
        // },
    })
    // console.log(extInfo, 'tokenSale extInfo')

    return { extInfo, transactions, execute }
}