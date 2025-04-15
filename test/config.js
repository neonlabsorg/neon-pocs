const web3 = require("@solana/web3.js");

const config = {
    SOLANA_NODE: 'https://api.devnet.solana.com',
    DATA: {
        EVM: {
            ADDRESSES: {
                MemeLaunchpad: {
                    MemeLaunchpadTest: '',
                    BondingCurve: '0x0Fc6Ec7F9F06bd733913C1Fcd10BFc959a1F88DC'
                },
                ERC20ForSplFactory: '0xF6b17787154C418d5773Ea22Afc87A95CAA3e957',
                AAVE: {
                    AaveFlashLoanTest: '0x1f464349eEAC5DbAD27c38cCe222d4D28bAc0824',
                    AAVE_POOL: '0x9eA85823b7B736189e663ddef0FEE250EF0d23E1', // Pool-Proxy-Aave.json
                    ADDRESS_PROVIDER: '0x3792F5eD078EEbE34419627E91D648e8Ac3C56e5'
                },
                WSOL: '0xc7Fc9b46e479c5Cb42f6C458D1881e55E6B7986c',
                devUSDC: '0x146c38c2E36D34Ed88d843E013677cCe72341794' // USDC-TestnetMintableERC20-Aave.json
            }
        },
        SVM: {
            ADDRESSES: {
                WHIRLPOOLS_CONFIG: "FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR",
                devSAMO: "Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa",
                devUSDC: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"
            }
        }
    },
    utils: {
        publicKeyToBytes32: function(pubkey) {
            return ethers.zeroPadValue(ethers.toBeHex(ethers.decodeBase58(pubkey)), 32);
        },
        addressToBytes32: function(address) {
            return ethers.zeroPadValue(ethers.toBeHex(address), 32);
        },
        calculateContractAccount: function (contractEvmAddress, neonEvmProgram) {
            const neonContractAddressBytes = Buffer.from(config.utils.isValidHex(contractEvmAddress) ? contractEvmAddress.replace(/^0x/i, '') : contractEvmAddress, 'hex');
            const seed = [
                new Uint8Array([0x03]),
                new Uint8Array(neonContractAddressBytes)
            ];
        
            return web3.PublicKey.findProgramAddressSync(seed, neonEvmProgram);
        },
        calculatePdaAccount: function (prefix, tokenEvmAddress, salt, neonEvmProgram) {
            const neonContractAddressBytes = Buffer.from(config.utils.isValidHex(tokenEvmAddress) ? tokenEvmAddress.replace(/^0x/i, '') : tokenEvmAddress, 'hex');
            const seed = [
                new Uint8Array([0x03]),
                new Uint8Array(Buffer.from(prefix, 'utf-8')),
                new Uint8Array(neonContractAddressBytes),
                Buffer.from(Buffer.concat([Buffer.alloc(12), Buffer.from(config.utils.isValidHex(salt) ? salt.substring(2) : salt, 'hex')]), 'hex')
            ];
        
            return web3.PublicKey.findProgramAddressSync(seed, neonEvmProgram);
        },
        isValidHex: function(hex) {
            const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
            if (!isHexStrict) {
                throw new Error(`Given value "${hex}" is not a valid hex string.`);
            } else {
                return isHexStrict;
            }
        },
        toFixed: function(num, fixed) {
            let re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
            return num.toString().match(re)[0];
        },
        asyncTimeout: async function(timeout) {
            return new Promise((resolve) => {
                setTimeout(() => resolve(), timeout);
            })
        },
        prepareInstructionAccounts: function(instruction, overwriteAccounts) {
            let encodeKeys = '';
            for (let i = 0, len = instruction.keys.length; i < len; ++i) {
                if (typeof(overwriteAccounts) != "undefined" && Object.hasOwn(overwriteAccounts, i)) {
                    console.log(config.utils.publicKeyToBytes32(overwriteAccounts[i].key), 'publicKey');
                    encodeKeys+= ethers.solidityPacked(["bytes32"], [config.utils.publicKeyToBytes32(overwriteAccounts[i].key)]).substring(2);
                    encodeKeys+= ethers.solidityPacked(["bool"], [overwriteAccounts[i].isSigner]).substring(2);
                    encodeKeys+= ethers.solidityPacked(["bool"], [overwriteAccounts[i].isWritable]).substring(2);
                } else {
                    console.log(config.utils.publicKeyToBytes32(instruction.keys[i].pubkey.toString()), 'publicKey');
                    encodeKeys+= ethers.solidityPacked(["bytes32"], [config.utils.publicKeyToBytes32(instruction.keys[i].pubkey.toString())]).substring(2);
                    encodeKeys+= ethers.solidityPacked(["bool"], [instruction.keys[i].isSigner]).substring(2);
                    encodeKeys+= ethers.solidityPacked(["bool"], [instruction.keys[i].isWritable]).substring(2);
                }
            }

            return '0x' + ethers.zeroPadBytes(ethers.toBeHex(instruction.keys.length), 8).substring(2) + encodeKeys;
        },
        prepareInstructionData: function(instruction) {
            const packedInstructionData = ethers.solidityPacked( 
                ["bytes"],
                [instruction.data]
            ).substring(2);
            console.log(packedInstructionData, 'packedInstructionData');

            return '0x' + ethers.zeroPadBytes(ethers.toBeHex(instruction.data.length), 8).substring(2) + packedInstructionData;
        },
        prepareInstruction: function(instruction) {
            return config.utils.publicKeyToBytes32(instruction.programId.toBase58()) + config.utils.prepareInstructionAccounts(instruction).substring(2) + config.utils.prepareInstructionData(instruction).substring(2);
        },
        orcaHelper: {
            getParamsFromPools: function(
                pools, 
                PDAUtil, 
                programId,
                ataContractTokenA,
                ataContractTokenB,
                ataContractTokenC
            ) {
                const whirlpoolOne = pools[0].address;
                const whirlpoolTwo = pools[1].address;
                const oracleOne = PDAUtil.getOracle(programId, whirlpoolOne).publicKey;
                const oracleTwo = PDAUtil.getOracle(programId, whirlpoolTwo).publicKey;
    
                return {
                    whirlpoolOne: whirlpoolOne,
                    whirlpoolTwo: whirlpoolTwo,
                    tokenOwnerAccountOneA: ataContractTokenA,
                    tokenVaultOneA: pools[0].tokenVaultAInfo.address,
                    tokenOwnerAccountOneB: ataContractTokenB,
                    tokenVaultOneB: pools[0].tokenVaultBInfo.address,
                    tokenOwnerAccountTwoA: ataContractTokenC,
                    tokenVaultTwoA: pools[1].tokenVaultAInfo.address,
                    tokenOwnerAccountTwoB: ataContractTokenB,
                    tokenVaultTwoB: pools[1].tokenVaultBInfo.address,
                    oracleOne,
                    oracleTwo
                };
            },
            getTokenAccsForPools: function(pools, tokenAccounts) {
                const mints = [];
                for (const pool of pools) {
                    mints.push(pool.tokenMintA);
                    mints.push(pool.tokenMintB);
                }
    
                return mints.map(
                    (mint) => tokenAccounts.find((acc) => acc.mint.equals(mint)).account
                );
            }
        },
        airdropNEON: async function(address) {
            const postRequestNeons = await fetch('https://api.neonfaucet.org/request_neon', {
                method: 'POST',
                body: JSON.stringify({"amount": 100, "wallet": address}),
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('Airdrop NEONs to', address);

            await config.utils.asyncTimeout(1000);
        },
        airdropSOL: async function(account) {
            let postRequest = await fetch(config.SOLANA_NODE, {
                method: 'POST',
                body: JSON.stringify({"jsonrpc":"2.0", "id":1, "method":"requestAirdrop", "params": [account.publicKey.toBase58(), 100000000000]}),
                headers: { 'Content-Type': 'application/json' }
            });
            console.log('Airdrop SOLs to', account.publicKey.toBase58());

            await config.utils.asyncTimeout(1000);
        },
        asyncTimeout: async function(timeout) {
            return new Promise((resolve) => {
                setTimeout(() => resolve(), timeout);
            })
        }
    },
};
module.exports = { config };