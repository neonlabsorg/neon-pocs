// See documentation: https://docs.raydium.io/raydium/pool-creation/launchlab/launchlab-typescript-sdk
// See example: https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/src/launchpad/createMint.ts
import web3 from "@solana/web3.js"
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import BN from "bn.js";
import Decimal from "decimal.js";
import {
    TxVersion,
    LaunchpadConfig,
    LaunchpadPool,
    PlatformConfig,
    Curve,
    getPdaLaunchpadPoolId,
    getPdaLaunchpadAuth,
    getATAAddress,
    getMultipleAccountsInfoWithCustomFlags,
    buyExactInInstruction,
    sellExactInInstruction,
    TxBuilder
} from '@raydium-io/raydium-sdk-v2'

const SLIPPAGE_UNIT = new BN(10_000);
const slippage = new BN(100) // 1%
const shareFeeRate = new BN(0)
const shareFeeReceiver = web3.Keypair.generate().publicKey
const associatedOnly = true
const checkCreateATAOwner = false

export async function buyToken(raydium, programId, configId, tokenMint, feePayer, buyAmount) {
    const configData = await raydium.connection.getAccountInfo(configId)
    if (!configData) throw new Error('config not found')
    let configInfo = LaunchpadConfig.decode(configData.data)
    const mintB = configInfo.mintB

    if (buyAmount.lte(new BN(0))) console.error("buy amount should gt 0:", buyAmount.toString());

    const txBuilder = new TxBuilder({
        connection: raydium.connection,
        feePayer: feePayer.publicKey || raydium.ownerPubKey,
        cluster: raydium.cluster,
        owner: raydium.owner,
        blockhashCommitment: raydium.blockhashCommitment,
        loopMultiTxStatus: raydium.loopMultiTxStatus,
        api: raydium.api,
        signAllTransactions: raydium.signAllTransactions,
    })

    const { publicKey: poolId } = getPdaLaunchpadPoolId(programId, tokenMint, mintB);
    const authProgramId = getPdaLaunchpadAuth(programId).publicKey;

    let userTokenAccountA = null;
    let userTokenAccountB = null;

    const mintBUseSOLBalance = mintB.equals(NATIVE_MINT);

    const { account: _ownerTokenAccountA, instructionParams: _tokenAccountAInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: tokenMint,
            owner: raydium.ownerPubKey,
            createInfo: {
                payer: raydium.ownerPubKey,
                amount: 0,
            },
            skipCloseAccount: true,
            notUseTokenAccount: false,
            associatedOnly,
            checkCreateATAOwner,
        });
    if (_ownerTokenAccountA) userTokenAccountA = _ownerTokenAccountA;
    txBuilder.addInstruction(_tokenAccountAInstruction || {});

    if (!userTokenAccountA)
        console.error(
            `cannot find tokenMint(${tokenMint.toBase58()}) token accounts`,
            // "tokenAccounts",
            // raydium.account.tokenAccounts,
        );

    const { account: _ownerTokenAccountB, instructionParams: _tokenAccountBInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: mintB,
            owner: raydium.ownerPubKey,
            createInfo: mintBUseSOLBalance
                ? {
                    payer: raydium.ownerPubKey,
                    amount: buyAmount,
                }
                : undefined,
        skipCloseAccount: !mintBUseSOLBalance,
        notUseTokenAccount: mintBUseSOLBalance,
        associatedOnly: mintBUseSOLBalance ? false : associatedOnly,
        checkCreateATAOwner,
    });
    if (_ownerTokenAccountB) userTokenAccountB = _ownerTokenAccountB;
    txBuilder.addInstruction(_tokenAccountBInstruction || {});
    if (userTokenAccountB === undefined)
        console.error(
            `cannot find mintB(${mintB.toBase58()}) token accounts`,
            // "tokenAccounts",
            // raydium.account.tokenAccounts,
        );

    let poolInfo;
    if (!poolInfo) {
        const poolData = await raydium.connection.getAccountInfo(poolId, { commitment: "confirmed" });
        if (!poolData) console.error("cannot find pool:", poolId.toBase58());
        poolInfo = LaunchpadPool.decode(poolData.data);
    }

    let platformFeeRate
    const allData = await getMultipleAccountsInfoWithCustomFlags(
        raydium.connection,
        [configInfo ? undefined : poolInfo.configId, platformFeeRate ? undefined : poolInfo.platformId]
            .filter(Boolean)
            .map((key) => ({ pubkey: key })),
    );
    if (!configInfo) {
        const data = allData.find((d) => d.pubkey.equals(poolInfo.configId));
        if (!data || !data.accountInfo) console.error("config not found: ", poolInfo.configId.toBase58());
        configInfo = LaunchpadConfig.decode(data.accountInfo.data);
    }
    if (!platformFeeRate) {
        const data = allData.find((d) => d.pubkey.equals(poolInfo.platformId));
        if (!data || !data.accountInfo) console.error("platform info not found: ", poolInfo.configId.toBase58());
        platformFeeRate = PlatformConfig.decode(data.accountInfo.data).feeRate;
    }

    const calculatedAmount = Curve.buyExactIn({
        poolInfo,
        amountB: buyAmount,
        protocolFeeRate: configInfo.tradeFeeRate,
        platformFeeRate,
        curveType: configInfo.curveType,
        shareFeeRate,
    });

    const decimalAmountA = new Decimal(calculatedAmount.amountA.toString());
    const multiplier = slippage
        ? new Decimal(SLIPPAGE_UNIT.sub(slippage).toNumber() / SLIPPAGE_UNIT.toNumber()).clampedTo(0, 1)
        : new Decimal(1);

    const minMintAAmount = (slippage ? new BN(decimalAmountA.mul(multiplier).toFixed(0)) : calculatedAmount.amountA);

    if (calculatedAmount.amountB.lt(buyAmount)) {
        console.log(
            `maximum ${tokenMint.toBase58()} amount can buy is ${calculatedAmount.amountA.toString()}, input ${mintB.toBase58()} amount: ${calculatedAmount.amountB.toString()}`,
        );
    }

    // let shareFeeReceiverATA: PublicKey | undefined;
    // if (shareFeeReceiver) {
    // if (mintB.equals(NATIVE_MINT)) {
    //   const { addresses, ...txInstruction } = await createWSolAccountInstructions({
    //     connection: raydium.connection,
    //     owner: shareFeeReceiver,
    //     payer: raydium.ownerPubKey,
    //     amount: 0,
    //     skipCloseAccount: true,
    //   });
    //   txBuilder.addInstruction(txInstruction);
    //   shareFeeReceiverATA = addresses.newAccount;
    // } else {
    //   shareFeeReceiverATA = getATAAddress(shareFeeReceiver, mintB, TOKEN_PROGRAM_ID).publicKey;
    //   txBuilder.addInstruction({
    //     instructions: [
    //       createAssociatedTokenAccountIdempotentInstruction(raydium.ownerPubKey, shareFeeReceiverATA, shareFeeReceiver!, mintB),
    //     ],
    //   });
    //   // }
    // }

    const shareFeeReceiverATA = shareFeeReceiver ? getATAAddress(shareFeeReceiver, mintB, TOKEN_PROGRAM_ID).publicKey : undefined;
    if (shareFeeReceiverATA) {
        txBuilder.addInstruction({
            instructions: [
                createAssociatedTokenAccountIdempotentInstruction(raydium.ownerPubKey, shareFeeReceiverATA, shareFeeReceiver, mintB),
            ],
        });
    }

    txBuilder.addInstruction({
        instructions: [
            buyExactInInstruction(
                programId,
                raydium.ownerPubKey,
                authProgramId,
                poolInfo.configId,
                poolInfo.platformId,
                poolId,
                userTokenAccountA,
                userTokenAccountB,
                poolInfo.vaultA,
                poolInfo.vaultB,
                tokenMint,
                mintB,
                TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                calculatedAmount.amountB.lt(buyAmount) ? calculatedAmount.amountB : buyAmount,
                minMintAAmount,
                shareFeeRate,
                shareFeeReceiverATA,
            ),
        ],
    });

    // txBuilder.addCustomComputeBudget(computeBudgetConfig);
    // txBuilder.addTipInstruction(txTipConfig);

    const { transaction, extInfo, execute } = await txBuilder.versionBuild({
        txVersion: TxVersion.V0,
        extInfo: {
            outAmount: minMintAAmount,
        },
    })

    return { extInfo, transaction, execute }
}




