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
  console.log(`\n🦞 Claw Wars Token Launcher`);
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

  if (balanceMON < 11) {
    console.error(`\n   Need at least 11 MON (10 creation fee + 1 initial buy). Current: ${balanceMON}`);
    console.log(`   Get MON from faucet: POST https://agents.devnads.com/v1/faucet`);
    process.exit(1);
  }

  // Token metadata
  const tokenMetadata = {
    name: "Claw Wars",
    symbol: "CLAW",
    description:
      "Claw Wars - the first autonomous social deduction game for AI agents on Monad. " +
      "AI agents lie, deceive, and deduce with real MON stakes. " +
      "$CLAW powers the game: stake to play, bet on outcomes, earn leaderboard rewards.",
    image: "",
    twitter: "https://x.com/clawwars",
    website: "https://clawwars.xyz",
  };

  console.log(`\n   Uploading metadata...`);

  // Step 1: Upload metadata to nad.fun API
  // The proper flow: upload metadata → get metadata_uri → mine salt → create on-chain
  let tokenURI = "";
  try {
    // Upload metadata (no image for now)
    const metaResponse = await fetch(`${NADFUN_API_BASE}/metadata/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        description: tokenMetadata.description,
        image_uri: "", // no image yet
        twitter: tokenMetadata.twitter || "",
        website: tokenMetadata.website || "",
      }),
    });

    if (metaResponse.ok) {
      const metaData = (await metaResponse.json()) as { metadata_uri: string };
      tokenURI = metaData.metadata_uri;
      console.log(`   Metadata URI: ${tokenURI}`);
    } else {
      const errText = await metaResponse.text();
      console.log(`   Metadata upload returned ${metaResponse.status}: ${errText}`);
      // Try legacy endpoint
      const legacyResponse = await fetch(`${NADFUN_API_BASE}/agent/token/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenMetadata.name,
          symbol: tokenMetadata.symbol,
          description: tokenMetadata.description,
          image_uri: "",
          twitter: tokenMetadata.twitter || "",
          website: tokenMetadata.website || "",
        }),
      });
      if (legacyResponse.ok) {
        const legacyData = (await legacyResponse.json()) as { uri?: string; metadata_uri?: string };
        tokenURI = legacyData.metadata_uri || legacyData.uri || "";
        console.log(`   Metadata URI (legacy): ${tokenURI}`);
      } else {
        const legacyErr = await legacyResponse.text();
        console.log(`   Legacy endpoint returned ${legacyResponse.status}: ${legacyErr}`);
        tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(tokenMetadata))}`;
        console.log(`   Using inline URI as fallback`);
      }
    }
  } catch (err) {
    console.log(`   Metadata upload failed: ${err}`);
    tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(tokenMetadata))}`;
  }

  // Step 2: Mine salt via API (required for on-chain create)
  let salt = keccak256(toHex(`claw-wars-${Date.now()}`)); // fallback
  try {
    console.log(`\n   Mining salt via API...`);
    const saltResponse = await fetch(`${NADFUN_API_BASE}/token/salt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator: account.address,
        name: "Claw Wars",
        symbol: "CLAW",
        metadataUri: tokenURI,
      }),
    });
    if (saltResponse.ok) {
      const saltData = (await saltResponse.json()) as { salt: string; address: string };
      salt = saltData.salt as `0x${string}`;
      console.log(`   Salt: ${salt.slice(0, 18)}...`);
      console.log(`   Predicted token address: ${saltData.address}`);
    } else {
      const saltErr = await saltResponse.text();
      console.log(`   Salt API returned ${saltResponse.status}: ${saltErr}`);
      console.log(`   Using local salt: ${salt.slice(0, 18)}...`);
    }
  } catch (err) {
    console.log(`   Salt API failed: ${err}, using local salt`);
  }

  // Step 3: Get deploy fee from Curve contract
  // feeConfig() returns (deployFeeAmount, graduateFeeAmount, protocolFee)
  let deployFee = parseEther("10"); // default 10 MON
  try {
    const feeConfig = await publicClient.readContract({
      address: CURVE_CONTRACT,
      abi: [{
        type: "function",
        name: "feeConfig",
        inputs: [],
        outputs: [{
          name: "",
          type: "tuple",
          components: [
            { name: "deployFeeAmount", type: "uint256" },
            { name: "graduateFeeAmount", type: "uint256" },
            { name: "protocolFee", type: "uint24" },
          ],
        }],
        stateMutability: "view",
      }] as const,
      functionName: "feeConfig",
    });
    deployFee = (feeConfig as { deployFeeAmount: bigint }).deployFeeAmount;
    console.log(`   Deploy fee from contract: ${Number(deployFee) / 1e18} MON`);
  } catch {
    console.log(`   Could not read feeConfig, using default 10 MON`);
  }

  // Total value = deploy fee + initial buy amount
  const actualInitialBuy = parseEther("1"); // 1 MON for initial buy
  const totalValue = deployFee + actualInitialBuy;

  console.log(`\n   Creating $CLAW on nad.fun...`);
  console.log(`   Deploy fee: ${Number(deployFee) / 1e18} MON`);
  console.log(`   Initial buy: ${Number(actualInitialBuy) / 1e18} MON`);
  console.log(`   Total value: ${Number(totalValue) / 1e18} MON (sent as msg.value)`);
  console.log(`   Salt: ${salt.slice(0, 18)}...`);

  try {
    const txHash = await wallet.writeContract({
      address: BONDING_CURVE_ROUTER,
      abi: ROUTER_ABI,
      functionName: "create",
      args: [
        {
          name: "Claw Wars",
          symbol: "CLAW",
          tokenURI,
          amountOut: BigInt(0), // no min output for creation
          salt,
          actionId: 1, // CapricornActor - standard creation (SDK hardcodes this)
        },
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

    // Look for CurveCreate event from the Curve contract
    // Event: CurveCreate(address indexed creator, address indexed token, address indexed pool, ...)
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CURVE_CONTRACT.toLowerCase()) {
        if (log.topics.length >= 4) {
          tokenAddress = `0x${log.topics[2]?.slice(26) || ""}`;
          curveAddress = `0x${log.topics[3]?.slice(26) || ""}`;
          if (tokenAddress.length === 42) break;
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
