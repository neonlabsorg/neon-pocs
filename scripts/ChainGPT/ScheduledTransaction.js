import {
  NeonProxyRpcApi,
  createBalanceAccountInstruction,
  solanaAirdrop,
  delay,
} from "@neonevm/solana-sign";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getSecrets } from "../../neon-secrets.js";
import "dotenv/config";
import { network } from "hardhat";

let ethers;
let owner;
let CheckInAddress = ""; // Replace this with the deployed contract address after running the script for the 1st time
let CheckIn;

async function main() {
  const { wallets } = await getSecrets();
  owner = wallets.owner;
  console.log("User wallet:", owner);
  const solanaUserKeypair = wallets.solanaUser1;
  console.log("Solana wallet:", solanaUserKeypair);
  ethers = (await network.connect()).ethers;

  const CheckInFactory = await ethers.getContractFactory(
    "contracts/ChainGPT/CheckIn.sol:CheckIn",
    owner
  );

  if (ethers.isAddress(CheckInAddress)) {
    console.log(
      "CheckIn used at",
      "\x1b[32m",
      CheckInAddress,
      "\x1b[30m",
      "\n"
    );
    CheckIn = CheckInFactory.attach(CheckInAddress);
  } else {
    CheckIn = await ethers.deployContract(
      "contracts/ChainGPT/CheckIn.sol:CheckIn",
      owner
    );
    await CheckIn.waitForDeployment();
    CheckInAddress = CheckIn.target;
    console.log(
      "CheckIn deployed at",
      "\x1b[32m",
      CheckIn.target,
      "\x1b[30m",
      "\n"
    );
  }

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const proxyApi = new NeonProxyRpcApi("https://devnet.neonevm.org/sol");

  /*const solanaPrivateKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(solanaPrivateKey);*/
  const { chainId, solanaUser, provider, programAddress, tokenMintAddress } =
    await proxyApi.init(solanaUserKeypair);
  await solanaAirdrop(connection, solanaUser.publicKey, 1e9);

  console.log("\nNeon wallet address:", solanaUser.neonWallet);
  const nonce = Number(
    await proxyApi.getTransactionCount(solanaUser.neonWallet)
  );
  console.log("\nCurrent nonce:", nonce);

  const abi = CheckInFactory.interface.format("json");
  const iface = new ethers.Interface(abi);
  const calldata = iface.encodeFunctionData("checkIn", []);

  const transactionData = {
    from: solanaUser.neonWallet,
    to: CheckInAddress,
    data: calldata,
  };

  const transactionGas = await proxyApi.estimateScheduledTransactionGas({
    solanaPayer: solanaUser.publicKey,
    transactions: [transactionData],
  });
  console.log("\nTransaction Gas:", transactionGas);

  const { scheduledTransaction } = await proxyApi.createScheduledTransaction({
    transactionGas,
    transactionData,
    nonce,
  });

  // Creates a balance program account for the Neon wallet if doesn't exist
  const account = await connection.getAccountInfo(solanaUser.balanceAddress);

  if (account === null) {
    const { neonEvmProgram, publicKey, neonWallet, chainId } = solanaUser;
    scheduledTransaction.instructions.unshift(
      createBalanceAccountInstruction(
        neonEvmProgram,
        publicKey,
        neonWallet,
        chainId
      )
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  scheduledTransaction.recentBlockhash = blockhash;
  scheduledTransaction.sign({
    publicKey: solanaUser.publicKey,
    secretKey: solanaUser.keypair.secretKey,
  });
  const signature = await connection.sendRawTransaction(
    scheduledTransaction.serialize()
  );
  console.log("\nTransaction signature", signature);

  // Gets the transaction execution tree and logs out the successful transactions
  let transactions = [];
  let attempts = 0;

  while (true) {
    transactions = await proxyApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      7000 // wait 7 seconds max per poll
    );

    const allSuccessful =
      transactions.length > 0 &&
      transactions.every(
        ({ status }) => status === "Success" || status === "Failed"
      );

    if (allSuccessful) {
      console.log("\n✅ All transactions succeeded:", transactions);
      break;
    }

    attempts++;
    console.log(
      `⏳ Attempt ${attempts}: Not all successful yet. Retrying in 2s...`
    );
    await delay(2000);
  }

  // Gets the transaction receipts of the transactions
  for (const { transactionHash, status } of transactions) {
    let result = null;
    let attempts = 0;

    while (result === null) {
      const res = await proxyApi.getTransactionReceipt(transactionHash);
      result = res?.result ?? null;

      if (result !== null) {
        console.log(`\n✅ Tx ${transactionHash}, Status: ${status}`);
        console.log("📄 Transaction receipt:", result);
        break;
      }

      attempts++;
      console.log(
        `⏳ Tx ${transactionHash} receipt not ready. Attempt ${attempts}. Retrying in 2s...`
      );
      await delay(2000);
    }
  }

  const totalNumberOfCheckIns = await CheckIn.getTotalCheckIns(
    solanaUser.neonWallet
  );

  console.log(`\nTotal check ins by the user wallet ${solanaUser.neonWallet}:`);

  for (let i = 0; i < Number(totalNumberOfCheckIns); i++) {
    const timestampStr = await CheckIn.checkIns(solanaUser.neonWallet, i);
    const timestamp = parseInt(timestampStr, 10); // convert to number
    const date = new Date(timestamp * 1000); // JS Date expects milliseconds
    const time = date.toUTCString();
    console.log(`${i + 1}. Check In by ${solanaUser.neonWallet} = ${time}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
