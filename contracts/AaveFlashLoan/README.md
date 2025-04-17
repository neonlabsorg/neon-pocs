# POC - Aave V3 flash loan with composability requests to Solana

The following POC aims to validate that it's possible to request a flash loan from DeFi protocol on Neon EVM _( an Aave V3 fork )_ and to use the loan in the context of Solana. In this example we're requesting a loan of $USDC tokens and swapping them against $SAMO tokens _( both tokens are arbitrary tokens supported by Orca program on Solana )_. At the end of the 2nd swap request to Orca we're repaying back the flash loan and the fee back to the Aave V3 fork. The requesting from Neon EVM to Solana is possible through a composability feature that Neon EVM supports and more specifically Solidity requests to a custom precompile `0xFF00000000000000000000000000000000000006`. More details about the feature [here](https://neonevm.org/docs/composability/common_solana_terminology). Data about the POC:
* The contract deployed and verified at [https://neon-devnet.blockscout.com/address/0x1f464349eEAC5DbAD27c38cCe222d4D28bAc0824](https://neon-devnet.blockscout.com/address/0x1f464349eEAC5DbAD27c38cCe222d4D28bAc0824)
* Sample transaction - [https://neon-devnet.blockscout.com/tx/0x5d4a2c7aefebd85f7fc2c726f81496953655238125b7efc535c9efa6189ce8c0](https://neon-devnet.blockscout.com/tx/0x5d4a2c7aefebd85f7fc2c726f81496953655238125b7efc535c9efa6189ce8c0)

### Run the POC
* ```npx hardhat test test/AaveFlashLoan/AaveFlashLoan.js --network neondevnet```

![alt text](https://github.com/neonlabsorg/neon-pocs/blob/master/contracts/AaveFlashLoan/Flashloan_Infographic.png)