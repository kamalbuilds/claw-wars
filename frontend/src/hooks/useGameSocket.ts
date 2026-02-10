"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, ChatMessage, Player, GamePhase, WebSocketEvent } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface UseGameSocketReturn {
  gameState: GameState | null;
  messages: ChatMessage[];
  phase: GamePhase | null;
  players: Player[];
  timeRemaining: number;
  connected: boolean;
  error: string | null;
  winner: "lobsters" | "impostor" | null;
}

export function useGameSocket(gameId: string | null): UseGameSocketReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<GamePhase | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winner, setWinner] = useState<"lobsters" | "impostor" | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!gameId) return;

    try {
      const ws = new WebSocket(`${WS_URL}?gameId=${gameId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        ws.send(JSON.stringify({ type: "subscribe", gameId }));
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent = JSON.parse(event.data) as WebSocketEvent;

          switch (wsEvent.type) {
            case "game_state":
              setGameState(wsEvent.data);
              setPlayers(wsEvent.data.players);
              setPhase(wsEvent.data.phase);
              setTimeRemaining(wsEvent.data.timeRemaining);
              setMessages(wsEvent.data.messages);
              setWinner(wsEvent.data.winner);
              break;

            case "phase_change":
              setPhase(wsEvent.data.phase);
              setTimeRemaining(wsEvent.data.timeRemaining);
              break;

            case "message":
              setMessages((prev) => [...prev, wsEvent.data]);
              break;

            case "vote":
              setPlayers((prev) =>
                prev.map((p) =>
                  p.address === wsEvent.data.voter
                    ? { ...p, votedFor: wsEvent.data.target }
                    : p
                )
              );
              break;

            case "elimination":
              setPlayers((prev) =>
                prev.map((p) =>
                  p.address === wsEvent.data.player
                    ? { ...p, isAlive: false, role: wsEvent.data.role }
                    : p
                )
              );
              break;

            case "game_end":
              setWinner(wsEvent.data.winner);
              setPhase("results");
              break;

            case "player_speaking":
              setPlayers((prev) =>
                prev.map((p) =>
                  p.address === wsEvent.data.player
                    ? { ...p, isSpeaking: wsEvent.data.isSpeaking }
                    : p
                )
              );
              break;

            case "error":
              setError(wsEvent.data.message);
              break;
          }
        } catch {
          console.error("Failed to parse WebSocket message");
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, RECONNECT_DELAY);
        } else {
          setError("Lost connection to game server. Please refresh.");
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
      };
    } catch {
      setError("Failed to connect to game server");
    }
  }, [gameId]);

  // Countdown timer
  useEffect(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    if (timeRemaining > 0 && phase && phase !== "results") {
      timerInterval.current = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [timeRemaining, phase]);

  // Connect / disconnect
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [connect]);

  return {
    gameState,
    messages,
    phase,
    players,
    timeRemaining,
    connected,
    error,
    winner,
  };
}
