import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, Account, Connection, SystemProgram, Transaction } from '@solana/web3.js'
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes'
import { setGlobalState} from './integrations/setGlobalState'
import { createPool } from './integrations/createPool'
import { addLiquiditytoExistPool} from './integrations/addLiquidity'
import { removeLiquiditytoExistPool } from './integrations/removeLiquidity'
import { getPoolByTokenPair, getTokenAmount } from './solanaPool/atlasPool';
import { getMintInfo } from './solanaPool/accounts'
import 'dotenv/config'

describe("amm-test", async () => {
  let signer: Account = new Account();
  const connection = new Connection('https://api.devnet.solana.com');
  let token0: Token, token1: Token;
  
  it("Is initialized!", async () => {
    await safeAirdrop(connection, signer.publicKey);
    
    token0 = await Token.createMint(
      connection,
      signer,
      signer.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID,
    );
    const token0Account = await token0.createAccount(signer.publicKey);
    await token0.mintTo(
      token0Account,
      signer,
      [],
      100_000_000,
    );
    token1 = await Token.createMint(
      connection,
      signer,
      signer.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID,
    );
    const token1Account = await token1.createAccount(signer.publicKey);
    await token1.mintTo(
      token1Account,
      signer,
      [],
      100_000_000,
    );
    // token0 = new PublicKey(process.env.TOKEN_1)
    // token1 = new PublicKey(process.env.TOKEN_2)
    // signer = new Account(
    //   bs58.decode(process.env.WALLET_PRIVATE_KEY as string),
    // )
  });
  let lpMint: PublicKey;

  // it("Set Global State!", async () => {
  //   await setGlobalState()
  // });

  it("Create New Pool!", async () => {
    const curveType = 2;//0: stable curve, 2: constant product curve
    const res = await createPool(token0.publicKey, token1.publicKey, 1_000, 10_000, curveType, connection, signer);
    if(res.status == 'ok') lpMint = res.data.lpMint;
    await delay(20000);
  });

  it("Add Liquidity!", async () => {
    await addLiquiditytoExistPool(token0.publicKey, token1.publicKey, 500, 5_000, connection, signer);
    await delay(40000);
    const lpInfo = await getMintInfo(lpMint);
    console.log("lpSupply:", parseInt(lpInfo.supply.toString()));
  })

  // it("Get Pool info", async () => {
  //   const res = await getPoolByTokenPair(token0.toString(), token1.toString());
  //   console.log(res)
  // })

  it("Remove Liquidity!", async () => {
    await removeLiquiditytoExistPool(token0.publicKey, token1.publicKey, 10_000, connection, signer);
  })
});


async function safeAirdrop(connection: Connection, destination: PublicKey, amount = 100000000) {
  while (await connection.getBalance(destination) < amount){
    try{
      // Request Airdrop for user
      await connection.confirmTransaction(
        await connection.requestAirdrop(destination, amount),
        "confirmed"
      );
    }catch{
    }
  };
}

async function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}