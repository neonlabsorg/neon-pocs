// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title LibSystemErrors
/// @notice Custom errors library for interactions with Solana's System program
/// @author maxpolizzo@gmail.com
library LibSystemErrors {
    // System account data query error
    error SystemAccountDataQuery();

    // Errors related to float64 to uint64 conversion
    error NegativeFloat64();
    error Float64Overflow();
}
