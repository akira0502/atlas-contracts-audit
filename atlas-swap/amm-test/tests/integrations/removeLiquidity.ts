import { PublicKey, Account, TransactionInstruction, Connection, Commitment, Transaction } from '@solana/web3.js'
import { addTokenAccountInstruction, getPoolByLp, getPoolByTokenPair, removeLiquidity} from '../solanaPool/atlasPool'
import { PoolInfo } from '../solanaPool/interfaces'

export const removeLiquiditytoExistPool = async (
    token0: PublicKey,
    token1: PublicKey,
    amount: number,
    connection: Connection,
    signer: Account
) => {
    const pool: PoolInfo = await getPoolByTokenPair(token0.toString(), token1.toString())
    if (pool === null) {
        return {
        status: 'error',
        message: 'Pool is not exist',
        }
    } else {
        let instructions: TransactionInstruction[] = []
        let cleanupInstructions: TransactionInstruction[] = []
        const signers: Account[] = []
        const lpAccount = await addTokenAccountInstruction(
            connection,
            pool.pubkeys.mint,
            signer.publicKey,
            instructions,
            cleanupInstructions,
            signer.publicKey,
            signers
        );
        await removeLiquidity(
        connection,
        signer.publicKey,
        pool.pubkeys.mint,
        amount,
        lpAccount,
        pool,
        instructions,
        cleanupInstructions,
        signers,
        )

        instructions = instructions.concat(cleanupInstructions)
        const transaction = new Transaction()
        instructions.forEach((item) => {
        transaction.add(item)
        })
        transaction.recentBlockhash = (await connection.getRecentBlockhash('max')).blockhash
        transaction.setSigners(...[signer.publicKey, ...signers.map((item) => {return item.publicKey})])
        transaction.partialSign(...[signer, ...signers])
        const rawTransaction = transaction.serialize()
        let options = {
        skipPreflight: true,
        commitment: 'singleGossip',
        }
        const txid = await connection.sendRawTransaction(rawTransaction, options)
        const status = (await connection.confirmTransaction(txid, options.commitment as Commitment)).value
        if (status.err) throw new Error(`Raw transaction ${txid} failed (${JSON.stringify(status)})`)
    }
}