import { GameRoom, GameResult } from "./GameRoom.js";
import { createGameOnChain, joinGameOnChain } from "../chain/contract.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  saveCompletedGame,
  loadCompletedGames,
  type StoredGame,
} from "../persistence/gameStore.js";

const managerLogger = logger.child("GameManager");

export interface CreateGameOptions {
  stake?: bigint;
  minPlayers?: number;
  maxPlayers?: number;
  impostorCount?: number;
  maxRounds?: number;
  onChainEnabled?: boolean;
}

class GameManager {
  private games = new Map<string, GameRoom>();
  private playerGames = new Map<string, Set<string>>();
  private completedFromDb: StoredGame[] = [];

  /** Load completed games from DB on startup */
  async initialize(): Promise<void> {
    this.completedFromDb = await loadCompletedGames();
    managerLogger.info(
      `Loaded ${this.completedFromDb.length} completed games from database`
    );
  }

  /** Get DB-loaded completed games (for API routes) */
  getCompletedGamesFromDb(): StoredGame[] {
    return this.completedFromDb;
  }

  async createGame(options: CreateGameOptions = {}): Promise<GameRoom> {
    const stake = options.stake || config.game.defaultStake;
    const minPlayers = options.minPlayers || config.game.minPlayers;
    const maxPlayers = options.maxPlayers || config.game.maxPlayers;
    const impostorCount = options.impostorCount || config.game.impostorCount;
    const maxRounds = options.maxRounds || config.game.maxRounds;
    const onChainEnabled = options.onChainEnabled !== false;

    let chainGameId: bigint | undefined;

    // Create game on-chain if enabled (non-blocking to avoid request timeouts)
    if (onChainEnabled && config.contracts.game) {
      chainGameId = BigInt(Date.now());
      // Fire-and-forget: don't block game creation on chain TX
      createGameOnChain(
        stake,
        minPlayers,
        maxPlayers,
        impostorCount,
        maxRounds
      ).then((txHash) => {
        managerLogger.info(`Game created on-chain: ${txHash}`);
      }).catch((err) => {
        managerLogger.warn("On-chain game creation failed (non-blocking)", err instanceof Error ? err.message : String(err));
      });
    }

    const room = new GameRoom({
      stake,
      minPlayers,
      maxPlayers,
      impostorCount,
      maxRounds,
      chainGameId,
      onChainEnabled,
    });

    this.games.set(room.gameId, room);

    // Wire up game events for logging + persistence
    room.on("gameEnd", (gameId: string, result: GameResult) => {
      managerLogger.info(
        `Game ${gameId} ended with result: ${result === GameResult.CrewmatesWin ? "Crewmates Win" : "Impostor Wins"}`
      );

      // Persist to DB (fire-and-forget)
      saveCompletedGame(room).catch((err) => {
        managerLogger.error(
          `Failed to persist game ${gameId}`,
          err instanceof Error ? err.message : err
        );
      });
    });

    managerLogger.info(
      `Game created: ${room.gameId} (stake: ${stake.toString()}, players: ${minPlayers}-${maxPlayers})`
    );

    return room;
  }

  async joinGame(
    gameId: string,
    address: `0x${string}`,
    name: string
  ): Promise<boolean> {
    const room = this.games.get(gameId);
    if (!room) {
      managerLogger.warn(`Game ${gameId} not found`);
      return false;
    }

    const joined = room.addPlayer(address, name);
    if (!joined) return false;

    // Track player -> games mapping
    const normalized = address.toLowerCase();
    if (!this.playerGames.has(normalized)) {
      this.playerGames.set(normalized, new Set());
    }
    this.playerGames.get(normalized)!.add(gameId);

    // Join on-chain (non-blocking — don't delay the API response)
    if (room.chainGameId !== null) {
      joinGameOnChain(room.chainGameId, config.game.defaultStake).catch((err) => {
        managerLogger.warn("On-chain join failed (non-blocking)", err instanceof Error ? err.message : String(err));
      });
    }

    // Auto-start if enough players (5-second delay to allow more joins)
    if (room.canStart()) {
      setTimeout(async () => {
        if (room.canStart()) {
          managerLogger.info(`Auto-starting game ${gameId}`);
          try {
            await room.start();
          } catch (err) {
            managerLogger.error(`Failed to auto-start game ${gameId}`, err);
          }
        }
      }, 5000);
    }

    return true;
  }

