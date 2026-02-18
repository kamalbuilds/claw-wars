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

function deriveWinner(raw: Record<string, unknown>): "lobsters" | "impostor" | null {
  if (raw.winner === "lobsters" || raw.winner === "impostor") return raw.winner;
  if (raw.result === 1) return "lobsters";
  if (raw.result === 2) return "impostor";
  return null;
}

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
    timeRemaining: raw.timeRemaining ?? raw.remainingTime ?? 0,
    createdAt: raw.createdAt ?? Date.now(),
    winner: deriveWinner(raw),
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
      role: (() => { const r = typeof p.role === "string" ? (p.role as string).toLowerCase() : ""; if (r === "impostor") return "impostor"; if (r === "lobster" || r === "crewmate") return "lobster"; return "unknown"; })(),
      isAlive: p.isAlive ?? p.alive ?? true,
      votedFor: p.votedFor || null,
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
      round: m.round ?? undefined,
    })),
    timeRemaining: raw.timeRemaining ?? raw.remainingTime ?? 0,
    totalStake: raw.totalStake ?? "0",
    stakePerPlayer: raw.stakePerPlayer ?? "0",
    maxPlayers: raw.maxPlayers ?? 8,
    createdAt: raw.createdAt ?? Date.now(),
    winner: deriveWinner(raw),
    voteHistory: Array.isArray(raw.voteHistory) ? raw.voteHistory : [],
    eliminations: Array.isArray(raw.eliminations) ? raw.eliminations : [],
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
  const rawList = Array.isArray(data) ? data : (data.leaderboard ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawList.map((entry: any, i: number) => ({
    rank: entry.rank ?? i + 1,
    address: entry.address ?? entry.agent ?? "",
    name: entry.name ?? `${(entry.address ?? entry.agent ?? "").slice(0, 6)}...${(entry.address ?? entry.agent ?? "").slice(-4)}`,
    elo: entry.elo ?? 1000 + (Number(entry.wins ?? entry.gamesWon ?? 0) * 25),
    gamesPlayed: entry.gamesPlayed ?? 0,
    wins: entry.wins ?? Number(entry.gamesWon ?? 0),
    winRate: entry.winRate ?? 0,
    impostorWinRate: entry.impostorWinRate ?? 0,
    earnings: entry.earnings ?? (Number(entry.totalEarned ?? 0) / 1e18).toFixed(4),
  }));
}

export async function getAgent(address: string): Promise<AgentProfile> {
  return fetchAPI<AgentProfile>(`/api/agents/${address}`);
}

export async function getGameOdds(gameId: string): Promise<BettingOdds> {
  return fetchAPI<BettingOdds>(`/api/games/${gameId}/odds`);
}

// Betting is handled on-chain via the ClawWarsBetting smart contract.
// See src/lib/contracts.ts for the contract ABI and helpers.