export async function sellToken(raydium, programId, configId, tokenMint, feePayer, sellAmount) {
    const configData = await raydium.connection.getAccountInfo(configId)
    if (!configData) throw new Error('config not found')
    let configInfo = LaunchpadConfig.decode(configData.data)
    const mintB = configInfo.mintB

    const txBuilder = new TxBuilder({
        connection: raydium.connection,
        feePayer: feePayer.publicKey || raydium.ownerPubKey,
        cluster: raydium.cluster,
        owner: raydium.owner,
        blockhashCommitment: raydium.blockhashCommitment,
        loopMultiTxStatus: raydium.loopMultiTxStatus,
        api: raydium.api,
        signAllTransactions: raydium.signAllTransactions,
    })

    const { publicKey: poolId } = getPdaLaunchpadPoolId(programId, tokenMint, mintB);
    const authProgramId = getPdaLaunchpadAuth(programId).publicKey;
    
    if (sellAmount.lte(new BN(0))) console.error("sell amount should be gt 0");
    
    let userTokenAccountA = null;
    let userTokenAccountB = null;

    const mintBUseSOLBalance = mintB.equals(NATIVE_MINT);

    const { account: _ownerTokenAccountA, instructionParams: _tokenAccountAInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: tokenMint,
            owner: raydium.ownerPubKey,
            createInfo: {
                payer: raydium.ownerPubKey,
                amount: 0,
            },
            skipCloseAccount: true,
            notUseTokenAccount: false,
            associatedOnly,
            checkCreateATAOwner: true,
        });

    console.log(_ownerTokenAccountA, '_ownerTokenAccountA')

    if (_ownerTokenAccountA) userTokenAccountA = _ownerTokenAccountA;
    txBuilder.addInstruction(_tokenAccountAInstruction || {});

    if (!userTokenAccountA)
        console.error(
            "cannot find tokenMint token accounts",
            // "tokenAccounts",
            // raydium.account.tokenAccounts
        );

    const { account: _ownerTokenAccountB, instructionParams: _tokenAccountBInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: mintB,
            owner: raydium.ownerPubKey,
            createInfo: mintBUseSOLBalance
                ? {
                    payer: raydium.ownerPubKey,
                    amount: 0,
                }
                : undefined,
            skipCloseAccount: !mintBUseSOLBalance,
            notUseTokenAccount: mintBUseSOLBalance,
            associatedOnly: mintBUseSOLBalance ? false : associatedOnly,
            checkCreateATAOwner
        })

    if (_ownerTokenAccountB) userTokenAccountB = _ownerTokenAccountB;
    txBuilder.addInstruction(_tokenAccountBInstruction || {});

    if (userTokenAccountB === undefined)
        console.error(
            "cannot find mintB token accounts",
            // "tokenAccounts",
            // raydium.account.tokenAccounts
        );

    let poolInfo;
    if (!poolInfo) {
        const poolData = await raydium.connection.getAccountInfo(poolId);
        if (!poolData) console.error("cannot find pool", poolId.toBase58());
        poolInfo = LaunchpadPool.decode(poolData.data);
        console.log(poolInfo, 'poolInfo')
    }

    let platformFeeRate
    const allData = await getMultipleAccountsInfoWithCustomFlags(
        raydium.connection,
        [configInfo ? undefined : poolInfo.configId, platformFeeRate ? undefined : poolInfo.platformId]
            .filter(Boolean)
            .map((key) => ({ pubkey: key })),
    );
    if (!configInfo) {
        const data = allData.find((d) => d.pubkey.equals(poolInfo.configId));
        if (!data || !data.accountInfo) console.error("config not found: ", poolInfo.configId.toBase58());
        configInfo = LaunchpadConfig.decode(data.accountInfo.data);
    }
    if (!platformFeeRate) {
        const data = allData.find((d) => d.pubkey.equals(poolInfo.platformId));
        if (!data || !data.accountInfo) console.error("platform info not found: ", poolInfo.configId.toBase58());
        platformFeeRate = PlatformConfig.decode(data.accountInfo.data).feeRate;
    }

    const calculatedAmount = Curve.sellExactIn({
        poolInfo,
        amountA: sellAmount,
        protocolFeeRate: configInfo.tradeFeeRate,
        platformFeeRate,
        curveType: configInfo.curveType,
        shareFeeRate,
    });

    const decimalAmountB = new Decimal(calculatedAmount.amountB.toString());
    const multiplier = slippage
        ? new Decimal(SLIPPAGE_UNIT.sub(slippage).toNumber() / SLIPPAGE_UNIT.toNumber()).clampedTo(0, 1)
        : new Decimal(1);

    const minAmountB = (slippage ? new BN(decimalAmountB.mul(multiplier).toFixed(0)) : calculatedAmount.amountB);

    if (minAmountB.lte(new BN(0))) console.error(`out ${mintB.toBase58()} amount should be gt 0`);

    const shareFeeReceiverATA = shareFeeReceiver ? getATAAddress(shareFeeReceiver, mintB, TOKEN_PROGRAM_ID).publicKey : undefined;
    if (shareFeeReceiverATA) {
        txBuilder.addInstruction({
            instructions: [
                createAssociatedTokenAccountIdempotentInstruction(raydium.ownerPubKey, shareFeeReceiverATA, shareFeeReceiver, mintB),
            ],
        });
    }

    txBuilder.addInstruction({
        instructions: [
            sellExactInInstruction(
                programId,
                raydium.ownerPubKey,
                authProgramId,
                poolInfo.configId,
                poolInfo.platformId,
                poolId,
                userTokenAccountA,
                userTokenAccountB,
                poolInfo.vaultA,
                poolInfo.vaultB,
                tokenMint,
                mintB,
                TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                calculatedAmount.amountA.lt(sellAmount) ? calculatedAmount.amountA : sellAmount,
                minAmountB,
                shareFeeRate,
                shareFeeReceiverATA
            )
        ]
    })

    // txBuilder.addCustomComputeBudget(computeBudgetConfig);
    // txBuilder.addTipInstruction(txTipConfig);

    const { transaction, extInfo, execute } = await txBuilder.versionBuild({
        txVersion: TxVersion.V0,
        extInfo: {
            outAmount: minAmountB,
        },
    })
    // console.log(extInfo, 'extInfo')

    return { extInfo, transaction, execute }
}
