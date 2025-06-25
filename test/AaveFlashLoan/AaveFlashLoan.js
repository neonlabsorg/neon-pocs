import { network } from "hardhat"
import web3 from "@solana/web3.js"
import {
    getAssociatedTokenAddress
} from "@solana/spl-token"
import { AnchorProvider } from "@coral-xyz/anchor"
import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, swapQuoteByInputToken, IGNORE_CACHE, WhirlpoolIx, SwapUtils } from  "@orca-so/whirlpools-sdk"
import { DecimalUtil, Percentage } from "@orca-so/common-sdk"
import { Decimal } from "decimal.js"
import config  from "../config"
import createATA from "../helpers/CreateATAThroughSolanaWeb3"
import { getSecrets } from "../../neon-secrets.js";
import "dotenv/config"

if (process.env.ANCHOR_PROVIDER_URL != config.SOLANA_NODE || process.env.ANCHOR_WALLET == undefined) {
    console.warn('This script uses the @coral-xyz/anchor library which requires the variables ANCHOR_PROVIDER_URL and ANCHOR_WALLET to be set. Please create id.json in the root of the hardhat project with your Solana\'s private key and run the following command in the terminal in order to proceed with the script execution: \n\n export ANCHOR_PROVIDER_URL='+config.SOLANA_NODE+' && export ANCHOR_WALLET=./id.json');
    throw new Error("Missing ANCHOR_PROVIDER_URL and ANCHOR_WALLET environment variables")
}

let ethers;
let owner;
let solanaUser;
const AaveFlashLoanAddress = config.DATA.EVM.ADDRESSES.AAVE.AaveFlashLoanTest;
let AaveFlashLoan;
let USDC;
const RECEIPTS_COUNT = 1;
let contractPublicKey;
let neon_getEvmParams;

describe('Test init', async function () {
    before(async function() {
        const { wallets } = await getSecrets()
        owner = wallets.owner;
        solanaUser = wallets.solanaUser1
        ethers = (await network.connect()).ethers
        if (await ethers.provider.getBalance(owner.address) == 0) {
            await config.utils.airdropNEON(owner.address);
        }

        const AaveFlashLoanFactory = await ethers.getContractFactory('contracts/AaveFlashLoan/AaveFlashLoan.sol:AaveFlashLoan', owner);
        USDC = await ethers.getContractAt('contracts/interfaces/IERC20ForSpl.sol:IERC20ForSpl', config.DATA.EVM.ADDRESSES.devUSDC, owner);

        const neon_getEvmParamsRequest = await fetch("https://devnet.neonevm.org", {
            method: 'POST',
            body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
            headers: { 'Content-Type': 'application/json' }
        });
        neon_getEvmParams = await neon_getEvmParamsRequest.json();

        if (ethers.isAddress(AaveFlashLoanAddress)) {
            console.log('\AaveFlashLoan used at', "\x1b[32m", AaveFlashLoanAddress, "\x1b[30m", '\n');
            AaveFlashLoan = AaveFlashLoanFactory.attach(AaveFlashLoanAddress);
        } else {
            AaveFlashLoan = await ethers.deployContract(
                'contracts/AaveFlashLoan/AaveFlashLoan.sol:AaveFlashLoan',
                [
                    config.DATA.EVM.ADDRESSES.AAVE.ADDRESS_PROVIDER
                ],
                owner);
            await AaveFlashLoan.waitForDeployment();
            console.log('\AaveFlashLoan deployed at', "\x1b[32m", AaveFlashLoan.target, "\x1b[30m", '\n');
        }

        const contractPublicKeyInBytes = await AaveFlashLoan.getNeonAddress(AaveFlashLoan.target);
        contractPublicKey = ethers.encodeBase58(contractPublicKeyInBytes);
        console.log(contractPublicKey, 'contractPublicKey');

        console.log(ethers.encodeBase58(await USDC.tokenMint()), 'tokenMint');

        await createATA(solanaUser, [new web3.PublicKey(contractPublicKey)]);
    });

    describe('ERC20ForSPL tests', function() {
        it('Validate Aave V3 flash loan with composability', async function () {
            let tx;
            // dummy transfer to the contract so it could be able to repay the flashloan fee
            if (await USDC.balanceOf(AaveFlashLoan.target) == 0) {
                console.log('Transferring some USDC to the contract so it could be able to repay the flashloan fee.');
                tx = await USDC.transfer(AaveFlashLoan.target, '1000000');
                await tx.wait(RECEIPTS_COUNT); 
            }

            const flashLoanRequestAmount = '10000000'; // 10 USDC
            const orcaSwapInstructions = await buildOrcaSwap(flashLoanRequestAmount);
            console.log(orcaSwapInstructions, 'orcaSwapInstructions');

            console.log(await USDC.balanceOf(AaveFlashLoan.target), 'balanceOf');

            tx = await AaveFlashLoan.flashLoanSimple(
                config.DATA.EVM.ADDRESSES.devUSDC,
                flashLoanRequestAmount,
                config.utils.prepareInstruction(ethers, orcaSwapInstructions[0].instructions[0]),
                config.utils.prepareInstruction(ethers, orcaSwapInstructions[1].instructions[0])
            );
            await tx.wait(RECEIPTS_COUNT);

            console.log('\n\n\n');
            console.log(tx.hash, 'Transaction hash');
            console.log(await USDC.balanceOf(AaveFlashLoan.target), 'Contract USDC balanceOf');
            console.log(await AaveFlashLoan.lastLoan(), 'lastLoan');
            console.log(await AaveFlashLoan.lastLoanFee(), 'lastLoanFee');
        });
    });
});

