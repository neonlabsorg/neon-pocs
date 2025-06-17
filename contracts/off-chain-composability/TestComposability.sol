// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../interfaces/IERC20ForSpl.sol';
import '../precompiles/ICallSolana.sol';

contract TestComposability {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    bytes32 public constant TOKEN_PROGRAM = 0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
    bytes32 public constant ASSOCIATED_TOKEN_PROGRAM = 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859;

    event ComposabilityResponse(bytes response);

    function getNeonAddress(address evm_address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(evm_address);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint64 amount,
        bytes32 programId,
        bytes calldata instruction,
        bytes calldata accountsData
    ) external {
        require(amount > 0, "ERROR: INPUT_AMOUNT");
        
        IERC20ForSpl(tokenIn).transferFrom(msg.sender, address(this), amount); // transfer the tokens from the user to the contract's arbitrary Token account = owner = Neon EVM Program
        IERC20ForSpl(tokenIn).transferSolana(
            CALL_SOLANA.getSolanaPDA(
                ASSOCIATED_TOKEN_PROGRAM,
                abi.encodePacked(
                    CALL_SOLANA.getNeonAddress(address(this)),
                    TOKEN_PROGRAM,
                    IERC20ForSpl(tokenIn).tokenMint()
                )
            ),
            amount
        ); // transfer the tokens from the contract's arbitrary Token account to contract's ATA account
        IERC20ForSpl(tokenOut).transfer(msg.sender, 0); // needed to make sure that the receiver has arbitrary Token account initialized; if the receiver is different than msg.sender then this line should be changed

        _executeComposabilityRequest(0, programId, instruction, accountsData);
    }

    function _executeComposabilityRequest(
        uint64 lamports,
        bytes32 programId,
        bytes calldata instruction,
        bytes calldata accountsData
    ) internal {
        bytes memory response = CALL_SOLANA.execute(
            lamports,
            abi.encodePacked(
                programId, 
                accountsData,
                instruction
            )
        );
        
        emit ComposabilityResponse(response);
    }
}