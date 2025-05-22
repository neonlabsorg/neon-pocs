// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Constants } from "../Constants.sol";
import { LibAssociatedTokenData } from "./LibAssociatedTokenData.sol";
import { LibSPLTokenData } from "../spl-token-program/LibSPLTokenData.sol";
import { LibSystemData } from "../system-program/LibSystemData.sol";

/// @title LibAssociatedTokenProgram
/// @notice Helper library for interactions with Solana's Associated Token program
/// @author maxpolizzo@gmail.com
library LibAssociatedTokenProgram {
    /// @notice Helper function to format a `create` instruction in order to create and initialize a canonical
    /// associated token account (ATA) derived from a token mint account public key, a user public key and Solana's SPL
    // Token program Id
    /// @param payer The payer account which will fund the newly created account
    /// @param owner The account owning the associated token account
    /// @param tokenMint The token mint account to which the new token account will be associated
    function formatCreateInstruction(
        bytes32 payer,
        bytes32 owner,
        bytes32 tokenMint
    ) internal view returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data,
        uint64 rentExemptionBalance
    ) {
        return _formatCreateInstruction(payer, owner, tokenMint, Constants.getTokenProgramId());
    }

    /// @notice Helper function to format a `create` instruction in order to create and initialize a canonical
    /// associated token account (ATA) derived from a token mint account public key, a user public key and and a Solana
    // program Id
    /// @param payer The payer account which will fund the newly created account
    /// @param owner The account owning the associated token account
    /// @param tokenMint The token mint account to which the new token account will be associated
    /// @param programId The 32 bytes program Id used to derive the associated token account
    function formatCreateInstruction(
        bytes32 payer,
        bytes32 owner,
        bytes32 tokenMint,
        bytes32 programId
    ) internal view returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data,
        uint64 rentExemptionBalance
    ) {
        return _formatCreateInstruction(payer, owner, tokenMint, programId);
    }

    function _formatCreateInstruction(
        bytes32 payer,
        bytes32 owner,
        bytes32 tokenMint,
        bytes32 programId
    ) private view returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data,
        uint64 rentExemptionBalance
    ) {
        // Derive the canonical associated token account to  be created
        bytes32 ata = LibAssociatedTokenData.getAssociatedTokenAccount(tokenMint, owner, programId);

        accounts = new bytes32[](6);
        accounts[0] = payer;
        accounts[1] = ata;
        accounts[2] = owner;
        accounts[3] = tokenMint;
        accounts[4] = Constants.getSystemProgramId();
        accounts[5] = programId;

        isSigner = new bool[](6);
        isSigner[0] = true;
        isSigner[1] = false;
        isSigner[2] = false;
        isSigner[3] = false;
        isSigner[4] = false;
        isSigner[5] = false;

        isWritable = new bool[](6);
        isWritable[0] = true;
        isWritable[1] = true;
        isWritable[2] = false;
        isWritable[3] = false;
        isWritable[4] = false;
        isWritable[5] = false;

        // Calculate rent exemption balance for created ata
        rentExemptionBalance = LibSystemData.getRentExemptionBalance(
            LibSPLTokenData.SPL_TOKEN_ACCOUNT_SIZE,
            LibSystemData.getSystemAccountData(
                Constants.getSysvarRentPubkey(),
                LibSystemData.getSpace(Constants.getSysvarRentPubkey())
            )
        );

        data = new bytes(0); // data is left empty (see: https://github.com/solana-program/associated-token-account/blob/ea3b78b46187cd545b9ba0902b7c221ef9d5d223/program/src/processor.rs#L44)
    }
}
