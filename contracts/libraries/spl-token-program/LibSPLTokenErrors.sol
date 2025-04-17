// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title LibSPLTokenErrors
/// @notice Custom errors library for interactions with Solana's SPL Token program
/// @author maxpolizzo@gmail.com
library LibSPLTokenErrors {
    // SPL Token mint/account data query errors
    error TokenMintDataQuery();
    error TokenAccountDataQuery();

    // Delegated token claim errors
    error InvalidSpender(bytes32 ata, bytes32 delegate, bytes32 invalidSpender);
    error InsufficientDelegatedAmount(bytes32 ata, uint64 delegatedAmount, uint64 claimedAmount);

    // Token mint authority errors
    error InvalidMintAuthority(bytes32 tokenMint, bytes32 mintAuthority, bytes32 invalidAuthority, string message);
    error InvalidFreezeAuthority(bytes32 tokenMint, bytes32 freezeAuthority, bytes32 invalidAuthority, string message);
    error InvalidTokenMintAuthorityType(bytes32 tokenMint, string message);

    // Token account authority errors
    error InvalidOwnerAuthority(bytes32 tokenAccount, bytes32 ownerAuthority, bytes32 invalidAuthority, string message);
    error InvalidCloseAuthority(
        bytes32 tokenAccount,
        bytes32 ownerAuthority,
        bytes32 closeAuthority,
        bytes32 invalidAuthority,
        string message
    );
    error InvalidTokenAccountAuthorityType(bytes32 tokenAccount, string message);
}
