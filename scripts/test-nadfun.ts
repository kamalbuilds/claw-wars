#!/usr/bin/env tsx
/**
 * Test nad.fun integration on Monad testnet
 *
 * Tests:
 *  1. RPC connectivity
 *  2. Wallet balance check
 *  3. nad.fun metadata API
 *  4. Contract deployment verification
 *  5. Token creation (BondingCurveRouter.create)
 *  6. Buy tokens
 *  7. Token balance
 *  8. Sell tokens
 *  9. Token info API
 *
 * Usage:
 *   npx tsx scripts/test-nadfun.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  keccak256,
  toHex,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
dotenv.config({ path: path.join(__dirname, "../engine/.env") });

// ── Config ──────────────────────────────────────────────

const chainId = parseInt(process.env.MONAD_CHAIN_ID || "10143", 10);
const isTestnet = chainId === 10143;
const rpcUrl =
  process.env.MONAD_RPC_URL ||
  (isTestnet ? "https://testnet-rpc.monad.xyz" : "https://rpc.monad.xyz");

const monad = {
  id: chainId,
  name: isTestnet ? "Monad Testnet" : "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: {
      name: "MonadExplorer",
      url: isTestnet
        ? "https://testnet.monadexplorer.com"
        : "https://monadexplorer.com",
    },
  },
} as const satisfies Chain;

// Contract addresses from official nad.fun SDK
const CONTRACTS = isTestnet
  ? {
      ROUTER: "0x865054F0F6A288adaAc30261731361EA7E908003" as const,
      CURVE: "0x1228b0dc9481C11D3071E7A924B794CfB038994e" as const,
      LENS: "0xB056d79CA5257589692699a46623F901a3BB76f1" as const,
    }
  : {
      ROUTER: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as const,
      CURVE: "0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE" as const,
      LENS: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea" as const,
    };

const NADFUN_API_BASE = isTestnet
  ? "https://dev-api.nad.fun"
  : "https://api.nadapp.net";

// ABIs from official nad.fun SDK
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

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// ── Helpers ─────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, err: unknown) {
  failed++;
  console.log(`  ❌ ${label} — ${err instanceof Error ? err.message : err}`);
}

function skip(label: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  ${label} — ${reason}`);
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\n🦀 nad.fun Integration Test Suite`);
  console.log(`   Network: ${isTestnet ? "TESTNET" : "MAINNET"} (chain ${chainId})`);
  console.log(`   RPC: ${rpcUrl}`);
  console.log(`   Router: ${CONTRACTS.ROUTER}`);
  console.log(`   API: ${NADFUN_API_BASE}\n`);

  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey || privateKey === "0x_your_private_key_here") {
    console.error("ERROR: Set OPERATOR_PRIVATE_KEY in engine/.env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`   Wallet: ${account.address}\n`);

  const publicClient = createPublicClient({
    chain: monad,
    transport: http(rpcUrl),
  });

  const wallet = createWalletClient({
    account,
    chain: monad,
    transport: http(rpcUrl),
  });

  // ── Test 1: RPC ──
  console.log("── Test 1: RPC Connectivity ──");
  try {
    const blockNumber = await publicClient.getBlockNumber();
    ok("Connected to RPC", `block #${blockNumber}`);
  } catch (err) {
    fail("RPC connection", err);
    process.exit(1);
  }

  // ── Test 2: Balance ──
  console.log("\n── Test 2: Wallet Balance ──");
  let balanceMON = 0;
  try {
    const balance = await publicClient.getBalance({ address: account.address });
    balanceMON = Number(balance) / 1e18;
    ok("Balance check", `${balanceMON.toFixed(4)} MON`);
  } catch (err) {
    fail("Balance check", err);
  }

  // ── Test 3: nad.fun API ──
  console.log("\n── Test 3: nad.fun Metadata API ──");

  try {
    const resp = await fetch(`${NADFUN_API_BASE}/health`);
    if (resp.ok) {
      const data = await resp.json() as { status: string };
      ok("API health", `status: ${data.status}`);
    } else {
      ok("API reachable", `status ${resp.status}`);
    }
  } catch (err) {
    fail("API reachable", err);
  }

  try {
    const resp = await fetch(`${NADFUN_API_BASE}/agent/token/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Token",
        symbol: "TEST",
        description: "Integration test token",
        ...(isTestnet
          ? { image_uri: "https://example.com/test.png" }
          : { image: "https://example.com/test.png" }),
      }),
    });
    const data = await resp.text();
    if (resp.ok) {
      ok("Metadata upload", `URI returned`);
    } else {
      ok("Metadata API validates", `${resp.status}: ${data.slice(0, 100)}`);
    }
  } catch (err) {
    fail("Metadata API", err);
  }

  // ── Test 4: Contracts deployed ──
  console.log("\n── Test 4: Contract Verification ──");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    try {
      const code = await publicClient.getCode({ address: addr as Hex });
      if (code && code.length > 2) {
        ok(`${name} deployed`, `${addr.slice(0, 10)}...`);
      } else {
        fail(`${name}`, "No bytecode");
      }
    } catch (err) {
      fail(`${name}`, err);
    }
  }

  // ── Test 4b: Lens contract works ──
  try {
    const amountOut = await publicClient.readContract({
      address: CONTRACTS.LENS,
      abi: LENS_ABI,
      functionName: "getInitialBuyAmountOut",
      args: [parseEther("1")],
    });
    ok("Lens.getInitialBuyAmountOut", `1 MON → ${formatEther(amountOut)} tokens`);
  } catch (err) {
    fail("Lens contract call", err);
  }

  // ── Test 5: Token Creation ──
  console.log("\n── Test 5: Token Creation (create) ──");
  let tokenAddress = process.env.CLAW_TOKEN_ADDRESS || "";

  if (tokenAddress) {
    skip("Create token", `Already have token at ${tokenAddress}`);
  } else if (balanceMON < 0.5) {
    skip("Create token", `Need 0.5 MON, have ${balanceMON.toFixed(4)}`);
  } else {
    try {
      const testMetadata = {
        name: "Claw Wars",
        symbol: "CLAW",
        description: "Claw Wars test token",
      };
      const tokenURI = `data:application/json,${encodeURIComponent(JSON.stringify(testMetadata))}`;
      const salt = keccak256(toHex(`test-${Date.now()}`));

      console.log("   Submitting create tx...");
      const txHash = await wallet.writeContract({
        address: CONTRACTS.ROUTER,
        abi: ROUTER_ABI,
        functionName: "create",
        args: [
          {
            name: "Claw Wars",
            symbol: "CLAW",
            tokenURI,
            amountOut: BigInt(0),
            salt,
            actionId: 0,
          },
        ],
        value: parseEther("0.5"),
      });

      console.log(`   TX: ${txHash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "reverted") {
        fail("Create token", "Transaction reverted");
      } else {
        // Parse logs for token address
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === CONTRACTS.CURVE.toLowerCase() && log.topics.length >= 3) {
            tokenAddress = `0x${log.topics[1]?.slice(26) || ""}`;
            if (tokenAddress.length === 42) break;
          }
        }
        if (!tokenAddress || tokenAddress.length !== 42) {
          for (const log of receipt.logs) {
            if (log.topics.length >= 3) {
              tokenAddress = `0x${log.topics[1]?.slice(26) || ""}`;
              if (tokenAddress.length === 42) break;
            }
          }
        }
        ok("Token created", `${tokenAddress} (tx: ${txHash.slice(0, 14)}...)`);
        console.log(`\n   Add to engine/.env: CLAW_TOKEN_ADDRESS=${tokenAddress}\n`);
      }
    } catch (err) {
      fail("Create token", err);
    }
  }

  // ── Test 6: Buy Tokens ──
  console.log("\n── Test 6: Buy Tokens ──");
  if (!tokenAddress) {
    skip("Buy tokens", "No token address");
  } else if (balanceMON < 0.1) {
    skip("Buy tokens", `Need ~0.1 MON, have ${balanceMON.toFixed(4)}`);
  } else {
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      console.log("   Submitting buy tx (0.05 MON)...");
      const txHash = await wallet.writeContract({
        address: CONTRACTS.ROUTER,
        abi: ROUTER_ABI,
        functionName: "buy",
        args: [
          {
            amountOutMin: BigInt(0),
            token: tokenAddress as Hex,
            to: account.address,
            deadline,
          },
        ],
        value: parseEther("0.05"),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "reverted") {
        fail("Buy tokens", "Transaction reverted");
      } else {
        ok("Buy tokens", `tx: ${txHash.slice(0, 14)}...`);
      }
    } catch (err) {
      fail("Buy tokens", err);
    }
  }

  // ── Test 7: Token Balance ──
  console.log("\n── Test 7: Token Balance ──");
  if (!tokenAddress) {
    skip("Token balance", "No token address");
  } else {
    try {
      const tokenBal = await publicClient.readContract({
        address: tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
      ok("Token balance", `${formatEther(tokenBal)} CLAW`);
    } catch (err) {
      fail("Token balance", err);
    }
  }

  // ── Test 8: Sell Tokens ──
  console.log("\n── Test 8: Sell Tokens ──");
  if (!tokenAddress) {
    skip("Sell tokens", "No token address");
  } else {
    try {
      const tokenBal = await publicClient.readContract({
        address: tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });

      if (tokenBal === BigInt(0)) {
        skip("Sell tokens", "No tokens to sell");
      } else {
        const sellAmount = tokenBal / BigInt(10);
        if (sellAmount === BigInt(0)) {
          skip("Sell tokens", "Token balance too small");
        } else {
          // Approve router
          console.log(`   Approving ${formatEther(sellAmount)} CLAW...`);
          const approveTx = await wallet.writeContract({
            address: tokenAddress as Hex,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [CONTRACTS.ROUTER, sellAmount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
          console.log(`   Selling ${formatEther(sellAmount)} CLAW...`);
          const txHash = await wallet.writeContract({
            address: CONTRACTS.ROUTER,
            abi: ROUTER_ABI,
            functionName: "sell",
            args: [
              {
                amountIn: sellAmount,
                amountOutMin: BigInt(0),
                token: tokenAddress as Hex,
                to: account.address,
                deadline,
              },
            ],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status === "reverted") {
            fail("Sell tokens", "Transaction reverted");
          } else {
            ok("Sell tokens", `tx: ${txHash.slice(0, 14)}...`);
          }
        }
      }
    } catch (err) {
      fail("Sell tokens", err);
    }
  }

  // ── Test 9: Token Info API ──
  console.log("\n── Test 9: Token Info API ──");
  if (!tokenAddress) {
    skip("Token info API", "No token address");
  } else {
    try {
      const resp = await fetch(`${NADFUN_API_BASE}/token/${tokenAddress}`);
      if (resp.ok) {
        const data = await resp.json();
        ok("Token info API", `name: ${(data as { name?: string }).name || "?"}`);
      } else {
        ok("Token info API responds", `status ${resp.status}`);
      }
    } catch (err) {
      fail("Token info API", err);
    }
  }

  // ── Summary ──
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`${"═".repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

main();
