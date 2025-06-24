// See SDK config template: https://github.com/raydium-io/raydium-sdk-V2-demo/blob/master/src/config.ts.template
import hre from "hardhat"
import web3 from "@solana/web3.js"
import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { clusterApiUrl } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import config from "../config.js"

const solanaConnection = new web3.Connection(config.svm_node[hre.globalOptions.network], "processed")
export const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'devnet' // 'mainnet' | 'devnet'

let raydium
export const initSdk = async (params) => {
    if (raydium) return raydium
    if (solanaConnection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
        console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
    console.log(`connect to rpc ${solanaConnection.rpcEndpoint} in ${cluster}`)

    raydium = await Raydium.load({
        owner: params.owner,
        connection: solanaConnection,
        cluster,
        disableFeatureCheck: true,
        disableLoadToken: !params.loadToken,
        blockhashCommitment: 'finalized',
        // urlConfigs: {
        //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
        // },
    })

    /**
     * By default: sdk will automatically fetch token account data when need it or any sol balance changed.
     * if you want to handle token account by yourself, set token account data after init sdk
     * code below shows how to do it.
     * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
     */

    /*
    raydium.account.updateTokenAccount(await fetchTokenAccountData())
    solanaConnection.onAccountChange(owner.publicKey, async () => {
      raydium!.account.updateTokenAccount(await fetchTokenAccountData())
    })
    */

    return raydium
}

export const fetchTokenAccountData = async () => {
    const solAccountResp = await solanaConnection.getAccountInfo(owner.publicKey)
    const tokenAccountResp = await solanaConnection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID })
    const token2022Req = await solanaConnection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
    const tokenAccountData = parseTokenAccountResp({
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    })
    return tokenAccountData
}
