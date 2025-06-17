import { network } from "hardhat"
import web3 from "@solana/web3.js"
import { expect } from "chai"
import config  from "../config"
import createATA from "../helpers/CreateATAThroughSolanaWeb3"
import raydiumSwapInput from "./raydiumSwapInput"
import { getSecrets } from "../../neon-secrets.js"

let ethers;
let owner;
let solanaUser;
const MemeLaunchpadAddress = config.DATA.EVM.ADDRESSES.MemeLaunchpad.MemeLaunchpadTest;
const BondingCurveAddress = config.DATA.EVM.ADDRESSES.MemeLaunchpad.BondingCurve;
let MemeLaunchpad;
let payer;
let BondingCurve;
let WSOL;
let Token;
let poolId;
const RECEIPTS_COUNT = 1;

describe('Test init', async function () {
    before(async function() {
        const { wallets } = await getSecrets()
        owner = wallets.owner;
        solanaUser = wallets.solanaUser1
        ethers = (await network.connect()).ethers
        if (await ethers.provider.getBalance(owner.address) == 0) {
            console.error('Deployer has 0 NEON balance, please grab some at https://neonfaucet.org/.');
            process.exit();
        }

        const MemeLaunchpadFactory = await ethers.getContractFactory('contracts/MemeLaunchpad/MemeLaunchpad.sol:MemeLaunchpad', owner);
        const BondingCurveFactory = await ethers.getContractFactory('contracts/MemeLaunchpad/BondingCurve.sol:BondingCurve', owner);
        WSOL = await ethers.getContractAt('contracts/interfaces/IERC20ForSpl.sol:IERC20ForSpl', config.DATA.EVM.ADDRESSES.WSOL, owner);

        if (ethers.isAddress(BondingCurveAddress)) {
            console.log('\BondingCurve used at', "\x1b[32m", BondingCurveAddress, "\x1b[30m", '\n');
            BondingCurve = BondingCurveFactory.attach(BondingCurveAddress);
        } else {
            BondingCurve = await ethers.deployContract('contracts/MemeLaunchpad/BondingCurve.sol:BondingCurve', [
                // sample Bonding curve config params
                1e15,
                2e15
            ]);
            await BondingCurve.waitForDeployment();
            console.log('\BondingCurve deployed at', "\x1b[32m", BondingCurve.target, "\x1b[30m", '\n');
        }

        if (ethers.isAddress(MemeLaunchpadAddress)) {
            console.log('\MemeLaunchpad used at', "\x1b[32m", MemeLaunchpadAddress, "\x1b[30m", '\n');
            MemeLaunchpad = MemeLaunchpadFactory.attach(MemeLaunchpadAddress);
        } else {
            MemeLaunchpad = await ethers.deployContract(
                'contracts/MemeLaunchpad/MemeLaunchpad.sol:MemeLaunchpad',
                [
                    config.DATA.EVM.ADDRESSES.ERC20ForSplFactory,
                    BondingCurve.target,
                    WSOL.target,
                    100 // 1% fee
                ],
                owner
            );
            await MemeLaunchpad.waitForDeployment();
            console.log('\MemeLaunchpad deployed at', "\x1b[32m", MemeLaunchpad.target, "\x1b[30m", '\n');
        }

        payer = await MemeLaunchpad.getPayer();
    });

    describe('MemeLaunchpad tests', function() {
        it('createTokenSale', async function () {
            let tx = await MemeLaunchpad.createTokenSale(
                "TEST" + Date.now().toString(),
                "TST",
                9,
                100000000, // 0.1 SOL sale cap
                ethers.parseUnits('2000', 9),
                ethers.parseUnits('8000', 9)
            );
            let receipt = await tx.wait(RECEIPTS_COUNT);
            console.log(tx.hash, 'createTokenSale tx');

            Token = await ethers.getContractAt('contracts/interfaces/IERC20ForSpl.sol:IERC20ForSpl', receipt.logs[2].args[0], owner);

            // setup contract's payer ATA accounts for both tokens ( payer account is the one who creates the Raydium pool )
            await createATA(
                solanaUser,
                [
                    new web3.PublicKey(ethers.encodeBase58(payer))
                ],
                [
                    ethers.encodeBase58(await WSOL.tokenMint()),
                    ethers.encodeBase58(await Token.tokenMint())
                ]
            )
        });

        it('buy ( not reaching the fundingGoal )', async function () {
            const initialWSOLBalance = await WSOL.balanceOf(owner.address);
            const initialWSOLBalanceContract = await WSOL.balanceOf(MemeLaunchpad.target);

            const amount = 10000000; // 0.01 SOL
            if (parseInt(initialWSOLBalance) < amount) {
                console.error('Not enough WSOL balance. Needed', amount, 'WSOLs, having', initialWSOLBalance);
                process.exit();
            }

            let tx;
            if (await WSOL.allowance(owner.address, MemeLaunchpad.target) == 0) {
                tx = await WSOL.approve(MemeLaunchpad.target, ethers.MaxUint256);
                await tx.wait(RECEIPTS_COUNT);
            }

            tx = await MemeLaunchpad.buy(
                Token.target,
                amount
            );
            console.log(tx.hash, 'buy tx');
            let receipt = await tx.wait(RECEIPTS_COUNT);

            expect(initialWSOLBalance).to.be.greaterThan(await WSOL.balanceOf(owner.address));
            expect(await WSOL.balanceOf(MemeLaunchpad.target)).to.be.greaterThan(initialWSOLBalanceContract);
        });

        it('buy ( reaching the fundingGoal )', async function () {
            const initialTokenABalance = await WSOL.balanceOf(owner.address);
            const initialTokenBBalance = await Token.balanceOf(owner.address);
            const initialWSOLBalanceContract = await WSOL.balanceOf(MemeLaunchpad.target);

            const amount = 150000000; // 0.15 SOL
            if (parseInt(initialTokenABalance) < amount) {
                console.error('Not enough WSOL balance. Needed', amount, 'WSOLs, having', initialTokenABalance);
                process.exit();
            }

            let tx;
            if (await WSOL.allowance(owner.address, MemeLaunchpad.target) == 0) {
                tx = await WSOL.approve(MemeLaunchpad.target, ethers.MaxUint256);
                await tx.wait(RECEIPTS_COUNT);
            }

            tx = await MemeLaunchpad.buy(
                Token.target,
                amount
            );
            console.log(tx.hash, 'buy tx');
            let receipt = await tx.wait(RECEIPTS_COUNT);

            poolId = receipt.logs[7].args[1];
            console.log('\nRaydium Pool ID account - ', ethers.encodeBase58(poolId));
            console.log('Locked LP amount - ', receipt.logs[7].args[2]);
            console.log('NFT account holding the locked LP position - ', ethers.encodeBase58(receipt.logs[7].args[3]));

            expect(initialTokenABalance).to.be.greaterThan(await WSOL.balanceOf(owner.address));
            expect(await Token.balanceOf(owner.address)).to.be.greaterThan(initialTokenBBalance);
            expect(initialWSOLBalanceContract).to.be.greaterThan(await WSOL.balanceOf(MemeLaunchpad.target));
            expect(await WSOL.balanceOf(MemeLaunchpad.target)).to.eq(await MemeLaunchpad.fee());
            expect(await Token.balanceOf(MemeLaunchpad.target)).to.eq(0);
        });

        it('collectPoolFees', async function () {
            // collect token sale fee
            const wsolBalance = await WSOL.balanceOf(owner.address);
            
            let tx = await MemeLaunchpad.claimTokenSaleFee();
            await tx.wait(RECEIPTS_COUNT);
            console.log(tx.hash, 'claimTokenSaleFee tx');

            expect(await WSOL.balanceOf(owner.address)).to.be.greaterThan(wsolBalance);
            
            // collect Raydium locked LP fee
            await raydiumSwapInput(solanaUser, ethers.encodeBase58(poolId)); // fake some swap in order to be able to collect some fees
            await config.utils.asyncTimeout(10000);

            const initialTokenABalance = await WSOL.balanceOf(owner.address);
            const initialTokenBBalance = await Token.balanceOf(owner.address);
            
            tx = await MemeLaunchpad.collectPoolFees(
                poolId,
                WSOL.target,
                Token.target,
                '18446744073709551615' // withdraw maximum available fees
            );
            await tx.wait(RECEIPTS_COUNT);
            console.log(tx.hash, 'collectPoolFees tx');

            expect(await WSOL.balanceOf(owner.address)).to.be.greaterThan(initialTokenABalance);
            expect(await Token.balanceOf(owner.address)).to.be.greaterThan(initialTokenBBalance);
        });
    });
});