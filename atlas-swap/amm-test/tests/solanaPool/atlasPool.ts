import { PublicKey, Account, TransactionInstruction, Connection, Keypair, Commitment } from '@solana/web3.js'
import * as BufferLayout from 'buffer-layout'
import { PoolInfo, LiquidityComponent, TokenAccount } from './interfaces'
import { AccountLayout, Token, u64 } from '@solana/spl-token'
import { SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { PROGRAM_ID, NET_ID } from './ids'
import { cache, getCachedAccount } from './accounts'

export const WRAPPED_SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
export const SWAP_SPACE = 228
export const commitment: Commitment = 'confirmed'
let TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
let connection = new Connection('https://solana-api.projectserum.com')
if (NET_ID === 'devnet') connection = new Connection('https://api.devnet.solana.com')

export const setGlobalStateInstruction = (
  state_key: PublicKey,
  swapProgramId: PublicKey,
  owner: PublicKey,
  fee_owner: PublicKey,
  initial_supply: number,
  lp_decimals: number,
  fee_stable_lp: number,
  fee_stable_owner: number,
  fee_base_lp: number,
  fee_base_owner: number,
  fee_deno: number,
): TransactionInstruction => {
  const keys = [
    { pubkey: state_key, isSigner: false, isWritable: true }, // state info needs to be added
    { pubkey: owner, isSigner: false, isWritable: false }, // current info
    { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system info
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: true }, // rent info
  ]

  const configDataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.blob(32, 'owner'),
    BufferLayout.blob(32, 'fee_owner'),
    BufferLayout.nu64('initial_supply'),
    BufferLayout.u8('lp_decimals'),
    BufferLayout.nu64('constant_product_return_fee_numerator'),
    BufferLayout.nu64('constant_product_fixed_fee_numerator'),
    BufferLayout.nu64('stable_return_fee_numerator'),
    BufferLayout.nu64('stable_fixed_fee_numerator'),
    BufferLayout.nu64('fee_denominator'),
  ])

  let data = Buffer.alloc(1024)
  {
    const encodeLength = configDataLayout.encode(
      {
        instruction: 4,
        owner: owner.toBuffer(),
        fee_owner: fee_owner.toBuffer(),
        initial_supply: initial_supply,
        lp_decimals: lp_decimals,
        constant_product_return_fee_numerator: fee_stable_lp,
        constant_product_fixed_fee_numerator: fee_stable_owner,
        stable_return_fee_numerator: fee_base_lp,
        stable_fixed_fee_numerator: fee_base_owner,
        fee_denominator: fee_deno,
      },
      data,
    )
    data = data.slice(0, encodeLength)
  }
  return new TransactionInstruction({ keys, programId: swapProgramId, data })
}

export const createInitSwapInstruction = (
  global_state_key: PublicKey,
  tokenSwapAccount: Account,
  authority: PublicKey,
  tokenAccountA: PublicKey,
  tokenAccountB: PublicKey,
  tokenPool: PublicKey,
  tokenAccountPool: PublicKey,
  tokenProgramId: PublicKey,
  swapProgramId: PublicKey,
  curveType: number,
): TransactionInstruction => {
  const keys = [
    { pubkey: tokenSwapAccount.publicKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: true },
    { pubkey: global_state_key, isSigner: false, isWritable: false },
    { pubkey: tokenAccountA, isSigner: false, isWritable: true },
    { pubkey: tokenAccountB, isSigner: false, isWritable: true },
    { pubkey: tokenPool, isSigner: false, isWritable: true },
    { pubkey: tokenAccountPool, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: true }, // rent info
  ]

  const commandDataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.u8('curveType'),
    BufferLayout.blob(32, 'curveParameters'),
  ])
  let data = Buffer.alloc(1024)
  {
    const encodeLength = commandDataLayout.encode(
      {
        instruction: 0,
        curveType: curveType,
      },
      data,
    )
    data = data.slice(0, encodeLength)
  }
  return new TransactionInstruction({ keys, programId: swapProgramId, data })
}

