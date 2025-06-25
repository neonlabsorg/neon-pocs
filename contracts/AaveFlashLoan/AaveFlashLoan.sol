// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ICallSolana } from '../precompiles/ICallSolana.sol';
import { IERC20ForSpl } from '../interfaces/IERC20ForSpl.sol';
import { FlashLoanSimpleReceiverBase } from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import { IPoolAddressesProvider } from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";


/// @title AaveFlashLoan
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serve as POC that a flash loan could be taken from the Neon EVM chain and used inside Solana. The protocol that is used to request flash is a fork of Aave V3.
contract AaveFlashLoan is FlashLoanSimpleReceiverBase {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    bytes32 public constant TOKEN_PROGRAM = 0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
    bytes32 public constant ASSOCIATED_TOKEN_PROGRAM = 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859;

    uint public lastLoan;
    uint public lastLoanFee;

    constructor(address _addressProvider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {}

    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    // request flash loan from Aave V3 protocol
    function flashLoanSimple(address token, uint256 amount, bytes memory instructionData1, bytes memory instructionData2) public {
        bytes memory params = abi.encode(instructionData1, instructionData2);

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
        require(msg.sender == address(POOL), "ERROR: AUTH - INVALID POOL");
        require(initiator == address(this), "ERROR: AUTH - INVALID INITIATOR");

        lastLoan = amount;
        lastLoanFee = premium;

        // move flash loan amount to contract's ATA
        IERC20ForSpl(asset).transferSolana(
            CALL_SOLANA.getSolanaPDA(
                ASSOCIATED_TOKEN_PROGRAM,
                abi.encodePacked(
                    CALL_SOLANA.getNeonAddress(address(this)), 
                    TOKEN_PROGRAM,
                    IERC20ForSpl(asset).tokenMint()
                )
            ),
            uint64(amount)
        );

        (bytes memory instructionData1, bytes memory instructionData2) = abi.decode(params, (bytes, bytes));

        CALL_SOLANA.execute(0, instructionData1); // Request Orca's program on Solana to swap $USDC for $SAMO
        CALL_SOLANA.execute(0, instructionData2); // Request Orca's program on Solana to swap back $SAMO for $USDC

        // approval to return back the $USDC flashloan + the small fee charged by Aave
        IERC20ForSpl(asset).approve(address(POOL), amount + premium);
        return true;
    }
}