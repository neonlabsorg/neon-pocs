import hre from "hardhat"
import web3 from "@solana/web3.js"
import config from "./config"

const ethers = (await hre.network.connect()).ethers;
const solanaConnection = new web3.Connection(config.svm_node[hre.globalOptions.network], "processed")

export async function asyncTimeout(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timeout)
    })
}

export function asyncForLoop(iterable, asyncCallback, index, result) {
    return new Promise(async (resolve, reject) => {
        try {
            if(index < iterable.length) {
                result = await asyncCallback(iterable, index, result)
                resolve(asyncForLoop(iterable, asyncCallback, index + 1, result))
            } else {
                resolve(result)
            }
        } catch(err) {
            reject(err)
        }
    })
}

export function asyncWhileLoop(isConditionFulfilled, asyncCallback, result) {
    return new Promise(async (resolve, reject) => {
        try {
            if(!isConditionFulfilled) {
                const { isConditionFulfilled: fulfilled, result: updatedResult } = await asyncCallback(result)
                resolve(asyncWhileLoop(fulfilled, asyncCallback, updatedResult))
            } else {
                resolve(result)
            }
        } catch(err) {
            reject(err)
        }
    })
}

export async function airdropNEON(address, amount) {
    const neonAmount = parseInt(ethers.formatUnits(amount.toString(), 18))
    if(neonAmount > 0) {
        const res = await fetch(config.neon_faucet[hre.globalOptions.network].url, {
            method: 'POST',
            body: JSON.stringify({"amount": neonAmount, "wallet": address}),
            headers: {'Content-Type': 'application/json'}
        })
        console.log("\nAirdropping " + neonAmount.toString() + " NEON to " + address)
        if(res.status !== 200) {
            console.warn("\nAirdrop request failed: " + JSON.stringify(res))
        }
        let accountBalance = BigInt(0)
        await asyncWhileLoop(
            accountBalance >= amount, // condition to fulfill
            async () => {
                await asyncForLoop(1000)
                accountBalance = await ethers.provider.getBalance(address)
                return({
                    isConditionFulfilled: accountBalance >= amount,
                    result: null
                })
            },
            null
        )
        // console.log("\nNew account balance: ", accountBalance)
    }
}

export async function airdropSOL(recipientPubKey, solAmount) {
    if(solAmount > 0) {
        const params = [recipientPubKey, solAmount]
        const res = await fetch(config.svm_node[hre.globalOptions.network], {
            method: 'POST',
            body: JSON.stringify({"jsonrpc": "2.0", "id": 1, "method": "requestAirdrop", "params": params}),
            headers: {'Content-Type': 'application/json'}
        })
        console.log("\nAirdropping " + ethers.formatUnits(solAmount.toString(), 9) + " SOL to " + recipientPubKey)
        if (res.status !== 200) {
            console.warn("\nAirdrop request failed: " + JSON.stringify(res))
        }
        let accountBalance = BigInt(0)
        await asyncWhileLoop(
            accountBalance >= solAmount, // condition to fulfill
            async () => {
                await asyncForLoop(1000)
                accountBalance = await solanaConnection.getBalance(recipientPubKey)
                return ({
                    isConditionFulfilled: accountBalance >= solAmount,
                    result: null
                })
            },
            null
        )
        // console.log("\nNew account balance: ", accountBalance)
    }
}

export async function deployContract(deployer, user, contractName, contractAddress = null) {
    const minBalance = BigInt(ethers.parseUnits(config.neon_faucet[hre.globalOptions.network].min_balance, 18))
    let deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address))
    if(deployerBalance < minBalance) {
        await airdropNEON(deployer.address, minBalance - deployerBalance)
    }
    let userBalance = BigInt(await ethers.provider.getBalance(user.address))
    if(userBalance < minBalance) {
        await airdropNEON(user.address, minBalance - userBalance)
    }
    const otherUser = ethers.Wallet.createRandom(ethers.provider)
    await airdropNEON(otherUser.address, minBalance)

    const contractFactory = await ethers.getContractFactory(contractName, deployer)
    let contract
    if(contractName.split(':').length > 1) {
        contractName = contractName.split(':')[contractName.split(':').length - 1]
    }
    if (!config.composability[contractName][hre.globalOptions.network] && !contractAddress) {
        console.log("\nDeployer address: " + deployer.address)
        deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address))
        console.log("\nDeployer balance: " + ethers.formatUnits(deployerBalance.toString(), 18) + " NEON")

        console.log("\nDeploying " + contractName + " contract to " + hre.globalOptions.network + "...")
        contract = await contractFactory.deploy()
        await contract.waitForDeployment()
        console.log("\n" + contractName + " contract deployed to: " + contract.target)
    } else {
        const deployedContractAddress = contractAddress ? contractAddress : config.composability[contractName][hre.globalOptions.network]
        console.log("\n" + contractName + " contract already deployed to: " + deployedContractAddress)
        contract = contractFactory.attach(deployedContractAddress)
    }

    return { deployer, user, otherUser, contract }
}

