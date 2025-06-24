// See documentation: https://docs.raydium.io/raydium/pool-creation/launchlab/launchlab-typescript-sdk
import web3 from "@solana/web3.js"
import {
        DEV_LAUNCHPAD_PROGRAM,
        LaunchpadConfig,
        LaunchpadPool,
        getPdaLaunchpadPoolId,
        getCpmmPdaPoolId
} from '@raydium-io/raydium-sdk-v2'
import BN from "bn.js";
import { initSdk } from './sdk-config.js'
import { createPlatform } from './sdk-createPlatform.js'
import { createTokenSale } from './sdk-createTokenSale.js'
import { buyToken, sellToken } from './sdk-buyToken.js'
import { swap } from './sdk-cpmm-swap.js'

import { getSecrets } from "../../neon-secrets.js";

const { wallets } = await getSecrets()
const raydium = await initSdk({ owner: wallets.solanaUser1, loadToken: false })
const programId = DEV_LAUNCHPAD_PROGRAM // mainnet: LAUNCHPAD_PROGRAM
const cpConfigId =  new web3.PublicKey('9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6') // for mainnet see: https://api-v3.raydium.io/main/cpmm-config
const cpmmProgramId = new web3.PublicKey('CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW') // devnet


let transaction, sentInfo
// Deploy Raydium Launchlab platform
/*
transaction = await createPlatform(raydium, wallets.solanaUser1.publicKey)
try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
        console.log(sentInfo, `platformId: ${transaction.extInfo.platformId.toBase58()}`)
} catch (error) { console.error(error) }
const platformId = transaction.extInfo.platformId
*/
const platformId = new web3.PublicKey('5HozrG39FNULZeGxiXjT7dSrVCAjusKSJFPrFRoWT7me')

// Deploy SPL token and create token sale with bonding curve
/*
const pair = web3.Keypair.generate()
transaction = await createTokenSale(raydium, programId, platformId, pair.publicKey, pair)
try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
        console.log(sentInfo, `poolId: ${transaction.extInfo.address.poolId.toBase58()}`)
} catch (error) { console.error(error) }
*/
const tokenSaleInfo = { address: {
        configId: new web3.PublicKey('A8uLQd7fLHJw8aGfHZB7CA3p9kmdUCCWd4QyLFvxNSid'),
        mintA: new web3.PublicKey('87SrFswhYnpAyjY9bgjk3pb3ZDwWysbWLMmo8aFpVRt8')
}}

// Buy SPL token from bonding curve
const buyAmount = new BN(30_110_000_000) // >= 30 SOL funding cap + fee
/*
transaction = await buyToken(raydium, programId, tokenSaleInfo.address.configId, tokenSaleInfo.address.mintA, wallets.solanaUser1, buyAmount)
try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
        console.log(sentInfo, 'sentInfo')
        console.log(`Bought token amount: ${transaction.extInfo.outAmount.toString()}`);
} catch (error) { console.error(error) }
const tokenAmount = transaction.extInfo.outAmount
*/

// Sell SPL token to bonding curve
const sellAmount = new BN(793100000000000)
/*
transaction = await sellToken(raydium, programId, tokenSaleInfo.address.configId, tokenSaleInfo.address.mintA, wallets.solanaUser1, sellAmount)
try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
        console.log(sentInfo, 'sentInfo')
        console.log(`Sold token for SOL amount: ${transaction.extInfo.outAmount.toString()}`);
} catch (error) { console.error(error) }
*/

// Check pool state
const configData = await raydium.connection.getAccountInfo(tokenSaleInfo.address.configId)
if (!configData) throw new Error('config not found')
let configInfo = LaunchpadConfig.decode(configData.data)
const { publicKey: poolId } = getPdaLaunchpadPoolId(programId, tokenSaleInfo.address.mintA, configInfo.mintB);
const poolData = await raydium.connection.getAccountInfo(poolId);
if (!poolData) console.error("cannot find pool", poolId.toBase58());
const poolInfo = LaunchpadPool.decode(poolData.data);
console.log(poolId, 'token sale poolId')
console.log(poolInfo, 'token sale poolInfo')

if(poolInfo.status === 2) { // If liquidity has been migrated to CPMM pool
        const cpmmPoolId = getCpmmPdaPoolId(cpmmProgramId, cpConfigId, poolInfo.mintB, poolInfo.mintA); // If returned poolId is a non-existing account, try switching mintA and mintB
        console.log(cpmmPoolId, 'cpmmPoolId')

        // Swap on Raydium CPMM pool
        //const inputAmount = new BN(793100000000000)
        const inputAmount = new BN(700000000000000)
        transaction = await swap(raydium, wallets.solanaUser1, cpmmPoolId, inputAmount)
        try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
                console.log(`Swapped on CPMM pool: ${sentInfo.txId}`);
        } catch (error) { console.error(error) }
}