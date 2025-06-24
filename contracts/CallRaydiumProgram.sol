// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { CallSolanaHelperLib } from './utils/CallSolanaHelperLib.sol';
import { LibSystemData } from "./libraries/system-program/LibSystemData.sol";
import { LibSystemProgram } from "./libraries/system-program/LibSystemProgram.sol";
import { Constants } from "./libraries/Constants.sol";

import { ICallSolana } from './precompiles/ICallSolana.sol';

/// @title CallRaydiumProgram
/// @author maxpolizzo@gmail.com
contract CallRaydiumProgram {
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    event LogData(bytes response);
    event CreateResource(bytes32 salt, uint64 space, uint64 lamports, bytes32 programId, bytes32 response);

    function transferSOL(
        bytes32 recipient,
        uint64 amount
    ) external {
        // Payer account will pay the SOL amount while msg.sender will pay gas fees covering that amount plus
        // transaction fees
        bytes32 payer = CALL_SOLANA.getPayer();

        // Format transfer instruction
        (   bytes32[] memory accounts,
            bool[] memory isSigner,
            bool[] memory isWritable,
            bytes memory data
        ) = LibSystemProgram.formatTransferInstruction(
            payer,
            recipient,
            amount
        );
        // Prepare transfer instruction
        bytes memory transferIx = CallSolanaHelperLib.prepareSolanaInstruction(
            Constants.getSystemProgramId(),
            accounts,
            isSigner,
            isWritable,
            data
        );
        // Execute transfer instruction, sending amount lamports
        CALL_SOLANA.execute(amount, transferIx);
    }

    function createResource(
        bytes32 salt,
        uint64 space,
        uint64 lamports,
        bytes32 program_id
    ) external returns (bytes32) {
        bytes32 response = CALL_SOLANA.createResource(
            salt,
            space,
            lamports,
            program_id
        );

        emit CreateResource(salt, space, lamports, program_id, response);
        return response;
    }

    // Returns the account public key derived from the provided basePubKey, programId and seed
    function getCreateWithSeedAccount(
        bytes32 basePubKey,
        bytes32 programId,
        bytes memory seed
    ) public pure returns(bytes32) {
        return LibSystemData.getCreateWithSeedAccount(basePubKey, programId, seed);
    }

    // Returns Solana public key for NeonEVM address
    function getNeonAddress(address user) external view returns (bytes32) {
        return CALL_SOLANA.getNeonAddress(user);
    }

    function getResourceAddress(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getResourceAddress(salt);
    }

    function getExtAuthority(bytes32 salt) external view returns (bytes32) {
        return CALL_SOLANA.getExtAuthority(salt);
    }

    function getPayer() external view returns (bytes32) {
        return CALL_SOLANA.getPayer();
    }

    function execute(
        uint64 lamports,
        bytes32 salt,
        bytes memory instruction
    ) external {
        _execute(lamports, salt, instruction);
    }

    function batchExecute(
        uint64[] memory lamports,
        bytes32[] memory salt,
        bytes[] memory instruction
    ) external {
        uint len = instruction.length;
        for (uint i = 0; i < len; ++i) {
            _execute(lamports[i], salt[i], instruction[i]);
        }
    }

    function _execute(
        uint64 lamports,
        bytes32 salt,
        bytes memory instruction
    ) internal {
        bytes memory response;
        if (salt != bytes32(0)) {
            response = CALL_SOLANA.executeWithSeed(
                lamports,
                salt,
                instruction
            );
        } else {
            response = CALL_SOLANA.execute(
                lamports,
                instruction
            );
        }

        emit LogData(response);
    }
}
