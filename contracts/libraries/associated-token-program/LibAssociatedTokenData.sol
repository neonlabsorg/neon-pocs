// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Constants } from "../Constants.sol";
import { ICallSolana } from '../../precompiles/ICallSolana.sol';

/// @title LibAssociatedTokenData
/// @notice Helper library for getting data related to Solana's Associated Token program
/// @author maxpolizzo@gmail.com
library LibAssociatedTokenData {

    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    /// @notice Function to get the 32 bytes canonical associated token account public key derived from a token mint
    /// account public key, a user public key and Solana's SPL Token program Id
    /// @param tokenMint The 32 bytes public key of the token mint associated with the token account we want to get
    /// @param ownerPubKey The 32 bytes public key of the owner of the associated token account
    /// @return the 32 bytes token account public key derived from the token mint account public key, the user public
    /// key and Solana's SPL Token program Id
    function getAssociatedTokenAccount(
        bytes32 tokenMint,
        bytes32 ownerPubKey
    ) internal view returns(bytes32) {
        return _getAssociatedTokenAccount(
            tokenMint,
            ownerPubKey,
            Constants.getTokenProgramId()
        );
    }

    /// @notice Function to get the 32 bytes canonical associated token account public key derived from a token mint
    /// account public key, a user public key and a Solana program Id
    /// @param tokenMint The 32 bytes public key of the token mint associated with the token account we want to get
    /// @param ownerPubKey The 32 bytes public key of the owner of the associated token account
    /// @param programId The 32 bytes program Id used to derive the associated token account
    /// @return the 32 bytes token account public key derived from the token mint account public key, the user public
    /// key and the programId
    function getAssociatedTokenAccount(
        bytes32 tokenMint,
        bytes32 ownerPubKey,
        bytes32 programId
    ) internal view returns(bytes32) {
        return _getAssociatedTokenAccount(
            tokenMint,
            ownerPubKey,
            programId
        );
    }

    function _getAssociatedTokenAccount(
        bytes32 tokenMint,
        bytes32 ownerPubKey,
        bytes32 programId
    ) private view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getAssociatedTokenProgramId(),
            abi.encodePacked(
                ownerPubKey,
                programId,
                tokenMint
            )
        );
    }
}
