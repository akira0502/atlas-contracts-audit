import { Account, Commitment, Connection, PublicKey, Signer, Transaction, TransactionInstruction } from '@solana/web3.js'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'
import { setGlobalStateInstruction } from '../solanaPool/atlasPool'
import { PROGRAM_ID, NET_ID } from '..//solanaPool/ids'
export const setGlobalState = async () => {
    const [global_state_key] = await PublicKey.findProgramAddress(
        [Buffer.from('atlas-swap'), new PublicKey(PROGRAM_ID).toBuffer()],
        new PublicKey(PROGRAM_ID),
      )
      let connection = new Connection('https://solana-api.projectserum.com')
      if (NET_ID === 'devnet') connection = new Connection('https://api.devnet.solana.com')
      const owner = new PublicKey('FABSYVqYSKogNUSRK6xBC3wRCTX6Gba9jMcHvLuEqC3G')
      const fee_owner = new PublicKey('FABSYVqYSKogNUSRK6xBC3wRCTX6Gba9jMcHvLuEqC3G')
      const initial_supply = 100000
      const lp_decimals = 2
      const instruction: TransactionInstruction = setGlobalStateInstruction(
        global_state_key,
        new PublicKey(PROGRAM_ID),
        owner,
        fee_owner,
        initial_supply,
        lp_decimals,
        0,
        0,
        0,
        0,
        10000,
      )
      const transaction: Transaction = new Transaction()
      transaction.add(instruction)
      let signer = new Account(
        bs58.decode('5LCSYZqYGHNzVgBzS99CpBP8471bDPgKXPhDWXk3UFVeteeYoYJ2odKEh5EHAeavcyicbku3eXXJ25Rtz1RTmz1U'),
      )
      transaction.recentBlockhash = (await connection.getRecentBlockhash('max')).blockhash
      transaction.setSigners(signer.publicKey)
      transaction.partialSign(...[signer])
      const rawTransaction = transaction.serialize()
      let options = {
        skipPreflight: true,
        commitment: 'singleGossip',
      }
      const txid = await connection.sendRawTransaction(rawTransaction, options)
      const status = (await connection.confirmTransaction(txid, options.commitment as Commitment)).value
      if (status.err) throw new Error(`Raw transaction ${txid} failed (${JSON.stringify(status)})`)
}