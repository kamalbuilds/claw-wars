#!/usr/bin/env tsx
/**
 * Launch $CLAW token on nad.fun
 *
 * Usage:
 *   npx tsx scripts/launch-token.ts
 *
 * Requires:
 *   OPERATOR_PRIVATE_KEY in .env (with ~2 MON for deploy + initial buy)
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, type Chain } from "viem";
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

// BondingCurveRouter (testnet vs mainnet)
const BONDING_CURVE_ROUTER = isTestnet
  ? ("0x865054F0F6A288adaAc30261731361EA7E908003" as const)
  : ("0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const);

// Curve contract for event parsing
const CURVE_CONTRACT = isTestnet
  ? ("0x1228b0dc9481C11D3071E7A924B794CfB038994e" as const)
  : ("0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE" as const);

// Lens contract for quote
const LENS_CONTRACT = isTestnet
  ? ("0xB056d79CA5257589692699a46623F901a3BB76f1" as const)
  : ("0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea" as const);

// Testnet vs mainnet API for metadata uploads
const NADFUN_API_BASE = isTestnet
  ? "https://dev-api.nad.fun"
  : "https://api.nadapp.net";

// ABI from official nad.fun SDK — BondingCurveRouter.create()
const ROUTER_ABI = [
  {
    type: "function",
    name: "create",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IBondingCurveRouter.TokenCreationParams",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "tokenURI", type: "string" },
          { name: "amountOut", type: "uint256" },
          { name: "salt", type: "bytes32" },
          { name: "actionId", type: "uint8" },
        ],
      },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "pool", type: "address" },
    ],
    stateMutability: "payable",
  },
] as const;

const LENS_ABI = [
  {
    type: "function",
    name: "getInitialBuyAmountOut",
    inputs: [{ name: "amountIn", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
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

  if (balanceMON < 1) {
    console.error(`\n   Need at least 1 MON. Current: ${balanceMON}`);
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

  // Use most of balance for creation (leave some for gas)
  const initialBuy = parseEther("0.5");

  // Estimate output tokens
  let expectedTokens = BigInt(0);
  try {
    expectedTokens = await publicClient.readContract({
      address: LENS_CONTRACT,
      abi: LENS_ABI,
      functionName: "getInitialBuyAmountOut",
      args: [initialBuy],
    });
    console.log(`\n   Expected tokens from initial buy: ${expectedTokens}`);
  } catch {
    console.log(`\n   Could not estimate initial buy output`);
  }

  const salt = keccak256(toHex(`among-claws-${Date.now()}`));

  console.log(`\n   Creating $CLAW on nad.fun...`);
  console.log(`   Initial buy value: ${Number(initialBuy) / 1e18} MON (sent as msg.value)`);
  console.log(`   Salt: ${salt.slice(0, 18)}...`);

  try {
    const txHash = await wallet.writeContract({
      address: BONDING_CURVE_ROUTER,
      abi: ROUTER_ABI,
      functionName: "create",
      args: [
        {
          name: "Among Claws",
          symbol: "CLAW",
          tokenURI,
          amountOut: BigInt(0), // no min output for creation
          salt,
          actionId: 0,
        },
      ],
      value: initialBuy,
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

    // Look for CurveCreate event from the Curve contract
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CURVE_CONTRACT.toLowerCase()) {
        if (log.topics.length >= 3) {
          tokenAddress = `0x${log.topics[1]?.slice(26) || ""}`;
          curveAddress = `0x${log.topics[2]?.slice(26) || ""}`;
          if (tokenAddress.length === 42) break;
        }
      }
    }

    // Fallback
    if (!tokenAddress || tokenAddress.length !== 42) {
      for (const log of receipt.logs) {
        if (log.topics.length >= 3) {
          const addr1 = `0x${log.topics[1]?.slice(26) || ""}`;
          const addr2 = `0x${log.topics[2]?.slice(26) || ""}`;
          if (addr1.length === 42 && addr2.length === 42) {
            tokenAddress = addr1;
            curveAddress = addr2;
            break;
          }
        }
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
