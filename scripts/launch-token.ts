#!/usr/bin/env tsx
/**
 * Launch $CLAW token on nad.fun
 *
 * Usage:
 *   npx tsx scripts/launch-token.ts
 *
 * Requires:
 *   OPERATOR_PRIVATE_KEY in .env (with ~12 MON for deploy fee + initial buy)
 */

import { createPublicClient, createWalletClient, http, parseEther, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config({ path: path.join(__dirname, "../engine/.env") });

// Network selection: use MONAD_CHAIN_ID from env, default to testnet (10143)
const chainId = parseInt(process.env.MONAD_CHAIN_ID || "10143", 10);
const isTestnet = chainId === 10143;
const rpcUrl = process.env.MONAD_RPC_URL || (isTestnet ? "https://testnet-rpc.monad.xyz" : "https://rpc.monad.xyz");

const monad = {
  id: chainId,
  name: isTestnet ? "Monad Testnet" : "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "MonadExplorer", url: isTestnet ? "https://testnet.monadexplorer.com" : "https://monadexplorer.com" } },
} as const satisfies Chain;

// Testnet vs mainnet BondingCurveRouter
const BONDING_CURVE_ROUTER = isTestnet
  ? ("0x865054F0F6A288adaAc30261731361EA7E908003" as const)
  : ("0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const);

// Testnet vs mainnet API for metadata uploads
const NADFUN_API_BASE = isTestnet
  ? "https://dev-api.nad.fun"
  : "https://api.nadapp.net";

const CORE_ABI = [
  {
    type: "function",
    name: "createCurve",
    inputs: [
      { name: "creator", type: "address" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "tokenURI", type: "string" },
      { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [
      { name: "curve", type: "address" },
      { name: "token", type: "address" },
      { name: "virtualNative", type: "uint256" },
      { name: "virtualToken", type: "uint256" },
      { name: "amountOut", type: "uint256" },
    ],
    stateMutability: "payable",
  },
] as const;

async function main() {
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey || privateKey === "0x_your_private_key_here") {
    console.error("ERROR: Set OPERATOR_PRIVATE_KEY in engine/.env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`\n🦞 Among Claws Token Launcher`);
  console.log(`   Network: ${isTestnet ? "TESTNET" : "MAINNET"} (chain ${chainId})`);
  console.log(`   RPC: ${rpcUrl}`);
  console.log(`   Router: ${BONDING_CURVE_ROUTER}`);
  console.log(`   Creator: ${account.address}`);

  const publicClient = createPublicClient({
    chain: monad,
    transport: http(rpcUrl),
  });

  const wallet = createWalletClient({
    account,
    chain: monad,
    transport: http(rpcUrl),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceMON = Number(balance) / 1e18;
  console.log(`   Balance: ${balanceMON.toFixed(4)} MON`);

  if (balanceMON < 12) {
    console.error(`\n   Need at least 12 MON (10 deploy fee + 2 initial buy). Current: ${balanceMON}`);
    console.log(`   Get MON from faucet: POST https://agents.devnads.com/v1/faucet`);
    process.exit(1);
  }

  // Token metadata
  const tokenMetadata = {
    name: "Among Claws",
    symbol: "CLAW",
    description:
      "Among Claws - the first autonomous social deduction game for AI agents on Monad. " +
      "AI agents lie, deceive, and deduce with real MON stakes. " +
      "$CLAW powers the game: stake to play, bet on outcomes, earn leaderboard rewards.",
    image: "",
    twitter: "https://x.com/amongclaws",
    website: "https://amongclaws.xyz",
  };

  console.log(`\n   Uploading metadata...`);

  // Upload metadata to nad.fun
  let tokenURI = "";
  try {
    const metaResponse = await fetch(`${NADFUN_API_BASE}/agent/token/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        description: tokenMetadata.description,
        ...(isTestnet
          ? { image_uri: tokenMetadata.image }
          : { image: tokenMetadata.image }),
        twitter: tokenMetadata.twitter || "",
        website: tokenMetadata.website || "",
      }),
    });

    if (metaResponse.ok) {
      const metaData = (await metaResponse.json()) as { uri: string };
      tokenURI = metaData.uri;
      console.log(`   Metadata URI: ${tokenURI}`);
    } else {
      console.log(`   Metadata upload returned ${metaResponse.status}, using inline URI`);
      tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(tokenMetadata))}`;
    }
  } catch {
    console.log(`   Metadata upload failed, using inline URI`);
    tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(tokenMetadata))}`;
  }

  const deployFee = parseEther("10");
  const initialBuy = parseEther("1");
  const totalValue = deployFee + initialBuy;

  console.log(`\n   Creating $CLAW on nad.fun...`);
  console.log(`   Deploy fee: 10 MON`);
  console.log(`   Initial buy: 1 MON`);
  console.log(`   Total cost: 11 MON`);

  try {
    const txHash = await wallet.writeContract({
      address: BONDING_CURVE_ROUTER,
      abi: CORE_ABI,
      functionName: "createCurve",
      args: [
        account.address,
        "Among Claws",
        "CLAW",
        tokenURI,
        initialBuy,
        deployFee,
      ],
      value: totalValue,
    });

    console.log(`\n   TX submitted: ${txHash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      console.error(`\n   Transaction REVERTED!`);
      process.exit(1);
    }

    // Parse token address from logs
    let tokenAddress = "";
    let curveAddress = "";
    for (const log of receipt.logs) {
      if (log.topics.length >= 4) {
        curveAddress = `0x${log.topics[2]?.slice(26) || ""}`;
        tokenAddress = `0x${log.topics[3]?.slice(26) || ""}`;
        if (tokenAddress.length === 42) break;
      }
    }

    console.log(`\n   $CLAW Token Created!`);
    console.log(`   Token Address: ${tokenAddress}`);
    console.log(`   Curve Address: ${curveAddress}`);
    console.log(`   TX Hash: ${txHash}`);
    const explorerBase = isTestnet ? "https://testnet.monadexplorer.com" : "https://monadexplorer.com";
    const nadfunBase = isTestnet ? "https://testnet.nad.fun" : "https://nad.fun";
    console.log(`   Explorer: ${explorerBase}/tx/${txHash}`);
    console.log(`   Nad.fun: ${nadfunBase}/token/${tokenAddress}`);
    console.log(`\n   Add to engine/.env:`);
    console.log(`   CLAW_TOKEN_ADDRESS=${tokenAddress}`);
  } catch (err) {
    console.error(`\n   Transaction failed:`, err);
    process.exit(1);
  }
}

main();
