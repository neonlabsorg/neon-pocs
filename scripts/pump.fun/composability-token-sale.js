import hre from "hardhat"
import web3 from "@solana/web3.js"
import {
    MINT_SIZE,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token"
import { PumpSdk, PUMP_PROGRAM_ID, PUMP_AMM_PROGRAM_ID, canonicalPumpPoolPda, getBuySolAmountFromTokenAmount } from "@pump-fun/pump-sdk"
import { PumpAmmSdk } from "@pump-fun/pump-swap-sdk";
import BN from "bn.js";
import { getSecrets } from "../../neon-secrets.js";
import { deployContract, execute, batchExecute } from "../utils.js";
import config from "../config.js"

const ethers = (await hre.network.connect()).ethers
const { wallets } = await getSecrets()
const solanaConnection = new web3.Connection(config.svm_node[hre.globalOptions.network], "processed")
const pumpSdk = new PumpSdk(solanaConnection)
const pumpAmmSdk = new PumpAmmSdk(solanaConnection)
const global = await pumpSdk.fetchGlobal()

// Instantiate caller contract
const { contract: callPumpFunProgram } = await deployContract(wallets.user1, wallets.owner, "CallPumpFunProgram")

const creatorSolanaPublicKey = new web3.PublicKey(ethers.encodeBase58((await callPumpFunProgram.getNeonAddress(wallets.owner.address))))
console.log(creatorSolanaPublicKey, 'creatorSolanaPublicKey')
const contractPublicKey = new web3.PublicKey(ethers.encodeBase58((await callPumpFunProgram.getNeonAddress(callPumpFunProgram.target))))
console.log(contractPublicKey, 'contractPublicKey')
const payerPublicKey = new web3.PublicKey(ethers.encodeBase58(await callPumpFunProgram.getPayer()))
console.log(payerPublicKey, 'payerPublicKey')
const neonEVMProgramId = new web3.PublicKey('eeLSJgWzzxrqKv1UxtRVVH8FX3qCQWUs9QuAjJpETGU')


const salt = Buffer.from(ethers.toBeHex(Date.now(), 32).slice(2), 'hex'); // random salt on each script call
console.log(salt, 'salt')
const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callPumpFunProgram.getCreateWithSeedAccount(
    contractPublicKey.toBuffer(), // also tried with payerPublicKey.toBuffer(),
    web3.SystemProgram.programId.toBuffer(), // also tried with neonEVMProgramId.toBuffer(),
    salt
))))

// const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callPumpFunProgram.getResourceAddress(salt))))
// const mintPublicKey = new web3.PublicKey(ethers.encodeBase58((await callPumpFunProgram.getExtAuthority(salt))))

console.log(mintPublicKey, 'mintPublicKey')

// Deploy SPL token and bonding curve
const createIx = await pumpSdk.createInstruction(
    mintPublicKey, // mint public key (must be signer)
    "Test",
    "TEST",
    "http://test-pump.fun",
    contractPublicKey, // creator public key (must be signer)
    contractPublicKey, // user public key
)
console.log(createIx, 'createIx')

console.log('Broadcasting Pump.fun create instruction via NeonEVM composability')
let [tx, receipt] = await execute(
    createIx,
    100000000,
    callPumpFunProgram,
    salt,
    wallets.user1
);
console.log(tx, 'tx');
console.log(receipt.logs[0].args, 'receipt args');

/*
let bondingCurve = await pumpSdk.fetchBondingCurve(mint.publicKey)
// console.log(bondingCurve, 'bondingCurve')
const bondingCurveAccountPublicKey = pumpSdk.bondingCurvePda(mint.publicKey)
// console.log(bondingCurveAccountPublicKey, 'bondingCurveAccountPublicKey')
const bondingCurveAccountInfo = await solanaConnection.getAccountInfo(bondingCurveAccountPublicKey)
// console.log(bondingCurveAccountInfo, 'bondingCurveAccountInfo')

// Buy token, reaching bonding curve's threshold
let TOKEN_AMOUNT = bondingCurve.realTokenReserves
let SOL_AMOUNT  = await getBuySolAmountFromTokenAmount(global, bondingCurve, TOKEN_AMOUNT, true)
console.log(SOL_AMOUNT.toString(), 'SOL_AMOUNT')
const buyInstructions = await pumpSdk.buyInstructions(
    global,
    bondingCurveAccountInfo,
    bondingCurve,
    mint.publicKey, // mint authority public key, set to pump.fun public key when creating through their front-end
    wallets.solanaUser1.publicKey, // user public key (?)
    TOKEN_AMOUNT,
    SOL_AMOUNT,
    500, // slippage bps?
    wallets.solanaUser1.publicKey // creator public key
)
tx = new web3.Transaction()
buyInstructions.forEach((ix) => {
    // console.log(ix, 'instruction')
    tx.add(ix)
})
console.log('Broadcasting Pump.fun buy instructions')
signature = await web3.sendAndConfirmTransaction(solanaConnection, tx, [wallets.solanaUser1])
console.log(signature, "signature")
// bondingCurve = await pumpSdk.fetchBondingCurve(mint.publicKey)
// console.log(bondingCurve, 'bondingCurve')

// Trigger PumpSwap pool creation (migrate instruction is executed automatically on devnet by account 5PXxuZkvftsg5CAGjv5LL5tEtvBRskdx1AAjxw8hK2Qx)
// Calculate the public key of the Pump AMM pool
const poolPubKey = (await canonicalPumpPoolPda(
    PUMP_PROGRAM_ID,
    PUMP_AMM_PROGRAM_ID,
    mint.publicKey,
))[0]
console.log(poolPubKey, 'poolPubKey')

const migrateIx = await pumpSdk.migrateInstruction(
    mint.publicKey, // mint authority public key, set to pump.fun public key when creating through their front-end
    wallets.solanaUser1.publicKey, // user public key (?)
)
// console.log(migrateIx, 'migrateIx')
tx = new web3.Transaction()
tx.add(migrateIx)
console.log('Broadcasting Pump.fun migrate instructions')
signature = await web3.sendAndConfirmTransaction(solanaConnection, tx, [wallets.solanaUser1])
console.log(signature, "signature")
// bondingCurve = await pumpSdk.fetchBondingCurve(mint.publicKey)
// console.log(bondingCurve, 'bondingCurve')

// Pump AMM swap
SOL_AMOUNT  = new BN(1000000)
// Quote to Base swap
const baseAmount = await pumpAmmSdk.swapAutocompleteBaseFromQuote(
    poolPubKey,
    SOL_AMOUNT,
    500, // bps?
    "quoteToBase",
);
console.log(baseAmount, 'baseAmount')

const swapInstructions = await pumpAmmSdk.swapBaseInstructions(
    poolPubKey,
    baseAmount,
    500,
    "quoteToBase",
    wallets.solanaUser1.publicKey,
)
tx = new web3.Transaction()
swapInstructions.forEach((ix) => {
    console.log(ix, 'instruction')
    tx.add(ix)
})
console.log('Broadcasting Pump.fun AMM swap instructions')
signature = await web3.sendAndConfirmTransaction(solanaConnection, tx, [wallets.solanaUser1])
console.log(signature, "signature")
*/