export const depositInstruction = (
  global_state_key: PublicKey,
  tokenSwap: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  sourceA: PublicKey,
  sourceB: PublicKey,
  intoA: PublicKey,
  intoB: PublicKey,
  poolToken: PublicKey,
  poolAccount: PublicKey,
  swapProgramId: PublicKey,
  tokenProgramId: PublicKey,
  maximumTokenA: number | u64,
  maximumTokenB: number | u64,
  poolAmount: number | u64,
): TransactionInstruction => {
  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.nu64('poolTokenAmount'),
    BufferLayout.nu64('maximumTokenA'),
    BufferLayout.nu64('maximumTokenB'),
  ])
  console.log(maximumTokenA, maximumTokenB, poolAmount)
  const data = Buffer.alloc(dataLayout.span)
  dataLayout.encode(
    {
      instruction: 2, // Deposit instruction
      poolTokenAmount: poolAmount,
      maximumTokenA: maximumTokenA,
      maximumTokenB: maximumTokenB,
    },
    data,
  )

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: global_state_key, isSigner: false, isWritable: false }, // state info needs to be added
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: sourceA, isSigner: false, isWritable: true },
    { pubkey: sourceB, isSigner: false, isWritable: true },
    { pubkey: intoA, isSigner: false, isWritable: true },
    { pubkey: intoB, isSigner: false, isWritable: true },
    { pubkey: poolToken, isSigner: false, isWritable: true },
    { pubkey: poolAccount, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
  ]
  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  })
}

export const withdrawInstruction = (
  global_state_key: PublicKey,
  tokenSwap: PublicKey,
  authority: PublicKey,
  poolMint: PublicKey,
  sourcePoolAccount: PublicKey,
  fromA: PublicKey,
  fromB: PublicKey,
  userAccountA: PublicKey,
  userAccountB: PublicKey,
  swapProgramId: PublicKey,
  tokenProgramId: PublicKey,
  poolTokenAmount: number | u64,
  minimumTokenA: number | u64,
  minimumTokenB: number | u64,
): TransactionInstruction => {
  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.nu64('poolTokenAmount'),
    BufferLayout.nu64('minimumTokenA'),
    BufferLayout.nu64('minimumTokenB'),
  ])

  const data = Buffer.alloc(dataLayout.span)
  dataLayout.encode(
    {
      instruction: 3, // Withdraw instruction
      poolTokenAmount: poolTokenAmount,
      minimumTokenA: minimumTokenA,
      minimumTokenB: minimumTokenB,
    },
    data,
  )

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: global_state_key, isSigner: false, isWritable: false }, // state info needs to be added
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: poolMint, isSigner: false, isWritable: true },
    { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
    { pubkey: fromA, isSigner: false, isWritable: true },
    { pubkey: fromB, isSigner: false, isWritable: true },
    { pubkey: userAccountA, isSigner: false, isWritable: true },
    { pubkey: userAccountB, isSigner: false, isWritable: true },
    { pubkey: tokenProgramId, isSigner: false, isWritable: true },
  ]

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  })
}

export async function addLiquidity(
  pool: PoolInfo,
  toAccount: PublicKey,
  components: LiquidityComponent[],
  wallet: any,
  instructions: TransactionInstruction[] = [],
  signers: Account[] = [],
) {
  const poolMint = await cache.getMint(pool.pubkeys.mint)
  if (!poolMint.mintAuthority) {
    throw new Error('Mint doesnt have authority')
  }

  const accountA = await cache.getAccount(pool.pubkeys.holdingAccounts[0])
  const accountB = await cache.getAccount(pool.pubkeys.holdingAccounts[1])

  const fromA = accountA.info.mint.toBase58() === components[0].mintAddress ? components[0] : components[1]
  const fromB = fromA === components[0] ? components[1] : components[0]

  if (!fromA.account || !fromB.account) {
    throw new Error('Missing account info.')
  }

  const supply = poolMint.supply.toNumber()
  const authority = poolMint.mintAuthority

  const amount0 = fromA.amount
  const amount1 = fromB.amount

  const reserve0 = accountA.info.amount.toNumber()
  const reserve1 = accountB.info.amount.toNumber()

  console.log('supply:', supply, 'amount0:', amount0, 'amount1:', amount1, 'reserve0:', reserve0, 'reserve1:', reserve1)
  console.log(pool.curveType)
  let liquidity
  if (pool.curveType === 2) {
    liquidity = Math.min((amount0 * supply) / reserve0, (amount1 * supply) / reserve1)
  } else {
    liquidity = (supply * (amount0 + amount1)) / (reserve0 + reserve1)
  }

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(AccountLayout.span)

  // create approval for transfer transactions
  instructions.push(
    Token.createApproveInstruction(TOKEN_PROGRAM_ID, fromA.account, authority, wallet.publicKey, [], amount0),
  )

  instructions.push(
    Token.createApproveInstruction(TOKEN_PROGRAM_ID, fromB.account, authority, wallet.publicKey, [], amount1),
  )

  const [global_state_key] = await PublicKey.findProgramAddress(
    [Buffer.from('atlas-swap'), new PublicKey(PROGRAM_ID).toBuffer()],
    new PublicKey(PROGRAM_ID),
  )
  // depoist
  instructions.push(
    depositInstruction(
      global_state_key,
      pool.pubkeys.account,
      authority,
      wallet.publicKey,
      fromA.account,
      fromB.account,
      pool.pubkeys.holdingAccounts[0],
      pool.pubkeys.holdingAccounts[1],
      pool.pubkeys.mint,
      toAccount,
      pool.pubkeys.program,
      TOKEN_PROGRAM_ID,
      amount0,
      amount1,
      liquidity,
    ),
  )
  return
}

