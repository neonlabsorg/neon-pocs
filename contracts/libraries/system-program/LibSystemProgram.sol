// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Constants } from "../Constants.sol";
import { LibSystemData } from "./LibSystemData.sol";
import { SolanaDataConverterLib } from "../../utils/SolanaDataConverterLib.sol";

/// @title LibSystemProgram
/// @notice Helper library for interactions with Solana's System program
/// @author maxpolizzo@gmail.com
library LibSystemProgram {
    /// @notice Helper function to format a `createAccountWithSeed` instruction
    /// @param payer The payer account which will fund the newly created account
    /// @param basePubKey The base public key used to derive the newly created account
    /// @param programId The `id` of the Solana program which will be granted permission to write data to the newly
    /// created account
    /// @param seed The bytes seed used to derive the newly created account
    /// @param accountSize The on-chain storage space for the newly created account
    function formatCreateAccountWithSeedInstruction(
        bytes32 payer,
        bytes32 basePubKey,
        bytes32 programId,
        bytes memory seed,
        uint64 accountSize
    ) internal view returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data,
        uint64 rentExemptionBalance
    ) {
        accounts = new bytes32[](3);
        accounts[0] = payer;
        accounts[1] = LibSystemData.getCreateWithSeedAccount(basePubKey, programId, seed); // Account to be created
        accounts[2] = basePubKey;

        isSigner = new bool[](3);
        isSigner[0] = true;
        isSigner[1] = false;
        isSigner[2] = true;

        isWritable = new bool[](3);
        isWritable[0] = true;
        isWritable[1] = true;
        isWritable[2] = false;

        // Calculate rent exemption balance for created account
        rentExemptionBalance = LibSystemData.getRentExemptionBalance(
            accountSize,
            LibSystemData.getSystemAccountData(
                Constants.getSysvarRentPubkey(),
                LibSystemData.getSpace(Constants.getSysvarRentPubkey())
            )
        );

        // Get values in right-padded little-endian bytes format
        bytes8 seedLenLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(uint64(seed.length)));
        bytes8 rentExemptionBalanceLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(rentExemptionBalance));
        bytes8 accountSizeLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(accountSize));
        data = abi.encodePacked(
            bytes4(0x03000000), // Instruction variant (see: https://github.com/solana-program/system/blob/17d70bc0e56354cc7811e22a28776e7f379bcd04/interface/src/instruction.rs#L121)
            basePubKey, // Base public key used for account  creation
            seedLenLE, // Seed bytes length (right-padded little-endian)
            seed, // Seed bytes
            rentExemptionBalanceLE, // Rent exemption balance for created account (right-padded little endian)
            accountSizeLE, // Storage space for created account (right-padded little endian)
            programId // program id
        );
    }

    /// @notice Helper function to format a `transfer` instruction to transfer SOL
    /// @param sender The account which will send SOL
    /// @param recipient The account which will receive SOL
    /// @param amount The amount to transfer
    function formatTransferInstruction(
        bytes32 sender,
        bytes32 recipient,
        uint64 amount
    ) internal pure returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data
    ) {
        accounts = new bytes32[](2);
        accounts[0] = sender;
        accounts[1] = recipient;

        isSigner = new bool[](2);
        isSigner[0] = true;
        isSigner[1] = false;

        isWritable = new bool[](2);
        isWritable[0] = true;
        isWritable[1] = true;

        // Get amount in right-padded little-endian bytes format
        bytes8 amountLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(amount));
        data = abi.encodePacked(
            bytes4(0x02000000), // Instruction variant (see: https://github.com/solana-program/system/blob/17d70bc0e56354cc7811e22a28776e7f379bcd04/interface/src/instruction.rs#L111)
            amountLE // Amount (right-padded little-endian)
        );
    }

    /// @notice Helper function to format a `assignWithSeed` instruction to assign a Solana PDA (program-derived
    /// account) to a Solana program
    /// @param basePubKey The base public key used to derive the PDA that we want to assign
    /// @param programId The public key of the program that was used to derive the PDA and to which we want to assign
    /// the PDA
    /// @param seed The bytes seed that was used to generate the PDA that we want to assign
    function formatAssignWithSeedInstruction(
        bytes32 basePubKey,
        bytes32 programId,
        bytes memory seed
    ) internal pure returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data
    ) {
        accounts = new bytes32[](2);
        accounts[0] = LibSystemData.getCreateWithSeedAccount(basePubKey, programId, seed); // Account to be assigned
        accounts[1] = basePubKey;

        isSigner = new bool[](2);
        isSigner[0] = false;
        isSigner[1] = true;

        isWritable = new bool[](2);
        isWritable[0] = true;
        isWritable[1] = false;

        // Get seed length value in right-padded little-endian bytes format
        bytes8 seedLenLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(uint64(seed.length)));
        data = abi.encodePacked(
            bytes4(0x0a000000), // Instruction variant (see: https://github.com/solana-program/system/blob/17d70bc0e56354cc7811e22a28776e7f379bcd04/interface/src/instruction.rs#L216)
            basePubKey,
            seedLenLE, // Seed bytes length (right-padded little-endian)
            seed, // Seed bytes
            programId // program id
        );
    }

    /// @notice Helper function to format a `allocateWithSeed` instruction to allocate storage space to a Solana PDA
    // (program-derived account)
    /// @param basePubKey The base public key used to derive the PDA that we want to allocate space to
    /// @param programId The public key of the program that was used to derive the PDA that we want to allocate space to
    /// @param seed The bytes seed that was used to generate the PDA that we want to allocate space to
    /// @param accountSize The on-chain storage space that we want to allocate to the PDA
    function formatAllocateWithSeedInstruction(
        bytes32 basePubKey,
        bytes32 programId,
        bytes memory seed,
        uint64 accountSize
    ) internal pure returns (
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory data
    ) {
        accounts = new bytes32[](2);
        accounts[0] = LibSystemData.getCreateWithSeedAccount(basePubKey, programId, seed); // Account to be assigned
        accounts[1] = basePubKey;

        isSigner = new bool[](2);
        isSigner[0] = false;
        isSigner[1] = true;

        isWritable = new bool[](2);
        isWritable[0] = true;
        isWritable[1] = false;

        // Get values in right-padded little-endian bytes format
        bytes8 seedLenLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(uint64(seed.length)));
        bytes8 accountSizeLE = bytes8(SolanaDataConverterLib.readLittleEndianUnsigned64(accountSize));
        data = abi.encodePacked(
            bytes4(0x09000000), // Instruction variant (see: https://github.com/solana-program/system/blob/17d70bc0e56354cc7811e22a28776e7f379bcd04/interface/src/instruction.rs#L197)
            basePubKey,
            seedLenLE, // Seed bytes length (right-padded little-endian)
            seed, // Seed bytes
            accountSizeLE, // Storage space for created account (right-padded little endian)
            programId // program id
        );
    }
}
