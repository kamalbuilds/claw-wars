import { Router, type Request, type Response } from "express";
import { gameManager } from "../game/GameManager.js";
import { wireGameEvents } from "../ws/server.js";
import { wireMoltbookEvents } from "../moltbook/MoltbookBroadcaster.js";
import {
  authMiddleware,
  verifySignature,
  buildSignatureMessage,
  type AuthenticatedRequest,
} from "../utils/auth.js";
import { getAgentStats, getTopAgents, placeBetOnChain } from "../chain/contract.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const routeLogger = logger.child("API");
const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ──────────────────────────────────────────
// POST /api/games - Create new game
// ──────────────────────────────────────────
router.post("/api/games", async (req: Request, res: Response) => {
  try {
    const {
      stake,
      minPlayers,
      maxPlayers,
      impostorCount,
      maxRounds,
    } = req.body;

    const room = await gameManager.createGame({
      stake: stake ? BigInt(stake) : undefined,
      minPlayers: minPlayers ? parseInt(minPlayers, 10) : undefined,
      maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : undefined,
      impostorCount: impostorCount ? parseInt(impostorCount, 10) : undefined,
      maxRounds: maxRounds ? parseInt(maxRounds, 10) : undefined,
    });

    // Wire WebSocket + Moltbook events
    wireGameEvents(room);
    wireMoltbookEvents(room);

    routeLogger.info(`Game created via API: ${room.gameId}`);

    res.status(201).json({
      gameId: room.gameId,
      chainGameId: room.chainGameId?.toString() || null,
      phase: "Lobby",
      players: 0,
    });
  } catch (err) {
    routeLogger.error("Failed to create game", err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// ──────────────────────────────────────────
// GET /api/games - List active games
// ──────────────────────────────────────────
router.get("/api/games", (_req: Request, res: Response) => {
  try {
    const games = gameManager.getActiveGames().map((g) => ({
      gameId: g.gameId,
      chainGameId: g.chainGameId?.toString() || null,
      phase: g.phase,
      playerCount: g.getPlayerCount(),
      aliveCount: g.getAliveCount(),
      roundNumber: g.roundNumber,
      spectatorCount: g.spectators.size,
    }));

    res.json({ games, count: games.length });
  } catch (err) {
    routeLogger.error("Failed to list games", err);
    res.status(500).json({ error: "Failed to list games" });
  }
});

// ──────────────────────────────────────────
// GET /api/games/:id - Get game state
// ──────────────────────────────────────────
router.get("/api/games/:id", (req: Request, res: Response) => {
  try {
    const room = gameManager.getGame(getParam(req.params.id));
    if (!room) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const forAgent = req.query.agent as `0x${string}` | undefined;
    const state = room.getState(forAgent);

    // Serialize chainGameId
    res.json({
      ...state,
      chainGameId: state.chainGameId?.toString() || null,
    });
  } catch (err) {
    routeLogger.error("Failed to get game state", err);
    res.status(500).json({ error: "Failed to get game state" });
  }
});

// ──────────────────────────────────────────
// POST /api/games/:id/join - Join game
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/join",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      const address = req.authenticatedAddress!;

      if (!name || typeof name !== "string" || name.length < 1) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      const joined = await gameManager.joinGame(getParam(req.params.id), address, name);

      if (!joined) {
        res.status(400).json({ error: "Failed to join game" });
        return;
      }

      routeLogger.info(
        `${name} (${address}) joined game ${getParam(req.params.id)}`
      );

      res.json({
        success: true,
        gameId: getParam(req.params.id),
        address,
        name,
      });
    } catch (err) {
      routeLogger.error("Failed to join game", err);
      res.status(500).json({ error: "Failed to join game" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/start - Manually start game
// ──────────────────────────────────────────
router.post("/api/games/:id/start", async (req: Request, res: Response) => {
  try {
    const room = gameManager.getGame(getParam(req.params.id));
    if (!room) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    if (!room.canStart()) {
      res.status(400).json({
        error: "Cannot start game: not enough players or wrong phase",
      });
      return;
    }

    await room.start();

    res.json({
      success: true,
      gameId: room.gameId,
      phase: "Discussion",
      roundNumber: room.roundNumber,
      playerCount: room.getPlayerCount(),
    });
  } catch (err) {
    routeLogger.error("Failed to start game", err);
    res.status(500).json({ error: "Failed to start game" });
  }
});

// ──────────────────────────────────────────
// POST /api/games/:id/discuss - Submit message
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/discuss",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message } = req.body;
      const address = req.authenticatedAddress!;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const gameMessage = room.submitMessage(address, message);
      if (!gameMessage) {
        res.status(400).json({ error: "Cannot send message" });
        return;
      }

      res.json({ success: true, message: gameMessage });
    } catch (err) {
      routeLogger.error("Failed to submit message", err);
      res.status(500).json({ error: "Failed to submit message" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/investigate - Investigate agent
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/investigate",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { target } = req.body;
      const address = req.authenticatedAddress!;

      if (!target) {
        res.status(400).json({ error: "Target address is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const result = room.investigate(address, target as `0x${string}`);
      if (!result) {
        res.status(400).json({ error: "Cannot investigate" });
        return;
      }

      // Return result without accuracy info (agent sees reported result only)
      res.json({
        success: true,
        scanner: result.scanner,
        target: result.target,
        result: result.result,
      });
    } catch (err) {
      routeLogger.error("Failed to investigate", err);
      res.status(500).json({ error: "Failed to investigate" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/vote - Cast vote
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/vote",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { target } = req.body;
      const address = req.authenticatedAddress!;

      if (!target) {
        res.status(400).json({ error: "Target address is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const voted = room.submitVote(address, target as `0x${string}`);
      if (!voted) {
        res.status(400).json({ error: "Cannot vote" });
        return;
      }

      res.json({
        success: true,
        voter: address,
        target,
      });
    } catch (err) {
      routeLogger.error("Failed to cast vote", err);
      res.status(500).json({ error: "Failed to cast vote" });
    }
  }
);

// ──────────────────────────────────────────
// GET /api/agents/:address - Agent profile
// ──────────────────────────────────────────
router.get("/api/agents/:address", async (req: Request, res: Response) => {
  try {
    const address = getParam(req.params.address) as `0x${string}`;

    // Try to get on-chain stats
    if (config.contracts.leaderboard) {
      try {
        const stats = await getAgentStats(address);
        res.json({
          address,
          stats: {
            gamesPlayed: stats.gamesPlayed.toString(),
            gamesWon: stats.gamesWon.toString(),
            impostorGames: stats.impostorGames.toString(),
            impostorWins: stats.impostorWins.toString(),
            crewmateGames: stats.crewmateGames.toString(),
            crewmateWins: stats.crewmateWins.toString(),
            totalEarned: stats.totalEarned.toString(),
            totalStaked: stats.totalStaked.toString(),
          },
        });
        return;
      } catch {
        // Fall through to local data
      }
    }

    // Return local game data
    const games = gameManager.getGamesByPlayer(address);
    res.json({
      address,
      activeGames: games.filter((g) => g.result === 0).length,
      totalGames: games.length,
      stats: null,
    });
  } catch (err) {
    routeLogger.error("Failed to get agent profile", err);
    res.status(500).json({ error: "Failed to get agent profile" });
  }
});

// ──────────────────────────────────────────
// GET /api/leaderboard - Top agents
// ──────────────────────────────────────────
router.get("/api/leaderboard", async (_req: Request, res: Response) => {
  try {
    if (config.contracts.leaderboard) {
      try {
        const topAgents = await getTopAgents(BigInt(20));
        const leaderboard = (topAgents as readonly { agent: `0x${string}`; gamesWon: bigint; totalEarned: bigint }[]).map(
          (a) => ({
            agent: a.agent,
            gamesWon: a.gamesWon.toString(),
            totalEarned: a.totalEarned.toString(),
          })
        );
        res.json({ leaderboard });
        return;
      } catch {
        // Fall through
      }
    }

    // Return empty leaderboard if no on-chain data
    res.json({ leaderboard: [], message: "On-chain leaderboard not available" });
  } catch (err) {
    routeLogger.error("Failed to get leaderboard", err);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ──────────────────────────────────────────
// POST /api/bets - Place bet
// ──────────────────────────────────────────
router.post(
  "/api/bets",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId, betType, predictedAgent, amount } = req.body;
      const address = req.authenticatedAddress!;

      if (!gameId || betType === undefined || !amount) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const room = gameManager.getGame(gameId);
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      if (!config.contracts.betting) {
        res.status(503).json({ error: "Betting contract not configured" });
        return;
      }

      try {
        const txHash = await placeBetOnChain(
          BigInt(gameId),
          parseInt(betType, 10),
          (predictedAgent || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          BigInt(amount)
        );

        res.json({
          success: true,
          txHash,
          bettor: address,
          gameId,
          betType,
          amount,
        });
      } catch (err) {
        routeLogger.error("Failed to place bet on-chain", err);
        res.status(500).json({ error: "Failed to place bet on-chain" });
      }
    } catch (err) {
      routeLogger.error("Failed to place bet", err);
      res.status(500).json({ error: "Failed to place bet" });
    }
  }
);

// ──────────────────────────────────────────
// GET /api/stats - Engine stats
// ──────────────────────────────────────────
router.get("/api/stats", (_req: Request, res: Response) => {
  const stats = gameManager.getStats();
  res.json(stats);
});

// ──────────────────────────────────────────
// GET /api/health - Health check
// ──────────────────────────────────────────
router.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export { router };
