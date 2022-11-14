import { PublicKey, Account, TransactionInstruction, Connection, Commitment, SystemProgram, Transaction } from '@solana/web3.js'
import { PROGRAM_ID } from '../solanaPool/ids'
import * as BufferLayout from 'buffer-layout'
import { MintLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { addLiquidity, addTokenAccountInstruction, createInitSwapInstruction, createSplMint, createSplTransfer, getPoolByTokenPair, SWAP_SPACE, WRAPPED_SOL_MINT } from '../solanaPool/atlasPool'
import { PoolInfo } from '../solanaPool/interfaces'

export const addLiquiditytoExistPool = async (
    token0: PublicKey,
    token1: PublicKey,
    amount0: number,
    amount1: number,
    connection: Connection,
    signer: Account
) => {
    const pool: PoolInfo = await getPoolByTokenPair(token0.toString(), token1.toString())
    if (pool == null) {
        return {
        status: 'error',
        message: 'Pool is not exist',
        }
    } else {
        let instructions: TransactionInstruction[] = []
        let cleanupInstructions: TransactionInstruction[] = []
        const signers: Account[] = []
        const rentForTokenAccount = await Token.getMinBalanceRentForExemptAccount(connection)

        const userTokenAccountA = await addTokenAccountInstruction(
        connection,
        token0,
        signer.publicKey,
        instructions,
        cleanupInstructions,
        signer.publicKey,
        signers,
        token0.toString() == WRAPPED_SOL_MINT.toString() ? amount0 : 0,
        )

        const userTokenAccountB = await addTokenAccountInstruction(
        connection,
        token1,
        signer.publicKey,
        instructions,
        cleanupInstructions,
        signer.publicKey,
        signers,
        token1.toString() == WRAPPED_SOL_MINT.toString() ? amount1 : 0,
        )
        const components = [
        {
            account: userTokenAccountA,
            mintAddress: token0.toString(),
            amount: amount0,
        },
        {
            account: userTokenAccountB,
            mintAddress: token1.toString(),
            amount: amount1,
        },
        ]


        const toAccount = await addTokenAccountInstruction(
            connection,
            pool.pubkeys.mint,
            signer.publicKey,
            instructions,
            cleanupInstructions,
            signer.publicKey,
            signers
        )

        await addLiquidity(pool, toAccount, components, signer, instructions, signers)
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