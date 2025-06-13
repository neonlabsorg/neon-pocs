const config = {
    neon_faucet: {
        curvestand: {
            url: "https://curve-stand.neontest.xyz/request_neon",
            min_balance: "10000",
        },
        neondevnet: {
            url: "https://api.neonfaucet.org/request_neon",
            min_balance: "100",
        },
        neonmainnet: {
            url: "",
            min_balance: "0",
        },
    },
    evm_sol_node: {
        curvestand: "https://curve-stand.neontest.xyz/SOL",
        neondevnet: "https://devnet.neonevm.org/SOL",
        neonmainnet: "https://neonevm.org/SOL",
    },
    svm_node: {
        curvestand: "https://curve-stand.neontest.xyz/solana",
        neondevnet: "https://api.devnet.solana.com",
        neonmainnet: "https://api.mainnet-beta.solana.com",
    },
    composability: {
        CallSolana: {
            curvestand: "",
            neondevnet: "0x776E4abe7d73Fed007099518F3aA02C8dDa9baA0",
            neonmainnet: "0x5BAB7cAb78D378bBf325705C51ec4649200A311b",
        },
        CallPumpFunProgram: {
            curvestand: "",
            neondevnet: "",
            neonmainnet: "",
        }
    }
}

export default config
