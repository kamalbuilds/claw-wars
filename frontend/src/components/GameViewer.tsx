"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatMON, shortenAddress, getAgentColor } from "@/lib/utils";
import {
  Users,
  Coins,
  Wifi,
  WifiOff,
  ArrowRight,
  Crown,
  Skull,
  Shield,
} from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import PhaseTimer from "./PhaseTimer";
import DiscussionMessage from "./DiscussionMessage";
import type { GameState, Player, ChatMessage, GamePhase } from "@/lib/types";

const PixiArena = dynamic(() => import("./game/PixiArena"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px]">
      <div className="animate-pulse text-gray-600 text-sm">Loading arena...</div>
    </div>
  ),
});

interface GameViewerProps {
  gameState: GameState | null;
  messages: ChatMessage[];
  phase: GamePhase | null;
  players: Player[];
  timeRemaining: number;
  connected: boolean;
  error: string | null;
  winner: "lobsters" | "impostor" | null;
}

/* ─── helper: phase accent config ─── */
function getPhaseAccent(phase: GamePhase | null) {
  switch (phase) {
    case "discussion":
      return {
        border: "border-green-500/20",
        glow: "phase-discussion",
        accent: "#22c55e",
        accentFaded: "rgba(34,197,94,0.08)",
        neonClass: "neon-green",
        glowClass: "glow-green",
        dotColor: "bg-green-400",
        label: "Discussion Phase",
      };
    case "voting":
      return {
        border: "border-orange-500/20",
        glow: "phase-voting",
        accent: "#fb923c",
        accentFaded: "rgba(251,146,60,0.08)",
        neonClass: "neon-orange",
        glowClass: "glow-orange",
        dotColor: "bg-orange-400",
        label: "Voting Phase",
      };
    case "elimination":
      return {
        border: "border-red-500/20",
        glow: "phase-elimination",
        accent: "#ef4444",
        accentFaded: "rgba(239,68,68,0.08)",
        neonClass: "neon-red",
        glowClass: "glow-red",
        dotColor: "bg-red-400",
        label: "Elimination Phase",
      };
    case "results":
      return {
        border: "border-purple-500/20",
        glow: "",
        accent: "#a855f7",
        accentFaded: "rgba(168,85,247,0.08)",
        neonClass: "neon-purple",
        glowClass: "glow-purple",
        dotColor: "bg-purple-400",
        label: "Results",
      };
    default:
      return {
        border: "border-gray-700/30",
        glow: "",
        accent: "#64748b",
        accentFaded: "rgba(100,116,139,0.05)",
        neonClass: "",
        glowClass: "",
        dotColor: "bg-gray-500",
        label: "Lobby",
      };
  }
}

/* ─── confetti particle colors ─── */
const CONFETTI_COLORS_LOBSTER = [
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#16a34a",
  "#34d399",
  "#10b981",
  "#a7f3d0",
  "#6ee7b7",
];
const CONFETTI_COLORS_IMPOSTOR = [
  "#a855f7",
  "#c084fc",
  "#e879f9",
  "#d946ef",
  "#7c3aed",
  "#8b5cf6",
  "#f0abfc",
  "#d8b4fe",
];

