export type ENV = 'mainnet-beta' | 'devnet'
export const NET_ID: ENV = 'devnet'
export const PROGRAM_IDs = {
  'mainnet-beta': '2E5cDaVrPPMp1a6Q7PNookgd48yUidJKgrf9as5ezWwF',
  devnet: 'EZrRrk4cDBwNMnJekmn7JmV6hcFaPAmFDksDePHJZR6Q',
}
export const PROGRAM_ID = PROGRAM_IDs[NET_ID]
