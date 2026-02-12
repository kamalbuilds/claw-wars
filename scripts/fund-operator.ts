#!/usr/bin/env tsx
/**
 * Fund operator wallet by:
 *  1. Requesting MON from faucet for fresh wallets
 *  2. Transferring all received MON to the operator
 *
 * Usage:
 *   npx tsx scripts/fund-operator.ts [count]
 *
 * count = number of faucet requests to attempt (default: 10)
 * Each request goes to a fresh wallet, then transfers to operator.
 * Includes delays between requests to avoid rate limiting.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Chain,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config({ path: path.join(__dirname, "../engine/.env") });

const rpcUrl = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

const monad = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const satisfies Chain;

const publicClient = createPublicClient({
  chain: monad,
  transport: http(rpcUrl),
});

const operatorKey = process.env.OPERATOR_PRIVATE_KEY as `0x${string}`;
const operatorAccount = privateKeyToAccount(operatorKey);
const OPERATOR = operatorAccount.address;

const FAUCET_URL = "https://agents.devnads.com/v1/faucet";
const DELAY_BETWEEN_REQUESTS = 90_000; // 90 seconds between faucet requests

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function requestFaucet(address: string): Promise<boolean> {
  try {
    const resp = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, chainId: 10143 }),
    });
    const data = (await resp.json()) as { txHash?: string; error?: string };
    if (data.txHash) {
      console.log(`  Faucet OK: ${data.txHash.slice(0, 16)}...`);
      return true;
    }
    console.log(`  Faucet: ${data.error}`);
    return false;
  } catch (err) {
    console.log(`  Faucet error: ${err}`);
    return false;
  }
}

async function transferToOperator(privateKey: `0x${string}`): Promise<bigint> {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain: monad,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  const gasBuffer = parseEther("0.005");

  if (balance <= gasBuffer) {
    console.log(`  Balance too low to transfer: ${formatEther(balance)} MON`);
    return BigInt(0);
  }

  const transferAmount = balance - gasBuffer;
  const tx = await wallet.sendTransaction({
    to: OPERATOR,
    value: transferAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`  Transferred ${formatEther(transferAmount)} MON`);
  return transferAmount;
}

async function main() {
  const count = parseInt(process.argv[2] || "10", 10);

  const opBalance = await publicClient.getBalance({ address: OPERATOR });
  console.log(`\nOperator: ${OPERATOR}`);
  console.log(`Current balance: ${formatEther(opBalance)} MON`);
  console.log(`Target: 12 MON (for token launch)`);
  console.log(`Attempting ${count} faucet requests...\n`);

  let totalCollected = BigInt(0);
  let successCount = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < count; i++) {
    const pk = generatePrivateKey();
    const acct = privateKeyToAccount(pk);
    console.log(`[${i + 1}/${count}] Wallet: ${acct.address}`);

    const funded = await requestFaucet(acct.address);
    if (funded) {
      consecutiveFailures = 0;
      successCount++;
      // Wait for faucet tx to confirm
      await sleep(3000);
      const amount = await transferToOperator(pk);
      totalCollected += amount;
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        console.log(`\n3 consecutive failures, stopping.`);
        break;
      }
    }

    if (i < count - 1) {
      console.log(`  Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s...`);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  const finalBalance = await publicClient.getBalance({ address: OPERATOR });
  console.log(`\n${"═".repeat(40)}`);
  console.log(`  Faucet requests: ${successCount}/${count}`);
  console.log(`  Total collected: ${formatEther(totalCollected)} MON`);
  console.log(`  Operator balance: ${formatEther(finalBalance)} MON`);
  console.log(`${"═".repeat(40)}`);

  if (Number(finalBalance) / 1e18 >= 12) {
    console.log(`\n✅ Ready to launch! Run: npx tsx scripts/launch-token.ts`);
  } else {
    const needed = 12 - Number(finalBalance) / 1e18;
    console.log(`\n⚠️  Need ${needed.toFixed(2)} more MON.`);
    console.log(`   Fund via browser faucet: https://faucet.monad.xyz/`);
  }
}

main().catch(console.error);
