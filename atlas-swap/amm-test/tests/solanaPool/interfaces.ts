import { PublicKey, AccountInfo, Connection } from '@solana/web3.js'
import { AccountLayout, u64, MintLayout, AccountInfo as TokenAccountInfo } from '@solana/spl-token'

export interface PoolInfo {
  pubkeys: {
    program: PublicKey
    account: PublicKey
    holdingAccounts: PublicKey[]
    holdingMints: PublicKey[]
    mint: PublicKey
    feeAccount?: PublicKey
  }
  legacy: boolean
  raw: any
  curveType: number
}

export interface TokenInfo {
  tokenSymbol: string
  mintAddress: string
  tokenName: string
  icon: string
}

export interface LiquidityComponent {
  amount: number
  account: PublicKey
  mintAddress: string
}

export interface TokenAccount {
  pubkey: PublicKey
  account: AccountInfo<Buffer>
  info: TokenAccountInfo
}