export async function getSolanaTransactions(neonTxHash) {
    return await fetch(hre.userConfig.networks[hre.globalOptions.network].url, neonTxHash, {
        method: 'POST',
        body: JSON.stringify({
            "jsonrpc":"2.0",
            "method":"neon_getSolanaTransactionByNeonTransaction",
            "params":[neonTxHash],
            "id":1
        }),
        headers: { 'Content-Type': 'application/json' }
    })
}

export function prepareInstructionAccounts(instruction, overwriteAccounts) {
    let encodeKeys = "";
    for (let i = 0, len = instruction.keys.length; i < len; ++i) {
        if (
            typeof overwriteAccounts != "undefined" &&
            Object.hasOwn(overwriteAccounts, i)
        ) {
            encodeKeys += ethers
                .solidityPacked(
                    ["bytes32"],
                    [publicKeyToBytes32(overwriteAccounts[i].key)]
                )
                .substring(2);
            encodeKeys += ethers
                .solidityPacked(["bool"], [overwriteAccounts[i].isSigner])
                .substring(2);
            encodeKeys += ethers
                .solidityPacked(["bool"], [overwriteAccounts[i].isWritable])
                .substring(2);
        } else {
            encodeKeys += ethers
                .solidityPacked(
                    ["bytes32"],
                    [
                        publicKeyToBytes32(
                            instruction.keys[i].pubkey.toString()
                        ),
                    ]
                )
                .substring(2);
            encodeKeys += ethers
                .solidityPacked(["bool"], [instruction.keys[i].isSigner])
                .substring(2);
            encodeKeys += ethers
                .solidityPacked(["bool"], [instruction.keys[i].isWritable])
                .substring(2);
        }
    }

    return (
        "0x" +
        ethers
            .zeroPadBytes(ethers.toBeHex(instruction.keys.length), 8)
            .substring(2) +
        encodeKeys
    );
}

export function prepareInstructionData(instruction) {
    const packedInstructionData = ethers
        .solidityPacked(["bytes"], [instruction.data])
        .substring(2);

    return (
        "0x" +
        ethers
            .zeroPadBytes(ethers.toBeHex(instruction.data.length), 8)
            .substring(2) +
        packedInstructionData
    );
}

export function prepareInstruction(instruction) {
    return (
        publicKeyToBytes32(instruction.programId.toBase58()) +
        prepareInstructionAccounts(instruction).substring(2) +
        prepareInstructionData(instruction).substring(2)
    );
}

export async function execute(
    instruction,
    lamports,
    contractInstance,
    salt,
    msgSender
) {
    if (salt == undefined) {
        salt =
            "0x0000000000000000000000000000000000000000000000000000000000000000";
    }

    console.log("\nExecuting with salt: ", salt)

    const tx = await contractInstance
        .connect(msgSender)
        .execute(lamports, salt, prepareInstruction(instruction)) // , { gasLimit: 100000000 });

    const receipt = await tx.wait(1);
    return [tx, receipt];
}

export async function batchExecute(
    instructions,
    lamports,
    contractInstance,
    salts,
    msgSender
) {
    let setSalts = false;
    if (salts == undefined) {
        setSalts = true;
        salts = [];
    }

    let instructionsDataArr = [];
    for (let i = 0, len = instructions.length; i < len; ++i) {
        instructionsDataArr.push(
            prepareInstruction(instructions[i])
        );

        if (setSalts) {
            salts.push(
                "0x0000000000000000000000000000000000000000000000000000000000000000"

            );
        }
    }

    const tx = await contractInstance
        .connect(msgSender)
        .batchExecute(lamports, salts, instructionsDataArr);
    const receipt = await tx.wait(3);

    return [tx, receipt];
}

export function publicKeyToBytes32(pubkey) {
    return ethers.zeroPadValue(
        ethers.toBeHex(ethers.decodeBase58(pubkey)),
        32
    );
}

