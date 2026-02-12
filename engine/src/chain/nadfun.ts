import { encodeFunctionData, parseEther, keccak256, toHex, type Hex } from "viem";
import { publicClient, walletClient, monad } from "./client.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

const nadfunLogger = logger.child("NadFun");

const isTestnet = config.monad.chainId === 10143;

// Nad.fun contract addresses (testnet vs mainnet) — from official SDK
const NADFUN_CONTRACTS = isTestnet
  ? {
      CORE: "0x865054F0F6A288adaAc30261731361EA7E908003" as const, // BondingCurveRouter
      BONDING_CURVE: "0x1228b0dc9481C11D3071E7A924B794CfB038994e" as const, // Curve
      LENS: "0xB056d79CA5257589692699a46623F901a3BB76f1" as const,
      DEX_ROUTER: "0x5D4a4f430cA3B1b2dB86B9cFE48a5316800F5fb2" as const,
      WMON: "0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd" as const,
    }
  : {
      CORE: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const,
      BONDING_CURVE: "0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE" as const,
      LENS: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea" as const,
      DEX_ROUTER: "0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137" as const,
      WMON: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const,
    };

nadfunLogger.info(`Using ${isTestnet ? "testnet" : "mainnet"} nad.fun contracts`);
nadfunLogger.info(`  BondingCurveRouter: ${NADFUN_CONTRACTS.CORE}`);

// ── ABIs from official nad.fun SDK ──────────────────────

