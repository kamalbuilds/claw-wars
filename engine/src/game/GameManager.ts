import { GameRoom, GameResult } from "./GameRoom.js";
import { createGameOnChain, joinGameOnChain } from "../chain/contract.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

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

    // Wire up game events for logging
    room.on("gameEnd", (gameId: string, result: GameResult) => {
      managerLogger.info(
        `Game ${gameId} ended with result: ${result === GameResult.CrewmatesWin ? "Crewmates Win" : "Impostor Wins"}`
      );
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
      totalGames: this.games.size,
      activeGames: activeGames.length,
      totalPlayers,
    };
  }
}

export const gameManager = new GameManager();
