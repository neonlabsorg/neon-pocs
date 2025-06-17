import hre, { network, globalOptions } from "hardhat"
import web3 from "@solana/web3.js";
import config from "./config";
import fetch from 'cross-fetch';
import {Decimal} from "decimal.js";
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

    const swapConfig = {
        TokenA: {
            SVM: config.DATA.SVM.ADDRESSES.USDC,
            EVM: config.DATA.EVM.ADDRESSES.USDC
        },
        TokenB: {
            SVM: config.DATA.SVM.ADDRESSES.WBTC,
            EVM: config.DATA.EVM.ADDRESSES.WBTC
        },
        TokenAAmount: new Decimal('0.01'),
        TokenADecimals: 6,
        slippage: 100
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
    });

    describe('Tests', function() {
        it('Jupiter swap TokenA -> TokenB', async function () {
            let initialTokenA_Balance = await TokenA.balanceOf(user1.address);
            let initialTokenB_Balance = await TokenB.balanceOf(user1.address);

            if (await TokenA.allowance(user1.address, TestComposabilityAddress) == 0) {
                console.log('\nBroadcast TokenA approval ... ');
                tx = await TokenA.connect(user1).approve(TestComposabilityAddress, ethers.MaxUint256 );
                await tx.wait(1);
                console.log(tx, 'tx');
            }

            const asLegacyTransaction = true;
            const onlyDirectRoutes = false;

            // prepare Jupiter quote
            const quoteResponse = await (
                await fetch('https://quote-api.jup.ag/v6/quote?asLegacyTransaction='+asLegacyTransaction+'&onlyDirectRoutes='+onlyDirectRoutes+'&inputMint=' + swapConfig.TokenA.SVM + '&outputMint=' + swapConfig.TokenB.SVM + '&amount=' + (swapConfig.TokenAAmount * 10 ** swapConfig.TokenADecimals) + '&slippageBps=' + swapConfig.slippage)
            ).json();
            console.log(quoteResponse, 'quoteResponse');

            const user1TokenBTokenAccount = config.utils.calculateTokenAccount(
                swapConfig.TokenB.EVM,
                user1.address,
                new web3.PublicKey(config.DATA.SVM.ADDRESSES.NEON_PROGRAM)
            );

            // prepare Jupiter swap instruction
            const { swapTransaction } = await (
                await fetch('https://quote-api.jup.ag/v6/swap', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quoteResponse,
                        userPublicKey: contractPublicKey,
                        wrapAndUnwrapSol: false,
                        asLegacyTransaction: asLegacyTransaction,
                        onlyDirectRoutes: onlyDirectRoutes,
                        destinationTokenAccount: user1TokenBTokenAccount[0]
                    })
                })
            ).json();
            const jupiterSwap = web3.Transaction.from(Buffer.from(swapTransaction, 'base64'));

            console.log('\nBroadcast Jupiter swap TokenA -> TokenB ... ');
            tx = await TestComposability.connect(user1).swap(
                swapConfig.TokenA.EVM,
                swapConfig.TokenB.EVM,
                swapConfig.TokenAAmount * 10 ** swapConfig.TokenADecimals,
                config.utils.publicKeyToBytes32(jupiterSwap.instructions[jupiterSwap.instructions.length - 1].programId.toBase58()),
                config.utils.prepareInstructionData(jupiterSwap.instructions[jupiterSwap.instructions.length - 1]),
                config.utils.prepareInstructionAccounts(jupiterSwap.instructions[jupiterSwap.instructions.length - 1])
            );
            await tx.wait(1);
            console.log(tx, 'tx');

            expect(initialTokenA_Balance).to.be.greaterThan(await TokenA.balanceOf(user1.address));
            expect(await TokenB.balanceOf(user1.address)).to.be.greaterThan(initialTokenB_Balance);
        });
    });
});