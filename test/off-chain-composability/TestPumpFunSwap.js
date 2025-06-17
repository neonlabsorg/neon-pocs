import hre, { network, globalOptions } from "hardhat"
import web3 from "@solana/web3.js";
import { PumpAmmSdk } from "@pump-fun/pump-swap-sdk";
import BN from 'bn.js';
import config from "./config";
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
    let pumpAmmSdk;

    const swapConfig = {
        TokenA: {
            SVM: config.DATA.SVM.ADDRESSES.USDT,
            EVM: config.DATA.EVM.ADDRESSES.USDT
        },
        TokenB: {
            SVM: config.DATA.SVM.ADDRESSES.USDC,
            EVM: config.DATA.EVM.ADDRESSES.USDC
        },
        TokenAAmount: new BN(1000),
        TokenADecimals: 6,
        slippage: 50
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
        
        pumpAmmSdk = new PumpAmmSdk(connection);
    });

    describe('Tests', function() {
        it('PumpFun swap TokenA -> TokenB', async function () {
            let initialTokenA_Balance = await TokenA.balanceOf(user1.address);
            let initialTokenB_Balance = await TokenB.balanceOf(user1.address);

            if (await TokenA.allowance(user1.address, TestComposabilityAddress) == 0) {
                console.log('\nBroadcast TokenA approval ... ');
                tx = await TokenA.connect(user1).approve(TestComposabilityAddress, ethers.MaxUint256);
                await tx.wait(1);
                console.log(tx, 'tx');
            }

            const pool = new web3.PublicKey('GjGP2kiq48xfjRg2PpPaVq22FCBbttiSLVeohzV8pXYj'); // USDC-USDT

            // Base to Quote swap (⬆️)
            /* const quoteAmount = await pumpAmmSdk.swapAutocompleteQuoteFromBase(
                pool,
                baseAmount,
                slippage,
                "quoteToBase"
            );
            console.log(quoteAmount, 'quoteAmount'); */
            
            // Execute swap
            const swapInstructions = await pumpAmmSdk.swapBaseInstructions(
                pool,
                swapConfig.TokenAAmount,
                swapConfig.slippage,
                "baseToQuote",
                new web3.PublicKey(contractPublicKey)
            );
            console.log(swapInstructions, 'swapInstructions');

            const user1TokenBTokenAccount = config.utils.calculateTokenAccount(
                swapConfig.TokenB.EVM,
                user1.address,
                new web3.PublicKey(config.DATA.SVM.ADDRESSES.NEON_PROGRAM)
            );

            console.log('\nBroadcast PumpFun swap TokenA -> TokenB ... ');
            tx = await TestComposability.connect(user1).swap(
                swapConfig.TokenA.EVM,
                swapConfig.TokenB.EVM,
                Number(swapConfig.TokenAAmount),
                config.utils.publicKeyToBytes32(swapInstructions[0].programId.toBase58()),
                config.utils.prepareInstructionData(swapInstructions[0]),
                config.utils.prepareInstructionAccounts( // overwrite receiver token account to be the user, not the contract
                    swapInstructions[0],
                    {
                        6: {
                            key: user1TokenBTokenAccount[0].toBase58(),
                            isSigner: swapInstructions[0].keys[6].isSigner,
                            isWritable: swapInstructions[0].keys[6].isWritable
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