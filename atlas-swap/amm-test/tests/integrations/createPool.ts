import { PublicKey, Account, TransactionInstruction, Connection, Commitment, SystemProgram, Transaction } from '@solana/web3.js'
import { PROGRAM_ID } from '../solanaPool/ids'
import * as BufferLayout from 'buffer-layout'
import { MintLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { addTokenAccountInstruction, createInitSwapInstruction, createSplMint, createSplTransfer, getTokenAmount, SWAP_SPACE, WRAPPED_SOL_MINT } from '../solanaPool/atlasPool'

export const createPool = async (
    token0: PublicKey,
    token1: PublicKey,
    amount0: number,
    amount1: number,
    curveType: number,
    connection: Connection,
    signer: Account
) => {
    const [global_state_key] = await PublicKey.findProgramAddress(
    [Buffer.from('atlas-swap'), new PublicKey(PROGRAM_ID).toBuffer()],
    new PublicKey(PROGRAM_ID),
    )
    const bufferGloablState = await connection.getAccountInfo(global_state_key)
    if (!bufferGloablState) {
    return {
        status: 'error',
        message: 'Global State is not set yet.',
    }
    }
    const configDataLayout = BufferLayout.struct([
    BufferLayout.u8('is_initialized'),
    BufferLayout.blob(32, 'owner'),
    BufferLayout.blob(32, 'feeOwner'),
    BufferLayout.nu64('initialSupply'),
    BufferLayout.u8('lp_decimals'),
    BufferLayout.nu64('stable_lp_fee_numerator'),
    BufferLayout.nu64('stable_owner_fee_numerator'),
    BufferLayout.nu64('base_lp_fee_numerator'),
    BufferLayout.nu64('base_owner_fee_numerator'),
    BufferLayout.nu64('fee_denominator'),
    ])
    const stateData: any = configDataLayout.decode(Buffer.from(bufferGloablState.data))
    if (!stateData.is_initialized) {
    return {
        status: 'error',
        message: 'Global State is not set yet.',
    }
    }
    const swapAccount = new Account()
    const [authority, bumpSeed] = await PublicKey.findProgramAddress(
        [swapAccount.publicKey.toBuffer()],
        new PublicKey(PROGRAM_ID),
    )
    let instructions1: TransactionInstruction[] = [],
        instructions2: TransactionInstruction[] = []
    let cleanupInstructions: TransactionInstruction[] = []
    const signers1: Account[] = [],
        signers2: Account[] = []
    const rentForTokenMint = await Token.getMinBalanceRentForExemptMint(connection)
    const rentForSwapAccount = await connection.getMinimumBalanceForRentExemption(SWAP_SPACE)
    instructions1.push(
        SystemProgram.createAccount({
        fromPubkey: signer.publicKey,
        newAccountPubkey: swapAccount.publicKey,
        lamports: rentForSwapAccount,
        space: SWAP_SPACE,
        programId: new PublicKey('11111111111111111111111111111111'),
        }),
        SystemProgram.assign({
        accountPubkey: swapAccount.publicKey,
        programId: new PublicKey(PROGRAM_ID),
        }),
    )
    signers1.push(swapAccount)
    const tokenPool = createSplMint(
        instructions1,
        signer.publicKey,
        rentForTokenMint,
        authority,
        MintLayout.span,
        stateData.lp_decimals,
        signers1,
    )
    const tokenAccountPool = await addTokenAccountInstruction(
        connection,
        tokenPool,
        authority,
        instructions1,
        [],
        signer.publicKey,
        signers1,
    )
    const tokenAccountA = await addTokenAccountInstruction(
        connection,
        token0,
        authority,
        instructions1,
        [],
        signer.publicKey,
        signers1,
    )
    const tokenAccountB = await addTokenAccountInstruction(
        connection,
        token1,
        authority,
        instructions1,
        [],
        signer.publicKey,
        signers1,
    )

    const userTokenPoolAccount = await addTokenAccountInstruction(
        connection,
        tokenPool,
        signer.publicKey,
        instructions2,
        [],
        signer.publicKey,
        signers2,
    )

    const userTokenAccountA = await addTokenAccountInstruction(
        connection,
        token0,
        signer.publicKey,
        instructions2,
        cleanupInstructions,
        signer.publicKey,
        signers2,
        token0.toString() == WRAPPED_SOL_MINT.toString() ? amount0 : 0,
    )

    const userTokenAccountB = await addTokenAccountInstruction(
        connection,
        token1,
        signer.publicKey,
        instructions2,
        cleanupInstructions,
        signer.publicKey,
        signers2,
        token1.toString() == WRAPPED_SOL_MINT.toString() ? amount1 : 0,
    )
    createSplTransfer(
        instructions2,
        signer.publicKey,
        userTokenAccountA,
        tokenAccountA,
        amount0,
    )

    createSplTransfer(
        instructions2,
        signer.publicKey,
        userTokenAccountB,
        tokenAccountB,
        amount1,
    )
    instructions2.push(
        createInitSwapInstruction(
        global_state_key,
        swapAccount,
        authority,
        tokenAccountA,
        tokenAccountB,
        tokenPool,
        userTokenPoolAccount,
        TOKEN_PROGRAM_ID,
        new PublicKey(PROGRAM_ID),
        curveType, //0: stable curve, 2: constant product curve
        ),
    )
    const transaction1 = new Transaction()
    instructions1.forEach((item) => {
        transaction1.add(item)
    })
    instructions2.concat(cleanupInstructions)
    const transaction2 = new Transaction()
    instructions2.forEach((item) => {
        transaction2.add(item)
    })

    transaction1.recentBlockhash = (await connection.getRecentBlockhash('max')).blockhash
    transaction1.setSigners(...[signer.publicKey, ...signers1.map((item) => {return item.publicKey})])
    transaction1.partialSign(...[signer, ...signers1])
    const rawTransaction = transaction1.serialize()
    let options = {
    skipPreflight: true,
    commitment: 'singleGossip',
    }
    const txid1 = await connection.sendRawTransaction(rawTransaction, options)
    const status1 = (await connection.confirmTransaction(txid1, options.commitment as Commitment)).value
    if (status1.err) throw new Error(`Raw transaction ${txid1} failed (${JSON.stringify(status1)})`)

    transaction2.recentBlockhash = (await connection.getRecentBlockhash('max')).blockhash
    transaction2.setSigners(...[signer.publicKey, ...signers2.map((item) => {return item.publicKey})])
    transaction2.partialSign(...[signer, ...signers2])
    const rawTransaction2 = transaction2.serialize()
    const txid2 = await connection.sendRawTransaction(rawTransaction2, options)
    const status2 = (await connection.confirmTransaction(txid2, options.commitment as Commitment)).value
    if (status2.err) throw new Error(`Raw transaction ${txid2} failed (${JSON.stringify(status2)})`)
    return {
        status: 'ok',
        data: {
            poolAddr: swapAccount,
            lpMint: tokenPool,
            authority: authority
        }
    }
}