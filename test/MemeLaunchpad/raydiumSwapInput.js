const web3 = require("@solana/web3.js");
const {
    Raydium,
    TxVersion,
    Percent,
    DEV_CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_PROGRAM,
    CurveCalculator
} = require("@raydium-io/raydium-sdk-v2");
const {
    NATIVE_MINT
} = require("@solana/spl-token");
const BN = require('bn.js');
const Decimal = require('decimal.js');
const { config } = require('../config');
const bs58 = require("bs58");
require("dotenv").config();

const connection = new web3.Connection(config.SOLANA_NODE, "processed");
if (process.env.ANCHOR_WALLET == undefined) {
    console.error('Please create id.json in the root of the hardhat project with your Solana\'s private key and run the following command in the terminal in order to proceed with the script execution: \n\n export ANCHOR_WALLET=./id.json');
    process.exit();
}
const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);

const VALID_PROGRAM_ID = new Set([CREATE_CPMM_POOL_PROGRAM.toBase58(), DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()])
function isValidCpmm(id) {
    return VALID_PROGRAM_ID.has(id);
}

async function raydiumSwapInput(poolId) {
    console.log('raydiumSwapInput', poolId);

    const raydium = await Raydium.load({
        connection,
        owner: keypair, // key pair or publicKey, if you run a node process, provide keyPair
        cluster: "devnet", // 'mainnet' | 'devnet'
        disableFeatureCheck: true,
        blockhashCommitment: "finalized",
    });

    poolId = new web3.PublicKey(poolId);
    let poolInfo;
    let poolKeys;
    let rpcData;
    
    if (raydium.cluster === "mainnet") {
        const data = await raydium.api.fetchPoolById({ ids: poolId });
        poolInfo = data[0];
        if (!isValidCpmm(poolInfo.programId))
          throw new Error("Target pool is not CPMM pool");
    } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
        poolInfo = data.poolInfo;
        poolKeys = data.poolKeys;
        rpcData = data.rpcData
    }

    const inputMint = NATIVE_MINT.toBase58(); // wSOL
    const uiInputAmount = '0.001';
    const inputAmount = new BN(new Decimal(uiInputAmount).mul(10 ** 9).toFixed(0));
    const slippage = new Percent(5, 100); // 5%
    const baseIn = inputMint === poolInfo.mintA.address;

    const balance = await connection.getBalance(keypair.publicKey);
    if (balance < uiInputAmount * 10 ** 9) {
        console.error('Not enough SOL balance. Needed', uiInputAmount, 'SOLs, having', balance);
        return;
    }

    const swapResult = CurveCalculator.swap(
        inputAmount,
        baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
        baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
        rpcData.configInfo.tradeFeeRate
    )

    const { execute, extInfo, transaction } = await raydium.cpmm.swap({
        poolKeys, // devnet
        poolInfo,
        inputAmount,
        swapResult,
        slippage,
        baseIn,
        txVersion: TxVersion.LEGACY
    });

    const { txId } = await execute({ sendAndConfirm: false });
    console.log(txId, 'txId');
    return;
}

module.exports = {
    raydiumSwapInput
};
  