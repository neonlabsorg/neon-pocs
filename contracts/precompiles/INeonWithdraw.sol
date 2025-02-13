// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INeonWithdraw {
    /// @notice Transfer NEONs from msg.sender's account on Solana to chosen Solana account
    /// @param account receiver's account on Solana in bytes32 format
    function withdraw(bytes32 account) external payable;
}