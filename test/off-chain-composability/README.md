# PoCs validating composability with off-chain generated Solana instructions

## Commands:
* **Jupiter swap** - ```npx hardhat test mocha test/off-chain-composability/TestJupiterSwap.js --network neonmainnet```
* **PumpFun swap** - ```npx hardhat test mocha test/off-chain-composability/TestRaydiumCLMMSwap.js --network neonmainnet```
* **Raydium CLMM swap** - ```npx hardhat test mocha test/off-chain-composability/TestPumpFunSwap.js --network neonmainnet```

## Transaction examples:
* **Jupiter swap** - [https://neon.blockscout.com/tx/0xd1b8ff43c059e0650305aa12febe72de2a3f20646146ffa00f5313b4250001c2](https://neon.blockscout.com/tx/0xd1b8ff43c059e0650305aa12febe72de2a3f20646146ffa00f5313b4250001c2)
* **PumpFun swap** - [https://neon.blockscout.com/tx/0x5d715a64027dc93ebb44fa40dd1a99dc5f3c1c135b101c6062d752f5f39110c6](https://neon.blockscout.com/tx/0x5d715a64027dc93ebb44fa40dd1a99dc5f3c1c135b101c6062d752f5f39110c6)
* **Raydium CLMM swap** - [https://neon.blockscout.com/tx/0x0a46f8b8229d2a95c1c933f00ff22b2dadac85a70e477d9e5e15a56fcc9266f5](https://neon.blockscout.com/tx/0x0a46f8b8229d2a95c1c933f00ff22b2dadac85a70e477d9e5e15a56fcc9266f5)