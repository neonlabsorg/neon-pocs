import { network } from "hardhat"
import web3 from "@solana/web3.js"
import config  from "../config"
import createATA from "../helpers/CreateATAThroughSolanaWeb3"
import { getSecrets } from "../../neon-secrets.js"
import "dotenv/config"

let ethers;
let owner;
let solanaUser;
const AaveFlashLoanAddress = config.DATA.EVM.ADDRESSES.AAVE.AaveFlashLoanTest;
let AaveFlashLoan;
let USDC;
let contractPublicKey;
const RECEIPTS_COUNT = 1;

describe('Test init', async function () {
    before(async function() {
        const { wallets } = await getSecrets()
        owner = wallets.owner
        solanaUser = wallets.solanaUser1
        ethers = (await network.connect()).ethers

        if (await ethers.provider.getBalance(owner.address) == 0) {
            await config.utils.airdropNEON(owner.address);
        }

        const AaveFlashLoanFactory = await ethers.getContractFactory('contracts/AaveFlashLoan/AaveFlashLoan.sol:AaveFlashLoan', owner);
        USDC = await ethers.getContractAt('contracts/interfaces/IERC20ForSpl.sol:IERC20ForSpl', config.DATA.EVM.ADDRESSES.devUSDC, owner);

        if (ethers.isAddress(AaveFlashLoanAddress)) {
            console.log('\AaveFlashLoan used at', "\x1b[32m", AaveFlashLoanAddress, "\x1b[30m", '\n');
            AaveFlashLoan = AaveFlashLoanFactory.attach(AaveFlashLoanAddress);
        } else {
            AaveFlashLoan = await ethers.deployContract(
                'contracts/AaveFlashLoan/AaveFlashLoan.sol:AaveFlashLoan',
                [
                    config.DATA.EVM.ADDRESSES.AAVE.ADDRESS_PROVIDER
                ],
                owner
            );
            await AaveFlashLoan.waitForDeployment();
            console.log('\AaveFlashLoan deployed at', "\x1b[32m", AaveFlashLoan.target, "\x1b[30m", '\n');
        }

        const contractPublicKeyInBytes = await AaveFlashLoan.getNeonAddress(AaveFlashLoan.target);
        contractPublicKey = ethers.encodeBase58(contractPublicKeyInBytes);
        console.log(contractPublicKey, 'contractPublicKey');

        await createATA(solanaUser, [new web3.PublicKey(contractPublicKey)]);
    });

    describe('Tests', function() {
        it('Validate Aave V3 flash loan with composability', async function () {
            let tx;
            // dummy transfer to the contract so it could be able to repay the flashloan fee
            if (await USDC.balanceOf(AaveFlashLoan.target) == 0) {
                console.log('Transferring some USDC to the contract so it could be able to repay the flashloan fee.');
                tx = await USDC.transfer(AaveFlashLoan.target, 1000000);
                await tx.wait(RECEIPTS_COUNT); 

                console.log(await USDC.balanceOf(AaveFlashLoan.target), 'balanceOf');
            }

            tx = await AaveFlashLoan.flashLoanSimple(
                config.DATA.EVM.ADDRESSES.devUSDC,
                10000000, // 10 USDC
                config.utils.publicKeyToBytes32(ethers, config.DATA.SVM.ADDRESSES.devUSDC_WSOL_Raydium_Pool), // poolId
                100 // 0.01% slippage
            );
            console.log(tx, 'tx');
            await tx.wait(RECEIPTS_COUNT);

            console.log('\n\n\n');
            console.log(await USDC.balanceOf(AaveFlashLoan.target), 'Contract USDC balanceOf');
            console.log(await AaveFlashLoan.lastLoan(), 'lastLoan');
        });
    });
});