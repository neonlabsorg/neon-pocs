import { TxVersion, DEV_LAUNCHPAD_PROGRAM, printSimulate, LAUNCHPAD_PROGRAM } from '@raydium-io/raydium-sdk-v2'
import { initSdk } from './sdk-config.js'
import web3 from '@solana/web3.js'
import BN from 'bn.js'

export const createPlatform = async (raydium, ownerPublicKey, feePayerPublicKey) => {
    /** notice: every wallet only enable to create "1" platform config */
    const { transaction, extInfo, execute } = await raydium.launchpad.createPlatformConfig({
        programId: DEV_LAUNCHPAD_PROGRAM, // LAUNCHPAD_PROGRAM, // devnet: DEV_LAUNCHPAD_PROGRAM,
        platformAdmin: ownerPublicKey,
        platformClaimFeeWallet: ownerPublicKey,
        platformLockNftWallet: ownerPublicKey,
        cpConfigId: new web3.PublicKey('9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6'), // devnet 9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6, see: https://solana.stackexchange.com/a/19519
        /**
         * when migration, launchpad pool will deposit mints in vaultA/vaultB to new cpmm pool
         * and return lp to migration wallet
         * migrateCpLockNftScale config is to set up usage of these lp
         * note: sum of these 3 should be 10**6, means percent (0%~100%)
         */
        migrateCpLockNftScale: {
            platformScale: new BN(400000), // means 40%, locked 40% of return lp and return to platform nft wallet
            creatorScale: new BN(500000), // means 50%, locked 50% of return lp and return to creator nft wallet
            burnScale: new BN(100000), // means 10%, burned return lp percent after migration
        },
        feeRate: new BN(1000), // launch lab buy and sell platform feeRate
        name: 'Raydium Launchlab Test Platform',
        web: 'https://raydium-test.platform.org',
        img: 'https://raydium-test.platform.org/img',
        txVersion: TxVersion.V0,
        // computeBudgetConfig: {
        //   units: 600000,
        //   microLamports: 600000,
        // },
        feePayer: feePayerPublicKey
    })

    // printSimulate([transaction])

    return { extInfo, transaction, execute }
}
