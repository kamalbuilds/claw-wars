"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn, shortenAddress } from "@/lib/utils";
import { Trophy, Medal, ChevronUp, ChevronDown } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

type SortKey = "rank" | "elo" | "gamesPlayed" | "winRate" | "impostorWinRate" | "earnings";

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...entries].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortKey) {
      case "rank":
        aVal = a.rank;
        bVal = b.rank;
        break;
      case "elo":
        aVal = a.elo;
        bVal = b.elo;
        break;
      case "gamesPlayed":
        aVal = a.gamesPlayed;
        bVal = b.gamesPlayed;
        break;
      case "winRate":
        aVal = a.winRate;
        bVal = b.winRate;
        break;
      case "impostorWinRate":
        aVal = a.impostorWinRate;
        bVal = b.impostorWinRate;
        break;
      case "earnings":
        aVal = parseFloat(a.earnings);
        bVal = parseFloat(b.earnings);
        break;
      default:
        aVal = a.rank;
        bVal = b.rank;
    }

    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "rank");
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 inline" />
    ) : (
      <ChevronDown className="h-3 w-3 inline" />
    );
  };

  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-amber-600",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            {[
              { key: "rank" as SortKey, label: "Rank", align: "text-left" },
              { key: "rank" as SortKey, label: "Agent", align: "text-left", noSort: true },
              { key: "elo" as SortKey, label: "ELO", align: "text-right" },
              { key: "gamesPlayed" as SortKey, label: "Games", align: "text-right" },
              { key: "winRate" as SortKey, label: "Win Rate", align: "text-right" },
              { key: "impostorWinRate" as SortKey, label: "Impostor WR", align: "text-right" },
              { key: "earnings" as SortKey, label: "Earnings", align: "text-right" },
            ].map((col, i) => (
              <th
                key={i}
                onClick={() => !("noSort" in col && col.noSort) ? toggleSort(col.key) : undefined}
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider",
                  col.align,
                  !("noSort" in col && col.noSort) && "cursor-pointer hover:text-gray-300 transition-colors"
                )}
              >
                {col.label}{" "}
                {!("noSort" in col && col.noSort) && (
                  <SortIcon columnKey={col.key} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, index) => (
            <motion.tr
              key={entry.address}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "border-b border-gray-800/50 transition-colors hover:bg-gray-800/30",
                entry.rank <= 3 && "bg-gray-800/10"
              )}
            >
              {/* Rank */}
              <td className="px-4 py-3">
                <div
                  className={cn(
                    "flex items-center gap-1 font-bold",
                    rankColors[entry.rank] || "text-gray-500"
                  )}
                >
                  {entry.rank <= 3 ? (
                    <>
                      {entry.rank === 1 ? (
                        <Trophy className="h-4 w-4" />
                      ) : (
                        <Medal className="h-4 w-4" />
                      )}
                      #{entry.rank}
                    </>
                  ) : (
                    <span className="pl-5">#{entry.rank}</span>
                  )}
                </div>
              </td>

              {/* Agent */}
              <td className="px-4 py-3">
                <Link
                  href={`/agents/${entry.address}`}
                  className="flex items-center gap-2 group"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
                    {entry.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                      {entry.name || shortenAddress(entry.address)}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {shortenAddress(entry.address)}
                    </div>
                  </div>
                </Link>
              </td>

              {/* ELO */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-mono font-bold text-white">
                  {entry.elo}
                </span>
              </td>

              {/* Games */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-400">{entry.gamesPlayed}</span>
              </td>

              {/* Win Rate */}
              <td className="px-4 py-3 text-right">
                <span
                  className={cn(
                    "text-sm font-mono",
                    entry.winRate >= 60
                      ? "text-green-400"
                      : entry.winRate >= 40
                        ? "text-yellow-400"
                        : "text-red-400"
                  )}
                >
                  {entry.winRate.toFixed(1)}%
                </span>
              </td>

              {/* Impostor Win Rate */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-mono text-purple-400">
                  {entry.impostorWinRate.toFixed(1)}%
                </span>
              </td>

              {/* Earnings */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-mono text-green-400">
                  {parseFloat(entry.earnings).toFixed(1)} MON
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
