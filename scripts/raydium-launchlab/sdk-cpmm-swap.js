// See example: https://github.com/raydium-io/raydium-sdk-V2/blob/566e8b6dab65cc892f91b90a59b341442760a0c6/src/raydium/cpmm/cpmm.ts#L662C3-L803C4
import web3 from "@solana/web3.js"
import { NATIVE_MINT, TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import BN from "bn.js";
import Decimal from "decimal.js";
import {
    TxVersion,
    TxBuilder,
    CurveCalculator,
    InstructionType,
    CpmmPoolInfoLayout,
    CpmmConfigInfoLayout,
    getPdaObservationId,
    getCreatePoolKeys,
    makeSwapCpmmBaseInInstruction,
    makeSwapCpmmBaseOutInstruction,
    getMultipleAccountsInfoWithCustomFlags,
} from '@raydium-io/raydium-sdk-v2'

const slippage = new BN(1) // 100%
const swapParams = {
    baseIn: false,
    fixedOut: false,
    config: {
        bypassAssociatedCheck: false,
        checkCreateATAOwner: true,
        associatedOnly: false,
    }
}

export async function swap(raydium, feePayer, cpmmPoolId, inputAmount) {
    const {
        baseIn,
        fixedOut,
        config
    } = swapParams;

    const { bypassAssociatedCheck, checkCreateATAOwner, associatedOnly } = {
        // default
        ...{ bypassAssociatedCheck: false, checkCreateATAOwner: false, associatedOnly: true },
        // custom
        ...config,
    };

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

    const poolInfo = await getRpcPoolInfo(raydium, cpmmPoolId.publicKey.toBase58(), true)
    console.log(poolInfo, 'poolInfo')
    const mintA = poolInfo.mintA
    const mintB = poolInfo.mintB

    const swapResult = CurveCalculator.swap(
        inputAmount,
        baseIn ? poolInfo.baseReserve : poolInfo.quoteReserve,
        baseIn ? poolInfo.quoteReserve : poolInfo.baseReserve,
        poolInfo.configInfo.tradeFeeRate,
    );

    if (!fixedOut) {
        swapResult.destinationAmountSwapped = swapResult.destinationAmountSwapped
            .mul(new BN((1 - slippage) * 10000))
            .div(new BN(10000));
    } else {
        swapResult.sourceAmountSwapped = swapResult.sourceAmountSwapped
            .mul(new BN((1 + slippage) * 10000))
            .div(new BN(10000));
    }
    
    const mintAUseSOLBalance = poolInfo.mintA.toBase58() === NATIVE_MINT.toBase58();
    const mintBUseSOLBalance = poolInfo.mintB.toBase58() === NATIVE_MINT.toBase58();
    
    const { account: mintATokenAcc, instructionParams: mintATokenAccInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: mintA,
            tokenProgram: new web3.PublicKey(poolInfo.mintA.programId ?? TOKEN_PROGRAM_ID),
            owner: raydium.ownerPubKey,
            createInfo:
                mintAUseSOLBalance || !baseIn
                    ? {
                        payer: raydium.ownerPubKey,
                        amount: baseIn ? swapResult.sourceAmountSwapped : 0,
                    }
                    : undefined,
            notUseTokenAccount: mintAUseSOLBalance,
            skipCloseAccount: !mintAUseSOLBalance,
            associatedOnly: mintAUseSOLBalance ? false : associatedOnly,
            checkCreateATAOwner,
        });

    if(mintATokenAccInstruction) txBuilder.addInstruction(mintATokenAccInstruction);
    
    const { account: mintBTokenAcc, instructionParams: mintBTokenAccInstruction } =
        await raydium.account.getOrCreateTokenAccount({
            mint: mintB,
            tokenProgram: new web3.PublicKey(poolInfo.mintB.programId ?? TOKEN_PROGRAM_ID),
            owner: raydium.ownerPubKey,
            createInfo:
                mintBUseSOLBalance || baseIn
                    ? {
                        payer: raydium.ownerPubKey,
                        amount: baseIn ? 0 : swapResult.sourceAmountSwapped,
                    }
                    : undefined,
            notUseTokenAccount: mintBUseSOLBalance,
            skipCloseAccount: !mintBUseSOLBalance,
            associatedOnly: mintBUseSOLBalance ? false : associatedOnly,
            checkCreateATAOwner,
        });

    if(mintBTokenAccInstruction) txBuilder.addInstruction(mintBTokenAccInstruction);
    
    if (!mintATokenAcc || !mintBTokenAcc)
        console.error("user do not have token account", {
            mintA: poolInfo.mintA.toBase58(),
            mintB: poolInfo.mintB.toBase58(),
            mintATokenAcc,
            mintBTokenAcc,
            mintAUseSOLBalance,
            mintBUseSOLBalance,
            associatedOnly,
        });
    
    const poolKeys = getCreatePoolKeys({
        poolId: cpmmPoolId.publicKey,
        programId: poolInfo.programId,
        configId: poolInfo.configId,
        mintA: poolInfo.mintA,
        mintB: poolInfo.mintB
    });
    console.log(poolKeys, 'poolKeys')

    txBuilder.addInstruction({
        instructions: [
            !fixedOut
                ? makeSwapCpmmBaseInInstruction(
                    new web3.PublicKey(poolInfo.programId),
                    raydium.ownerPubKey,
                    new web3.PublicKey(poolKeys.authority),
                    new web3.PublicKey(poolKeys.configId),
                    new web3.PublicKey(cpmmPoolId.publicKey),
                    baseIn ? mintATokenAcc : mintBTokenAcc,
                    baseIn ? mintBTokenAcc : mintATokenAcc,
                    baseIn ? new web3.PublicKey(poolKeys.vaultA) : new web3.PublicKey(poolKeys.vaultB),
                    baseIn ? new web3.PublicKey(poolKeys.vaultB) : new web3.PublicKey(poolKeys.vaultA),
                    new web3.PublicKey(poolInfo[baseIn ? "mintA" : "mintB"].programId ?? TOKEN_PROGRAM_ID),
                    new web3.PublicKey(poolInfo[baseIn ? "mintB" : "mintA"].programId ?? TOKEN_PROGRAM_ID),
                    baseIn ? mintA : mintB,
                    baseIn ? mintB : mintA,
                    getPdaObservationId(new web3.PublicKey(poolInfo.programId), new web3.PublicKey(cpmmPoolId.publicKey)).publicKey,
                    inputAmount,
                    swapResult.destinationAmountSwapped,
                )
                : makeSwapCpmmBaseOutInstruction(
                    new web3.PublicKey(poolInfo.programId),
                    raydium.ownerPubKey,
                    new web3.PublicKey(poolKeys.authority),
                    new web3.PublicKey(poolKeys.configId),
                    new web3.PublicKey(cpmmPoolId.publicKey),
                    baseIn ? mintATokenAcc : mintBTokenAcc,
                    baseIn ? mintBTokenAcc : mintATokenAcc,
                    baseIn ? new web3.PublicKey(poolKeys.vaultA) : new web3.PublicKey(poolKeys.vaultB),
                    baseIn ? new web3.PublicKey(poolKeys.vaultB) : new web3.PublicKey(poolKeys.vaultA),
                    new web3.PublicKey(poolInfo[baseIn ? "mintA" : "mintB"].programId ?? TOKEN_PROGRAM_ID),
                    new web3.PublicKey(poolInfo[baseIn ? "mintB" : "mintA"].programId ?? TOKEN_PROGRAM_ID),
                    baseIn ? mintA : mintB,
                    baseIn ? mintB : mintA,
                    getPdaObservationId(new web3.PublicKey(poolInfo.programId), new web3.PublicKey(cpmmPoolId.publicKey)).publicKey,
                    swapResult.sourceAmountSwapped,
                    swapResult.destinationAmountSwapped,
                ),
        ],
        instructionTypes: [fixedOut ? InstructionType.CpmmSwapBaseOut : InstructionType.ClmmSwapBaseIn],
    });
    
    // txBuilder.addCustomComputeBudget(computeBudgetConfig);
    // txBuilder.addTipInstruction(txTipConfig);

    const { transaction, extInfo, execute } = await txBuilder.versionBuild({
        txVersion: TxVersion.V0
    })

    return { extInfo, transaction, execute }
}

