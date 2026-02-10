import { encodeFunctionData, parseEther, type Hex } from "viem";
import { publicClient, walletClient, monad } from "./client.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

const nadfunLogger = logger.child("NadFun");

// Nad.fun mainnet contract addresses
const NADFUN_CONTRACTS = {
  CORE: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const, // BondingCurveRouter
  BONDING_CURVE: "0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE" as const,
  LENS: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea" as const,
  DEX_ROUTER: "0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137" as const,
  WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const,
};

// ICore ABI (createCurve function)
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
  {
    type: "function",
    name: "buy",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sell",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Nad.fun REST API
const NADFUN_API_BASE = "https://api.nadapp.net";

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface CreateTokenResult {
  tokenAddress: string;
  curveAddress: string;
  txHash: string;
}

/**
 * Upload token image to nad.fun
 */
async function uploadTokenImage(imageUrl: string): Promise<string> {
  nadfunLogger.info("Uploading token image to nad.fun...");

  try {
    // Fetch the image first
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    formData.append("file", imageBlob, "token-image.png");

    const response = await fetch(`${NADFUN_API_BASE}/agent/token/image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Image upload failed: ${response.status}`);
    }

    const data = (await response.json()) as { url: string };
    nadfunLogger.info(`Image uploaded: ${data.url}`);
    return data.url;
  } catch (err) {
    nadfunLogger.error("Failed to upload token image, using placeholder", err);
    return imageUrl; // Fallback to original URL
  }
}

/**
 * Upload token metadata to nad.fun
 */
async function uploadTokenMetadata(
  metadata: TokenMetadata
): Promise<string> {
  nadfunLogger.info("Uploading token metadata...");

  try {
    const response = await fetch(`${NADFUN_API_BASE}/agent/token/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: metadata.image,
        twitter: metadata.twitter || "",
        telegram: metadata.telegram || "",
        website: metadata.website || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Metadata upload failed: ${response.status}`);
    }

    const data = (await response.json()) as { uri: string };
    nadfunLogger.info(`Metadata uploaded: ${data.uri}`);
    return data.uri;
  } catch (err) {
    nadfunLogger.error("Failed to upload metadata", err);
    throw err;
  }
}

/**
 * Create $CLAW token on nad.fun via the BondingCurveRouter
 */
