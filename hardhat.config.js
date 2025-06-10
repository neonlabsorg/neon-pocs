import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers"
import {
    setSecretTask,
    getSecretTask,
    listSecretsTask,
    deleteSecretTask,
    displayKeystoreFilePathTask,
    isSecretSetTask,
    askPasswordTask,
    decryptSecretTask
} from "./custom-tasks.js"

const config = {
    plugins: [hardhatToolboxMochaEthersPlugin],
    tasks: [
        setSecretTask,
        getSecretTask,
        listSecretsTask,
        deleteSecretTask,
        displayKeystoreFilePathTask,
        isSecretSetTask,
        askPasswordTask,
        decryptSecretTask
    ],
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