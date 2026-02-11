"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, ChatMessage, Player, GamePhase, WebSocketEvent } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const POLL_INTERVAL = 3000;

function getWsUrl(gameId: string): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    // On HTTPS, route through Next.js rewrite proxy to avoid mixed content
    return `wss://${window.location.host}/ws?gameId=${gameId}`;
  }
  return `${WS_URL}?gameId=${gameId}`;
}

function getApiBase(): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return "/engine";
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  return apiUrl;
}

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

const PHASE_MAP: Record<number, GamePhase> = {
  0: "lobby",
  1: "discussion",
  2: "voting",
  3: "elimination",
  4: "results",
};

function normalizePhase(phase: unknown): GamePhase {
  if (typeof phase === "number") return PHASE_MAP[phase] ?? "lobby";
  if (typeof phase === "string" && ["lobby", "discussion", "voting", "elimination", "results"].includes(phase)) {
    return phase as GamePhase;
  }
  return "lobby";
}

function normalizePlayers(raw: unknown[]): Player[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    address: p.address ?? "",
    name: p.name ?? "",
    role: p.role ?? "unknown",
    isAlive: p.isAlive ?? p.alive ?? true,
    votedFor: p.votedFor ?? null,
    isSpeaking: p.isSpeaking ?? false,
  }));
}

function normalizeMessage(m: any): ChatMessage {
  return {
    id: m.id ?? String(m.timestamp ?? Math.random()),
    sender: m.sender ?? "",
    senderName: m.senderName ?? m.sender_name ?? "",
    content: m.content ?? "",
    timestamp: m.timestamp ?? Date.now(),
    type: m.type ?? "discussion",
    senderAlive: m.senderAlive ?? m.sender_alive ?? true,
  };
}

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMessage);
}

function normalizeGameState(data: any, fallbackId: string): GameState {
  return {
    id: data.gameId ?? data.id ?? fallbackId,
    phase: normalizePhase(data.phase),
    round: data.roundNumber ?? data.round ?? 1,
    players: normalizePlayers(data.players ?? []),
    messages: normalizeMessages(data.messages),
    timeRemaining: data.timeRemaining ?? 0,
    totalStake: data.totalStake ?? "0",
    stakePerPlayer: data.stakePerPlayer ?? "0",
    maxPlayers: data.maxPlayers ?? 8,
    createdAt: data.createdAt ?? Date.now(),
    winner: data.winner ?? null,
  };
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
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const wsFailedRef = useRef(false);
  const serverTimeRef = useRef(0); // Track server-sent time to avoid jitter

  // Set server time from external updates (WS or polling) without triggering timer jitter
  const updateServerTime = useCallback((newTime: number) => {
    if (Math.abs(newTime - serverTimeRef.current) > 1) {
      serverTimeRef.current = newTime;
      setTimeRemaining(newTime);
    }
  }, []);

  // HTTP polling fallback when WebSocket fails
  const startPolling = useCallback(() => {
    if (!gameId || pollInterval.current) return;

    const poll = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/games/${gameId}`);
        if (!res.ok) return;
        const data = await res.json();

        const normalized = normalizeGameState(data, gameId);

        setGameState(normalized);
        setPhase(normalized.phase);
        setPlayers(normalized.players);
        updateServerTime(normalized.timeRemaining);
        setMessages(normalized.messages);
        if (normalized.winner) setWinner(normalized.winner);
        setConnected(true);
        setError(null);
      } catch {
        // Silently continue polling
      }
    };

    poll(); // Immediate first poll
    pollInterval.current = setInterval(poll, POLL_INTERVAL);
  }, [gameId, updateServerTime]);

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!gameId) return;

    try {
      const wsUrl = getWsUrl(gameId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        wsFailedRef.current = false;
        stopPolling(); // Stop polling if WS connects

        ws.send(JSON.stringify({ type: "subscribe", gameId }));
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent = JSON.parse(event.data) as WebSocketEvent;

          switch (wsEvent.type) {
            case "game_state": {
              const normalized = normalizeGameState(wsEvent.data, gameId ?? "unknown");
              setGameState(normalized);
              setPlayers(normalized.players);
              setPhase(normalized.phase);
              updateServerTime(normalized.timeRemaining);
              setMessages(normalized.messages);
              setWinner(normalized.winner);
              break;
            }

            case "phase_change":
              setPhase(normalizePhase(wsEvent.data.phase));
              updateServerTime(wsEvent.data.timeRemaining ?? 0);
              break;

            case "message":
              setMessages((prev) => [...prev, normalizeMessage(wsEvent.data)]);
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
          // WebSocket exhausted retries - fall back to HTTP polling
          wsFailedRef.current = true;
          setError(null); // Clear error since polling will take over
          startPolling();
        }
      };

      ws.onerror = () => {
        // Don't show error to user if we'll fall back to polling
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS - 1) {
          setError(null);
        } else {
          setError("Connecting...");
        }
      };
    } catch {
      // WebSocket constructor failed - fall back to polling
      wsFailedRef.current = true;
      startPolling();
    }
  }, [gameId, startPolling, stopPolling, updateServerTime]);

  // Countdown timer - only depends on phase, not timeRemaining
  useEffect(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    if (phase && phase !== "results" && phase !== "lobby") {
      timerInterval.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const next = Math.max(0, prev - 1);
          serverTimeRef.current = next;
          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [phase]);

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
      stopPolling();
    };
  }, [connect, stopPolling]);

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
