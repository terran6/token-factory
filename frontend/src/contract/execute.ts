import { LCDClient, MsgExecuteContract, Coin } from "@terra-money/terra.js";
import { ConnectedWallet } from "@terra-money/wallet-provider";
import { SubmitTokenData } from "../components/TokenDialog";
import { Address } from "../models/address";
import { TokenData } from "../models/query";
import { Token, TokenUtils } from "../models/token";
import { factoryAddress } from "./address";

// ==== utils ====

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = Date.now() + 1000 * 60 * 60;
const untilInterval = Date.now() + 1000 * 60;
const DECIMALS = 6;

const _exec =
  (msgs: any) =>
    async (wallet: ConnectedWallet) => {
      const lcd = new LCDClient({
        URL: wallet.network.lcd,
        chainID: wallet.network.chainID,
      });

      const { result } = await wallet.post({
        msgs
      });

      while (true) {
        try {
          return await lcd.tx.txInfo(result.txhash);
        } catch (e) {
          if (Date.now() < untilInterval) {
            await sleep(500);
          } else if (Date.now() < until) {
            await sleep(1000 * 10);
          } else {
            throw new Error(
              `Transaction queued. To verify the status, please check the transaction hash: ${result.txhash}`
            );
          }
        }
      }
    };

// ==== execute contract ====
export const mintToken = async (
  tokenData: TokenData,
  userData: SubmitTokenData,
  wallet: ConnectedWallet
) => {
  const executeMsg = [
    new MsgExecuteContract(
      wallet.walletAddress,
      factoryAddress(wallet),
      {
        deposit: {
          mint: {
            token_address: tokenData.address,
            recipient: userData.address,
            allowance_address: factoryAddress(wallet)
          }
        }
      },
      [new Coin("uluna", (Number(userData.amount) * (10 ** DECIMALS)).toString())]
    )
  ]
  return _exec(executeMsg)(wallet);
}

export const createNewToken = async (token: Token, wallet: ConnectedWallet) => {
  const executeMsg = [
    new MsgExecuteContract(
      wallet.walletAddress,
      factoryAddress(wallet),
      {
        deposit: {
          instantiate: token
        }
      },
      [new Coin("uluna", TokenUtils.getInitialBalance(token))]
    )
  ]
  return _exec(executeMsg)(wallet);
}

export const burnToken = async (
  tokenData: TokenData,
  userData: SubmitTokenData,
  wallet: ConnectedWallet
) => {
  const executeMsg = [
    new MsgExecuteContract(
      wallet.walletAddress,
      tokenData.address as string,
      {
        increase_allowance: {
          spender: factoryAddress(wallet),
          amount: (Number(userData.amount) * 10 ** DECIMALS).toString()
        }
      }
    ),
    new MsgExecuteContract(
      wallet.walletAddress,
      factoryAddress(wallet),
      {
        burn: {
          token_address: tokenData.address,
          amount: (Number(userData.amount) * 10 ** DECIMALS).toString()
        }
      }
    ),
    new MsgExecuteContract(
      wallet.walletAddress,
      tokenData.address as string,
      {
        decrease_allowance: {
          spender: factoryAddress(wallet),
          amount: (Number(userData.amount) * 10 ** DECIMALS).toString()
        }
      }
    )
  ]
  return _exec(executeMsg)(wallet);
}
