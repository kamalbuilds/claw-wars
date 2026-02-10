"use client";

import { motion } from "framer-motion";
import { cn, formatTime, getPhaseColor, getPhaseBgColor } from "@/lib/utils";
import { Clock, MessageCircle, Vote, Skull, Trophy } from "lucide-react";
import type { GamePhase } from "@/lib/types";

interface PhaseTimerProps {
  phase: GamePhase;
  timeRemaining: number;
  round: number;
}

const phaseConfig: Record<
  GamePhase,
  { label: string; icon: typeof Clock; description: string }
> = {
  lobby: {
    label: "Lobby",
    icon: Clock,
    description: "Waiting for players...",
  },
  discussion: {
    label: "Discussion",
    icon: MessageCircle,
    description: "Agents are debating who the impostor is",
  },
  voting: {
    label: "Voting",
    icon: Vote,
    description: "Agents are casting their votes",
  },
  elimination: {
    label: "Elimination",
    icon: Skull,
    description: "Someone is about to be eliminated...",
  },
  results: {
    label: "Game Over",
    icon: Trophy,
    description: "The game has concluded",
  },
};

export default function PhaseTimer({
  phase,
  timeRemaining,
  round,
}: PhaseTimerProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  const isLowTime = timeRemaining > 0 && timeRemaining <= 10;
  const isVoting = phase === "voting";

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        getPhaseBgColor(phase)
      )}
      animate={
        isVoting
          ? {
              boxShadow: [
                "0 0 0 0 rgba(249, 115, 22, 0)",
                "0 0 20px 5px rgba(249, 115, 22, 0.3)",
                "0 0 0 0 rgba(249, 115, 22, 0)",
              ],
            }
          : {}
      }
      transition={{ duration: 2, repeat: Infinity }}
    >
      {/* Progress bar background */}
      {timeRemaining > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-white/10"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: timeRemaining, ease: "linear" }}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={
              isLowTime
                ? { scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }
                : isVoting
                  ? { rotate: [0, 5, -5, 0] }
                  : {}
            }
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Icon className={cn("h-6 w-6", getPhaseColor(phase))} />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn("text-lg font-bold", getPhaseColor(phase))}
              >
                {config.label}
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                Round {round}
              </span>
            </div>
            <p className="text-xs text-gray-400">{config.description}</p>
          </div>
        </div>

        {/* Timer */}
        {timeRemaining > 0 && (
          <motion.div
            className={cn(
              "text-2xl font-mono font-bold tabular-nums",
              isLowTime ? "text-red-400" : getPhaseColor(phase)
            )}
            animate={isLowTime ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {formatTime(timeRemaining)}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
