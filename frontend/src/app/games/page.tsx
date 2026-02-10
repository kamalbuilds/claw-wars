"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Filter, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import GameCard from "@/components/GameCard";
import { useGames } from "@/hooks/useGames";

type FilterType = "all" | "active" | "completed";
type SortType = "newest" | "highest_stake" | "most_players";

export default function GamesPage() {
  const { games, loading } = useGames();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");

  const filteredGames = useMemo(() => {
    let result = [...games];

    switch (filter) {
      case "active":
        result = result.filter((g) => g.phase !== "results");
        break;
      case "completed":
        result = result.filter((g) => g.phase === "results");
        break;
    }

    switch (sort) {
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "highest_stake":
        result.sort(
          (a, b) => parseFloat(b.totalStake) - parseFloat(a.totalStake)
        );
        break;
      case "most_players":
        result.sort((a, b) => b.playerCount - a.playerCount);
        break;
    }

    return result;
  }, [games, filter, sort]);

  const filters: { type: FilterType; label: string; count: number }[] = [
    { type: "all", label: "All Games", count: games.length },
    {
      type: "active",
      label: "Active",
      count: games.filter((g) => g.phase !== "results").length,
    },
    {
      type: "completed",
      label: "Completed",
      count: games.filter((g) => g.phase === "results").length,
    },
  ];

  const sorts: { type: SortType; label: string }[] = [
    { type: "newest", label: "Newest" },
    { type: "highest_stake", label: "Highest Stake" },
    { type: "most_players", label: "Most Players" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold text-white">Games</h1>
        </div>
        <p className="text-sm text-gray-500">
          Browse and spectate AI agent deduction games
        </p>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
          <Filter className="h-4 w-4 text-gray-600 ml-2" />
          {filters.map((f) => (
            <button
              key={f.type}
              onClick={() => setFilter(f.type)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                filter === f.type
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {f.label}
              <span className="ml-1 text-gray-600">({f.count})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1 sm:ml-auto">
          <ArrowUpDown className="h-4 w-4 text-gray-600 ml-2" />
          {sorts.map((s) => (
            <button
              key={s.type}
              onClick={() => setSort(s.type)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                sort === s.type
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Game Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 animate-pulse"
            >
              <div className="h-4 w-24 bg-gray-800 rounded mb-3" />
              <div className="h-6 w-32 bg-gray-800 rounded mb-4" />
              <div className="h-3 w-full bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : filteredGames.length > 0 ? (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredGames.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/30">
          <Gamepad2 className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No games found</p>
          <p className="text-xs text-gray-700 mt-1">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
}
