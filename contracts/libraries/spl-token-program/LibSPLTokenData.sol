// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Constants } from "../Constants.sol";
import { LibSPLTokenErrors } from "./LibSPLTokenErrors.sol";
import { QueryAccount } from "../../precompiles/QueryAccount.sol";
import { SolanaDataConverterLib } from "../../utils/SolanaDataConverterLib.sol";

import { ICallSolana } from '../../precompiles/ICallSolana.sol';

/// @title LibSPLTokenData
/// @notice Helper library for getting data from Solana's SPL Token program
/// @author maxpolizzo@gmail.com
library LibSPLTokenData {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint64;

    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    uint8 public constant SPL_TOKEN_ACCOUNT_SIZE = 165;
    uint8 public constant SPL_TOKEN_MINT_SIZE = 82;

    struct SPLTokenAccountData {
        bytes32 mint;
        bytes32 owner;
        uint64 balance;
        bytes4 delegateOption;
        bytes32 delegate;
        bool isInitialized;
        bytes4 isNativeOption;
        bool isNative;
        uint64 delegatedAmount;
        bytes4 closeAuthorityOption;
        bytes32 closeAuthority;
    }

    struct SPLTokenMintData {
        bytes4 mintAuthorityOption;
        bytes32 mintAuthority;
        uint64 supply;
        uint8 decimals;
        bool isInitialized;
        bytes4 freezeAuthorityOption;
        bytes32 freezeAuthority;
    }

    // SPL token mint data getters

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return true if the token mint is initialized, false otherwise
    function getSPLTokenMintIsInitialized(bytes32 tokenMint) internal view returns(bool) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            45,
            1
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return to_bool(data);
    }

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return token supply as uint64
    function getSPLTokenSupply(bytes32 tokenMint) internal view returns(uint64) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            36,
            8
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return (data.toUint64(0)).readLittleEndianUnsigned64();
    }

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return token decimals as uint8
    function getSPLTokenDecimals(bytes32 tokenMint) internal view returns(uint8) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            44,
            1
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return data.toUint8(0);
    }

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return 32 bytes public key of the token's MINT authority
    function getSPLTokenMintAuthority(bytes32 tokenMint) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            4,
            32
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return 32 bytes public key of the token's FREEZE authority
    function getSPLTokenFreezeAuthority(bytes32 tokenMint) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            50,
            32
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenMint The 32 bytes SPL token mint account public key
    /// @return the full token mint data formatted as a SPLTokenMintData struct
    function getSPLTokenMintData(bytes32 tokenMint) internal view returns(SPLTokenMintData memory) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenMint),
            0,
            SPL_TOKEN_MINT_SIZE
        );
        require(success, LibSPLTokenErrors.TokenMintDataQuery());

        return SPLTokenMintData (
            bytes4(data.toUint32(0)), // 4 bytes mintAuthorityOption
            data.toBytes32(4), // 32 bytes mintAuthority
            (data.toUint64(36)).readLittleEndianUnsigned64(), // 8 bytes token supply
            data.toUint8(44), // 1 byte token decimals
            to_bool(abi.encodePacked((data.toUint8(45)))), // bool isInitialized
            bytes4(data.toUint32(46)), // 4 bytes freezeAuthorityOption
            data.toBytes32(50) // 32 bytes freezeAuthority
        );
    }

    // SPL token account data getters

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return true if the token account is initialized, false otherwise
    function getSPLTokenAccountIsInitialized(bytes32 tokenAccount) internal view returns(bool) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            108,
            1
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return to_bool(data);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return true if the token account is a Wrapped SOL token account, false otherwise
    function getSPLTokenAccountIsNative(bytes32 tokenAccount) internal view returns(bool) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            113,
            8
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return to_bool(data);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return token account balance as uint64
    function getSPLTokenAccountBalance(bytes32 tokenAccount) internal view returns(uint64) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            64,
            8
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return (data.toUint64(0)).readLittleEndianUnsigned64();
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return 32 bytes public key of the token account owner
    function getSPLTokenAccountOwner(bytes32 tokenAccount) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            32,
            32
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return 32 bytes public key of the token mint account associated with the token account
    function getSPLTokenAccountMint(bytes32 tokenAccount) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            0,
            32
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return 32 bytes public key of the token account's delegate
    function getSPLTokenAccountDelegate(bytes32 tokenAccount) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            76,
            32
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return the token account's delegated amount as uint64
    function getSPLTokenAccountDelegatedAmount(bytes32 tokenAccount) internal view returns(uint64) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            121,
            8
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return (data.toUint64(0)).readLittleEndianUnsigned64();
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return 32 bytes public key of the token account's CLOSE authority
    function getSPLTokenAccountCloseAuthority(bytes32 tokenAccount) internal view returns(bytes32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            133,
            32
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return data.toBytes32(0);
    }

    /// @param tokenAccount The 32 bytes SPL token account public key
    /// @return the full token account data formatted as a SPLTokenAccountData struct
    function getSPLTokenAccountData(bytes32 tokenAccount) internal view returns(SPLTokenAccountData memory) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(tokenAccount),
            0,
            SPL_TOKEN_ACCOUNT_SIZE
        );
        require(success, LibSPLTokenErrors.TokenAccountDataQuery());

        return SPLTokenAccountData (
            data.toBytes32(0), // 32 bytes token mint
            data.toBytes32(32), // 32 bytes token account owner
            (data.toUint64(64)).readLittleEndianUnsigned64(), // 8 bytes token account balance
            bytes4(data.toUint32(72)), // 4 bytes delegateOption
            data.toBytes32(76), // 32 bytes delegate
            to_bool(abi.encodePacked(data.toUint8(108))), // bool isInitialized
            bytes4(data.toUint32(109)), // 4 bytes isNativeOption
            to_bool(abi.encodePacked(data.toUint64(113))), // bool isNative
            (data.toUint64(121)).readLittleEndianUnsigned64(), // 8 bytes delegated amount
            bytes4(data.toUint32(129)), // 4 bytes closeAuthorityOption
            data.toBytes32(133) // 32 bytes closeAuthority
        );
    }

    /// @notice Function to get an arbitrary 32 bytes token account public key derived from a token mint account public
    /// key, a user public key and an arbitrary nonce
    /// @param tokenMint The 32 bytes public key of the token mint associated with the token account we want to get
    /// @param ownerPubKey The 32 bytes public key of the owner of the arbitrary token account
    /// @param nonce A uint8 nonce (can be incremented to get different token accounts)
    /// @return the 32 bytes token account public key derived from the token mint account public key, the user public
    /// key and the nonce
    function getArbitraryTokenAccount(
        bytes32 tokenMint,
        bytes32 ownerPubKey,
        uint8 nonce
    ) internal view returns(bytes32) {
        return CALL_SOLANA.getResourceAddress(sha256(abi.encodePacked(
            ownerPubKey,
            Constants.getTokenProgramId(),
            tokenMint,
            nonce,
            Constants.getAssociatedTokenProgramId()
        )));
    }

    function to_bool(bytes memory data) private pure returns (bool result) {
        assembly {
            result := mload(add(data, 32))
        }
    }
}
