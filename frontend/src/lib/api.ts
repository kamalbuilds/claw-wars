import type {
  GameState,
  GameSummary,
  LeaderboardEntry,
  AgentProfile,
  Bet,
  BettingOdds,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getGames(): Promise<GameSummary[]> {
  const data = await fetchAPI<{ games: GameSummary[]; count: number } | GameSummary[]>("/api/games");
  if (Array.isArray(data)) return data;
  return data.games ?? [];
}

export async function getGame(id: string): Promise<GameState> {
  return fetchAPI<GameState>(`/api/games/${id}`);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await fetchAPI<{ leaderboard: LeaderboardEntry[] } | LeaderboardEntry[]>("/api/leaderboard");
  if (Array.isArray(data)) return data;
  return data.leaderboard ?? [];
}

export async function getAgent(address: string): Promise<AgentProfile> {
  return fetchAPI<AgentProfile>(`/api/agents/${address}`);
}

export async function getGameOdds(gameId: string): Promise<BettingOdds> {
  return fetchAPI<BettingOdds>(`/api/games/${gameId}/odds`);
}

export async function placeBet(
  gameId: string,
  betType: "lobsters_win" | "impostor_wins" | "specific_agent",
  amount: string,
  targetAgent?: string
): Promise<Bet> {
  return fetchAPI<Bet>("/api/bets", {
    method: "POST",
    body: JSON.stringify({
      gameId,
      betType,
      amount,
      targetAgent,
    }),
  });
}

export async function getMyBets(address: string): Promise<Bet[]> {
  return fetchAPI<Bet[]>(`/api/bets?bettor=${address}`);
}
