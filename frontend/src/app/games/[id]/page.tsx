"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import GameViewer from "@/components/GameViewer";
import BettingPanel from "@/components/BettingPanel";
import { useGameSocket } from "@/hooks/useGameSocket";
import type { BettingOdds, Bet } from "@/lib/types";

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = use(params);
  const {
    gameState,
    messages,
    phase,
    players,
    timeRemaining,
    connected,
    error,
    winner,
  } = useGameSocket(gameId);

  const [odds, setOdds] = useState<BettingOdds | null>(null);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);

  // Load demo data for game state when WS not connected
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    if (!connected && !demoLoaded && !gameState) {
      const timer = setTimeout(() => setDemoLoaded(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [connected, demoLoaded, gameState]);

  // Demo odds
  useEffect(() => {
    setOdds({
      lobstersWin: 1.8,
      impostorWins: 2.5,
      specificAgents: {},
    });
  }, []);

  const showLoading = !gameState && !demoLoaded;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Back link */}
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Games
      </Link>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          Game{" "}
          <span className="text-red-400">
            #{gameId.split("-").pop() || gameId.slice(-6)}
          </span>
        </h1>
      </div>

      {showLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-8 w-8 text-red-500" />
          </motion.div>
          <p className="text-sm text-gray-500 mt-4">
            Connecting to game server...
          </p>
          <p className="text-xs text-gray-700 mt-1">
            Attempting WebSocket connection to game {gameId}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main game viewer */}
          <div className="xl:col-span-3">
            <GameViewer
              gameState={gameState || getDemoGameState(gameId)}
              messages={messages.length > 0 ? messages : getDemoMessages()}
              phase={phase || "discussion"}
              players={
                players.length > 0 ? players : getDemoGameState(gameId).players
              }
              timeRemaining={timeRemaining || 42}
              connected={connected}
              error={error}
              winner={winner}
            />
          </div>

          {/* Betting sidebar */}
          <div className="xl:col-span-1">
            <BettingPanel
              gameId={gameId}
              players={
                players.length > 0 ? players : getDemoGameState(gameId).players
              }
              odds={odds}
              activeBets={activeBets}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Demo data for when the API/WebSocket isn't available
function getDemoGameState(gameId: string) {
  const { GameState } = getDemoData();
  return { ...GameState, id: gameId };
}

function getDemoMessages() {
  return getDemoData().messages;
}

function getDemoData() {
  const players = [
    {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      name: "Agent Alpha",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: false,
    },
    {
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      name: "Agent Bravo",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: true,
    },
    {
      address: "0x9876543210fedcba9876543210fedcba98765432",
      name: "Agent Charlie",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: false,
    },
    {
      address: "0xfedcba9876543210fedcba9876543210fedcba98",
      name: "Agent Delta",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: false,
    },
    {
      address: "0x1111222233334444555566667777888899990000",
      name: "Agent Echo",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: false,
    },
    {
      address: "0xaaaabbbbccccddddeeeeffffaaaabbbbccccdddd",
      name: "Agent Foxtrot",
      role: "lobster" as const,
      isAlive: false,
      votedFor: null,
      isSpeaking: false,
    },
    {
      address: "0x5555666677778888999900001111222233334444",
      name: "Agent Golf",
      role: "unknown" as const,
      isAlive: true,
      votedFor: null,
      isSpeaking: false,
    },
  ];

  const messages = [
    {
      id: "msg-1",
      sender: "0x0000000000000000000000000000000000000000",
      senderName: "System",
      content: "Round 2 discussion phase has begun. 6 players remain alive.",
      timestamp: Date.now() - 60000,
      type: "system" as const,
      senderAlive: true,
    },
    {
      id: "msg-2",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      senderName: "Agent Alpha",
      content:
        "I've been observing everyone carefully. Agent Charlie was acting very suspicious during the last task assignment. They seemed to be avoiding group activities.",
      timestamp: Date.now() - 55000,
      type: "accusation" as const,
      senderAlive: true,
    },
    {
      id: "msg-3",
      sender: "0x9876543210fedcba9876543210fedcba98765432",
      senderName: "Agent Charlie",
      content:
        "That's completely false! I was working on the reactor the entire time. Alpha is trying to deflect suspicion because THEY were the ones nowhere to be found during the sabotage.",
      timestamp: Date.now() - 48000,
      type: "defense" as const,
      senderAlive: true,
    },
    {
      id: "msg-4",
      sender: "0xabcdef1234567890abcdef1234567890abcdef12",
      senderName: "Agent Bravo",
      content:
        "I can confirm I saw Charlie near the reactor. But I also noticed Delta was behaving oddly -- they kept going back and forth near the electrical room.",
      timestamp: Date.now() - 40000,
      type: "discussion" as const,
      senderAlive: true,
    },
    {
      id: "msg-5",
      sender: "0xfedcba9876543210fedcba9876543210fedcba98",
      senderName: "Agent Delta",
      content:
        "I was fixing the wiring! That's a legitimate task. You can check the task logs. I think we need to focus on who was near Foxtrot when they got eliminated.",
      timestamp: Date.now() - 33000,
      type: "defense" as const,
      senderAlive: true,
    },
    {
      id: "msg-6",
      sender: "0x1111222233334444555566667777888899990000",
      senderName: "Agent Echo",
      content:
        "Everyone is pointing fingers at each other. I think the impostor is someone who's been quiet. Golf, what's your take? You've barely said anything.",
      timestamp: Date.now() - 25000,
      type: "discussion" as const,
      senderAlive: true,
    },
    {
      id: "msg-7",
      sender: "0x5555666677778888999900001111222233334444",
      senderName: "Agent Golf",
      content:
        "I've been listening and analyzing. Based on behavioral patterns, I believe the impostor is either Alpha or Delta. Their stories have the most inconsistencies.",
      timestamp: Date.now() - 18000,
      type: "accusation" as const,
      senderAlive: true,
    },
    {
      id: "msg-8",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      senderName: "Agent Alpha",
      content:
        "Golf is trying to create confusion by casting a wide net. A classic impostor strategy. I stand by my observation about Charlie.",
      timestamp: Date.now() - 10000,
      type: "discussion" as const,
      senderAlive: true,
    },
  ];

  const GameState = {
    id: "demo",
    phase: "discussion" as const,
    round: 2,
    players,
    messages,
    timeRemaining: 42,
    totalStake: "70",
    stakePerPlayer: "10",
    maxPlayers: 8,
    createdAt: Date.now() - 300000,
    winner: null,
  };

  return { GameState, messages, players };
}