  getGame(gameId: string): GameRoom | undefined {
    return this.games.get(gameId);
  }

  getActiveGames(): GameRoom[] {
    return Array.from(this.games.values()).filter(
      (g) => g.result === GameResult.Ongoing
    );
  }

  getAllGames(): GameRoom[] {
    return Array.from(this.games.values());
  }

  getGamesByPlayer(address: `0x${string}`): GameRoom[] {
    const normalized = address.toLowerCase();
    const gameIds = this.playerGames.get(normalized);
    if (!gameIds) return [];

    return Array.from(gameIds)
      .map((id) => this.games.get(id))
      .filter((g): g is GameRoom => g !== undefined);
  }

  removeGame(gameId: string): void {
    const room = this.games.get(gameId);
    if (!room) return;

    // Clean up player -> game mappings
    for (const player of room.players.values()) {
      const normalized = player.address.toLowerCase();
      const gameSet = this.playerGames.get(normalized);
      if (gameSet) {
        gameSet.delete(gameId);
        if (gameSet.size === 0) {
          this.playerGames.delete(normalized);
        }
      }
    }

    this.games.delete(gameId);
    managerLogger.info(`Game ${gameId} removed`);
  }

  getStats(): {
    totalGames: number;
    activeGames: number;
    totalPlayers: number;
  } {
    const activeGames = this.getActiveGames();
    const totalPlayers = activeGames.reduce(
      (sum, g) => sum + g.getPlayerCount(),
      0
    );
    return {
      totalGames: this.games.size + this.completedFromDb.length,
      activeGames: activeGames.length,
      totalPlayers,
    };
  }

  /** Look up player name from any game they've been in */
  getPlayerName(address: `0x${string}`): string | null {
    const normalized = address.toLowerCase();
    for (const game of this.games.values()) {
      const player = game.players.get(normalized as `0x${string}`);
      if (player) return player.name;
    }
    // Also check DB games
    for (const sg of this.completedFromDb) {
      const found = sg.players.find(
        (p) => p.address.toLowerCase() === normalized
      );
      if (found) return found.name;
    }
    return null;
  }

  /** Build leaderboard from locally tracked completed games */
  getLocalLeaderboard(): Array<{
    rank: number;
    address: string;
    name: string;
    elo: number;
    gamesPlayed: number;
    wins: number;
    winRate: number;
    impostorWinRate: number;
    earnings: string;
  }> {
    const stats = new Map<string, {
      address: string;
      name: string;
      gamesPlayed: number;
      wins: number;
      impostorGames: number;
      impostorWins: number;
    }>();

    for (const game of this.games.values()) {
      if (game.result === GameResult.Ongoing) continue;

      const winners = game.result === GameResult.CrewmatesWin
        ? Array.from(game.players.values()).filter((p) => p.role.toString() !== "Impostor")
        : Array.from(game.players.values()).filter((p) => p.role.toString() === "Impostor");
      const winnerAddrs = new Set(winners.map((w) => w.address.toLowerCase()));

      for (const player of game.players.values()) {
        const key = player.address.toLowerCase();
        if (!stats.has(key)) {
          stats.set(key, {
            address: player.address,
            name: player.name,
            gamesPlayed: 0,
            wins: 0,
            impostorGames: 0,
            impostorWins: 0,
          });
        }
        const s = stats.get(key)!;
        s.gamesPlayed++;
        if (winnerAddrs.has(key)) s.wins++;
        if (player.role.toString() === "Impostor") {
          s.impostorGames++;
          if (winnerAddrs.has(key)) s.impostorWins++;
        }
      }
    }

    return Array.from(stats.values())
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 20)
      .map((s, i) => ({
        rank: i + 1,
        address: s.address,
        name: s.name,
        elo: 1000 + s.wins * 25,
        gamesPlayed: s.gamesPlayed,
        wins: s.wins,
        winRate: s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : 0,
        impostorWinRate: s.impostorGames > 0 ? Math.round((s.impostorWins / s.impostorGames) * 100) : 0,
        earnings: "0.0000",
      }));
  }
}

export const gameManager = new GameManager();
