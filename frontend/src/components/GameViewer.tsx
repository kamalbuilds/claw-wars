"use client";

import { useRef, useEffect, useState } from "react";
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

  return (
    <div className="relative">
      {/* Winner overlay */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-xl"
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="text-center"
            >
              {/* Animated particles */}
              <div className="relative">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "absolute w-2 h-2 rounded-full",
                      winner === "lobsters" ? "bg-green-400" : "bg-purple-400"
                    )}
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 1,
                    }}
                    animate={{
                      x: (Math.random() - 0.5) * 300,
                      y: (Math.random() - 0.5) * 300,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{
                      duration: 2 + Math.random(),
                      repeat: Infinity,
                      repeatDelay: Math.random() * 2,
                    }}
                    style={{
                      left: "50%",
                      top: "50%",
                    }}
                  />
                ))}

                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {winner === "lobsters" ? (
                    <Shield className="h-24 w-24 text-green-400 mx-auto mb-4" />
                  ) : (
                    <Skull className="h-24 w-24 text-purple-400 mx-auto mb-4" />
                  )}
                </motion.div>
              </div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  "text-4xl font-black mb-2",
                  winner === "lobsters" ? "text-green-400" : "text-purple-400"
                )}
              >
                {winner === "lobsters" ? "LOBSTERS WIN!" : "IMPOSTOR WINS!"}
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 text-lg"
              >
                {winner === "lobsters"
                  ? "The crew successfully identified the impostor!"
                  : "The impostor eliminated enough crew members!"}
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-4 flex items-center justify-center gap-2 text-yellow-400"
              >
                <Crown className="h-5 w-5" />
                <span className="font-bold">
                  Pot: {formatMON(totalStake)}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main area (left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Connection status + Phase timer */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                connected
                  ? "bg-green-500/10 text-green-400 border border-green-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              )}
            >
              {connected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {connected ? "Connected" : "Disconnected"}
            </div>
            {error && (
              <span className="text-xs text-red-400">{error}</span>
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

          {/* Player grid */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Players ({alivePlayers.length} alive / {players.length} total)
            </h3>

            {/* Alive players */}
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              {alivePlayers.map((player) => (
                <PlayerAvatar
                  key={player.address}
                  player={player}
                  size="lg"
                  showVote={phase === "voting"}
                  onClick={() =>
                    setSelectedPlayer(
                      selectedPlayer === player.address
                        ? null
                        : player.address
                    )
                  }
                />
              ))}
            </div>

            {/* Eliminated players */}
            {eliminatedPlayers.length > 0 && (
              <>
                <div className="border-t border-gray-800 pt-3 mt-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">
                    Eliminated
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {eliminatedPlayers.map((player) => (
                      <PlayerAvatar
                        key={player.address}
                        player={player}
                        size="sm"
                        showRole
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Vote tracker */}
          <AnimatePresence>
            {phase === "voting" && Object.keys(voteTally).length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                  <h3 className="text-sm font-bold text-orange-400 mb-3">
                    Vote Tracker
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(voteTally)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([target, voters]) => {
                        const targetPlayer = players.find(
                          (p) => p.address === target
                        );
                        return (
                          <motion.div
                            key={target}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="flex items-center gap-3 rounded-lg bg-gray-800/30 p-2"
                          >
                            {/* Voters */}
                            <div className="flex items-center gap-1">
                              {voters.map((voter) => (
                                <div
                                  key={voter}
                                  className="h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold"
                                  style={{
                                    backgroundColor: `${getAgentColor(voter)}30`,
                                    color: getAgentColor(voter),
                                  }}
                                >
                                  {voter.slice(2, 4).toUpperCase()}
                                </div>
                              ))}
                            </div>

                            <ArrowRight className="h-3 w-3 text-orange-400 shrink-0" />

                            {/* Target */}
                            <div className="flex items-center gap-2">
                              <div
                                className="h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-red-500/50"
                                style={{
                                  backgroundColor: `${getAgentColor(target)}30`,
                                  color: getAgentColor(target),
                                }}
                              >
                                {target.slice(2, 4).toUpperCase()}
                              </div>
                              <span className="text-xs text-gray-300">
                                {targetPlayer?.name ||
                                  shortenAddress(target)}
                              </span>
                            </div>

                            {/* Vote count */}
                            <span className="ml-auto text-sm font-bold text-orange-400">
                              {voters.length} vote
                              {voters.length > 1 ? "s" : ""}
                            </span>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Discussion feed */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-400">
                Discussion Feed
              </h3>
              <span className="text-xs text-gray-600">
                {messages.length} messages
              </span>
            </div>
            <div className="h-[400px] overflow-y-auto p-2 space-y-1 scroll-smooth">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  Waiting for discussion to begin...
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

        {/* Sidebar (right col) */}
        <div className="space-y-4">
          {/* Game info */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Game Info
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Game ID</span>
                <span className="text-xs font-mono text-gray-300">
                  {gameState?.id || "---"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Total Pot</span>
                <span className="text-sm font-bold text-yellow-400">
                  {formatMON(totalStake)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Stake / Player</span>
                <span className="text-xs text-gray-300">
                  {formatMON(gameState?.stakePerPlayer ?? "0")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Round</span>
                <span className="text-sm font-bold text-white">
                  {currentRound}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Players Alive</span>
                <span className="text-sm font-bold text-green-400">
                  {alivePlayers.length}
                  <span className="text-gray-600 font-normal">
                    /{players.length}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Selected player detail */}
          <AnimatePresence>
            {selectedPlayer && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="rounded-xl border border-gray-700 bg-gray-900/80 p-4"
              >
                {(() => {
                  const player = players.find(
                    (p) => p.address === selectedPlayer
                  );
                  if (!player) return null;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{
                            backgroundColor: `${getAgentColor(player.address)}30`,
                            color: getAgentColor(player.address),
                          }}
                        >
                          {player.address.slice(2, 4).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {player.name || shortenAddress(player.address)}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {player.address}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-gray-800/50 p-2 text-center">
                          <div className="text-[10px] text-gray-500">
                            Status
                          </div>
                          <div
                            className={cn(
                              "text-xs font-bold",
                              player.isAlive
                                ? "text-green-400"
                                : "text-red-400"
                            )}
                          >
                            {player.isAlive ? "ALIVE" : "ELIMINATED"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-800/50 p-2 text-center">
                          <div className="text-[10px] text-gray-500">
                            Role
                          </div>
                          <div
                            className={cn(
                              "text-xs font-bold",
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
                      {player.votedFor && (
                        <div className="text-xs text-gray-400">
                          Voted for:{" "}
                          <span className="text-orange-400 font-medium">
                            {shortenAddress(player.votedFor)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player list compact */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3">
              All Players
            </h3>
            <div className="space-y-1.5">
              {players.map((player) => (
                <button
                  key={player.address}
                  onClick={() =>
                    setSelectedPlayer(
                      selectedPlayer === player.address
                        ? null
                        : player.address
                    )
                  }
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg p-2 text-left transition-colors",
                    selectedPlayer === player.address
                      ? "bg-gray-800"
                      : "hover:bg-gray-800/50",
                    !player.isAlive && "opacity-50"
                  )}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor: `${getAgentColor(player.address)}25`,
                      color: player.isAlive
                        ? getAgentColor(player.address)
                        : "#4b5563",
                    }}
                  >
                    {player.address.slice(2, 4).toUpperCase()}
                  </div>
                  <span
                    className={cn(
                      "text-xs truncate flex-1",
                      player.isAlive ? "text-gray-300" : "text-gray-600 line-through"
                    )}
                  >
                    {player.name || shortenAddress(player.address)}
                  </span>
                  {!player.isAlive && player.role !== "unknown" && (
                    <span
                      className={cn(
                        "text-[9px] font-bold px-1 rounded",
                        player.role === "impostor"
                          ? "text-purple-400 bg-purple-500/10"
                          : "text-green-400 bg-green-500/10"
                      )}
                    >
                      {player.role === "impostor" ? "IMP" : "LOB"}
                    </span>
                  )}
                  {player.isSpeaking && (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-green-400"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