const BONDING_CURVE_ROUTER_ABI = [
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
  {
    type: "function",
    name: "buy",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IBondingCurveRouter.BuyParams",
        components: [
          { name: "amountOutMin", type: "uint256" },
          { name: "token", type: "address" },
          { name: "to", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sell",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IBondingCurveRouter.SellParams",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMin", type: "uint256" },
          { name: "token", type: "address" },
          { name: "to", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sellPermit",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IBondingCurveRouter.SellPermitParams",
        components: [
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMin", type: "uint256" },
          { name: "amountAllowance", type: "uint256" },
          { name: "token", type: "address" },
          { name: "to", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "availableBuyTokens",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "availableBuyToken", type: "uint256" },
      { name: "requiredMonAmount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAmountOutWithFee",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "isBuy", type: "bool" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const LENS_ABI = [
  {
    type: "function",
    name: "getAmountOut",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "isBuy", type: "bool" },
    ],
    outputs: [
      { name: "router", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getInitialBuyAmountOut",
    inputs: [{ name: "amountIn", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Nad.fun REST API (testnet vs mainnet)
const NADFUN_API_BASE = isTestnet
  ? "https://dev-api.nad.fun"
  : "https://api.nadapp.net";

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
    return imageUrl;
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
        // Testnet API uses image_uri, mainnet uses image
        ...(isTestnet
          ? { image_uri: metadata.image }
          : { image: metadata.image }),
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
 * Create $CLAW token on nad.fun via BondingCurveRouter.create()
 *
 * The create function takes a TokenCreationParams struct:
 *   { name, symbol, tokenURI, amountOut, salt, actionId }
 *
 * msg.value = total MON to send (covers creation fee + initial buy)
 * amountOut = 0 for no initial buy, or the expected token output
 * salt = random bytes32 for deterministic token address
 * actionId = 0 for standard creation
 */
export async function createClawToken(
  initialBuyMON: bigint = parseEther("1")
): Promise<CreateTokenResult> {
  if (!walletClient || !walletClient.account) {
    throw new Error("Operator wallet not configured");
  }

  const creatorAddress = walletClient.account.address;
  nadfunLogger.info(
    `Creating $CLAW token from ${creatorAddress} with initial buy: ${initialBuyMON}`
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
    image: "",
    twitter: "https://x.com/amongclaws",
    website: "https://amongclaws.xyz",
  };

  // Step 1: Upload image
  const clawImageUrl =
    "https://raw.githubusercontent.com/kamalbuilds/among-claws/main/assets/claw-token.png";
  const uploadedImageUrl = await uploadTokenImage(clawImageUrl).catch(
    () => clawImageUrl
  );
  metadata.image = uploadedImageUrl;

  // Step 2: Upload metadata
  let tokenURI: string;
  try {
    tokenURI = await uploadTokenMetadata(metadata);
  } catch {
    // Fallback to inline metadata
    tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
  }

  // Step 3: Estimate initial buy output via Lens
  let amountOut = BigInt(0);
  if (initialBuyMON > BigInt(0)) {
    try {
      amountOut = await publicClient.readContract({
        address: NADFUN_CONTRACTS.LENS,
        abi: LENS_ABI,
        functionName: "getInitialBuyAmountOut",
        args: [initialBuyMON],
      });
      nadfunLogger.info(`Expected initial buy output: ${amountOut} tokens`);
    } catch {
      nadfunLogger.warn("Could not estimate initial buy output, using 0");
    }
  }

  // Step 4: Create token on-chain
  const salt = keccak256(toHex(`among-claws-${Date.now()}`));

  nadfunLogger.info("Submitting create transaction...");

  const txHash = await walletClient.writeContract({
    address: NADFUN_CONTRACTS.CORE,
    abi: BONDING_CURVE_ROUTER_ABI,
    functionName: "create",
    args: [
      {
        name: metadata.name,
        symbol: metadata.symbol,
        tokenURI,
        amountOut: BigInt(0), // min output (0 = no slippage protection for creation)
        salt,
        actionId: 0,
      },
    ],
    value: initialBuyMON, // msg.value covers fee + initial buy
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

  // Parse logs for token and pool addresses
  let tokenAddress = "";
  let curveAddress = "";

  for (const log of receipt.logs) {
    // CurveCreate event from the Curve contract
    if (log.address.toLowerCase() === NADFUN_CONTRACTS.BONDING_CURVE.toLowerCase()) {
      if (log.topics.length >= 3) {
        // CurveCreate: creator(indexed), token(indexed), pool(indexed), ...
        tokenAddress = `0x${log.topics[1]?.slice(26) || ""}`;
        curveAddress = `0x${log.topics[2]?.slice(26) || ""}`;
        if (tokenAddress.length === 42) break;
      }
    }
  }

  // Fallback: scan all logs for address-like topics
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
 * Buy $CLAW tokens on nad.fun via BondingCurveRouter.buy()
 *
 * Sends MON as msg.value, receives tokens.
 * The router handles fee calculation internally.
 */
export async function buyClawTokens(
  tokenAddress: string,
  amountMON: bigint
): Promise<string> {
  if (!walletClient || !walletClient.account) {
    throw new Error("Operator wallet not configured");
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const txHash = await walletClient.writeContract({
    address: NADFUN_CONTRACTS.CORE,
    abi: BONDING_CURVE_ROUTER_ABI,
    functionName: "buy",
    args: [
      {
        amountOutMin: BigInt(0), // no slippage protection
        token: tokenAddress as Hex,
        to: walletClient.account.address,
        deadline,
      },
    ],
    value: amountMON,
    chain: monad,
    account: walletClient.account,
  });

  nadfunLogger.info(`Buy TX submitted: ${txHash}`);
  return txHash;
}

/**
 * Sell $CLAW tokens on nad.fun via BondingCurveRouter.sell()
 *
 * Requires prior ERC20 approve() for the router.
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
    abi: BONDING_CURVE_ROUTER_ABI,
    functionName: "sell",
    args: [
      {
        amountIn: tokenAmount,
        amountOutMin: BigInt(0), // no slippage protection
        token: tokenAddress as Hex,
        to: walletClient.account.address,
        deadline,
      },
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
    `${NADFUN_API_BASE}/token/${tokenAddress}`
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
    `${NADFUN_API_BASE}/token/market/${tokenAddress}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.status}`);
  }
  return response.json();
}
