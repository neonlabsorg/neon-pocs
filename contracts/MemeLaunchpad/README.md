# POC - MemeLaunchpad with composability requests to Solana

The following POC aims to validate that it's possible to build MemeLaunchpad project that deploys pool in a chosen DEX on Solana. Pool is being created when the funding goal for each token sale has been reached, then the initial supply of LP gets locked. The requesting from Neon EVM to Solana is possible through a composability feature that Neon EVM supports and more specifically Solidity requests to a custom precompile `0xFF00000000000000000000000000000000000006`. More details about the feature [here](https://neonevm.org/docs/composability/common_solana_terminology). Data about the POC:
* Funding goal being reached for a token sale _( Raydium pool creation; Locking of initial LP )_ - [https://devnet.neonscan.org/tx/0xa3d9819bfd47833718f3bb1525e24b4ad32a686b929b9c47c3da305b518e09e8](https://devnet.neonscan.org/tx/0xa3d9819bfd47833718f3bb1525e24b4ad32a686b929b9c47c3da305b518e09e8)
* Collecting fees generated from Raydium's pool activity - [https://devnet.neonscan.org/tx/0xfde57881cd5f0d9f1d487dfc4755f85993b6f3c0803802c31656b750a0ddb1be](https://devnet.neonscan.org/tx/0xfde57881cd5f0d9f1d487dfc4755f85993b6f3c0803802c31656b750a0ddb1be)

### Run the POC
* ```npx hardhat test test/MemeLaunchpad/MemeLaunchpad.js --network neondevnet```