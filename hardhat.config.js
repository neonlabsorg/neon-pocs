import { task } from "hardhat/config"
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers"
import { deriveMasterKeyFromKeystore } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/keystores/encryption.ts"
import { askPassword } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/keystores/password.ts"
import { UserDisplayMessages } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/ui/user-display-messages.ts"
import { setupKeystoreLoaderFrom } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/utils/setup-keystore-loader-from.ts"

// Custom subtask to the built-in keystore task to ask for the keystore password in the CLI while running mocha tests
const askPasswordTask = task(["keystore", "askpwd"], "Asks for the keystore password in the CLI")
    .setAction(async (args, hre) => {
      return await askPassword(hre.interruptions.requestSecretInput.bind(hre.interruptions))
    })
    .build()

// Custom subtask to the built-in keystore task to decrypt keystore secrets while running mocha tests
const decryptSecretTask = task(["keystore", "decrypt"], "Decrypts a secret value given a key and a password")
    .addPositionalArgument({
      name: "key",
      type: "STRING",
      description: "Specifies the key of the secret value we want to decrypt"
    })
    .addPositionalArgument({
      name: "password",
      type: "STRING",
      description: "The password that was used to encrypt the secret value"
    })
    .setAction(async (args, hre) => {
      return await decryptSecret(hre, args.key, args.password)
    })
    .build()

// Custom function to decrypt keystore secrets while running mocha tests
async function decryptSecret(hre, key, password) {
  const keystoreLoader = setupKeystoreLoaderFrom(hre)
  if (!(await keystoreLoader.isKeystoreInitialized())) {
    console.error(UserDisplayMessages.displayNoKeystoreSetErrorMessage())
    process.exitCode = 1
    return
  }
  const keystore = await keystoreLoader.loadKeystore()
  const masterKey = deriveMasterKeyFromKeystore({
    encryptedKeystore: keystore.toJSON(),
    password
  })
  if (!(await keystore.hasKey(key, masterKey))) {
    console.error(UserDisplayMessages.displayKeyNotFoundErrorMessage(key))
    process.exitCode = 1
    return
  }
  return await keystore.readValue(key, masterKey)
}

const config = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  tasks: [askPasswordTask, decryptSecretTask],
  solidity: {
        compilers:[
            {
                version: '0.8.28',
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    }
                },
            },
        ],
  },
  docgen: {
    path: './docs',
    pages: 'files',
    clear: true,
    runOnCompile: true
  },
  etherscan: {
    apiKey: {
      neonevm: "test",
    },
    customChains: [
      {
        network: "neonevm",
        chainId: 245022926,
        urls: {
          apiURL: "https://neon-devnet.blockscout.com/api",
          browserURL: "https://neon-devnet.blockscout.com",
        },
      },
      {
        network: "neonevm",
        chainId: 245022934,
        urls: {
          apiURL: "https://neon.blockscout.com/api",
          browserURL: "https://neon.blockscout.com",
        },
      },
    ],
    },
  networks: {
    neondevnet: {
      type: "http",
      chainType: "generic",
      url: "https://devnet.neonevm.org",
      accounts: [],
      chainId: 245022926,
      allowUnlimitedContractSize: false,
      gas: "auto",
      gasPrice: "auto",
    },
    neonmainnet: {
      type: "http",
      chainType: "generic",
      url: "https://neon-proxy-mainnet.solana.p2p.org",
      accounts: [],
      chainId: 245022934,
      allowUnlimitedContractSize: false,
      gas: "auto",
      gasPrice: "auto",
    },
  },
  mocha: {
      timeout: 2800000
  }
}

export default config