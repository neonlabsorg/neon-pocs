import hre from "hardhat"
import web3, { TransactionInstruction } from "@solana/web3.js"
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
import { deployContract, execute, batchExecute } from "../utils.js";

import { getSecrets } from "../../neon-secrets.js";

const ethers = (await hre.network.connect()).ethers
const { wallets } = await getSecrets()
const raydium = await initSdk({ owner: wallets.solanaUser1, loadToken: false })
const programId = DEV_LAUNCHPAD_PROGRAM // mainnet: LAUNCHPAD_PROGRAM
const cpConfigId =  new web3.PublicKey('9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6') // for mainnet see: https://api-v3.raydium.io/main/cpmm-config
const cpmmProgramId = new web3.PublicKey('CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW') // devnet

// Instantiate caller contract
const { contract: callRaydiumProgram } = await deployContract(wallets.owner, wallets.user1, "CallRaydiumProgram")

const ownerSolanaPublicKey = new web3.PublicKey(ethers.encodeBase58((await callRaydiumProgram.getNeonAddress(wallets.owner.address))))
console.log(ownerSolanaPublicKey, 'ownerSolanaPublicKey')
const contractPublicKey = new web3.PublicKey(ethers.encodeBase58((await callRaydiumProgram.getNeonAddress(callRaydiumProgram.target))))
console.log(contractPublicKey, 'contractPublicKey')
const payerPublicKey = new web3.PublicKey(ethers.encodeBase58(await callRaydiumProgram.getPayer()))
console.log(payerPublicKey, 'payerPublicKey')

// Deploy Raydium Launchlab platform
// See: https://github.com/raydium-io/raydium-cpi/blob/6f6c1597caa0d2f0153bbae0bc45618b76439d34/programs/launch-cpi/src/context.rs#L364
let transaction, sentInfo
const platformAdminPublicKey = payerPublicKey
transaction = (await createPlatform(raydium, platformAdminPublicKey, wallets.solanaUser1.publicKey)).transaction
const platformId = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config'), platformAdminPublicKey.toBuffer()],
    programId
)[0]
console.log(platformId, 'platformId')
/*
const createPlatformIx = new TransactionInstruction({
        keys: transaction.message.compiledInstructions[0].accountKeyIndexes.map((index, i) => {
               return ({
                       pubkey: i <= 2 ? platformAdminPublicKey : (i === 3 ? platformId : transaction.message.staticAccountKeys[index]),
                       isWritable: i <= 4,
                       isSigner: i <= 2
               })
            }),
        programId,
        data: transaction.message.compiledInstructions[0].data
})
// console.log(createPlatformIx, 'createPlatformIx')

let [tx, receipt] = await execute(
    createPlatformIx,
    100000000,
    callRaydiumProgram,
    undefined,
    wallets.owner
);
console.log(tx, 'tx');
console.log(receipt.logs[0].args, 'receipt args');
*/

// Deploy SPL token and create token sale with bonding curve
const tokenSaleCreatorPublicKey = contractPublicKey
const salt = Buffer.from(ethers.toBeHex(Date.now(), 32).slice(2), 'hex'); // random salt on each script call
console.log(salt, 'salt')
/*
const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callRaydiumProgram.getCreateWithSeedAccount(
    contractPublicKey.toBuffer(), // also tried with payerPublicKey.toBuffer(),
    web3.SystemProgram.programId.toBuffer(), // also tried with neonEVMProgramId.toBuffer(),
    salt
))))
*/
// const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callRaydiumProgram.getResourceAddress(salt))))
const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callRaydiumProgram.getExtAuthority(salt))))
console.log(mintPublicKey, 'mintPublicKey')

transaction = (await createTokenSale(raydium, programId, platformId, mintPublicKey)).transactions[0]
/*
console.log(transaction, 'createTokenSale transaction')
console.log(transaction.message, 'createTokenSale transaction message')
console.log(transaction.message.staticAccountKeys, 'createTokenSale transaction staticAccountKeys ')
console.log(transaction.message.compiledInstructions, 'createTokenSale transaction compiledInstructions')
*/
const createTokenSaleIx = new TransactionInstruction({
        keys: transaction.message.compiledInstructions[0].accountKeyIndexes.map((index, i) => {
                return ({
                        pubkey: i <= 1 ? tokenSaleCreatorPublicKey : transaction.message.staticAccountKeys[index],
                        isWritable: (i <= 1) || (i === 5) || (i === 6) || (i >= 8 && i <= 10),
                        isSigner: (i <= 1) || (i === 6)
                })
        }),
        programId,
        data: transaction.message.compiledInstructions[0].data
})
// console.log(createTokenSaleIx, 'createTokenSaleIx')

let [tx, receipt] = await execute(
    createTokenSaleIx,
    100000000,
    callRaydiumProgram,
    salt,
    wallets.owner
);
console.log(tx, 'tx');
console.log(receipt.logs[0].args, 'receipt args');


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
const sellAmount = new BN(793097465452307)
/*
transaction = await sellToken(raydium, programId, tokenSaleInfo.address.configId, tokenSaleInfo.address.mintA, wallets.solanaUser1, sellAmount)
try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
        console.log(sentInfo, 'sentInfo')
        console.log(`Sold token for SOL amount: ${transaction.extInfo.outAmount.toString()}`);
} catch (error) { console.error(error) }
*/
/*
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
        const inputAmount = new BN(1_000)
        transaction = await swap(raydium, wallets.solanaUser1, cpmmPoolId, inputAmount)
        try {   sentInfo = await transaction.execute({ sendAndConfirm: true })
                console.log(`Swapped on CPMM pool: ${sentInfo.txId}`);
        } catch (error) { console.error(error) }
}
*/