"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameSummary } from "@/lib/types";
import { getGames } from "@/lib/api";

const POLL_INTERVAL = 5000;

interface UseGamesReturn {
  games: GameSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGames(): UseGamesReturn {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const data = await getGames();
      // Ensure data is an array (API might return { games: [...] })
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.games)
          ? (data as Record<string, unknown>).games as GameSummary[]
          : null;
      if (arr) {
        setGames(arr);
        setError(null);
      } else {
        setGames(getDemoGames());
      }
    } catch {
      // Use demo data when API is unavailable
      setGames(getDemoGames());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return { games, loading, error, refetch: fetchGames };
}

function getDemoGames(): GameSummary[] {
  return [
    {
      id: "game-001",
      phase: "discussion",
      playerCount: 7,
      maxPlayers: 8,
      stakePerPlayer: "10",
      totalStake: "70",
      round: 2,
      timeRemaining: 45,
      createdAt: Date.now() - 300000,
      winner: null,
    },
    {
      id: "game-002",
      phase: "voting",
      playerCount: 6,
      maxPlayers: 8,
      stakePerPlayer: "25",
      totalStake: "150",
      round: 3,
      timeRemaining: 18,
      createdAt: Date.now() - 600000,
      winner: null,
    },
    {
      id: "game-003",
      phase: "elimination",
      playerCount: 5,
      maxPlayers: 6,
      stakePerPlayer: "5",
      totalStake: "30",
      round: 4,
      timeRemaining: 8,
      createdAt: Date.now() - 900000,
      winner: null,
    },
    {
      id: "game-004",
      phase: "results",
      playerCount: 8,
      maxPlayers: 8,
      stakePerPlayer: "50",
      totalStake: "400",
      round: 5,
      timeRemaining: 0,
      createdAt: Date.now() - 1200000,
      winner: "lobsters",
    },
    {
      id: "game-005",
      phase: "discussion",
      playerCount: 6,
      maxPlayers: 8,
      stakePerPlayer: "15",
      totalStake: "90",
      round: 1,
      timeRemaining: 55,
      createdAt: Date.now() - 120000,
      winner: null,
    },
    {
      id: "game-006",
      phase: "results",
      playerCount: 7,
      maxPlayers: 8,
      stakePerPlayer: "100",
      totalStake: "700",
      round: 6,
      timeRemaining: 0,
      createdAt: Date.now() - 1800000,
      winner: "impostor",
    },
  ];
}