export const removeLiquidity = async (
  connection: Connection,
  wallet: PublicKey,
  liquidityMint: PublicKey,
  liquidityAmount: number,
  account: PublicKey,
  pool?: PoolInfo,
  instructions: TransactionInstruction[] = [],
  cleanupInstructions: TransactionInstruction[] = [],
  signers: Account[] = [],
) => {
  if (!pool) return

  // TODO get min amounts based on total supply and liquidity

  const poolMint = await cache.getMint(pool.pubkeys.mint)
  const accountA = await cache.getAccount(pool.pubkeys.holdingAccounts[0])
  const accountB = await cache.getAccount(pool.pubkeys.holdingAccounts[1])
  if (!poolMint.mintAuthority) throw new Error('Mint doesnt have authority')

  let minAmount0 = 0
  let minAmount1 = 0
  const supply = poolMint.supply.toNumber()
  const reserve0 = accountA.info.amount.toNumber()
  const reserve1 = accountB.info.amount.toNumber()
  if (pool.curveType === 2) {
    minAmount0 = (liquidityAmount * reserve0) / supply
    minAmount1 = (liquidityAmount * reserve1) / supply
  } else {
    minAmount0 = (liquidityAmount * (reserve0 + reserve1)) / supply
    minAmount1 = (liquidityAmount * (reserve0 + reserve1)) / supply
  }

  console.log('supply:', supply, 'amount0:', minAmount0, 'amount1:', minAmount1, 'reserve0:', reserve0, 'reserve1:', reserve1)
  minAmount0 = 0
  minAmount1 = 0
  const authority = poolMint.mintAuthority

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(AccountLayout.span)
  // TODO: check if one of to accounts needs to be native sol ... if yes unwrap it ...
  const toAccounts: PublicKey[] = [
    await addTokenAccountInstruction(
      connection,
      accountA.info.mint,
      wallet,
      instructions,
      cleanupInstructions,
      wallet,
      signers,
    ),
    await addTokenAccountInstruction(
      connection,
      accountB.info.mint,
      wallet,
      instructions,
      cleanupInstructions,
      wallet,
      signers,
    ),
  ]

  instructions.push(Token.createApproveInstruction(TOKEN_PROGRAM_ID, account, authority, wallet, [], liquidityAmount))

  const [global_state_key] = await PublicKey.findProgramAddress(
    [Buffer.from('atlas-swap'), new PublicKey(PROGRAM_ID).toBuffer()],
    new PublicKey(PROGRAM_ID),
  )

  // withdraw
  instructions.push(
    withdrawInstruction(
      global_state_key,
      pool.pubkeys.account,
      authority,
      pool.pubkeys.mint,
      // pool.pubkeys.feeAccount,
      account,
      pool.pubkeys.holdingAccounts[0],
      pool.pubkeys.holdingAccounts[1],
      toAccounts[0],
      toAccounts[1],
      pool.pubkeys.program,
      TOKEN_PROGRAM_ID,
      liquidityAmount,
      minAmount0,
      minAmount1,
    ),
  )
  return
}

function getWrappedAccount(
  instructions: TransactionInstruction[],
  cleanupInstructions: TransactionInstruction[],
  toCheck: TokenAccount,
  payer: PublicKey,
  amount: number,
  signers: Account[],
) {
  if (!toCheck.info.isNative) return toCheck.pubkey

  const account = new Account()
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: amount,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
  )

  instructions.push(Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, WRAPPED_SOL_MINT, account.publicKey, payer))

  cleanupInstructions.push(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, account.publicKey, payer, payer, []))
  signers.push(account)
  return account.publicKey
}

