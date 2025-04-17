// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20ForSplFactory} from "../interfaces/IERC20ForSplFactory.sol";
import {IERC20ForSpl} from "../interfaces/IERC20ForSpl.sol";
import {ICallSolana} from '../precompiles/ICallSolana.sol';
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Constants} from "../libraries/Constants.sol";
import {LibAssociatedTokenData} from "../libraries/associated-token-program/LibAssociatedTokenData.sol";
import {LibRaydiumProgram} from "../libraries/raydium-program/LibRaydiumProgram.sol";
import {LibRaydiumData} from "../libraries/raydium-program/LibRaydiumData.sol";
import {LibSPLTokenData} from "../libraries/spl-token-program/LibSPLTokenData.sol";
import {SolanaDataConverterLib} from "../utils/SolanaDataConverterLib.sol";
import {CallSolanaHelperLib} from "../utils/CallSolanaHelperLib.sol";


/// @title MemeLaunchpad
/// @notice Factory contract for creating and managing memecoin tokens with Raydium integration
/// @dev Implements a funding mechanism with bonding curve and Raydium pool creation
contract MemeLaunchpad is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20ForSpl;
    using SolanaDataConverterLib for uint64;
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    
    /// @notice Represents the current state of a token
    /// @dev NOT_CREATED: Token hasn't been created yet
    /// @dev FUNDING: Token is in funding phase
    /// @dev TRADING: Token has reached funding goal and is trading on Raydium
    enum TokenState {
        NOT_CREATED,
        FUNDING,
        TRADING
    }

    struct TokenSale {
        uint64 fundingGoal;
        uint64 initialSupply;
        uint64 fundingSupply;
        uint64 collateralAmount;
        TokenState state;
    }

    /// @notice Denominator for fee calculations (10000 = 100%)
    uint64 public constant FEE_DENOMINATOR = 10000;

    /// @notice Mapping of token address to its current state
    mapping(address => TokenSale) public tokens;

    /// @notice Address of the ERC20ForSplFactory contract
    address public immutable erc20ForSplFactory;

    /// @notice Address of the WSOL token
    IERC20ForSpl public immutable wsolToken;

    /// @notice Address of the BondingCurve contract
    BondingCurve public immutable bondingCurve;

    /// @notice Fee percentage in basis points
    uint64 public feePercent;

    /// @notice Accumulated fees
    uint64 public fee;

    /// @notice Emitted when a new token is created
    /// @param token Address of the newly created token
    event TokenSaleCreated(address indexed token);

    /// @notice Emitted when liquidity is added to a token's Raydium pool
    /// @param token Address of the token
    /// @param poolId The Solana account of the Raydium pool
    /// @param lpAmount The initial amount of LP being locked
    /// @param lpLockPositionNFTAccount The NFT Solana account that holds the LP locked position
    event TokenLiqudityAdded(address indexed token, bytes32 indexed poolId, uint64 lpAmount, bytes32 lpLockPositionNFTAccount);

    error InvalidTokens();

    error InvalidTokenSaleFee();

    error InvalidTokenSale();

    error InvalidInputAmount();

    /// @notice Constructor for MemeLaunchpad
    /// @param _erc20ForSplFactory Address of the ERC20ForSplFactory contract
    /// @param _bondingCurve Address of the BondingCurve contract
    /// @param _wsolToken Address of the WSOL token
    /// @param _feePercent Fee percentage in basis points
    constructor(
        address _erc20ForSplFactory,
        address _bondingCurve,
        IERC20ForSpl _wsolToken,
        uint64 _feePercent
    ) Ownable(msg.sender) {
        require(_feePercent <= 500, InvalidTokenSaleFee()); // token sale fee cannot be bigger than 5%
        erc20ForSplFactory = _erc20ForSplFactory;
        bondingCurve = BondingCurve(_bondingCurve);
        wsolToken = _wsolToken;
        feePercent = _feePercent;
    }

    /// @notice Calculates the amount of tokens to receive for a given WSOL amount
    /// @param tokenAddress Address of the token
    /// @param amount Amount of WSOL to spend
    /// @return receiveAmount Amount of tokens to receive
    /// @return availableSupply Available supply for funding
    /// @return totalSupply Current total supply
    /// @return contributionWithoutFee Contribution amount after fee calculation
    function calculateBuyAmount(
        address tokenAddress, 
        uint64 amount
    ) public view returns (
        uint256 receiveAmount,
        uint256 availableSupply,
        uint256 totalSupply,
        uint256 contributionWithoutFee
    ) {
        contributionWithoutFee = _amountWithoutFee(amount);
        
        totalSupply = IERC20ForSpl(tokenAddress).totalSupply();
        receiveAmount = bondingCurve.getAmountOut(
            totalSupply,
            contributionWithoutFee
        );
        availableSupply = tokens[tokenAddress].fundingSupply - totalSupply;
    }
    
    function getNeonAddress(address _address) public view returns(bytes32) {
        return CALL_SOLANA.getNeonAddress(_address);
    }

    function getPayer() public view returns(bytes32) {
        return CALL_SOLANA.getPayer();
    }

    function getNeonArbitraryTokenAccount(address token, address evm_address) public view returns (bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            Constants.getNeonEvmProgramId(),
            abi.encodePacked(
                hex"03",
                hex"436f6e747261637444617461", // ContractData
                token,
                bytes32(uint256(uint160((evm_address))))
            )
        );
    }

    /// @notice Remove feePercent out of provided amount
    function _amountWithoutFee(uint64 amount) internal view returns(uint64) {
        return amount - ((amount * feePercent) / FEE_DENOMINATOR);
    }

    /// @notice Updates the fee percentage for token operations
    /// @param _feePercent New fee percentage in basis points
    function setFeePercent(uint64 _feePercent) external onlyOwner {
        require(_feePercent <= 500, InvalidTokenSaleFee()); // token sale fee cannot be bigger than 5%
        feePercent = _feePercent;
    }

    /// @notice Withdraws accumulated fees to the owner
    function claimTokenSaleFee() external onlyOwner {
        wsolToken.transfer(msg.sender, fee);
        fee = 0;
    }

    /// @notice Creates a new erc20forspl token with the specified name and symbol. This token is a Solidity wrapper of SPLToken on Solana
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param decimals Token decimals
    /// @param fundingGoal Token sale funding goal
    /// @param initialSupply Token sale initial supply
    /// @param fundingSupply Token sale current funding supply
    /// @return tokenAddress The address of the new created token
    function createTokenSale(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint64 fundingGoal,
        uint64 initialSupply,
        uint64 fundingSupply
    ) external returns(address) {
        address tokenAddress = IERC20ForSplFactory(erc20ForSplFactory).createErc20ForSplMintable(
            name,
            symbol,
            decimals,
            address(this)
        );
        
        tokens[tokenAddress] = TokenSale(
            fundingGoal,
            initialSupply,
            fundingSupply,
            0,
            TokenState.FUNDING
        );
        emit TokenSaleCreated(tokenAddress);

        return tokenAddress;
    }

    /// @notice Buys tokens during the funding phase. If funding goal is reached, creates Raydium pool and locks all of the initial liquidity
    /// @param tokenAddress Address of the token to buy
    /// @param amount Amount of WSOL to spend
    function buy(
        address tokenAddress, 
        uint64 amount
    ) external nonReentrant {
        require(tokens[tokenAddress].state == TokenState.FUNDING, InvalidTokenSale());
        require(amount > 0, InvalidInputAmount());

        uint64 leftToFundingGoal = tokens[tokenAddress].fundingGoal - tokens[tokenAddress].collateralAmount;
        uint64 contributionWithoutFee = _amountWithoutFee(amount);
        if (contributionWithoutFee > leftToFundingGoal) {
            amount = leftToFundingGoal + (leftToFundingGoal * feePercent) / FEE_DENOMINATOR;
            contributionWithoutFee = leftToFundingGoal;
        }
        uint64 _fee = amount - contributionWithoutFee;
        fee += _fee;
        
        wsolToken.transferFrom(msg.sender, address(this), amount);

        IERC20ForSpl token = IERC20ForSpl(tokenAddress);
        tokens[tokenAddress].collateralAmount += contributionWithoutFee;
        token.mint(
            msg.sender, 
            bondingCurve.getAmountOut(
                token.totalSupply(),
                contributionWithoutFee
            )
        );
        
        if (tokens[tokenAddress].collateralAmount >= tokens[tokenAddress].fundingGoal) {
            token.mint(address(this), tokens[tokenAddress].initialSupply);
            (
                bytes32 poolId,
                uint64 lpAmount,
                bytes32 lpLockPositionNFTAccount
            ) = _createPoolAndLockLP(
                token, 
                tokens[tokenAddress].collateralAmount,
                tokens[tokenAddress].initialSupply,
                true
            );

            tokens[tokenAddress].state = TokenState.TRADING;
            emit TokenLiqudityAdded(tokenAddress, poolId, lpAmount, lpLockPositionNFTAccount);
        }
    }

    function _createPoolAndLockLP(
        IERC20ForSpl token,
        uint64 mintAAmount,
        uint64 mintBAmount,
        bool withMetadata
    ) internal returns(bytes32, uint64, bytes32) {
        bytes32 tokenAMint = wsolToken.tokenMint();
        bytes32 tokenBMint = token.tokenMint();
        bytes32 payerAccount = CALL_SOLANA.getPayer();
        bytes32 tokenA_ATA = LibAssociatedTokenData.getAssociatedTokenAccount(tokenAMint, payerAccount);
        bytes32 tokenB_ATA = LibAssociatedTokenData.getAssociatedTokenAccount(tokenBMint, payerAccount);

        wsolToken.transferSolana(
            tokenA_ATA,
            mintAAmount
        );

        token.transferSolana(
            tokenB_ATA,
            mintBAmount
        );

        bytes32[] memory premadeAccounts = new bytes32[](20);
        premadeAccounts[0] = payerAccount;
        premadeAccounts[7] = tokenA_ATA;
        premadeAccounts[8] = tokenB_ATA;

        // build instruction #1 - Creation of a pool
        (
            uint64 lamports,
            bytes32[] memory accounts,
            bool[] memory isSigner,
            bool[] memory isWritable,
            bytes memory data
        ) = LibRaydiumProgram.createPoolInstruction(
            tokenAMint, 
            tokenBMint, 
            mintAAmount, 
            tokens[address(token)].initialSupply, 
            uint64(block.timestamp), 
            0, 
            true, 
            premadeAccounts
        );
        bytes32 poolId = accounts[3];

        // Semi-build instruction #2 - Locking of LP
        bytes32[] memory premadeLockLPAccounts = new bytes32[](19);
        premadeLockLPAccounts[1] = accounts[0];
        premadeLockLPAccounts[8] = accounts[6];
        premadeLockLPAccounts[9] = accounts[9];
        premadeLockLPAccounts[11] = accounts[10];
        premadeLockLPAccounts[12] = accounts[11];
        (
            uint64 lamportsLock,
            bytes32[] memory accountsLock,
            bool[] memory isSignerLock,
            bool[] memory isWritableLock,
            bytes memory dataLock
        ) = LibRaydiumProgram.lockLiquidityInstruction(
            poolId, 
            0, 
            withMetadata, 
            poolId, 
            false, 
            premadeLockLPAccounts
        );

        bytes memory lockInstruction = CallSolanaHelperLib.prepareSolanaInstruction(
            Constants.getLockCPMMPoolProgramId(),
            accountsLock,
            isSignerLock,
            isWritableLock,
            dataLock
        );

        // First composability request to Solana - no more iterative execution of the Solidity logic
        CALL_SOLANA.execute(
            lamports,
            CallSolanaHelperLib.prepareSolanaInstruction(
                Constants.getCreateCPMMPoolProgramId(),
                accounts,
                isSigner,
                isWritable,
                data
            )
        );
        
        // Building the instruction data for the second composability request
        uint64 lpBalance = LibSPLTokenData.getSPLTokenAccountBalance(accountsLock[9]);
        bytes memory lockInstructionData = LibRaydiumProgram.buildLockLiquidityData(
            lpBalance,
            withMetadata
        );

        // Second composability request to Solana
        CALL_SOLANA.executeWithSeed(
            lamportsLock,
            poolId,
            abi.encodePacked(
                lockInstruction,
                uint64(lockInstructionData.length).readLittleEndianUnsigned64(),
                lockInstructionData
            )
        );

        return (
            poolId, // Raydium CPMM Pool account
            lpBalance, // locked LP amount
            accountsLock[4] // NFT Mint account
        );
    }

    /// @notice Buys tokens during the funding phase. If funding goal is reached, creates Raydium pool and locks all of the initial liquidity
    /// @param poolId The Solana account of the Raydium pool
    /// @param tokenA The EVM address of the pool's token A
    /// @param tokenB The EVM address of the pool's token B
    /// @param lpFeeAmount Amount of fee to be collected ( passing type(uint64).max will collect all the current pending fees )
    function collectPoolFees(
        bytes32 poolId,
        address tokenA,
        address tokenB,
        uint64 lpFeeAmount
    ) external onlyOwner {
        bytes32 tokenAMint = IERC20ForSpl(tokenA).tokenMint();
        bytes32 tokenBMint = IERC20ForSpl(tokenB).tokenMint();

        bytes32[] memory premadeAccounts = new bytes32[](18);
        premadeAccounts[8] = getNeonArbitraryTokenAccount(tokenA, msg.sender);
        premadeAccounts[9] = getNeonArbitraryTokenAccount(tokenB, msg.sender);

        (
            bytes32[] memory accounts,
            bool[] memory isSigner,
            bool[] memory isWritable,
            bytes memory data
        ) = LibRaydiumProgram.collectFeesInstruction(poolId, lpFeeAmount, poolId, true, premadeAccounts);
        require(accounts[12] == tokenAMint && accounts[13] == tokenBMint, InvalidTokens());

        CALL_SOLANA.execute(
            0,
            CallSolanaHelperLib.prepareSolanaInstruction(
                Constants.getLockCPMMPoolProgramId(),
                accounts,
                isSigner,
                isWritable,
                data
            )
        );
    }
} 