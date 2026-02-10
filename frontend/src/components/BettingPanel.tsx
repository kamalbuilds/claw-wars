"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn, shortenAddress, formatMON } from "@/lib/utils";
import { Coins, TrendingUp, Target, ChevronDown } from "lucide-react";
import type { Player, BettingOdds, Bet } from "@/lib/types";
import { placeBet } from "@/lib/api";

interface BettingPanelProps {
  gameId: string;
  players: Player[];
  odds: BettingOdds | null;
  activeBets: Bet[];
}

type BetType = "lobsters_win" | "impostor_wins" | "specific_agent";

export default function BettingPanel({
  gameId,
  players,
  odds,
  activeBets,
}: BettingPanelProps) {
  const { address, isConnected } = useAccount();
  const [betType, setBetType] = useState<BetType>("lobsters_win");
  const [amount, setAmount] = useState("");
  const [targetAgent, setTargetAgent] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);

  const betOptions: { type: BetType; label: string; icon: typeof Coins; color: string }[] = [
    {
      type: "lobsters_win",
      label: "Lobsters Win",
      icon: Target,
      color: "text-green-400 border-green-500/50 bg-green-500/10",
    },
    {
      type: "impostor_wins",
      label: "Impostor Wins",
      icon: TrendingUp,
      color: "text-purple-400 border-purple-500/50 bg-purple-500/10",
    },
    {
      type: "specific_agent",
      label: "Specific Agent",
      icon: Target,
      color: "text-orange-400 border-orange-500/50 bg-orange-500/10",
    },
  ];

  const currentOdds =
    betType === "lobsters_win"
      ? odds?.lobstersWin ?? 1.8
      : betType === "impostor_wins"
        ? odds?.impostorWins ?? 2.5
        : targetAgent
          ? odds?.specificAgents?.[targetAgent] ?? 5.0
          : 5.0;

  const potentialPayout = amount
    ? (parseFloat(amount) * currentOdds).toFixed(2)
    : "0.00";

  async function handlePlaceBet() {
    if (!amount || parseFloat(amount) <= 0) return;
    if (betType === "specific_agent" && !targetAgent) return;

    setIsPlacing(true);
    try {
      await placeBet(gameId, betType, amount, targetAgent || undefined);
      setAmount("");
    } catch (error) {
      console.error("Failed to place bet:", error);
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-yellow-500" />
          <h3 className="font-bold text-white">Place Your Bet</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Wager on the game outcome
        </p>
      </div>

      <div className="p-4 space-y-4">
        {!isConnected ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-3">
              Connect your wallet to place bets
            </p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Bet type selection */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">
                Bet Type
              </label>
              <div className="grid gap-2">
                {betOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.type}
                      onClick={() => {
                        setBetType(option.type);
                        if (option.type !== "specific_agent") {
                          setTargetAgent("");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all text-left",
                        betType === option.type
                          ? option.color
                          : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{option.label}</span>
                      <span className="ml-auto text-xs opacity-60">
                        {option.type === "lobsters_win"
                          ? `${(odds?.lobstersWin ?? 1.8).toFixed(1)}x`
                          : option.type === "impostor_wins"
                            ? `${(odds?.impostorWins ?? 2.5).toFixed(1)}x`
                            : "varies"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agent select for specific_agent */}
            <AnimatePresence>
              {betType === "specific_agent" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">
                      Select Agent
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowAgentSelect(!showAgentSelect)}
                        className="w-full flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-300"
                      >
                        {targetAgent
                          ? shortenAddress(targetAgent)
                          : "Choose agent..."}
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <AnimatePresence>
                        {showAgentSelect && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-10 mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 shadow-xl max-h-40 overflow-y-auto"
                          >
                            {players
                              .filter((p) => p.isAlive)
                              .map((player) => (
                                <button
                                  key={player.address}
                                  onClick={() => {
                                    setTargetAgent(player.address);
                                    setShowAgentSelect(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors text-left"
                                >
                                  <span>
                                    {player.name ||
                                      shortenAddress(player.address)}
                                  </span>
                                  <span className="ml-auto text-xs text-gray-500">
                                    {(
                                      odds?.specificAgents?.[player.address] ??
                                      5.0
                                    ).toFixed(1)}
                                    x
                                  </span>
                                </button>
                              ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">
                Amount (MON)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  MON
                </div>
              </div>
              <div className="flex gap-2">
                {["1", "5", "10", "25"].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className="flex-1 rounded-md border border-gray-700 bg-gray-800 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Odds & payout */}
            <div className="rounded-lg bg-gray-800/50 p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Odds</span>
                <span className="text-yellow-400 font-mono">
                  {currentOdds.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Potential Payout</span>
                <span className="text-green-400 font-mono font-bold">
                  {potentialPayout} MON
                </span>
              </div>
            </div>

            {/* Place bet button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePlaceBet}
              disabled={
                isPlacing ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (betType === "specific_agent" && !targetAgent)
              }
              className={cn(
                "w-full rounded-lg py-3 text-sm font-bold transition-all",
                isPlacing ||
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  (betType === "specific_agent" && !targetAgent)
                  ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-500 hover:to-orange-500 shadow-lg shadow-red-500/20"
              )}
            >
              {isPlacing ? "Placing Bet..." : "Place Bet"}
            </motion.button>
          </>
        )}

        {/* Active bets */}
        {activeBets.length > 0 && (
          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Your Active Bets
            </h4>
            <div className="space-y-2">
              {activeBets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2.5"
                >
                  <div>
                    <span className="text-xs font-medium text-gray-300">
                      {bet.betType === "lobsters_win"
                        ? "Lobsters Win"
                        : bet.betType === "impostor_wins"
                          ? "Impostor Wins"
                          : `Agent ${shortenAddress(bet.targetAgent || "")}`}
                    </span>
                    <div className="text-[10px] text-gray-500">
                      {formatMON(bet.amount)} @ {bet.odds.toFixed(1)}x
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      bet.status === "active"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : bet.status === "won"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                    )}
                  >
                    {bet.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
