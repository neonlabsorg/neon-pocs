// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Constants } from "../Constants.sol";
import { LibSystemErrors } from "./LibSystemErrors.sol";
import { QueryAccount } from "../../precompiles/QueryAccount.sol";
import { SolanaDataConverterLib } from "../../utils/SolanaDataConverterLib.sol";

/// @title LibSystemData
/// @notice Helper library for getting data from Solana's System program
/// @author maxpolizzo@gmail.com
library LibSystemData {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint64;

    uint8 public constant ACCOUNT_STORAGE_OVERHEAD = 128;

    struct AccountInfo {
        bytes32 pubkey;
        uint64 lamports;
        bytes32 owner;
        bool executable;
        uint64 rent_epoch;
    }

    struct DecodedFloat64 {
        uint64 fraction;
        uint64 exponent;
    }

    // System account data getters

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return lamport balance of the account as uint64
    function getBalance(bytes32 accountPubKey) internal view returns(uint64) {
        (bool success,  uint256 lamports) = QueryAccount.lamports(uint256(accountPubKey));
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return uint64(lamports);
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return The 32 bytes public key of the account's owner
    function getOwner(bytes32 accountPubKey) internal view returns(bytes32) {
        (bool success,  bytes memory result) = QueryAccount.owner(uint256(accountPubKey));
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return result.toBytes32(0);
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return true if the token mint is a program account, false otherwise
    function getIsExecutable(bytes32 accountPubKey) internal view returns(bool) {
        (bool success,  bool result) = QueryAccount.executable(uint256(accountPubKey));
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return result;
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return account's rent epoch as uint64
    function getRentEpoch(bytes32 accountPubKey) internal view returns(uint64) {
        (bool success,  uint256 result) = QueryAccount.rent_epoch(uint256(accountPubKey));
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return uint64(result);
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return account's allocated storage space in bytes as uint64
    function getSpace(bytes32 accountPubKey) internal view returns(uint64) {
        (bool success,  uint256 result) = QueryAccount.length(uint256(accountPubKey));
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return uint64(result);
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @param size The uint8 bytes size of the data we want to get
    /// @return the account data bytes
    function getSystemAccountData(bytes32 accountPubKey, uint64 size) internal view returns(bytes memory) {
        require(size > 0, LibSystemErrors.SystemAccountDataQuery());
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(accountPubKey),
            0,
            size
        );
        require(success, LibSystemErrors.SystemAccountDataQuery());

        return data;
    }

    /// @notice Helper function to derive the address of the Solana account which would be created by executing a
    /// `createAccountWithSeed` instruction formatted with the same parameters
    /// @param basePubKey The base public key used to derive the newly created account
    /// @param programId The id of the Solana program which would be granted permission to write data to the newly
    /// created account
    /// @param seed The bytes seed used to derive the newly created account
    function getCreateWithSeedAccount(
        bytes32 basePubKey,
        bytes32 programId,
        bytes memory seed
    ) internal pure returns(bytes32) {
        return sha256(abi.encodePacked(basePubKey, seed, programId));
    }

    /// @param accountPubKey The 32 bytes Solana account public key
    /// @return true if account is rent exempt, false otherwise
    function isRentExempt(bytes32 accountPubKey) internal view returns(bool) {
        if(getRentEpoch(accountPubKey) >= type(uint64).max) {
            return true;
        } else {
            return false;
        }
    }

    /// @param accountBytesSize The storage space allocated to considered Solana account in bytes
    /// @param rentDataBytes The rent data stored on Solana's SysvarRent111111111111111111111111111111111 account
    /// @return account's minimum balance for rent exemption in lamports
    function getRentExemptionBalance(
        uint64 accountBytesSize,
        bytes memory rentDataBytes
    ) internal pure returns(uint64) {
        // Extract the first 8 bytes of data which represent the rent in lamports per byte per year encoded as a uint64
        uint64 lamportsPerByteYear = (rentDataBytes.toUint64(0)).readLittleEndianUnsigned64();
        // Calculate the account's rent per year
        uint256 rentPerYear = (ACCOUNT_STORAGE_OVERHEAD + accountBytesSize) * lamportsPerByteYear;
        // Extract the next 8 bytes of data which represent the rent exemption threshold in years encoded as a IEEE754
        // double precision floating point value (float64)
        bytes8 rentExemptionThresholdFloat64Bytes = bytes8(rentDataBytes.toUint64(8).readLittleEndianUnsigned64());
        // Decode the IEEE754 double precision floating point value (float64) into its fraction and exponent components
        DecodedFloat64 memory decodedRentExemptionThresholdFloat64 = decodeFloat64(rentExemptionThresholdFloat64Bytes);
        // IEEE754 double precision encoding: https://en.wikipedia.org/wiki/Double-precision_floating-point_format
        // IEEE754 quadruple precision encoding: https://en.wikipedia.org/wiki/Quadruple-precision_floating-point_format
        // Reference implementation: https://github.com/abdk-consulting/abdk-libraries-solidity/blob/d8817cb600381319992d7caa038bf4faceb1097f/ABDKMathQuad.sol#L127
        // The conversion from float64 to uint64 is calculated as: (1 + fraction) * 2 ^ exponent
        // We return rentPerYear * (1 + fraction) * 2 ^ exponent
        uint256 rentExemptionBalance = rentPerYear * (decodedRentExemptionThresholdFloat64.fraction + 0x10000000000000);
        // Exponent is encoded with the zero offset being 1023, so the actual exponent value is (exponent - 1023).
        // We check if the actual exponent value is lower than or greater than 52, i.e. if the exponent component of the
        // IEEE754 double precision encoding is lower than or greater than 1023 + 52 = 1075.
        uint64 shift = (decodedRentExemptionThresholdFloat64.exponent < 1075)
            ? (1075 - decodedRentExemptionThresholdFloat64.exponent)
            : (decodedRentExemptionThresholdFloat64.exponent - 1075);
        // The bytes length of the fraction component of the IEEE754 double precision encoding is 52 bytes. This means
        // that in order to multiply it by (2 ^ exponent) and obtain the resulting value as a uint64 we actually need to
        // shift the bytes encoding of this fraction component to the left by (exponent - 52) or to the right by (52 - exponent)
        if (decodedRentExemptionThresholdFloat64.exponent < 1075) {
            // If the actual exponent value is less than 52: divide by 2 ^ (52 - exponent)
            rentExemptionBalance >>= shift;
        } else {
            // Else if the actual exponent value is greater than 52: multiply by 2 ^ (exponent - 52)
            rentExemptionBalance <<= shift;
        }

        return uint64(rentExemptionBalance);
    }

    /// @notice Helper function to decode a IEEE754 double precision floating point value into its fraction and exponent
    /// components
    /// IEEE754 double precision encoding: https://en.wikipedia.org/wiki/Double-precision_floating-point_format
    /// IEEE754 quadruple precision encoding: https://en.wikipedia.org/wiki/Quadruple-precision_floating-point_format
    /// Reference implementation: https://github.com/abdk-consulting/abdk-libraries-solidity/blob/d8817cb600381319992d7caa038bf4faceb1097f/ABDKMathQuad.sol#L127
    /// @param float64Bytes IEEE754 double precision encoded floating point value
    /// @return DecodedFloat64 struct
    function decodeFloat64 (bytes8 float64Bytes) internal pure returns (DecodedFloat64 memory) {
        unchecked {
            require (uint64(float64Bytes) < 0x8000000000000000, LibSystemErrors.NegativeFloat64()); // Make sure the encoded
            // number is positive, revert otherwise.
            uint64 fraction = uint64(float64Bytes) & 0x0FFFFFFFFFFFFF; // Only keep significand bits (remove sign and
            // exponent bits).
            uint64 exponent = uint64(float64Bytes) >> 52 & 0x7FF; // Shift float64Value to the right by 52 bits and
            // remove the sign bit to only keep exponent bits.
            require (exponent <= 1086, LibSystemErrors.Float64Overflow()); // Exponent is encoded with the zero offset
            // being 1023, so the actual exponent value is: (exponent - 1023). Here we make sure the actual exponent
            // value is below 63 to avoid overflow and we revert otherwise. This is because the encoded value is at
            // least equal to 2^p where p is the actual exponent value.

            return DecodedFloat64(fraction, exponent);
        }
    }
}
