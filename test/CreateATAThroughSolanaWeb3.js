const web3 = require("@solana/web3.js");
const {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const bs58 = require("bs58");
require("dotenv").config();
const { config } = require('./config');

const connection = new web3.Connection(config.SOLANA_NODE, "processed");
if (process.env.ANCHOR_WALLET == undefined) {
    console.error('Please create id.json in the root of the hardhat project with your Solana\'s private key and run the following command in the terminal in order to proceed with the script execution: \n\n export ANCHOR_WALLET=./id.json');
    process.exit();
}
const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);

const defaultTokenMintsArray = [
    config.DATA.SVM.ADDRESSES.devSAMO,
    config.DATA.SVM.ADDRESSES.devUSDC
];
let atasToBeCreated = '';

async function createATA(publicKeys, tokenMintsArray) {
    if (await connection.getBalance(keypair.publicKey) < 100000000) {
        await config.utils.airdropSOL(keypair);
    }

    if (tokenMintsArray == undefined) {
        tokenMintsArray = defaultTokenMintsArray;
    }
    const transaction = new web3.Transaction();

    for (let i = 0, len = publicKeys.length; i < len; ++i) {
        for (let y = 0, leny = tokenMintsArray.length; y < leny; ++y) {
            const associatedToken = getAssociatedTokenAddressSync(
                new web3.PublicKey(tokenMintsArray[y]), 
                publicKeys[i], 
                true, 
                TOKEN_PROGRAM_ID, 
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const ataInfo = await connection.getAccountInfo(associatedToken);

            // create ATA only if it's missing
            if (!ataInfo || !ataInfo.data) {
                atasToBeCreated += tokenMintsArray[y] + ', ';

                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        keypair.publicKey,
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
            connection,
            transaction,
            [keypair]
        );

        console.log('\nTx signature', signature);
        await config.utils.asyncTimeout(5000);
    } else {
        return console.error('\nNo instructions to be performed, all ATA accounts are initialized.');
    }
} 

module.exports = {
    createATA
};