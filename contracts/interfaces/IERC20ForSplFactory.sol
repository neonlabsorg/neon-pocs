// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20ForSplFactory {
    function createErc20ForSplMintable(string memory _name, string memory _symbol, uint8 _decimals, address _mint_authority) external returns (address erc20spl);
}