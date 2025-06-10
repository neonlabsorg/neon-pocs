import hre from "hardhat"
import web3 from "@solana/web3.js"
import bs58 from "bs58"
import fs from "fs"
import { customKeystoreFilePath } from "./custom-tasks.js"
import "dotenv/config"

// Secret variables' keys
const keystorePasswordKey = "KEYSTORE_PASSWORD"
const secretsKeys = [
    "PRIVATE_KEY_OWNER",
    "PRIVATE_KEY_SOLANA"
]

export async function getSecrets() {
    const ethers = (await hre.network.connect()).ethers
    let usingPlainTextSecrets = false
    // We first check is some secret keys are present in .env file
    const envFileSecretKeys = []
    secretsKeys.forEach((key) => {
        if(process.env[key]) {
            envFileSecretKeys.push(key)
        }
    })
    if(envFileSecretKeys.length) {
        // Prompt warning message asking user to confirm wanting to use plain text secrets in .env file
        usingPlainTextSecrets = await promptPlainTextSecretsWarning(envFileSecretKeys)
        if(!usingPlainTextSecrets) {
            // If user did not confirm using plain text secrets in .env file
            throw new Error("Please remove plain text secrets from .env file before running Hardhat tests and scripts")
        }
    }
    try {
        const secrets = await asyncForLoop(
            secretsKeys,
            async function(secretsKeys, index, secrets) {
                const secretName = getSecretName(secretsKeys[index])
                if(process.env[secretsKeys[index]]) { // If secret is found in .env file
                    if(usingPlainTextSecrets) {
                        // If user confirmed using plain text secrets in .env file
                        console.log("\n\u{26A0} \x1b[33mReading secret " + secretsKeys[index] + " from \x1b[36m.env" +
                            "\x1b[33m file\x1b[0m\n")
                        if(secretsKeys[index].split("PRIVATE_KEY").length > 1) {
                            try {
                                if(secretsKeys[index].split("SOLANA").length > 1) {  // SVM private key
                                    secrets.wallets[secretName] = web3.Keypair.fromSecretKey(bs58.decode(
                                        process.env[secretsKeys[index]]
                                    ))
                                    console.log("   Solana u" + secretName.split("solanaU")[1] + " address:",
                                        secrets.wallets[secretName].publicKey.toBase58()
                                    )
                                } else { // EVM private key
                                    secrets.wallets[secretName] = new ethers.Wallet(
                                        process.env[secretsKeys[index]],
                                        ethers.provider
                                    )
                                    console.log("   NeonEVM " + secretName + " address:", secrets.wallets[secretName].address)
                                }

                                return secrets
                            } catch(error) {
                                console.error("\n\u{26A0} \x1b[33mError: failed to load private key " + secretsKeys[index] +
                                    " from .env file. Will try to decrypt secret from Hardhat's encrypted keystore " +
                                    "instead.\x1b[0m\n")
                                return await decryptSecret(ethers, secrets, secretsKeys[index], true)
                            }
                        } else {
                            // Not implemented: case where secret is not a private key
                        }
                    } else {
                        // If user did not confirm using plain text secrets in .env file
                        throw new Error("User denied using plain text secrets from .env file")
                    }
                } else {
                    // If secret was not found in .env file
                    if(!usingPlainTextSecrets) {
                        // If user has not confirmed wanting to use plain text secrets in .env file (because, in this
                        // case, no secret was found yet in .env file so user has not been asked to confirm wanting to
                        // use plain-text secrets)
                        if(index === 0) {
                            console.log("\n ", "\u{1F512} \x1b[36mDecrypting keystore secrets...\x1b[0m\n")
                        }
                        // Try getting secret from encrypted keystore
                        secrets = await decryptSecret(ethers, secrets, secretsKeys[index], false)
                        if(index === secretsKeys.length - 1) {
                            console.log("\n ", "\u{1F513} \x1b[36mSuccessfully decrypted keystore secrets!\x1b[0m\n")
                        }
                        return  secrets
                    } else {
                        // If user did already confirm wanting to use plain text secrets and some secret is not found in
                        // .env file
                        console.log("\n\u{26A0} \x1b[33mDecrypting secret " + secretsKeys[index] + " from \x1b[36m" +
                            "Hardhat's encrypted keystore\x1b[0m\n")
                        try {
                            return await decryptSecret(ethers, secrets, secretsKeys[index], true)
                        } catch(error) {
                            console.error("\n\u{26A0} \x1b[33mError: Failed to decrypt secret " + secretsKeys[index] +
                                " from Hardhat's encrypted keystore.\x1b[0m\n")
                            throw error
                        }
                    }
                }
            },
            0,
            { wallets: {}, keystorePassword: "" }
        )
        delete secrets.keystorePassword
        return secrets
    } catch(error) {
        if (error.message === "User denied using plain text secrets from .env file") {
            // If user denied using plain text secrets from .env file
            console.log("\x1b[33m Please remove plain-text secrets from \x1b[36m.env\x1b[33m file and store them using " +
                "Hardhat's encrypted keystore instead using the following CLI command:\n")
            console.log("\x1b[32m   npx hardhat keystore set < SECRET_KEY >\x1b[0m\n")
            throw(error)
        } else if(error.message.split("invalid private key").length > 1) {
            console.error(error)
        } else {
            // If there was another error using some secret found in .env file
            console.error(error)
            // Try getting secrets from encrypted keystore
            return await decryptSecrets(ethers)
        }
    }
}

