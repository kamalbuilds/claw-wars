import type {
  GameState,
  GameSummary,
  GamePhase,
  LeaderboardEntry,
  AgentProfile,
  Bet,
  BettingOdds,
} from "./types";

// In production, use /engine proxy (avoids mixed content HTTPS→HTTP).
// In development, call the engine directly.
const API_URL =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "" // use Next.js rewrite proxy at /engine
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getApiBase(endpoint: string): string {
  if (API_URL === "") {
    return `/engine${endpoint}`;
  }
  return `${API_URL}${endpoint}`;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = options ?? {};
  const res = await fetch(getApiBase(endpoint), {
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders instanceof Headers
        ? Object.fromEntries(extraHeaders.entries())
        : extraHeaders ?? {}),
    },
    ...rest,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── Engine → Frontend data transformation ───

const PHASE_MAP: Record<number, GamePhase> = {
  0: "lobby",
  1: "discussion",
  2: "voting",
  3: "elimination",
  4: "results",
};

function toPhase(phase: number | string): GamePhase {
  if (typeof phase === "number") return PHASE_MAP[phase] ?? "lobby";
  if (typeof phase === "string" && ["lobby", "discussion", "voting", "elimination", "results"].includes(phase))
    return phase as GamePhase;
  return "lobby";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGameSummary(raw: any): GameSummary {
  return {
    id: raw.gameId ?? raw.id ?? "unknown",
    phase: toPhase(raw.phase),
    playerCount: raw.playerCount ?? 0,
    maxPlayers: raw.maxPlayers ?? 8,
    stakePerPlayer: raw.stakePerPlayer ?? "0",
    totalStake: raw.totalStake ?? "0",
    round: raw.roundNumber ?? raw.round ?? 1,
    timeRemaining: raw.timeRemaining ?? 0,
    createdAt: raw.createdAt ?? Date.now(),
    winner: raw.winner ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGameState(raw: any): GameState {
  return {
    id: raw.gameId ?? raw.id ?? "unknown",
    phase: toPhase(raw.phase),
    round: raw.roundNumber ?? raw.round ?? 1,
    players: (raw.players ?? []).map((p: Record<string, unknown>) => ({
      address: p.address ?? "",
      name: (p.name as string) ?? "",
      role: p.role ?? "unknown",
      isAlive: p.isAlive ?? p.alive ?? true,
      votedFor: (p.votedFor as string) ?? null,
      isSpeaking: p.isSpeaking ?? false,
    })),
    messages: (raw.messages ?? []).map((m: Record<string, unknown>) => ({
      id: m.id ?? String(m.timestamp ?? Math.random()),
      sender: m.sender ?? "",
      senderName: m.senderName ?? "",
      content: m.content ?? "",
      timestamp: m.timestamp ?? Date.now(),
      type: m.type ?? "discussion",
      senderAlive: m.senderAlive ?? true,
    })),
    timeRemaining: raw.timeRemaining ?? 0,
    totalStake: raw.totalStake ?? "0",
    stakePerPlayer: raw.stakePerPlayer ?? "0",
    maxPlayers: raw.maxPlayers ?? 8,
    createdAt: raw.createdAt ?? Date.now(),
    winner: raw.winner ?? null,
  };
}

// ─── Public API functions ───

export async function getGames(): Promise<GameSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fetchAPI<any>("/api/games");
  const rawList = Array.isArray(data) ? data : (data.games ?? []);
  return rawList.map(toGameSummary);
}

export async function getGame(id: string): Promise<GameState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchAPI<any>(`/api/games/${id}`);
  return toGameState(raw);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fetchAPI<any>("/api/leaderboard");
  if (Array.isArray(data)) return data;
  return data.leaderboard ?? [];
}

export async function getAgent(address: string): Promise<AgentProfile> {
  return fetchAPI<AgentProfile>(`/api/agents/${address}`);
}

export async function getGameOdds(gameId: string): Promise<BettingOdds> {
  return fetchAPI<BettingOdds>(`/api/games/${gameId}/odds`);
}

// Betting is handled on-chain via the AmongClawsBetting smart contract.
// See src/lib/contracts.ts for the contract ABI and helpers.