export default function GameViewer({
  gameState,
  messages,
  phase,
  players,
  timeRemaining,
  connected,
  error,
  winner,
}: GameViewerProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const alivePlayers = players.filter((p) => p.isAlive);
  const eliminatedPlayers = players.filter((p) => !p.isAlive);
  const currentRound = gameState?.round ?? 1;
  const totalStake = gameState?.totalStake ?? "0";

  // Votes tally
  const voteTally: Record<string, string[]> = {};
  if (phase === "voting") {
    players.forEach((p) => {
      if (p.votedFor && p.isAlive) {
        if (!voteTally[p.votedFor]) voteTally[p.votedFor] = [];
        voteTally[p.votedFor].push(p.address);
      }
    });
  }
  const maxVotes = Math.max(
    1,
    ...Object.values(voteTally).map((v) => v.length)
  );

  const accent = getPhaseAccent(phase);
  const confettiColors =
    winner === "lobsters" ? CONFETTI_COLORS_LOBSTER : CONFETTI_COLORS_IMPOSTOR;

  return (
    <div className="relative">
      {/* ━━━ Phase-reactive ambient background tint ━━━ */}
      <div
        className="absolute inset-0 -z-10 rounded-2xl pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accent.accentFaded} 0%, transparent 60%)`,
        }}
      />

      {/* ━━━━━━━━━━ WINNER OVERLAY ━━━━━━━━━━ */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl overflow-hidden"
          >
            {/* Dark backdrop with pulsing color wash */}
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  winner === "lobsters"
                    ? "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)"
                    : "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
              }}
              animate={{
                background:
                  winner === "lobsters"
                    ? [
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.25) 0%, rgba(0,0,0,0.88) 70%)",
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                      ]
                    : [
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.25) 0%, rgba(0,0,0,0.88) 70%)",
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                      ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Backdrop blur */}
            <div className="absolute inset-0 backdrop-blur-md" />

            {/* Confetti particles - 40 particles for dramatic effect */}
            {Array.from({ length: 40 }).map((_, i) => {
              const startX = (Math.random() - 0.5) * 100;
              const size = 3 + Math.random() * 8;
              const isRect = Math.random() > 0.5;
              return (
                <motion.div
                  key={`confetti-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    width: isRect ? size * 2.5 : size,
                    height: size,
                    borderRadius: isRect ? "2px" : "50%",
                    backgroundColor:
                      confettiColors[i % confettiColors.length],
                    left: `calc(50% + ${startX}%)`,
                    top: "50%",
                    boxShadow: `0 0 6px ${confettiColors[i % confettiColors.length]}80`,
                  }}
                  initial={{ y: 0, x: 0, opacity: 1, rotate: 0, scale: 0 }}
                  animate={{
                    y: [0, (Math.random() - 0.5) * 500 - 100],
                    x: [(Math.random() - 0.5) * 80, (Math.random() - 0.5) * 400],
                    opacity: [0, 1, 1, 0],
                    rotate: [0, Math.random() * 720 - 360],
                    scale: [0, 1.2, 1, 0.3],
                  }}
                  transition={{
                    duration: 2.5 + Math.random() * 2,
                    repeat: Infinity,
                    repeatDelay: Math.random() * 1.5,
                    delay: Math.random() * 1.5,
                    ease: "easeOut",
                  }}
                />
              );
            })}

            {/* Radiating ring burst */}
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  border: `2px solid ${winner === "lobsters" ? "#22c55e" : "#a855f7"}`,
                }}
                initial={{ width: 0, height: 0, opacity: 0.6 }}
                animate={{
                  width: [0, 600],
                  height: [0, 600],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Center content */}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2, damping: 12 }}
              className="relative text-center z-10"
            >
              {/* Icon with float animation */}
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative inline-block"
              >
                {/* Glow behind icon */}
                <div
                  className="absolute inset-0 blur-3xl opacity-40"
                  style={{
                    background:
                      winner === "lobsters"
                        ? "radial-gradient(circle, #22c55e, transparent)"
                        : "radial-gradient(circle, #a855f7, transparent)",
                    transform: "scale(2)",
                  }}
                />
                {winner === "lobsters" ? (
                  <Shield className="h-28 w-28 text-green-400 mx-auto mb-6 relative z-10 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]" />
                ) : (
                  <Skull className="h-28 w-28 text-purple-400 mx-auto mb-6 relative z-10 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]" />
                )}
              </motion.div>

              {/* Winner title */}
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  "text-5xl font-black mb-3 tracking-tight",
                  winner === "lobsters" ? "neon-green" : "neon-purple",
                  "animate-text-glow"
                )}
                style={{
                  textShadow:
                    winner === "lobsters"
                      ? "0 0 20px rgba(34,197,94,0.6), 0 0 60px rgba(34,197,94,0.3), 0 0 100px rgba(34,197,94,0.15)"
                      : "0 0 20px rgba(168,85,247,0.6), 0 0 60px rgba(168,85,247,0.3), 0 0 100px rgba(168,85,247,0.15)",
                }}
              >
                {winner === "lobsters" ? "LOBSTERS WIN!" : "IMPOSTOR WINS!"}
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 text-lg mb-6 max-w-sm mx-auto"
              >
                {winner === "lobsters"
                  ? "The crew successfully identified and eliminated the impostor!"
                  : "The impostor outplayed the crew and claimed victory!"}
              </motion.p>

              {/* Pot display */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl glass-card"
                style={{
                  boxShadow: "0 0 20px rgba(250,204,21,0.15), inset 0 0 20px rgba(250,204,21,0.05)",
                  border: "1px solid rgba(250,204,21,0.2)",
                }}
              >
                <Crown className="h-6 w-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                <span className="font-black text-xl text-yellow-400 neon-orange">
                  Pot: {formatMON(totalStake)}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━━━━━━━━ MAIN GRID LAYOUT ━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Left 2 columns: Main area ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Connection status pill */}
          <div className="flex items-center gap-3">
            <motion.div
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all",
                connected
                  ? "bg-green-500/8 text-green-400 border border-green-500/25"
                  : "bg-red-500/8 text-red-400 border border-red-500/25"
              )}
              style={{
                boxShadow: connected
                  ? "0 0 12px rgba(34,197,94,0.1), inset 0 0 12px rgba(34,197,94,0.03)"
                  : "0 0 12px rgba(239,68,68,0.1), inset 0 0 12px rgba(239,68,68,0.03)",
              }}
              animate={
                connected
                  ? {}
                  : { opacity: [1, 0.6, 1] }
              }
              transition={{ duration: 2, repeat: Infinity }}
            >
              {connected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              <span>{connected ? "Live" : "Disconnected"}</span>
              {connected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </motion.div>

            {error && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-red-400 bg-red-500/8 px-3 py-1 rounded-full border border-red-500/20"
              >
                {error}
              </motion.span>
            )}
          </div>

          {/* Phase timer */}
          {phase && (
            <PhaseTimer
              phase={phase}
              timeRemaining={timeRemaining}
              round={currentRound}
            />
          )}

          {/* ─── Player Arena ─── */}
          <div
            className={cn(
              "rounded-2xl p-5 card-shine glass-card transition-all duration-700",
              accent.glow
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <h3
                className="text-sm font-bold text-gray-300 flex items-center gap-2.5"
                style={{ textShadow: `0 0 10px ${accent.accent}30` }}
              >
                <Users className="h-4 w-4" style={{ color: accent.accent }} />
                <span>
                  Arena{" "}
                  <span className="text-gray-500 font-normal ml-1">
                    {alivePlayers.length} alive / {players.length} total
                  </span>
                </span>
              </h3>
              {phase && (
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                    phase === "discussion" && "border-green-500/30 text-green-400 bg-green-500/8",
                    phase === "voting" && "border-orange-500/30 text-orange-400 bg-orange-500/8",
                    phase === "elimination" && "border-red-500/30 text-red-400 bg-red-500/8",
                    phase === "results" && "border-purple-500/30 text-purple-400 bg-purple-500/8",
                    phase === "lobby" && "border-gray-500/30 text-gray-400 bg-gray-500/8"
                  )}
                >
                  {phase}
                </div>
              )}
            </div>

            {/* PixiJS 2D Game Arena */}
            <div className="rounded-xl overflow-hidden mb-3">
              <PixiArena
                players={players}
                phase={phase}
                winner={winner}
                accentColor={accent.accent}
              />
            </div>

            {/* Eliminated section - gravestone style */}
            <AnimatePresence>
              {eliminatedPlayers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="border-t border-gray-800/50 pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Skull className="h-3 w-3 text-red-500/60" />
                      <p className="text-[10px] text-red-400/60 uppercase tracking-[0.2em] font-bold">
                        Fallen
                      </p>
                      <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
                    </div>
                    <div className="flex flex-wrap justify-center gap-4">
                      {eliminatedPlayers.map((player, idx) => (
                        <motion.div
                          key={player.address}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 0.6, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="relative"
                        >
                          {/* Tombstone-like background */}
                          <div
                            className="absolute inset-0 -z-10 rounded-xl opacity-30"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(127,29,29,0.15) 0%, transparent 100%)",
                            }}
                          />
                          <PlayerAvatar
                            player={player}
                            size="sm"
                            showRole
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Vote Tracker ─── */}
          <AnimatePresence>
            {phase === "voting" && Object.keys(voteTally).length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-2xl p-5 glass-card glow-orange card-shine"
                  style={{
                    border: "1px solid rgba(251,146,60,0.15)",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold neon-orange flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-4 w-4"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </motion.div>
                      Vote Tracker
                    </h3>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {Object.values(voteTally).reduce(
                        (sum, v) => sum + v.length,
                        0
                      )}{" "}
                      / {alivePlayers.length} cast
                    </span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(voteTally)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([target, voters], idx) => {
                        const targetPlayer = players.find(
                          (p) => p.address === target
                        );
                        const percentage = (voters.length / maxVotes) * 100;
                        const targetColor = getAgentColor(target);

                        return (
                          <motion.div
                            key={target}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="relative rounded-xl overflow-hidden bg-gray-900/40 border border-gray-800/50"
                          >
                            {/* Animated progress bar background */}
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-xl"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{
                                duration: 0.8,
                                delay: idx * 0.1 + 0.2,
                                ease: "easeOut",
                              }}
                              style={{
                                background: `linear-gradient(90deg, ${targetColor}15, ${targetColor}08)`,
                                borderRight: `2px solid ${targetColor}40`,
                              }}
                            />

                            <div className="relative flex items-center gap-3 p-3">
                              {/* Voter avatars */}
                              <div className="flex items-center -space-x-1.5">
                                {voters.map((voter) => (
                                  <motion.div
                                    key={voter}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="h-7 w-7 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-gray-900"
                                    style={{
                                      backgroundColor: `${getAgentColor(voter)}30`,
                                      color: getAgentColor(voter),
                                      boxShadow: `0 0 6px ${getAgentColor(voter)}30`,
                                    }}
                                  >
                                    {voter.slice(2, 4).toUpperCase()}
                                  </motion.div>
                                ))}
                              </div>

                              <ArrowRight className="h-3 w-3 text-orange-400/60 shrink-0" />

                              {/* Target */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border-2"
                                  style={{
                                    backgroundColor: `${targetColor}25`,
                                    color: targetColor,
                                    borderColor: `${targetColor}50`,
                                    boxShadow: `0 0 10px ${targetColor}25`,
                                  }}
                                >
                                  {target.slice(2, 4).toUpperCase()}
                                </div>
                                <span className="text-xs text-gray-300 font-medium truncate">
                                  {targetPlayer?.name ||
                                    shortenAddress(target)}
                                </span>
                              </div>

                              {/* Vote count */}
                              <motion.div
                                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shrink-0"
                                style={{
                                  background: `${targetColor}18`,
                                  color: targetColor,
                                  boxShadow: `0 0 8px ${targetColor}15`,
                                }}
                                animate={{
                                  scale: [1, 1.05, 1],
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  delay: idx * 0.2,
                                }}
                              >
                                {voters.length}
                                <span className="text-[10px] font-medium opacity-70">
                                  vote{voters.length > 1 ? "s" : ""}
                                </span>
                              </motion.div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Discussion Feed ─── */}
          <div
            className={cn(
              "rounded-2xl overflow-hidden transition-all duration-700",
              accent.glow
            )}
            style={{
              background: "rgba(10,15,30,0.85)",
              border: "1px solid rgba(148,163,184,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Header */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{
                borderBottom: "1px solid rgba(148,163,184,0.1)",
                background: "rgba(15,23,42,0.6)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: accent.accent,
                    boxShadow: `0 0 8px ${accent.accent}50`,
                  }}
                />
                <h3 className="text-sm font-bold text-gray-200">
                  Discussion Feed
                </h3>
              </div>
              <span className="text-[10px] text-gray-500 font-medium bg-gray-800/60 px-2.5 py-1 rounded-full">
                {messages.length} messages
              </span>
            </div>

            {/* Messages area */}
            <div className="h-[400px] overflow-y-auto p-3 space-y-1 scroll-smooth" style={{ background: "rgba(8,12,24,0.5)" }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-gray-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-10 w-10"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </motion.div>
                  <p className="text-gray-600 text-sm font-medium">
                    Waiting for discussion to begin...
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <DiscussionMessage key={msg.id} message={msg} index={i} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* ─── Sidebar (right column) ─── */}
        <div className="space-y-5">
          {/* Game Info Card */}
          <div
            className={cn(
              "rounded-2xl p-5 space-y-4 glass-card glass-card-hover card-shine transition-all duration-700",
              accent.glow
            )}
          >
            <h3
              className="text-sm font-bold text-gray-300 flex items-center gap-2.5"
              style={{ textShadow: `0 0 10px ${accent.accent}20` }}
            >
              <Coins className="h-4 w-4" style={{ color: accent.accent }} />
              Game Info
            </h3>

            <div className="space-y-3">
              {/* Game ID */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Game ID
                </span>
                <span className="text-xs font-mono text-gray-400 bg-gray-800/40 px-2 py-0.5 rounded">
                  {gameState?.id
                    ? `${gameState.id.slice(0, 8)}...`
                    : "---"}
                </span>
              </div>

              {/* Total Pot - highlighted */}
              <div
                className="flex justify-between items-center rounded-xl p-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(250,204,21,0.06), rgba(250,204,21,0.02))",
                  border: "1px solid rgba(250,204,21,0.1)",
                }}
              >
                <span className="text-xs text-gray-400 font-medium">
                  Total Pot
                </span>
                <span className="text-base font-black text-yellow-400 tracking-tight">
                  {formatMON(totalStake)}
                </span>
              </div>

              {/* Stake per player */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Stake / Player
                </span>
                <span className="text-xs text-gray-300 font-semibold">
                  {formatMON(gameState?.stakePerPlayer ?? "0")}
                </span>
              </div>

              {/* Round */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Round
                </span>
                <span
                  className="text-sm font-black"
                  style={{
                    color: accent.accent,
                    textShadow: `0 0 8px ${accent.accent}40`,
                  }}
                >
                  {currentRound}
                </span>
              </div>

              {/* Players alive */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Players Alive
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-green-400">
                    {alivePlayers.length}
                  </span>
                  <span className="text-xs text-gray-600">/</span>
                  <span className="text-xs text-gray-500">
                    {players.length}
                  </span>
                  {/* Visual health bar */}
                  <div className="w-12 h-1.5 bg-gray-800 rounded-full ml-1.5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, #22c55e, #4ade80)",
                        boxShadow: "0 0 6px rgba(34,197,94,0.4)",
                      }}
                      initial={{ width: "100%" }}
                      animate={{
                        width: `${players.length > 0 ? (alivePlayers.length / players.length) * 100 : 0}%`,
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Player Detail */}
          <AnimatePresence>
            {selectedPlayer && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="rounded-2xl glass-card p-5 card-shine"
                style={{
                  border: `1px solid ${getAgentColor(selectedPlayer)}25`,
                  boxShadow: `0 0 20px ${getAgentColor(selectedPlayer)}08`,
                }}
              >
                {(() => {
                  const player = players.find(
                    (p) => p.address === selectedPlayer
                  );
                  if (!player) return null;
                  const pColor = getAgentColor(player.address);
                  return (
                    <div className="space-y-4">
                      {/* Player header */}
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-black border-2"
                          style={{
                            background: `radial-gradient(circle at 35% 35%, ${pColor}40, ${pColor}10)`,
                            color: pColor,
                            borderColor: `${pColor}40`,
                            boxShadow: `0 0 12px ${pColor}25`,
                          }}
                        >
                          {player.address.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-sm truncate">
                            {player.name || shortenAddress(player.address)}
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono truncate">
                            {player.address}
                          </div>
                        </div>
                        {/* Close button */}
                        <button
                          onClick={() => setSelectedPlayer(null)}
                          className="text-gray-600 hover:text-gray-400 transition-colors text-lg leading-none p-1"
                        >
                          x
                        </button>
                      </div>

                      {/* Status grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          className="rounded-xl p-3 text-center"
                          style={{
                            background: player.isAlive
                              ? "rgba(34,197,94,0.06)"
                              : "rgba(239,68,68,0.06)",
                            border: player.isAlive
                              ? "1px solid rgba(34,197,94,0.15)"
                              : "1px solid rgba(239,68,68,0.15)",
                          }}
                        >
                          <div className="text-[10px] text-gray-500 font-medium mb-1">
                            Status
                          </div>
                          <div
                            className={cn(
                              "text-xs font-black tracking-wide",
                              player.isAlive
                                ? "text-green-400"
                                : "text-red-400"
                            )}
                          >
                            {player.isAlive ? "ALIVE" : "ELIMINATED"}
                          </div>
                        </div>
                        <div
                          className="rounded-xl p-3 text-center"
                          style={{
                            background:
                              player.role === "impostor"
                                ? "rgba(168,85,247,0.06)"
                                : player.role === "lobster"
                                  ? "rgba(34,197,94,0.06)"
                                  : "rgba(100,116,139,0.06)",
                            border:
                              player.role === "impostor"
                                ? "1px solid rgba(168,85,247,0.15)"
                                : player.role === "lobster"
                                  ? "1px solid rgba(34,197,94,0.15)"
                                  : "1px solid rgba(100,116,139,0.1)",
                          }}
                        >
                          <div className="text-[10px] text-gray-500 font-medium mb-1">
                            Role
                          </div>
                          <div
                            className={cn(
                              "text-xs font-black tracking-wide",
                              player.role === "impostor"
                                ? "text-purple-400"
                                : player.role === "lobster"
                                  ? "text-green-400"
                                  : "text-gray-500"
                            )}
                          >
                            {player.role === "unknown"
                              ? "HIDDEN"
                              : player.role.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Vote info */}
                      {player.votedFor && (
                        <div
                          className="text-xs text-gray-400 rounded-lg p-2 flex items-center gap-2"
                          style={{
                            background: "rgba(251,146,60,0.06)",
                            border: "1px solid rgba(251,146,60,0.12)",
                          }}
                        >
                          <span className="text-gray-500">Voted for:</span>
                          <span
                            className="font-bold"
                            style={{
                              color: getAgentColor(player.votedFor),
                            }}
                          >
                            {players.find(
                              (p) => p.address === player.votedFor
                            )?.name || shortenAddress(player.votedFor)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* All Players list */}
          <div
            className={cn(
              "rounded-2xl p-5 glass-card glass-card-hover card-shine transition-all duration-700",
              accent.glow
            )}
          >
            <h3
              className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2.5"
              style={{ textShadow: `0 0 10px ${accent.accent}20` }}
            >
              <Users className="h-4 w-4" style={{ color: accent.accent }} />
              All Players
            </h3>

            <div className="space-y-1.5">
              {players.map((player) => {
                const pColor = getAgentColor(player.address);
                const isSelected = selectedPlayer === player.address;
                return (
                  <motion.button
                    key={player.address}
                    onClick={() =>
                      setSelectedPlayer(
                        isSelected ? null : player.address
                      )
                    }
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all duration-200",
                      isSelected
                        ? "bg-gray-800/60"
                        : "hover:bg-gray-800/30"
                    )}
                    style={{
                      border: isSelected
                        ? `1px solid ${pColor}30`
                        : "1px solid transparent",
                      boxShadow: isSelected
                        ? `0 0 10px ${pColor}10`
                        : "none",
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Mini avatar */}
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border"
                      style={{
                        background: player.isAlive
                          ? `radial-gradient(circle at 35% 35%, ${pColor}35, ${pColor}10)`
                          : "#1f2937",
                        color: player.isAlive ? pColor : "#4b5563",
                        borderColor: player.isAlive
                          ? `${pColor}35`
                          : "#374151",
                        boxShadow: player.isAlive
                          ? `0 0 6px ${pColor}15`
                          : "none",
                      }}
                    >
                      {player.address.slice(2, 4).toUpperCase()}
                    </div>

                    {/* Name */}
                    <span
                      className={cn(
                        "text-xs truncate flex-1 font-medium",
                        player.isAlive
                          ? "text-gray-300"
                          : "text-gray-600 line-through"
                      )}
                    >
                      {player.name || shortenAddress(player.address)}
                    </span>

                    {/* Role badge for eliminated */}
                    {!player.isAlive && player.role !== "unknown" && (
                      <span
                        className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-full border",
                          player.role === "impostor"
                            ? "text-purple-400 bg-purple-500/10 border-purple-500/25"
                            : "text-green-400 bg-green-500/10 border-green-500/25"
                        )}
                        style={{
                          boxShadow:
                            player.role === "impostor"
                              ? "0 0 6px rgba(168,85,247,0.15)"
                              : "0 0 6px rgba(34,197,94,0.15)",
                        }}
                      >
                        {player.role === "impostor" ? "IMP" : "LOB"}
                      </span>
                    )}

                    {/* Speaking indicator */}
                    {player.isSpeaking && player.isAlive && (
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-0.5 rounded-full bg-green-400"
                            animate={{
                              height: ["4px", "10px", "4px"],
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.15,
                            }}
                            style={{
                              boxShadow: "0 0 4px rgba(34,197,94,0.5)",
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Alive dot */}
                    {player.isAlive && !player.isSpeaking && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: pColor,
                          boxShadow: `0 0 4px ${pColor}60`,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