export async function decryptSecret(ethers, secrets, secretKey, logs = true) {
    // First check if keystore file has been created
    await checkKeystoreExists()
    // Then check if provided secretKey is registered in keystore file
    await checkKeystoreSecretIsSet(secretKey)
    
    if(logs) {
        console.log("\n ", "\u{1F512} \x1b[36mDecrypting keystore secret " + secretKey + "\x1b[0m\n")
    }

    if(!secrets.keystorePassword) {
        if(process.env[keystorePasswordKey]) { // Keystore password can be stored in .env file
            secrets.keystorePassword = process.env[keystorePasswordKey]
        } else { // If not, ask for password in CLI
            secrets.keystorePassword = await hre.tasks.getTask("keystore").subtasks.get("askpwd").run()
        }
    }

    const secretName = getSecretName(secretKey)

    if(secretKey.split("PRIVATE_KEY").length > 1) {
        try {
            if(secretKey.split("SOLANA").length > 1) {  // SVM private key
                secrets.wallets[secretName] = web3.Keypair.fromSecretKey(bs58.decode(
                    await hre.tasks.getTask("keystore").subtasks.get("decrypt").run(
                        {
                            key: secretKey,
                            password: secrets.keystorePassword
                        }
                    )
                ))
                console.log("   Solana u" + secretName.split("solanaU")[1] + " address:",
                    secrets.wallets[secretName].publicKey.toBase58()
                )
            } else { // EVM private key
                secrets.wallets[secretName] = new ethers.Wallet(
                    await hre.tasks.getTask("keystore").subtasks.get("decrypt").run(
                        {
                            key: secretKey,
                            password: secrets.keystorePassword
                        }
                    ),
                    ethers.provider
                )
                console.log("   NeonEVM " + secretName + " address:", secrets.wallets[secretName].address)
            }
            if(logs) {
                console.log("\n ", "\u{1F513} \x1b[36mSuccessfully decrypted keystore secret!\x1b[0m\n")
            }
            return secrets
        } catch(error) {
            console.error("\n\u{26A0} \x1b[33mError: failed to decrypt and load private key " + secretKey +
                " from Hardhat's encrypted keystore.\x1b[0m\n")
            throw error
        }
    } else {
        // Not implemented: case where secret is not a private key
    }
}

async function decryptSecrets(ethers) {
    // First check if keystore file has been created
    await checkKeystoreExists()

    console.log("\n ", "\u{1F512} \x1b[36mDecrypting keystore secrets...\x1b[0m\n")

    const secrets = await asyncForLoop(
        secretsKeys,
        async function(secretsKeys, index, secrets) {
            return await decryptSecret(ethers, secrets, secretsKeys[index], false)
        },
        0,
        { wallets: {}, keystorePassword: "" }
    )

    console.log("\n ", "\u{1F513} \x1b[36mSuccessfully decrypted keystore secrets!\x1b[0m\n")
    delete secrets.keystorePassword
    return secrets
}

async function promptPlainTextSecretsWarning(envFileSecretKeys) {
    let warningMessage = "\x1b[33mThe following plain-text secrets have been found in \x1b[36m.env\x1b[33m " +
        "file: "
    for(let i = 0; i < envFileSecretKeys.length; i++) {
        if (i < envFileSecretKeys.length - 1) {
            warningMessage += envFileSecretKeys[i] + ", "
        } else {
            warningMessage += envFileSecretKeys[i] + "."
        }
    }
    warningMessage += "\n\n\x1b[33mStoring secrets in .env file involves the risk of leaking secret values. It is recommended " +
        "to store secrets using Hardhat's encrypted keystore instead.\n\nWould you like to continue using " +
        "plain-text secrets found in \x1b[36m.env\x1b[33m file?\x1b[34m"
    console.log("\n") // Line break
    const input = await hre.interruptions.requestInput(warningMessage, "y/n");
    console.log("\x1b[0m") // Reset text color
    return input === "y" || input === "Y"
}

function getSecretName(secretKey) {
    let secretName;
    if(secretKey.split("PRIVATE_KEY").length > 1) {
        if (secretKey.split("SOLANA").length > 1) {  // SVM private key
            if (secretKey.split("_").length > 3) {
                secretName = "solanaUser" + secretKey.split("_")[3]
            } else {
                secretName = "solanaUser1"
            }
        } else { // EVM private key
            if (secretKey.split("_")[2] === "OWNER") {
                secretName = "owner"
            } else if (secretKey.split("_")[2] === "USER") {
                secretName = "user" + secretKey.split("_")[3]
            }
        }
    } else {
        // Not implemented: case where secret is not a private key
    }

    return secretName
}

async function checkKeystoreExists() {
    if(!fs.existsSync(customKeystoreFilePath(hre).keystore.filePath)) {
        throw(new Error("\n\u{26A0} \x1b[33mNo keystore file found for project. Please set one up using \x1b[36mnpx hardhat keystore set {key}\x1b[0m"))
    }
}

async function checkKeystoreSecretIsSet(secretKey) {
    if(!(await hre.tasks.getTask("keystore").subtasks.get("contains").run({ key: secretKey }))) {
        throw(new Error("\n\u{26A0}  \x1b[36m" + secretKey + "\x1b[33m key not found in project's keystore file. Please set it up using \x1b[36mnpx hardhat keystore set " + secretKey + "\x1b[0m"))
    }
}

function asyncForLoop(iterable, asyncCallback, index, result) {
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