import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";
import {
  registerArenaOnChain,
  setArenaActiveOnChain,
  recordArenaGamePlayedOnChain,
} from "../chain/colosseum-contract.js";
import { walletClient } from "../chain/client.js";

const arenaLogger = logger.child("ArenaFramework");

export interface ArenaType {
  id: number;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultStake: bigint;
  active: boolean;
  gamesPlayed: number;
  totalVolume: bigint;
  createdAt: number;
}

export interface ArenaGameConfig {
  arenaType: number;
  stake: bigint;
  minPlayers: number;
  maxPlayers: number;
  options: Record<string, unknown>;
}

/**
 * ArenaFramework manages the registry of game types ("arenas") in the Colosseum.
 * Each arena defines rules for a different game type. Currently:
 *  - Arena 0: Social Deduction (Among Claws) — the original game
 *  - Arena 1+: Future game types (trivia, strategy, trading, etc.)
 */
class ArenaFramework extends EventEmitter {
  private arenas = new Map<number, ArenaType>();
  private nextId = 0;

  constructor() {
    super();
    // Register the default Social Deduction arena
    this.registerArena({
      name: "Social Deduction",
      description: "Among Claws - AI agents play social deduction. Find the impostor before it's too late!",
      minPlayers: 5,
      maxPlayers: 8,
      defaultStake: 500000000000000000n, // 0.5 MON
    });
  }

  registerArena(config: {
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    defaultStake: bigint;
  }): ArenaType {
    const id = this.nextId++;

    const arena: ArenaType = {
      id,
      name: config.name,
      description: config.description,
      minPlayers: config.minPlayers,
      maxPlayers: config.maxPlayers,
      defaultStake: config.defaultStake,
      active: true,
      gamesPlayed: 0,
      totalVolume: 0n,
      createdAt: Date.now(),
    };

    this.arenas.set(id, arena);
    this.emit("arenaRegistered", arena);
    arenaLogger.info(`Arena registered: ${id} - ${config.name}`);

    // Register on-chain (non-blocking)
    if (walletClient) {
      registerArenaOnChain(
        config.name,
        config.description,
        BigInt(config.minPlayers),
        BigInt(config.maxPlayers),
        config.defaultStake
      )
        .then((hash) => {
          if (hash) arenaLogger.info(`Arena ${id} on-chain register tx: ${hash}`);
        })
        .catch((err) => arenaLogger.error(`Arena ${id} on-chain register failed`, err));
    }

    return arena;
  }

  getArena(id: number): ArenaType | undefined {
    return this.arenas.get(id);
  }

  getActiveArenas(): ArenaType[] {
    return Array.from(this.arenas.values()).filter((a) => a.active);
  }

  getAllArenas(): ArenaType[] {
    return Array.from(this.arenas.values());
  }

  setArenaActive(id: number, active: boolean): boolean {
    const arena = this.arenas.get(id);
    if (!arena) return false;
    arena.active = active;
    this.emit("arenaUpdated", id, active);

    // Sync on-chain (non-blocking)
    if (walletClient) {
      setArenaActiveOnChain(BigInt(id), active).catch((err) =>
        arenaLogger.error(`Arena ${id} on-chain setActive failed`, err)
      );
    }

    return true;
  }

  recordGamePlayed(arenaId: number, volume: bigint): void {
    const arena = this.arenas.get(arenaId);
    if (!arena) return;
    arena.gamesPlayed++;
    arena.totalVolume += volume;
    this.emit("arenaStatsUpdated", arenaId);

    // Sync on-chain (non-blocking)
    if (walletClient) {
      recordArenaGamePlayedOnChain(BigInt(arenaId), volume).catch((err) =>
        arenaLogger.error(`Arena ${arenaId} on-chain recordGamePlayed failed`, err)
      );
    }
  }

  getState(): object {
    return {
      arenas: this.getAllArenas().map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        minPlayers: a.minPlayers,
        maxPlayers: a.maxPlayers,
        defaultStake: a.defaultStake.toString(),
        active: a.active,
        gamesPlayed: a.gamesPlayed,
        totalVolume: a.totalVolume.toString(),
      })),
      totalArenas: this.arenas.size,
      activeArenas: this.getActiveArenas().length,
    };
  }
}

export const arenaFramework = new ArenaFramework();
