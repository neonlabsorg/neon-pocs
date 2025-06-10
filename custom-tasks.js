import { task, overrideTask } from "hardhat/config"
import { deriveMasterKeyFromKeystore } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/keystores/encryption.ts"
import { askPassword } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/keystores/password.ts"
import { set } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/tasks/set.ts"
import { get } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/tasks/get.ts"
import { list } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/tasks/list.ts"
import { remove } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/tasks/delete.ts"
import { UserDisplayMessages } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/ui/user-display-messages.ts"
import { setupKeystoreLoaderFrom } from "./node_modules/@nomicfoundation/hardhat-keystore/src/internal/utils/setup-keystore-loader-from.ts"
import pkg from './package.json';

// We define a custom project-specific file path for the encrypted keystore
export const customKeystoreFilePath = (hre) => {
    return {
        keystore: {
            filePath: hre.config.keystore.filePath.split('keystore.json')[0] + `${pkg.name}-keystore.json`
        }
    }
}

// Custom subtask overriding the built-in keystore:set subtask to use our custom keystore file path instead of the
// default one
export const setSecretTask = overrideTask(["keystore", "set"])
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
        await set(
            args,
            keystoreLoader,
            hre.interruptions.requestSecretInput.bind(hre.interruptions),
        );
    })
    .build()

// Custom subtask overriding the built-in keystore:get subtask to use our custom keystore file path instead of the
// default one
export const getSecretTask = overrideTask(["keystore", "get"])
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
        await get(
            args,
            keystoreLoader,
            hre.interruptions.requestSecretInput.bind(hre.interruptions),
        );
    })
    .build()

// Custom subtask overriding the built-in keystore:list subtask to use our custom keystore file path instead of the
// default one
export const listSecretsTask = overrideTask(["keystore", "list"])
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
        await list(keystoreLoader);
    })
    .build()

// Custom subtask overriding the built-in keystore:delete subtask to use our custom keystore file path instead of the
// default one
export const deleteSecretTask = overrideTask(["keystore", "delete"])
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })

        await remove(
            args,
            keystoreLoader,
            hre.interruptions.requestSecretInput.bind(hre.interruptions),
        );
    })
    .build()

// Custom subtask to the built-in keystore task to check if a secret is set in the keystore
export const isSecretSetTask = task(["keystore", "contains"], "Checks if a secret is set in the keystore")
    .addPositionalArgument({
        name: "key",
        type: "STRING",
        description: "Specifies the key that we are looking for in the keystore file"
    })
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
        const keystore = await keystoreLoader.loadKeystore();
        const keys = await keystore.listUnverifiedKeys()
        let secretIsSet = false;
        keys.forEach((key) => {
            if(key === args.key) {
                secretIsSet = true
            }
        })
        return secretIsSet
    })
    .build()

// Custom subtask to the built-in keystore task to display the keystore file path in the CLI
export const displayKeystoreFilePathTask = task(["keystore", "path"], "Displays the keystore file path in the CLI")
    .setAction(async (args, hre) => {
        const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
        if (!(await keystoreLoader.isKeystoreInitialized())) {
            console.log(UserDisplayMessages.displayNoKeystoreSetErrorMessage());
            process.exitCode = 1;
        }
        console.log(`Custom Hardhat keystore file path for ${pkg.name} project:`, customKeystoreFilePath(hre).keystore.filePath)
    })
    .build()

// Custom subtask to the built-in keystore task to ask for the keystore password in the CLI while running mocha tests
export const askPasswordTask = task(["keystore", "askpwd"], "Asks for the keystore password in the CLI")
    .setAction(async (args, hre) => {
        return await askPassword(hre.interruptions.requestSecretInput.bind(hre.interruptions))
    })
    .build()

// Custom subtask to the built-in keystore task to decrypt keystore secrets while running mocha tests
export const decryptSecretTask = task(["keystore", "decrypt"], "Decrypts a secret value given a key and a password")
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
    const keystoreLoader = setupKeystoreLoaderFrom({ config: customKeystoreFilePath(hre) })
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