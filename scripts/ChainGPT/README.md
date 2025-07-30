## ChainGPT Demo

### Steps to run the demo script:

1. Clone the repository -

```sh
git clone https://github.com/neonlabsorg/neon-pocs.git
cd neon-pocs
npm install
```

2. Switch to the demo branch -

```sh
gh pr checkout 7
```

3. **Secret values setup -**
   Secret values (such as private keys) used in tests and scripts should be stored using Hardhat's encrypted keystore file.
   This keystore file is specific to this _Hardhat_ project, you can run the following command in the CLI to display the
   keystore file path for this _Hardhat_ project:

```shell
npx hardhat keystore path
```

To store encrypted secret values into this project's Hardhat keystore file, run the following commands in the CLI:

```shell
npx hardhat keystore set PRIVATE_KEY_OWNER
```

```shell
npx hardhat keystore set PRIVATE_KEY_SOLANA
```

You will be asked to choose a password (which will be used to encrypt provided secrets) and to enter the secret values
to be encrypted. The keystore password can be added to the `.env` file (as `KEYSTORE_PASSWORD`) which allows secrets
to be decrypted automatically when running Hardhat tests and scripts. Otherwise, each running Hardhat test and script
will have the CLI prompt a request to enter the keystore password manually.

> [!CAUTION]
> Although it is not recommended (as it involves risks of leaking secrets) it is possible to store plain-text secrets in
> `.env` file using the same keys as listed above. When doing so, user will be asked to confirm wanting to use plain-text
> secrets found in `.env` file when running Hardhat tests and scripts.

4. Run the demo script to deploy the `CheckIn` contract on Neon EVM Devnet with an EVM wallet, sign and send scheduled transaction to the `checkIn` function of the deployed contract using a Phantom wallet.

```sh
npx hardhat run scripts/ChainGPT/ScheduledTransaction.js --network neondevnet
```

5. Once the contract is deployed in the previous step, replace the `CheckInAddress` variable in the script with the deployed contract address to prevent repeated deployment of the contract.

**NOTE:** Faucet for test NEONs to deploy the contract on Neon EVM Devnet - https://neonfaucet.org/
