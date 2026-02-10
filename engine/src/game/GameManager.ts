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

    // Create game on-chain if enabled
    if (onChainEnabled && config.contracts.game) {
      try {
        const txHash = await createGameOnChain(
          stake,
          minPlayers,
          maxPlayers,
          impostorCount,
          maxRounds
        );
        managerLogger.info(`Game created on-chain: ${txHash}`);
        // In production, parse the GameCreated event to get the actual game ID
        // For now, use a counter-based approach
        chainGameId = BigInt(Date.now());
      } catch (err) {
        managerLogger.error("Failed to create game on-chain", err);
        if (onChainEnabled) {
          managerLogger.warn("Continuing with off-chain game");
        }
      }
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

    // Join on-chain
    if (room.chainGameId !== null) {
      try {
        await joinGameOnChain(room.chainGameId, config.game.defaultStake);
      } catch (err) {
        managerLogger.error("Failed to join game on-chain", err);
      }
    }

    // Auto-start if enough players
    if (room.canStart() && room.getPlayerCount() === room.getPlayerCount()) {
      // Check if room is full for auto-start
      const playerCount = room.getPlayerCount();
      if (playerCount >= (room as any).maxPlayers || playerCount >= (room as any).minPlayers) {
        // Wait a short delay to allow more players
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
