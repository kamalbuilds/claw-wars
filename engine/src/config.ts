import dotenv from "dotenv";
dotenv.config();

export const config = {
  monad: {
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    chainId: parseInt(process.env.MONAD_CHAIN_ID || "10143", 10),
  },
  operator: {
    privateKey: process.env.OPERATOR_PRIVATE_KEY || "",
  },
  contracts: {
    game: (process.env.GAME_CONTRACT_ADDRESS || "") as `0x${string}`,
    betting: (process.env.BETTING_CONTRACT_ADDRESS || "") as `0x${string}`,
    leaderboard: (process.env.LEADERBOARD_CONTRACT_ADDRESS || "") as `0x${string}`,
    tournament: (process.env.TOURNAMENT_CONTRACT_ADDRESS || "0x2fc3AE18e95812F0b2603F6be63Fed5f139A35e4") as `0x${string}`,
    season: (process.env.SEASON_CONTRACT_ADDRESS || "0xba7AA81EBbee3ec90F058730C777Ea8D8076113C") as `0x${string}`,
    agentNFT: (process.env.AGENT_NFT_CONTRACT_ADDRESS || "0x6BE8CA8E265d37Cbcb950c05074D61f2f1B6f7C2") as `0x${string}`,
    arenaRegistry: (process.env.ARENA_REGISTRY_CONTRACT_ADDRESS || "0x399a08bb490F6D573b115eA672f9EFcf36AD3ca7") as `0x${string}`,
  },
  moltbook: {
    apiUrl: process.env.MOLTBOOK_API_URL || "https://moltbook.com/api",
    apiKey: process.env.MOLTBOOK_API_KEY || "",
    submolt: process.env.MOLTBOOK_SUBMOLT || "general",
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
  database: {
    url: process.env.DATABASE_URL || "",
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
