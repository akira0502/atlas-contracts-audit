import { AccountLayout, MintInfo, MintLayout, u64 } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { NET_ID } from './ids'
import { TokenAccount } from './interfaces'

let connection = new Connection('https://solana-api.projectserum.com')
if (NET_ID === 'devnet') connection = new Connection('https://api.devnet.solana.com')

const mintCache = new Map<string, Promise<MintInfo>>()
const pendingAccountCalls = new Map<string, Promise<TokenAccount>>()
const accountsCache = new Map<string, TokenAccount>()

const getAccountInfo = async (pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey)

  if (info == null) throw new Error('Failed to find mint account')

  const buffer = Buffer.from(info.data)
  const data = deserializeAccount(buffer)

  const details = {
    pubkey: pubKey,
    account: {
      ...info,
    },
    info: data,
  } as TokenAccount

  return details
}

export const getMintInfo = async (pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey)
  if (info === null) throw new Error('Failed to find mint account')

  const data = Buffer.from(info.data)
  return deserializeMint(data)
}

export const cache = {
  getAccount: async (pubKey: string | PublicKey) => {
    let id: PublicKey
    if (typeof pubKey === 'string') {
      id = new PublicKey(pubKey)
    } else {
      id = pubKey
    }
    const address = id.toBase58()
    let account = accountsCache.get(address)
    if (account) {
      return account
    }
    let query = pendingAccountCalls.get(address)
    if (query) return query
    query = getAccountInfo(id).then((data) => {
      pendingAccountCalls.delete(address)
      accountsCache.set(address, data)
      return data
    }) as Promise<TokenAccount>
    pendingAccountCalls.set(address, query as any)
    return query
  },

  getMint: async (pubKey: string | PublicKey) => {
    let id: PublicKey
    if (typeof pubKey === 'string') {
      id = new PublicKey(pubKey)
    } else {
      id = pubKey
    }
    let mint = mintCache.get(id.toBase58())
    if (mint) return mint

    let query = getMintInfo(id)
    mintCache.set(id.toBase58(), query as any)
    return query
  },
}

export const getCachedAccount = (predicate: (account: TokenAccount) => boolean) => {
  for (const account of accountsCache.values()) {
    if (predicate(account)) {
      return account as TokenAccount
    }
  }
}

const deserializeAccount = (data: Buffer) => {
  const accountInfo = AccountLayout.decode(data)
  accountInfo.mint = new PublicKey(accountInfo.mint)
  accountInfo.owner = new PublicKey(accountInfo.owner)
  accountInfo.amount = u64.fromBuffer(accountInfo.amount)

  if (accountInfo.delegateOption == 0) {
    accountInfo.delegate = null
    accountInfo.delegateAmount = new u64(0)
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate)
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount)
  }
  accountInfo.isInitialized = accountInfo.state !== 0
  accountInfo.isFrozen = accountInfo.state === 2
  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative)
    accountInfo.isNative = true
  } else {
    accountInfo.rentExemptReserve = null
    accountInfo.isNative = false
  }
  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority)
  }
  return accountInfo
}

const deserializeMint = (data: Buffer) => {
  if (data.length !== MintLayout.span) throw new Error('Not a valid Mint')

  const mintInfo = MintLayout.decode(data)
  if (mintInfo.mintAuthorityOption === 0) {
    mintInfo.mintAuthority = null
  } else {
    mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority)
  }
  mintInfo.supply = u64.fromBuffer(mintInfo.supply)
  mintInfo.isInitialized = mintInfo.isInitialized !== 0
  if (mintInfo.freezeAuthorityOption === 0) {
    mintInfo.freezeAuthority = null
  } else {
    mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority)
  }
  return mintInfo as MintInfo
}