async function buildOrcaSwap(amountIn) {
    amountIn = new Decimal(amountIn / 10 ** 6);

    const provider = AnchorProvider.env();
    const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);
    
    const TokenA = {mint: new web3.PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6}; // devUSDC
    const TokenB = {mint: new web3.PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9}; // devSAMO
    const tickSpacing = 64;

    const whirlpool_pubkey = PDAUtil.getWhirlpool(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        new web3.PublicKey(config.DATA.SVM.ADDRESSES.WHIRLPOOLS_CONFIG),
        TokenB.mint,
        TokenA.mint,
        tickSpacing // tick spacing
    ).publicKey;
    const whirlpool = await client.getPool(whirlpool_pubkey);
    
    const ataContractTokenA = await getAssociatedTokenAddress(
        TokenA.mint,
        new web3.PublicKey(contractPublicKey),
        true
    );

    const ataContractTokenB = await getAssociatedTokenAddress(
        TokenB.mint,
        new web3.PublicKey(contractPublicKey),
        true
    );

    const contractPDAdevUSDC = config.utils.calculatePdaAccount(
        'ContractData',
        USDC.target,
        AaveFlashLoan.target,
        new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
    )[0];
    console.log(contractPDAdevUSDC, 'contractPDAdevUSDC');

    // Obtain swap estimation (run simulation)
    const quote1 = await swapQuoteByInputToken(
        whirlpool,
        TokenA.mint,
        DecimalUtil.toBN(amountIn, TokenA.decimals), // Input Token Mint amount
        Percentage.fromFraction(0, 1000), // 0 slippage
        ctx.program.programId,
        ctx.fetcher,
        IGNORE_CACHE
    );

    // Output the estimation
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote1.estimatedAmountIn, TokenA.decimals).toString(), "TokenA");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote1.estimatedAmountOut, TokenB.decimals).toString(), "TokenB");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote1.otherAmountThreshold, TokenB.decimals).toString(), "TokenB");

    let swaps = [];
    swaps[0] = WhirlpoolIx.swapIx(
        ctx.program,
        SwapUtils.getSwapParamsFromQuote(
            quote1,
            ctx,
            whirlpool,
            ataContractTokenA,
            ataContractTokenB,
            new web3.PublicKey(contractPublicKey)
        )
    );

    // Obtain swap estimation (run simulation)
    const quote2 = await swapQuoteByInputToken(
        whirlpool,
        TokenB.mint,
        DecimalUtil.toBN(new Decimal(DecimalUtil.fromBN(quote1.estimatedAmountOut, TokenB.decimals).toString()), TokenB.decimals), // Input Token Mint amount
        Percentage.fromFraction(5, 1000), // Acceptable slippage (5/1000 = 5%)
        ctx.program.programId,
        ctx.fetcher,
        IGNORE_CACHE
    );

    // Output the estimation
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote2.estimatedAmountIn, TokenB.decimals).toString(), "TokenA");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote2.estimatedAmountOut, TokenA.decimals).toString(), "TokenB");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote2.otherAmountThreshold, TokenA.decimals).toString(), "TokenB");

    swaps[1] = WhirlpoolIx.swapIx(
        ctx.program,
        SwapUtils.getSwapParamsFromQuote(
            quote2,
            ctx,
            whirlpool,
            ataContractTokenB,
            contractPDAdevUSDC,
            new web3.PublicKey(contractPublicKey)
        )
    );

    return swaps;
}
