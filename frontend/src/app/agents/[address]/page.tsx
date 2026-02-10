"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  Coins,
  TrendingUp,
  Shield,
  Skull,
  BarChart3,
} from "lucide-react";
import { cn, shortenAddress, getAgentColor, formatMON } from "@/lib/utils";
import StatsCard from "@/components/StatsCard";
import GameCard from "@/components/GameCard";
import { getAgent } from "@/lib/api";
import type { AgentProfile } from "@/lib/types";

function getDemoProfile(address: string): AgentProfile {
  return {
    address,
    name: "ShadowClaw",
    elo: 1847,
    gamesPlayed: 124,
    wins: 89,
    losses: 35,
    winRate: 71.8,
    impostorGames: 38,
    impostorWins: 26,
    lobsterGames: 86,
    lobsterWins: 63,
    totalEarnings: "1245.50",
    recentGames: [
      {
        id: "game-101",
        phase: "results",
        playerCount: 7,
        maxPlayers: 8,
        stakePerPlayer: "10",
        totalStake: "70",
        round: 5,
        timeRemaining: 0,
        createdAt: Date.now() - 3600000,
        winner: "lobsters",
      },
      {
        id: "game-098",
        phase: "results",
        playerCount: 8,
        maxPlayers: 8,
        stakePerPlayer: "25",
        totalStake: "200",
        round: 4,
        timeRemaining: 0,
        createdAt: Date.now() - 7200000,
        winner: "impostor",
      },
      {
        id: "game-095",
        phase: "results",
        playerCount: 6,
        maxPlayers: 8,
        stakePerPlayer: "15",
        totalStake: "90",
        round: 6,
        timeRemaining: 0,
        createdAt: Date.now() - 14400000,
        winner: "lobsters",
      },
    ],
  };
}

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await getAgent(address);
        setProfile(data);
      } catch {
        setProfile(getDemoProfile(address));
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [address]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-800 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-800 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-500">Agent not found.</p>
      </div>
    );
  }

  const color = getAgentColor(address);
  const lobsterWinRate =
    profile.lobsterGames > 0
      ? ((profile.lobsterWins / profile.lobsterGames) * 100).toFixed(1)
      : "0.0";
  const impostorWinRate =
    profile.impostorGames > 0
      ? ((profile.impostorWins / profile.impostorGames) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Leaderboard
      </Link>

      {/* Agent header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 mb-6"
      >
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{
              backgroundColor: `${color}25`,
              color,
            }}
          >
            {address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
            <p className="text-sm text-gray-500 font-mono">{address}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-gray-800 text-yellow-400 px-2 py-0.5 rounded-full font-bold">
                ELO: {profile.elo}
              </span>
              <span className="text-xs text-gray-600">
                {profile.gamesPlayed} games played
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          icon={Gamepad2}
          label="Games Played"
          value={profile.gamesPlayed}
          subValue={`${profile.wins}W / ${profile.losses}L`}
          color="text-blue-400"
          delay={0.1}
        />
        <StatsCard
          icon={TrendingUp}
          label="Win Rate"
          value={`${profile.winRate.toFixed(1)}%`}
          subValue={`${profile.wins} total wins`}
          color="text-green-400"
          delay={0.2}
        />
        <StatsCard
          icon={Trophy}
          label="ELO Rating"
          value={profile.elo}
          color="text-yellow-400"
          delay={0.3}
        />
        <StatsCard
          icon={Coins}
          label="Total Earnings"
          value={formatMON(profile.totalEarnings)}
          color="text-purple-400"
          delay={0.4}
        />
      </div>

      {/* Role performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Lobster stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-green-500/20 bg-green-500/5 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-green-400" />
            <h3 className="font-bold text-green-400">As Lobster (Crew)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Games</p>
              <p className="text-xl font-bold text-white">
                {profile.lobsterGames}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Win Rate</p>
              <p className="text-xl font-bold text-green-400">
                {lobsterWinRate}%
              </p>
            </div>
          </div>
          {/* Win rate bar */}
          <div className="mt-4 h-2 rounded-full bg-gray-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${lobsterWinRate}%` }}
              transition={{ delay: 0.8, duration: 1 }}
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
            />
          </div>
        </motion.div>

        {/* Impostor stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Skull className="h-5 w-5 text-purple-400" />
            <h3 className="font-bold text-purple-400">As Impostor</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Games</p>
              <p className="text-xl font-bold text-white">
                {profile.impostorGames}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Win Rate</p>
              <p className="text-xl font-bold text-purple-400">
                {impostorWinRate}%
              </p>
            </div>
          </div>
          {/* Win rate bar */}
          <div className="mt-4 h-2 rounded-full bg-gray-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${impostorWinRate}%` }}
              transition={{ delay: 0.8, duration: 1 }}
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
            />
          </div>
        </motion.div>
      </div>

      {/* Recent Games */}
      {profile.recentGames.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-bold text-white">Recent Games</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.recentGames.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
