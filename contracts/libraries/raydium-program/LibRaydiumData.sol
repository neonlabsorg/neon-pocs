// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Constants} from "../Constants.sol";
import {QueryAccount} from "../../precompiles/QueryAccount.sol";
import {SolanaDataConverterLib} from "../../utils/SolanaDataConverterLib.sol";
import {ICallSolana} from "../../precompiles/ICallSolana.sol";
import {LibSPLTokenData} from "../spl-token-program/LibSPLTokenData.sol";
import {LibRaydiumErrors} from "./LibRaydiumErrors.sol";


/// @title LibRaydiumData
/// @author https://twitter.com/mnedelchev_
/// @notice Helper library for getting data about Raydium's CPMM pools.
library LibRaydiumData {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint16;
    using SolanaDataConverterLib for uint64;

    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);

    struct PoolData {
        bytes32 ammConfig;
        bytes32 poolCreator;
        bytes32 tokenAVault;
        bytes32 tokenBVault;
        bytes32 lpMint;
        bytes32 tokenA;
        bytes32 tokenB;
        bytes32 tokenAProgram;
        bytes32 tokenBProgram;
        bytes32 observationKey;
    }

    struct ConfigData {
        bool disableCreatePool;
        uint16 index;
        uint64 tradeFeeRate;
        uint64 protocolFeeRate;
        uint64 fundFeeRate;
        uint64 createPoolFee;
        bytes32 protocolOwner;
        bytes32 fundOwner;
    }

    /// @notice Fetching a CPPM config account by given index
    function getConfigAccount(uint16 index) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"616d6d5f636f6e666967", // "amm_config"
                index
            )
        );
    }

    /// @notice Calculating the CPPM pool account
    function getCpmmPdaPoolId(
        bytes32 ammConfigId,
        bytes32 tokenA,
        bytes32 tokenB
    ) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"706f6f6c", // "pool"
                ammConfigId,
                tokenA,
                tokenB
            )
        );
    }

    /// @notice Calculating the CPPM pool's observation account
    function getPdaObservationId(
        bytes32 poolId
    ) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"6f62736572766174696f6e", // "observation"
                poolId
            )
        );
    }

    /// @notice Calculating the CPPM pool's LP Mint account
    function getPdaLpMint(
        bytes32 poolId
    ) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"706f6f6c5f6c705f6d696e74", // "pool_lp_mint"
                poolId
            )
        );
    }

    /// @notice Calculating the CPPM pool's Vault account for given token mint
    function getPdaVault(
        bytes32 poolId,
        bytes32 tokenMint
    ) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"706f6f6c5f7661756c74", // "pool_vault"
                poolId,
                tokenMint
            )
        );
    }

    /// @notice Calculating the CPPM authority
    function getPdaPoolAuthority() internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getCreateCPMMPoolProgramId(),
            abi.encodePacked(
                hex"7661756c745f616e645f6c705f6d696e745f617574685f73656564" // "vault_and_lp_mint_auth_seed"
            )
        );
    }

    /// @notice Calculating the CPPM lock PDA for given token mint
    function getCpLockPda(bytes32 tokenMint) internal view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getLockCPMMPoolProgramId(),
            abi.encodePacked(
                hex"6c6f636b65645f6c6971756964697479", // "locked_liquidity"
                tokenMint
            )
        );
    }

    /// @notice Calculating the CPPM metadata key account for given token mint
    function getPdaMetadataKey(bytes32 tokenMint) internal view returns(bytes32) {
        bytes32 metaplexProgramId = Constants.getMetaplexProgramId();
        return CALL_SOLANA.getSolanaPDA(
            metaplexProgramId,
            abi.encodePacked(
                hex"6d65746164617461", // "metadata"
                metaplexProgramId,
                tokenMint
            )
        );
    }

    /// @notice Fetching the CPPM pool's data by given pool account
    function getPoolData(bytes32 poolId) internal view returns(PoolData memory) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(poolId),
            0,
            328
        );
        require(success, LibRaydiumErrors.InvalidPool(poolId));

        return PoolData(
            data.toBytes32(8),
            data.toBytes32(40),
            data.toBytes32(72),
            data.toBytes32(104),
            data.toBytes32(136),
            data.toBytes32(168),
            data.toBytes32(200),
            data.toBytes32(232),
            data.toBytes32(264),
            data.toBytes32(296)
        );
    }

    /// @notice Fetching the CPPM config's data by given config account
    function getConfigData(bytes32 configAccount) internal view returns(ConfigData memory) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(configAccount),
            0,
            108
        );
        require(success, LibRaydiumErrors.InvalidConfig(configAccount));

        return ConfigData(
            data.toBool(9),
            (data.toUint16(10)).readLittleEndianUnsigned16(),
            (data.toUint64(12)).readLittleEndianUnsigned64(),
            (data.toUint64(20)).readLittleEndianUnsigned64(),
            (data.toUint64(28)).readLittleEndianUnsigned64(),
            (data.toUint64(36)).readLittleEndianUnsigned64(),
            data.toBytes32(44),
            data.toBytes32(76)
        );
    }

    /// @notice Fetching the CPPM pool's reserve amount by given pool account and token mint account
    function getTokenReserve(bytes32 poolId, bytes32 tokenMint) internal view returns(uint64) {
        return LibSPLTokenData.getSPLTokenAccountBalance(getPdaVault(poolId, tokenMint));
    }

    /// @notice Fetching the CPPM pool's LP amount by given pool account
    function getPoolLpAmount(bytes32 poolId) internal view returns(uint64) {
        return LibSPLTokenData.getSPLTokenSupply(getPdaLpMint(poolId));
    }

    /// @notice Calculating the CPPM pool's LP amount to reserve amounts
    function lpToAmount(
        uint64 lp,
        uint64 poolAmountA,
        uint64 poolAmountB,
        uint64 supply
    ) internal pure returns (uint64 amountA, uint64 amountB) {
        require(supply > 0, LibRaydiumErrors.ZeroSupply());

        amountA = (lp * poolAmountA) / supply;
        if (amountA > 0 && (lp * poolAmountA) % supply > 0) {
            amountA+=1;
        }

        amountB = (lp * poolAmountB) / supply;
        if (amountB > 0 && (lp * poolAmountB) % supply > 0) {
            amountB+=1;
        }
    }

    /// @notice Calculating the CPPM pool's swap output by given input amount
    function getSwapOutput(
        bytes32 poolId,
        bytes32 configAccount,
        bytes32 inputToken,
        bytes32 outputToken,
        uint64 sourceAmount
    ) internal view returns(uint64) {
        LibRaydiumData.ConfigData memory configData = LibRaydiumData.getConfigData(configAccount);
        uint64 reserveInAmount = LibRaydiumData.getTokenReserve(poolId, inputToken);
        uint64 reserveOutAmount = LibRaydiumData.getTokenReserve(poolId, outputToken);

        uint64 tradeFee = ((sourceAmount * configData.tradeFeeRate) + 1000000 - 1) / 1000000;
        return reserveOutAmount - ((reserveInAmount * reserveOutAmount) / (reserveInAmount + sourceAmount - tradeFee));
    }

    /// @notice Calculating the CPPM pool's swap input by given output amount
    function getSwapInput(
        bytes32 poolId,
        bytes32 configAccount,
        bytes32 inputToken,
        bytes32 outputToken,
        uint64 outputAmount
    ) internal view returns(uint64) {
        LibRaydiumData.ConfigData memory configData = LibRaydiumData.getConfigData(configAccount);
        uint64 reserveInAmount = LibRaydiumData.getTokenReserve(poolId, inputToken);
        uint64 reserveOutAmount = LibRaydiumData.getTokenReserve(poolId, outputToken);

        uint64 amountRealOut = (outputAmount > reserveOutAmount) ? reserveOutAmount - 1 : outputAmount;
        uint64 denominator = reserveOutAmount - amountRealOut;
        uint64 amountInWithoutFee = (reserveInAmount * amountRealOut) / denominator;
        return ((amountInWithoutFee * 1000000) / (1000000 - configData.tradeFeeRate));
    }
}