export async function createClawToken(
  initialBuyAmount: bigint = parseEther("1")
): Promise<CreateTokenResult> {
  if (!walletClient || !walletClient.account) {
    throw new Error("Operator wallet not configured");
  }

  const creatorAddress = walletClient.account.address;
  nadfunLogger.info(
    `Creating $CLAW token from ${creatorAddress} with initial buy: ${initialBuyAmount}`
  );

  // Token metadata
  const metadata: TokenMetadata = {
    name: "Among Claws",
    symbol: "CLAW",
    description:
      "Among Claws — the first autonomous social deduction game for AI agents on Monad. " +
      "Watch AI agents lie, deceive, and deduce in real-time with real MON stakes. " +
      "$CLAW powers the game economy: stake to play premium games, bet on outcomes, " +
      "earn leaderboard rewards, and govern the protocol.",
    image: "", // Will be set after upload
    twitter: "https://x.com/amongclaws",
    website: "https://amongclaws.xyz",
  };

  // Step 1: Upload image (using a generated or placeholder lobster claw image)
  const clawImageUrl =
    "https://raw.githubusercontent.com/kamalbuilds/among-claws/main/assets/claw-token.png";
  const uploadedImageUrl = await uploadTokenImage(clawImageUrl).catch(
    () => clawImageUrl
  );
  metadata.image = uploadedImageUrl;

  // Step 2: Upload metadata
  const tokenURI = await uploadTokenMetadata(metadata);

  // Step 3: Calculate fee (nad.fun deploy fee ~10 MON)
  const deployFee = parseEther("10");
  const totalValue = deployFee + initialBuyAmount;

  // Step 4: Create curve on-chain
  nadfunLogger.info("Submitting createCurve transaction...");

  const txHash = await walletClient.writeContract({
    address: NADFUN_CONTRACTS.CORE,
    abi: CORE_ABI,
    functionName: "createCurve",
    args: [
      creatorAddress,
      metadata.name,
      metadata.symbol,
      tokenURI,
      initialBuyAmount,
      deployFee,
    ],
    value: totalValue,
    chain: monad,
    account: walletClient.account,
  });

  nadfunLogger.info(`Transaction submitted: ${txHash}`);

  // Step 5: Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  if (receipt.status === "reverted") {
    throw new Error(`Token creation reverted: ${txHash}`);
  }

  // Parse logs to get token and curve addresses
  // The Create event has: owner, curve, token, tokenURI, name, symbol, virtualNative, virtualToken
  const createEventTopic =
    "0x" +
    "0000000000000000000000000000000000000000000000000000000000000000"; // Will parse from logs

  let tokenAddress = "";
  let curveAddress = "";

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === NADFUN_CONTRACTS.BONDING_CURVE.toLowerCase()) {
      // Parse the Create event
      if (log.topics.length >= 4) {
        curveAddress = `0x${log.topics[2]?.slice(26) || ""}`;
        tokenAddress = `0x${log.topics[3]?.slice(26) || ""}`;
      }
    }
  }

  // Fallback: try reading from transaction receipt logs
  if (!tokenAddress) {
    for (const log of receipt.logs) {
      if (log.topics.length >= 3 && log.data.length > 2) {
        // Look for the first address-like topic after the event signature
        const possibleToken = `0x${log.topics[2]?.slice(26) || ""}`;
        if (possibleToken.length === 42) {
          tokenAddress = possibleToken;
          curveAddress = `0x${log.topics[1]?.slice(26) || ""}`;
          break;
        }
      }
    }
  }

  nadfunLogger.info(`$CLAW Token created!`);
  nadfunLogger.info(`  Token: ${tokenAddress}`);
  nadfunLogger.info(`  Curve: ${curveAddress}`);
  nadfunLogger.info(`  TX: ${txHash}`);

  return {
    tokenAddress,
    curveAddress,
    txHash,
  };
}

/**
 * Buy $CLAW tokens on nad.fun
 */
export async function buyClawTokens(
  tokenAddress: string,
  amountMON: bigint
): Promise<string> {
  if (!walletClient || !walletClient.account) {
    throw new Error("Operator wallet not configured");
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min deadline
  const fee = (amountMON * BigInt(100)) / BigInt(10000); // 1% fee estimate

  const txHash = await walletClient.writeContract({
    address: NADFUN_CONTRACTS.CORE,
    abi: CORE_ABI,
    functionName: "buy",
    args: [
      amountMON,
      fee,
      tokenAddress as Hex,
      walletClient.account.address,
      deadline,
    ],
    value: amountMON + fee,
    chain: monad,
    account: walletClient.account,
  });

  nadfunLogger.info(`Buy TX submitted: ${txHash}`);
  return txHash;
}

/**
 * Sell $CLAW tokens on nad.fun
 */
export async function sellClawTokens(
  tokenAddress: string,
  tokenAmount: bigint
): Promise<string> {
  if (!walletClient || !walletClient.account) {
    throw new Error("Operator wallet not configured");
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const txHash = await walletClient.writeContract({
    address: NADFUN_CONTRACTS.CORE,
    abi: CORE_ABI,
    functionName: "sell",
    args: [
      tokenAmount,
      tokenAddress as Hex,
      walletClient.account.address,
      deadline,
    ],
    chain: monad,
    account: walletClient.account,
  });

  nadfunLogger.info(`Sell TX submitted: ${txHash}`);
  return txHash;
}

/**
 * Get token info from nad.fun API
 */
export async function getTokenInfo(tokenAddress: string) {
  const response = await fetch(
    `https://testnet-bot-api-server.nad.fun/token/${tokenAddress}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch token info: ${response.status}`);
  }
  return response.json();
}

/**
 * Get token market data from nad.fun API
 */
export async function getTokenMarket(tokenAddress: string) {
  const response = await fetch(
    `https://testnet-bot-api-server.nad.fun/token/market/${tokenAddress}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.status}`);
  }
  return response.json();
}
