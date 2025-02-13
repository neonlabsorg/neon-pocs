// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import '../precompiles/ICallSolana.sol';
import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";


interface IErc20ForSpl {
    function transferSolana(bytes32 to, uint64 amount) external returns (bool);
    function tokenMint() external view returns (bytes32);
}


contract AaveFlashLoan is FlashLoanSimpleReceiverBase {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    bytes32 public constant TOKEN_PROGRAM = 0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
    bytes32 public constant ASSOCIATED_TOKEN_PROGRAM = 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859;

    uint public lastLoan;
    uint public lastLoanFee;

    constructor(
        address _addressProvider
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {}

    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    function flashLoanSimple(address _token, uint256 _amount, bytes memory instructionData1, bytes memory instructionData2) public {
        address receiverAddress = address(this);
        address asset = _token;
        uint256 amount = _amount;
        bytes memory params = abi.encode(instructionData1, instructionData2);
        uint16 referralCode = 0;

        // request loan from Aave
        POOL.flashLoanSimple(
            receiverAddress,
            asset,
            amount,
            params,
            referralCode
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    )  external override returns (bool) {
        require(msg.sender == address(POOL), "ERROR: INVALID MSG.SENDER");
        lastLoan = amount;
        lastLoanFee = premium;

        // move flash loan amount to contract's ATA
        IErc20ForSpl(asset).transferSolana(
            CALL_SOLANA.getSolanaPDA(
                ASSOCIATED_TOKEN_PROGRAM,
                abi.encodePacked(
                    CALL_SOLANA.getNeonAddress(address(this)), 
                    TOKEN_PROGRAM,
                    IErc20ForSpl(asset).tokenMint()
                )
            ),
            uint64(amount)
        );

        (bytes memory instructionData1, bytes memory instructionData2) = abi.decode(params, (bytes, bytes));
        _execute(0, instructionData1);
        _execute(0, instructionData2);

        // approval to return back the loan + the fee
        IERC20(asset).approve(address(POOL), amount + premium);
        return true;
    }

    function _execute(
        uint64 lamports,
        bytes memory instruction
    ) internal {
        CALL_SOLANA.execute(
            lamports,
            instruction
        );
    }
}