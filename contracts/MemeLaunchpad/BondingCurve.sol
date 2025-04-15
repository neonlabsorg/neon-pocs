// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";

/// @title BondingCurve
/// @notice Implements a bonding curve for token pricing using exponential functions
contract BondingCurve {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;

    uint256 public immutable A;
    uint256 public immutable B;

    constructor(uint256 _a, uint256 _b) {
        A = _a;
        B = _b;
    }

    /// @notice Calculates the WSOL amount received for selling tokens
    /// @param x0 Current token supply
    /// @param deltaX Amount of tokens to sell
    /// @return deltaY Amount of WSOL received
    function getFundsReceived(
        uint256 x0,
        uint256 deltaX
    ) public view returns (uint256 deltaY) {
        uint256 a = A;
        uint256 b = B;
        require(x0 >= deltaX);
        // calculate exp(b*x0), exp(b*x1)
        int256 exp_b_x0 = (int256(b.mulWad(x0))).expWad();
        int256 exp_b_x1 = (int256(b.mulWad(x0 - deltaX))).expWad();

        // calculate deltaY = (a/b)*(exp(b*x0) - exp(b*x1))
        uint256 delta = uint256(exp_b_x0 - exp_b_x1);
        deltaY = a.fullMulDiv(delta, b);
    }

    /// @notice Calculates the number of tokens received for a given WSOL amount
    /// @param x0 Current token supply
    /// @param deltaY Amount of WSOL to spend
    /// @return deltaX Amount of tokens received
    function getAmountOut(
        uint256 x0,
        uint256 deltaY
    ) public view returns (uint256 deltaX) {
        uint256 a = A;
        uint256 b = B;
        // calculate exp(b*x0)
        uint256 exp_b_x0 = uint256((int256(b.mulWad(x0))).expWad());

        // calculate exp(b*x0) + (dy*b/a)
        uint256 exp_b_x1 = exp_b_x0 + deltaY.fullMulDiv(b, a);

        // calculate ln(x1)/b-x0
        deltaX = uint256(int256(exp_b_x1).lnWad()).divWad(b) - x0;
    }
}