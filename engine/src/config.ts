import dotenv from "dotenv";
dotenv.config();

export const config = {
  monad: {
    rpcUrl: process.env.MONAD_RPC_URL || "https://rpc.monad.xyz",
    chainId: parseInt(process.env.MONAD_CHAIN_ID || "143", 10),
  },
  operator: {
    privateKey: process.env.OPERATOR_PRIVATE_KEY || "",
  },
  contracts: {
    game: (process.env.GAME_CONTRACT_ADDRESS || "") as `0x${string}`,
    betting: (process.env.BETTING_CONTRACT_ADDRESS || "") as `0x${string}`,
    leaderboard: (process.env.LEADERBOARD_CONTRACT_ADDRESS || "") as `0x${string}`,
  },
  moltbook: {
    apiUrl: process.env.MOLTBOOK_API_URL || "https://moltbook.com/api",
    apiKey: process.env.MOLTBOOK_API_KEY || "",
    submolt: process.env.MOLTBOOK_SUBMOLT || "m/amongclaws",
  },
  claw: {
    tokenAddress: (process.env.CLAW_TOKEN_ADDRESS || "") as `0x${string}`,
  },
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    wsPort: parseInt(process.env.WS_PORT || "3002", 10),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  game: {
    defaultStake: BigInt(process.env.DEFAULT_STAKE || "500000000000000000"),
    minPlayers: parseInt(process.env.MIN_PLAYERS || "5", 10),
    maxPlayers: parseInt(process.env.MAX_PLAYERS || "8", 10),
    discussionDuration: parseInt(process.env.DISCUSSION_DURATION || "180", 10),
    votingDuration: parseInt(process.env.VOTING_DURATION || "60", 10),
    maxRounds: parseInt(process.env.MAX_ROUNDS || "5", 10),
    impostorCount: parseInt(process.env.IMPOSTOR_COUNT || "1", 10),
  },
} as const;
