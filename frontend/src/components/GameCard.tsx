"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  cn,
  formatMON,
  formatTime,
  getPhaseColor,
  getPhaseBgColor,
} from "@/lib/utils";
import { Users, Coins, Clock, Trophy } from "lucide-react";
import type { GameSummary } from "@/lib/types";

interface GameCardProps {
  game: GameSummary;
  index: number;
}

export default function GameCard({ game, index }: GameCardProps) {
  const isActive = game.phase !== "results";
  const isLive = isActive && game.phase !== "lobby";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Link href={`/games/${game.id}`}>
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl border bg-gray-900/50 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-600 hover:shadow-lg hover:shadow-black/20 cursor-pointer",
            isActive ? "border-gray-700" : "border-gray-800"
          )}
        >
          {/* Live indicator */}
          {isLive && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <motion.div
                className="h-2 w-2 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                Live
              </span>
            </div>
          )}

          {/* Winner badge */}
          {game.winner && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  game.winner === "lobsters"
                    ? "text-green-400"
                    : "text-purple-400"
                )}
              >
                {game.winner === "lobsters" ? "Lobsters Win" : "Impostor Wins"}
              </span>
            </div>
          )}

          {/* Game ID */}
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
              Game #{game.id.split("-").pop() || game.id.slice(-6)}
            </h3>
          </div>

          {/* Phase badge */}
          <div className="mb-4">
            <motion.div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                getPhaseBgColor(game.phase)
              )}
              animate={
                game.phase === "voting"
                  ? { scale: [1, 1.02, 1] }
                  : {}
              }
              transition={{ duration: 1, repeat: Infinity }}
            >
              <span className={getPhaseColor(game.phase)}>
                {game.phase.charAt(0).toUpperCase() + game.phase.slice(1)}
              </span>
              {game.timeRemaining > 0 && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-400 font-mono">
                    {formatTime(game.timeRemaining)}
                  </span>
                </>
              )}
            </motion.div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">
                <span className="text-white font-semibold">
                  {game.playerCount}
                </span>
                /{game.maxPlayers}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">
                <span className="text-white font-semibold">
                  {formatMON(game.totalStake)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">
                R<span className="text-white font-semibold">{game.round}</span>
              </span>
            </div>
          </div>

          {/* Hover glow */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-red-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}