export function findOrCreateAccountByMint(
  payer: PublicKey,
  owner: PublicKey,
  instructions: TransactionInstruction[],
  cleanupInstructions: TransactionInstruction[],
  accountRentExempt: number,
  mint: PublicKey, // use to identify same type
  signers: Account[],
  excluded?: Set<string>,
): PublicKey {
  const accountToFind = mint.toString()
  const account = getCachedAccount(
    (acc) =>
      acc.info.mint.toString() === accountToFind &&
      acc.info.owner.toString() === owner.toString() &&
      (excluded === undefined || !excluded.has(acc.pubkey.toString())),
  )
  const isWrappedSol = accountToFind === WRAPPED_SOL_MINT.toString()

  let toAccount: PublicKey = null
  if (account && !isWrappedSol) {
    toAccount = account.pubkey
  } else {
    const newToAccount = createSplAccount(instructions, payer, accountRentExempt, mint, owner, AccountLayout.span)

    toAccount = newToAccount.publicKey
    signers.push(newToAccount)

    if (isWrappedSol) {
      cleanupInstructions.push(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, toAccount, payer, payer, []))
    }
  }
  return toAccount
}

export function createSplAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  space: number,
) {
  const account = new Account()
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: TOKEN_PROGRAM_ID,
    }),
  )

  instructions.push(Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, mint, account.publicKey, owner))
  return account
}

export async function addTokenAccountInstruction(
  connection: any,
  mint: PublicKey,
  owner: PublicKey,
  instructions: TransactionInstruction[],
  cleanupInstructions: TransactionInstruction[],
  signer: PublicKey,
  signers: Account[],
  rent: number = 0,
) {
  const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID,
    },
    'confirmed',
  )
  let tokenAccount = ''
  parsedTokenAccounts.value.forEach((tokenAccountInfo) => {
    const tokenAccountPubkey = tokenAccountInfo.pubkey
    const parsedInfo = tokenAccountInfo.account.data.parsed.info
    const mintAddress = parsedInfo.mint
    const amount = parsedInfo.tokenAmount.uiAmount
    if (mintAddress == mint.toString()) {
      tokenAccount = tokenAccountPubkey.toString()
    }
  })
  if (tokenAccount != '') return new PublicKey(tokenAccount)
  const newKeypair = new Account()
  const rentForTokenAccount = await Token.getMinBalanceRentForExemptAccount(connection)
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: signer,
      newAccountPubkey: newKeypair.publicKey,
      lamports: rent + rentForTokenAccount,
      space: AccountLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, mint, newKeypair.publicKey, owner),
  )
  if (mint.toString() === WRAPPED_SOL_MINT.toString()) {
    cleanupInstructions.push(
      Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, newKeypair.publicKey, signer, signer, []),
    )
  }
  signers.push(newKeypair)
  return newKeypair.publicKey
}

export async function getTokenAmount(
  connection: any,
  mint: PublicKey,
  owner: PublicKey,
) {
  const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID,
    },
    'confirmed',
  )
  let maxAmount = 0
  parsedTokenAccounts.value.forEach((tokenAccountInfo) => {
    const tokenAccountPubkey = tokenAccountInfo.pubkey
    const parsedInfo = tokenAccountInfo.account.data.parsed.info
    const mintAddress = parsedInfo.mint
    const amount = parsedInfo.tokenAmount.uiAmount
    if (mintAddress == mint.toString() && amount > maxAmount) {
      maxAmount = amount
    }
  })
  return maxAmount
}

export function createSplMint(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  owner: PublicKey,
  space: number,
  decimals: number,
  signers: Account[],
) {
  const account = new Account()
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: TOKEN_PROGRAM_ID,
    }),
  )
  signers.push(account)
  instructions.push(Token.createInitMintInstruction(TOKEN_PROGRAM_ID, account.publicKey, decimals, owner, null))
  return account.publicKey
}

export function createSplTransfer(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  source: PublicKey,
  destination: PublicKey,
  amount: number,
) {
  instructions.push(Token.createTransferInstruction(TOKEN_PROGRAM_ID, source, destination, payer, [], amount))
}

export const sendTransaction = async (
  connection: any,
  wallet: PublicKey,
  instructions: TransactionInstruction[],
  signers: Account[],
  awaitConfirmation = true,
) => {
  let transaction = new Transaction()
  instructions.forEach((instruction) => transaction.add(instruction))
  transaction.recentBlockhash = (await connection.getRecentBlockhash('max')).blockhash
  transaction.setSigners(wallet, ...signers.map((s) => s.publicKey))
  if (signers.length > 0) {
    transaction.partialSign(...signers)
  }

  //   transaction = await wallet.signTransaction(transaction)
  const rawTransaction = transaction.serialize()
  let options = {
    skipPreflight: true,
    commitment: 'singleGossip',
  }
  const txid = await connection.sendRawTransaction(rawTransaction, options)
  if (awaitConfirmation) {
    const status = (await connection.confirmTransaction(txid, options && options.commitment)).value
    if (status.err) throw new Error(`Raw transaction ${txid} failed (${JSON.stringify(status)})`)
  }
  return txid
}

