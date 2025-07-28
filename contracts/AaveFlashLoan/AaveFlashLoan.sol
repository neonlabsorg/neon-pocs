// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20ForSpl } from '../interfaces/IERC20ForSpl.sol';
import { FlashLoanSimpleReceiverBase } from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import { IPoolAddressesProvider } from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { ICallSolana } from '@neonevm/call-solana/precompiles/ICallSolana.sol';
import { Constants } from "@neonevm/call-solana/composability/libraries/Constants.sol";
import { CallSolanaHelperLib } from "@neonevm/call-solana/utils/CallSolanaHelperLib.sol";
import { LibRaydiumCPMMData } from "@neonevm/call-solana/composability/libraries/raydium-cpmm-program/LibRaydiumCPMMData.sol";
import { LibRaydiumCPMMProgram } from "@neonevm/call-solana/composability/libraries/raydium-cpmm-program/LibRaydiumCPMMProgram.sol";


/// @title AaveFlashLoan
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serve as POC that a flash loan could be taken from the Neon EVM chain and used inside Solana. The protocol that is used to request flash is a fork of Aave V3.
contract AaveFlashLoan is FlashLoanSimpleReceiverBase {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    uint public lastLoan;

    error InvalidAmount();
    error InvalidPool();
    error InvalidInitiator();

    constructor(address _addressProvider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {}

    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    // request flash loan from Aave V3 protocol
    function flashLoanSimple(
        address token, 
        uint256 amount,
        bytes32 poolId,
        uint16 slippage
     ) public {
        require(amount > 0, InvalidAmount());
        bytes memory params = abi.encode(poolId, slippage);

        POOL.flashLoanSimple(
            address(this),
            token,
            amount,
            params,
            0
        );
    }

    // Callback to be called by Aave V3 to provide the smart contract with the flashloan earlier requested
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    )  external override returns (bool) {
        require(msg.sender == address(POOL), InvalidPool());
        require(initiator == address(this), InvalidInitiator());

        lastLoan = amount;
        uint64 amountUint64 = SafeCast.toUint64(amount);

        (bytes32 poolId, uint16 slippage) = abi.decode(params, (bytes32, uint16));
        LibRaydiumCPMMData.PoolData memory poolData = LibRaydiumCPMMData.getPoolData(poolId);

        bytes32 flashloanTokenMint = IERC20ForSpl(asset).tokenMint();
        bytes32 tokenB = (flashloanTokenMint == poolData.tokenA) ? poolData.tokenB : poolData.tokenA;
        bytes32 thisContractAccount = CALL_SOLANA.getNeonAddress(address(this));

        bytes32[] memory premadeAccounts = new bytes32[](12);
        // re-use already calculated accounts from swap #1
        premadeAccounts[0] = thisContractAccount;

        // building the request instruction data for swap #2
        (
            bytes32[] memory accounts,
            bool[] memory isSigner,
            bool[] memory isWritable,
            bytes memory data
        ) = LibRaydiumCPMMProgram.swapInputInstruction(
            poolId, 
            flashloanTokenMint,
            amountUint64, 
            0, 
            true, 
            premadeAccounts
        );

        // move the flashloan amount from the contract's PDA account to the contract's ATA account
        // the reason for this is because through the composability feature we don't have access over PDA accounts, because they're owned by the Neon EVM program on Solana
        IERC20ForSpl(asset).transferSolana(
            accounts[4],
            amountUint64
        );

        // re-use already calculated accounts from swap #1
        premadeAccounts[1] = accounts[1];
        premadeAccounts[4] = accounts[5];
        // overwrite the swap #2 request receiver to be the contract's PDA account instead of the contract's ATA account
        premadeAccounts[5] = CALL_SOLANA.getSolanaPDA(
            Constants.getNeonEvmProgramId(),
            abi.encodePacked(
                hex"03",
                hex"436f6e747261637444617461", // "ContractData"
                asset,
                bytes32(uint256(uint160((address(this)))))
            )
        );

        // building the request instruction data for swap #2
        (
            bytes32[] memory accountsSwapBack,
            bool[] memory isSignerSwapBack,
            bool[] memory isWritableSwapBack,
            bytes memory dataSwapBack
        ) = LibRaydiumCPMMProgram.swapInputInstruction(
            poolId, 
            tokenB,
            LibRaydiumCPMMData.getSwapOutput(
                poolId, 
                poolData.ammConfig,
                flashloanTokenMint,
                tokenB,
                amountUint64
            ), 
            slippage, 
            true, 
            premadeAccounts
        );

        bytes memory swapBackRequestData = CallSolanaHelperLib.prepareSolanaInstruction(
            Constants.getCreateCPMMPoolProgramId(),
            accountsSwapBack,
            isSignerSwapBack,
            isWritableSwapBack,
            dataSwapBack
        );

        // Swap #1 - devUSDC -> WSOL
        CALL_SOLANA.execute(
            0,
            CallSolanaHelperLib.prepareSolanaInstruction(
                Constants.getCreateCPMMPoolProgramId(),
                accounts,
                isSigner,
                isWritable,
                data
            )
        );

        // Swap #2 - WSOL -> devUSDC
        CALL_SOLANA.execute(
            0,
            swapBackRequestData
        );

        // approval to return back the $USDC flashloan + the small fee charged by Aave
        IERC20ForSpl(asset).approve(address(POOL), amount + premium);
        return true;
    }
}