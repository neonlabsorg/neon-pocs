# POC - Aave V3 flash loan with composability requests to Solana

The following POC aims to validate that it's possible to request a flash loan from DeFi protocol on Neon EVM _( an Aave V3 fork )_ and to use the loan in the context of Solana by requesting the Raydium CPMM Program. In this example we're requesting a loan of $USDC tokens and swapping them against WSOL tokens. At the end of the 2nd swap request to Raydium we're repaying back the flash loan and the fee back to Aave. The requesting from Neon EVM to Solana is possible through a composability feature that Neon EVM supports and more specifically Solidity requests to a custom precompile `0xFF00000000000000000000000000000000000006`. More details about the feature [here](https://neonevm.org/docs/composability/common_solana_terminology). Info about the POC:
* The contract deployed and verified at [https://neon-devnet.blockscout.com/address/0x6A97C70e47Ab5d8B524C48B0FfFc570E51489ddA](https://neon-devnet.blockscout.com/address/0x6A97C70e47Ab5d8B524C48B0FfFc570E51489ddA)
* Sample transaction - [https://neon-devnet.blockscout.com/tx/0xd78d1882413a6a44f5693144b99506d1e58fd1c4b1da9da440e5f700e7275d4d](https://neon-devnet.blockscout.com/tx/0xd78d1882413a6a44f5693144b99506d1e58fd1c4b1da9da440e5f700e7275d4d)

This POC is built with the npmjs package [https://www.npmjs.com/package/@neonevm/call-solana](https://www.npmjs.com/package/@neonevm/call-solana) which provide helpers and instruction builders for different variaty of program on Solana including the Raydium's CPMM Program.

### Run the POC
* ```npx hardhat test mocha test/AaveFlashLoan/AaveFlashLoan.js --network neondevnet```

![alt text](https://github.com/neonlabsorg/neon-pocs/blob/master/contracts/AaveFlashLoan/Flashloan_Infographic.png)

### Secret values setup

See detailed [instructions](../../README.md) for setting up secret values (such as private keys) used to run tests.