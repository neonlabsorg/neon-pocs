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
import { airdropSOL } from "../utils.js";
import config from "../config.js"

const { wallets } = await getSecrets()
const solanaConnection = new web3.Connection(config.svm_node[hre.globalOptions.network], "processed")
const pumpSdk = new PumpSdk(solanaConnection)
const pumpAmmSdk = new PumpAmmSdk(solanaConnection)
const global = await pumpSdk.fetchGlobal()

// See documentation: https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md

const mint = await web3.Keypair.generate()
// Airdrop some SOL to token creator
await airdropSOL(wallets.solanaUser1.publicKey, 100000000)

// Deploy SPL token and bonding curve
const createIx = await pumpSdk.createInstruction(
    mint.publicKey, // mint public key
    "Test",
    "TEST",
    "http://test-pump.fun",
    wallets.solanaUser1.publicKey, // creator public key
    wallets.solanaUser1.publicKey // user public key
)
// console.log(createIx, 'createIx')
let tx = new web3.Transaction()
tx.add(createIx)
console.log('Broadcasting Pump.fun create instruction')
let signature = await web3.sendAndConfirmTransaction(solanaConnection, tx, [wallets.solanaUser1, mint])
console.log(signature, "signature")

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
