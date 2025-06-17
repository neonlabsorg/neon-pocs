import hre, { network, globalOptions } from "hardhat"
import web3 from "@solana/web3.js";
import config from "./config";
import BN from 'bn.js';
import {
    PoolUtils,
    Raydium,
    TxVersion
} from "@raydium-io/raydium-sdk-v2";
import { expect } from "chai";
import { getSecrets } from "../../neon-secrets.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import createATA from "../helpers/CreateATAThroughSolanaWeb3";

describe('Test init', async function () {
    let user1;
    let solanaUser;
    let TestComposability;
    let tx;
    let ethers;
    let contractPublicKey;
    let TestComposabilityAddress = config.TestComposability;
    const connection = new web3.Connection(config.SOLANA_NODE_MAINNET, "processed");
    let TokenA;
    let TokenB;
    let raydium;

    const swapConfig = {
        TokenA: {
            SVM: config.DATA.SVM.ADDRESSES.USDC,
            EVM: config.DATA.EVM.ADDRESSES.USDC
        },
        TokenB: {
            SVM: config.DATA.SVM.ADDRESSES.USDT,
            EVM: config.DATA.EVM.ADDRESSES.USDT
        },
        TokenAAmount: new BN(100),
        TokenADecimals: 6,
        slippage: 0.01
    };

    before(async function() {
        ethers = (await network.connect()).ethers
        const { wallets } = await getSecrets()
        user1 = wallets.owner;
        solanaUser = wallets.solanaUser1;

        const TestComposabilityFactory = await ethers.getContractFactory("contracts/off-chain-composability/TestComposability.sol:TestComposability");

        if (ethers.isAddress(TestComposabilityAddress)) {
            TestComposability = TestComposabilityFactory.attach(TestComposabilityAddress);
            console.log(
                `TestComposability at ${TestComposability.target}`
            );
        } else {
            TestComposability = await ethers.deployContract("TestComposability", user1);
            await TestComposability.waitForDeployment();

            TestComposabilityAddress = TestComposability.target;
            console.log(
                `TestComposability deployed to ${TestComposability.target}`
            );
        }

        TokenA = new ethers.Contract(
            swapConfig.TokenA.EVM,
            config.DATA.EVM.ABIs.ERC20ForSPL,
            ethers.provider
        );

        TokenB = new ethers.Contract(
            swapConfig.TokenB.EVM,
            config.DATA.EVM.ABIs.ERC20ForSPL,
            ethers.provider
        );

        const contractPublicKeyInBytes = await TestComposability.connect(user1).getNeonAddress(TestComposabilityAddress);
        contractPublicKey = ethers.encodeBase58(contractPublicKeyInBytes);
        console.log(contractPublicKey, 'contractPublicKey');

        let ataContractTokenA = await getAssociatedTokenAddress(
            new web3.PublicKey(swapConfig.TokenA.SVM),
            new web3.PublicKey(contractPublicKey),
            true
        );
        const ataContractTokenAInfo = await connection.getAccountInfo(ataContractTokenA);

        let ataContractTokenB = await getAssociatedTokenAddress(
            new web3.PublicKey(swapConfig.TokenB.SVM),
            new web3.PublicKey(contractPublicKey),
            true
        );
        const ataContractTokenBInfo = await connection.getAccountInfo(ataContractTokenB);

        // setup ATA's if needed
        if (ataContractTokenAInfo == null || ataContractTokenBInfo == null) {
            await createATA(
                solanaUser, 
                [
                    new web3.PublicKey(contractPublicKey)
                ],
                [
                    swapConfig.TokenA.SVM,
                    swapConfig.TokenB.SVM
                ],
                connection
            );
        }

        raydium = await Raydium.load({
            connection,
            owner: new web3.PublicKey(contractPublicKey), // key pair or publicKey, if you run a node process, provide keyPair
            cluster: "mainnet", // 'mainnet' | 'devnet'
            disableFeatureCheck: true,
            blockhashCommitment: "finalized",
        });
    });

    describe('Tests', function() {
        it('Raydium swap TokenA -> TokenB', async function () {
            let initialTokenA_Balance = await TokenA.balanceOf(user1.address);
            let initialTokenB_Balance = await TokenB.balanceOf(user1.address);

            if (await TokenA.allowance(user1.address, TestComposabilityAddress) == 0) {
                console.log('\nBroadcast TokenA approval ... ');
                tx = await TokenA.connect(user1).approve(TestComposabilityAddress, ethers.MaxUint256 );
                await tx.wait(1);
                console.log(tx, 'tx');
            }

            // USDC-USDT pool
            const poolId = 'BZtgQEyS6eXUXicYPHecYQ7PybqodXQMvkjUbP4R8mUU'
            const inputMint = swapConfig.TokenA.SVM
            let poolKeys;
            let poolInfo;
            let clmmPoolInfo;
            let tickCache;
        
            if (raydium.cluster === 'mainnet') {
            // note: api doesn't support get devnet pool info, so in devnet else we go rpc method
            // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
            const data = await raydium.api.fetchPoolById({ ids: poolId })
            poolInfo = data[0];
            //if (!isValidClmm(poolInfo.programId)) throw new Error('target pool is not CLMM pool')
        
            clmmPoolInfo = await PoolUtils.fetchComputeClmmInfo({
                connection: raydium.connection,
                poolInfo,
            })
            tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
                connection: raydium.connection,
                poolKeys: [clmmPoolInfo],
            })
            } else {
                const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
                poolInfo = data.poolInfo
                poolKeys = data.poolKeys
                clmmPoolInfo = data.computePoolInfo
                tickCache = data.tickData
            }
        
            if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
            throw new Error('input mint does not match pool')
        
            const baseIn = inputMint === poolInfo.mintA.address;
        
            const { minAmountOut, remainingAccounts } = await PoolUtils.computeAmountOutFormat({
                poolInfo: clmmPoolInfo,
                tickArrayCache: tickCache[poolId],
                amountIn: swapConfig.TokenAAmount,
                tokenOut: poolInfo[baseIn ? 'mintB' : 'mintA'],
                slippage: swapConfig.slippage,
                epochInfo: await raydium.fetchEpochInfo(),
            })
        
            const { execute, extInfo, transaction } = await raydium.clmm.swap({
                poolInfo,
                poolKeys,
                inputMint: poolInfo[baseIn ? 'mintA' : 'mintB'].address,
                amountIn: swapConfig.TokenAAmount,
                amountOutMin: minAmountOut.amount.raw,
                observationId: clmmPoolInfo.observationId,
                ownerInfo: {
                    useSOLBalance: true, // if wish to use existed wsol token account, pass false
                },
                remainingAccounts,
                TxVersion,
            
                // optional: set up priority fee here
                // computeBudgetConfig: {
                //   units: 600000,
                //   microLamports: 465915,
                // },
            
                // optional: add transfer sol to tip account instruction. e.g sent tip to jito
                // txTipConfig: {
                //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
                //   amount: new BN(10000000), // 0.01 sol
                // },
            });

            const user1TokenBTokenAccount = config.utils.calculateTokenAccount(
                swapConfig.TokenB.EVM,
                user1.address,
                new web3.PublicKey(config.DATA.SVM.ADDRESSES.NEON_PROGRAM)
            );

            console.log('\nBroadcast Raydium swap TokenA -> TokenB ... ');
            tx = await TestComposability.connect(user1).swap(
                swapConfig.TokenA.EVM,
                swapConfig.TokenB.EVM,
                Number(swapConfig.TokenAAmount),
                config.utils.publicKeyToBytes32(transaction.instructions[0].programId.toBase58()),
                config.utils.prepareInstructionData(transaction.instructions[0]),
                config.utils.prepareInstructionAccounts( // overwrite receiver token account to be the user, not the contract
                    transaction.instructions[0],
                    {
                        4: {
                            key: user1TokenBTokenAccount[0].toBase58(),
                            isSigner: transaction.instructions[0].keys[4].isSigner,
                            isWritable: transaction.instructions[0].keys[4].isWritable
                        }
                    }
                )
            );
            await tx.wait(1);
            console.log(tx, 'tx');

            expect(initialTokenA_Balance).to.be.greaterThan(await TokenA.balanceOf(user1.address));
            expect(await TokenB.balanceOf(user1.address)).to.be.greaterThan(initialTokenB_Balance);
        });
    });
});