async function getRpcPoolInfo(raydium, poolId, fetchConfigInfo) {
    return (await getRpcPoolInfos(raydium, [poolId], fetchConfigInfo))[poolId];
}

async function getRpcPoolInfos(
    raydium,
    poolIds,
    fetchConfigInfo,
) {
    const accounts = await getMultipleAccountsInfoWithCustomFlags(
        raydium.connection,
        poolIds.map((i) => ({ pubkey: new web3.PublicKey(i) })),
    );
    const poolInfos = {};

    const needFetchConfigId = new Set();
    const needFetchVaults = [];

    for (let i = 0; i < poolIds.length; i++) {
        const item = accounts[i];
        if (item.accountInfo === null) throw Error("fetch pool info error: " + String(poolIds[i]));
        const rpc = CpmmPoolInfoLayout.decode(item.accountInfo.data);
        poolInfos[poolIds[i]] = {
            ...rpc,
            programId: item.accountInfo.owner,
        };
        needFetchConfigId.add(rpc.configId);

        needFetchVaults.push(rpc.vaultA, rpc.vaultB);
    }

    const configInfo = {};

    if (fetchConfigInfo) {
        const configIds = [...needFetchConfigId];
        const configState = await getMultipleAccountsInfoWithCustomFlags(
            raydium.connection,
            configIds.map((i) => ({ pubkey: new web3.PublicKey(i) })),
        );

        for (let i = 0; i < configIds.length; i++) {
            const configItemInfo = configState[i].accountInfo;
            if (configItemInfo === null) throw Error("fetch pool config error: " + configIds[i]);
            configInfo[configIds[i]] = CpmmConfigInfoLayout.decode(configItemInfo.data);
        }
    }

    const vaultInfo = {};

    const vaultAccountInfo = await getMultipleAccountsInfoWithCustomFlags(
        raydium.connection,
        needFetchVaults.map((i) => ({ pubkey: new web3.PublicKey(i) })),
    );

    for (let i = 0; i < needFetchVaults.length; i++) {
        const vaultItemInfo = vaultAccountInfo[i].accountInfo;
        if (vaultItemInfo === null) throw Error("fetch vault info error: " + needFetchVaults[i]);

        vaultInfo[needFetchVaults[i]] = new BN(AccountLayout.decode(vaultItemInfo.data).amount.toString());
    }

    const returnData = {};

    for (const [id, info] of Object.entries(poolInfos)) {
        const baseReserve = vaultInfo[info.vaultA.toString()].sub(info.protocolFeesMintA).sub(info.fundFeesMintA);
        const quoteReserve = vaultInfo[info.vaultB.toString()].sub(info.protocolFeesMintB).sub(info.fundFeesMintB);
        returnData[id] = {
            ...info,
            baseReserve,
            quoteReserve,
            vaultAAmount: vaultInfo[info.vaultA.toString()],
            vaultBAmount: vaultInfo[info.vaultB.toString()],
            configInfo: configInfo[info.configId.toString()],
            poolPrice: new Decimal(quoteReserve.toString())
                .div(new Decimal(10).pow(info.mintDecimalB))
                .div(new Decimal(baseReserve.toString()).div(new Decimal(10).pow(info.mintDecimalA))),
        };
    }

    return returnData;
}