export const TokenSwapLayout: BufferLayout.Structure = BufferLayout.struct([
  BufferLayout.u8('version') as any,
  BufferLayout.u8('isInitialized') as any,
  BufferLayout.u8('nonce') as any,
  BufferLayout.blob(32, 'tokenProgramId') as any,
  BufferLayout.blob(32, 'tokenAccountA') as any,
  BufferLayout.blob(32, 'tokenAccountB') as any,
  BufferLayout.blob(32, 'tokenPool') as any,
  BufferLayout.blob(32, 'mintA') as any,
  BufferLayout.blob(32, 'mintB') as any,
  BufferLayout.u8('curveType'),
  BufferLayout.blob(32, 'curveParameters'),
])

const toPoolInfo = (item: any, program: PublicKey, toMerge?: PoolInfo) => {
  const mint = new PublicKey(item.data.tokenPool)
  return {
    pubkeys: {
      account: item.pubkey,
      program: program,
      mint,
      holdingMints: [] as PublicKey[],
      holdingAccounts: [item.data.tokenAccountA, item.data.tokenAccountB].map((a) => new PublicKey(a)),
    },
    legacy: false,
    raw: item,
  } as PoolInfo
}

export const getPools = async (mint_address: String, isLegacy = false) => {
  let swapId: PublicKey = new PublicKey(PROGRAM_ID)
  let poolsArray: PoolInfo[] = []
  console.log(PROGRAM_ID, connection)
  ;(await connection.getProgramAccounts(swapId))
    .filter((item) => item.account.data.length === TokenSwapLayout.span)
    .map((item) => {
      let result = {
        data: undefined as any,
        account: item.account,
        pubkey: item.pubkey,
        init: async () => {},
      }
      result.data = TokenSwapLayout.decode(item.account.data)
      let pool = toPoolInfo(result, swapId)
      pool.legacy = isLegacy
      pool.pubkeys.holdingMints = [new PublicKey(result.data.mintA), new PublicKey(result.data.mintB)] as PublicKey[]
      pool.curveType = result.data.curveType
      console.log(pool)
      if (
        new PublicKey(result.data.mintA).toString() === mint_address ||
        new PublicKey(result.data.mintB).toString() === mint_address
      )
        poolsArray.push(pool as PoolInfo)
      return result
    })
  return poolsArray
}

export const getPoolByTokenPair = async (mint0: String, mint1: String, isLegacy = false) => {
  let swapId: PublicKey = new PublicKey(PROGRAM_ID);
  let pool = null;
  (await connection.getProgramAccounts(swapId))
    .filter((item) => item.account.data.length === TokenSwapLayout.span)
    .map((item) => {
      let result = {
        data: undefined as any,
        account: item.account,
        pubkey: item.pubkey,
        init: async () => {},
      }
      result.data = TokenSwapLayout.decode(item.account.data)
      if (
        (new PublicKey(result.data.mintA).toString() === mint0 &&
          new PublicKey(result.data.mintB).toString() === mint1) ||
        (new PublicKey(result.data.mintA).toString() === mint1 && new PublicKey(result.data.mintB).toString() === mint0)
      ){
        pool = toPoolInfo(result, swapId)
        pool.legacy = isLegacy
        pool.pubkeys.holdingMints = [new PublicKey(result.data.mintA), new PublicKey(result.data.mintB)] as PublicKey[]
        pool.curveType = result.data.curveType
      }
    })
  return pool
}

export const getPoolByLp = async (lp: String, isLegacy = false) => {
  let swapId: PublicKey = new PublicKey(PROGRAM_ID);
  let pool = null;
  (await connection.getProgramAccounts(swapId))
    .filter((item) => item.account.data.length === TokenSwapLayout.span)
    .map((item) => {
      let result = {
        data: undefined as any,
        account: item.account,
        pubkey: item.pubkey,
        init: async () => {},
      }
      result.data = TokenSwapLayout.decode(item.account.data)
      if (new PublicKey(result.data.tokenPool).toString() === lp) {
        pool = toPoolInfo(result, swapId)
        pool.legacy = isLegacy
        pool.pubkeys.holdingMints = [new PublicKey(result.data.mintA), new PublicKey(result.data.mintB)] as PublicKey[]
        pool.curveType = result.data.curveType
      }
    })
  return pool
}
