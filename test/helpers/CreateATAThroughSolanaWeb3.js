import web3 from "@solana/web3.js"
import {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token"
import config from "../config"
import "dotenv/config"

const connection = new web3.Connection(config.SOLANA_NODE, "processed");

const defaultTokenMintsArray = [
    config.DATA.SVM.ADDRESSES.devSAMO,
    config.DATA.SVM.ADDRESSES.devUSDC
];
let atasToBeCreated = '';

async function createATA(solanaUser, publicKeys, tokenMintsArray, connectionParam) {
    if (connectionParam == undefined) {
        connectionParam = connection;
    }

    if (await connectionParam.getBalance(solanaUser.publicKey) < 100000000) {
        await config.utils.airdropSOL(solanaUser);
    }

    if (tokenMintsArray == undefined) {
        tokenMintsArray = defaultTokenMintsArray;
    }
    const transaction = new web3.Transaction();
    console.log(tokenMintsArray, 'tokenMintsArray');

    for (let i = 0, len = publicKeys.length; i < len; ++i) {
        for (let y = 0, leny = tokenMintsArray.length; y < leny; ++y) {
            const associatedToken = getAssociatedTokenAddressSync(
                new web3.PublicKey(tokenMintsArray[y]), 
                publicKeys[i], 
                true, 
                TOKEN_PROGRAM_ID, 
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const ataInfo = await connectionParam.getAccountInfo(associatedToken);

            // create ATA only if it's missing
            if (!ataInfo || !ataInfo.data) {
                atasToBeCreated += tokenMintsArray[y] + ', ';

                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        solanaUser.publicKey,
                        associatedToken,
                        publicKeys[i],
                        new web3.PublicKey(tokenMintsArray[y]), 
                        TOKEN_PROGRAM_ID, 
                        ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            } else {
                const ATA = await getAssociatedTokenAddress(
                    new web3.PublicKey(tokenMintsArray[y]), 
                    new web3.PublicKey(publicKeys[i]),
                    true
                );
            }
        }
    }

    if (transaction.instructions.length) {
        console.log('\nCreating ATA accounts for the following SPLTokens - ', atasToBeCreated.substring(0, atasToBeCreated.length - 2));
        const signature = await web3.sendAndConfirmTransaction(
            connectionParam,
            transaction,
            [solanaUser]
        );

        console.log('\nTx signature', signature);
        await config.utils.asyncTimeout(5000);
    } else {
        return console.error('\nNo instructions to be performed, all ATA accounts are initialized.');
    }
} 

export default createATA