import { parseEther } from "viem";

// ─── Contract Addresses ───
export const BETTING_CONTRACT =
  (process.env.NEXT_PUBLIC_BETTING_CONTRACT as `0x${string}`) ||
  "0x0aE8E4023C7761Ca53d25EB33006F1f85B1eFa81";

export const GAME_CONTRACT =
  (process.env.NEXT_PUBLIC_GAME_CONTRACT as `0x${string}`) ||
  "0x03a91b6b9cef690A9c554E72B6f7ab81cDf722e4";

// ─── Betting Contract ABI (only the functions we need) ───
export const BETTING_ABI = [
  {
    name: "placeBet",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "betType", type: "uint8" },
      { name: "predictedAgent", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getPoolSizes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "lobstersPool", type: "uint256" },
      { name: "impostorPool", type: "uint256" },
      { name: "specificPool", type: "uint256" },
    ],
  },
  {
    name: "getBetCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pools",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "totalLobstersPool", type: "uint256" },
      { name: "totalImpostorPool", type: "uint256" },
      { name: "totalSpecificPool", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "result", type: "uint8" },
      { name: "revealedImpostor", type: "address" },
    ],
  },
] as const;

// ─── Bet Type Mapping ───
export const BET_TYPE_MAP = {
  lobsters_win: 0,
  impostor_wins: 1,
  specific_agent: 2,
} as const;

// ─── Helpers ───

/** Convert a UUID game ID to a uint256 for the contract.
 *  Uses the last 8 hex chars of the UUID as the numeric game ID.
 *  This matches how the engine maps off-chain UUIDs to on-chain IDs. */
export function gameIdToUint256(gameId: string): bigint {
  // If it's already a number, use it directly
  const num = Number(gameId);
  if (!isNaN(num) && num >= 0) return BigInt(num);

  // For UUIDs, hash to a deterministic uint256
  const hex = gameId.replace(/-/g, "");
  // Use last 16 hex chars to stay within safe range
  const trimmed = hex.slice(-16);
  return BigInt("0x" + trimmed);
}

/** Convert MON string amount to wei (bigint) */
export function monToWei(amount: string): bigint {
  try {
    return parseEther(amount);
  } catch {
    return BigInt(0);
  }
}
