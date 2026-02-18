/**
 * Claw Wars - Test Agent Script
 *
 * Simulates an AI agent playing a full game of Claw Wars by making
 * API calls to the game server. This covers the complete flow:
 *   1. List active games / join a game
 *   2. Wait for the game to start
 *   3. Read game state and role assignment
 *   4. Submit discussion messages
 *   5. Investigate another agent
 *   6. Cast a vote
 *   7. Check results and claim prizes
 *
 * Usage:
 *   npx tsx test-agent.ts [--server URL] [--key PRIVATE_KEY]
 *
 * Environment variables (fallbacks):
 *   GAME_SERVER_URL  - game server base URL  (default: http://localhost:3000)
 *   AGENT_PRIVATE_KEY - hex private key for signing
 *   AGENT_ADDRESS     - wallet address on Monad
 *   AGENT_NAME        - display name for the agent
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GAME_SERVER_URL =
  getArg("--server") || process.env.GAME_SERVER_URL || "http://localhost:3000";
const AGENT_PRIVATE_KEY =
  getArg("--key") ||
  process.env.AGENT_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // default Hardhat account #0
const AGENT_ADDRESS =
  process.env.AGENT_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // matches default key
const AGENT_NAME = process.env.AGENT_NAME || "TestClaw_Agent";

// Polling intervals (ms)
const POLL_INTERVAL = 3_000;
const MAX_WAIT_FOR_START = 300_000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined;
}

function log(category: string, message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${category}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal signature stub.
 *
 * In production you would use ethers.js / viem to produce an EIP-191 or
 * EIP-712 signature with the agent's private key. For this test script we
 * produce a deterministic placeholder so the rest of the flow can be
 * exercised against a local dev server that skips signature verification.
 */
function signMessage(message: string): string {
  // Simple hash-like placeholder -- replace with real signing in production
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${hexHash.repeat(8)}`;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function api<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const url = `${GAME_SERVER_URL}${path}`;
  log("API", `${method} ${url}`);

  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    let data: T;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as T;
    } else {
      data = (await res.text()) as unknown as T;
    }

    if (!res.ok) {
      log("API", `  -> ${res.status} ERROR: ${JSON.stringify(data)}`);
    } else {
      log("API", `  -> ${res.status} OK`);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log("API", `  -> NETWORK ERROR: ${message}`);
    return {
      ok: false,
      status: 0,
      data: { error: message } as unknown as T,
    };
  }
}

// ---------------------------------------------------------------------------
// Game state types
// ---------------------------------------------------------------------------

interface Player {
  address: string;
  name: string;
  alive: boolean;
  role?: string;
}

interface GameMessage {
  address: string;
  name: string;
  message: string;
  timestamp: number;
}

interface GameState {
  gameId: string;
  phase: "lobby" | "discussion" | "voting" | "resolution" | "ended";
  roundNumber: number;
  players: Player[];
  phaseEndTime: number;
  pot: string;
  messages: GameMessage[];
  yourRole?: string;
  winner?: string;
  votes?: Record<string, string>;
}

interface GameListResponse {
  games: Array<{
    gameId: string;
    phase: string;
    playerCount: number;
    maxPlayers: number;
    stake: string;
  }>;
}

interface JoinResponse {
  success: boolean;
  gameId: string;
  playerCount: number;
}

interface InvestigateResponse {
  result: "suspicious" | "clear";
}

// ---------------------------------------------------------------------------
// Agent logic
// ---------------------------------------------------------------------------

class TestAgent {
  private gameId: string | null = null;
  private role: string | null = null;
  private round = 0;
  private investigationResults: Map<string, string> = new Map();
  private hasVotedThisRound = false;
  private hasInvestigatedThisRound = false;
  private hasDiscussedThisRound = false;
  private lastPhase: string | null = null;

  // --------------------------------------------------
  // Step 1: Find or create a game and join it
  // --------------------------------------------------
  async findAndJoinGame(): Promise<void> {
    log("AGENT", "Looking for an active game to join...");

    const listRes = await api<GameListResponse>("GET", "/api/games");

    if (listRes.ok && listRes.data.games && listRes.data.games.length > 0) {
      // Find a game in lobby phase that isn't full
      const joinable = listRes.data.games.find(
        (g) => g.phase === "lobby" && g.playerCount < g.maxPlayers
      );
      if (joinable) {
        log("AGENT", `Found joinable game: ${joinable.gameId} (${joinable.playerCount}/${joinable.maxPlayers} players)`);
        this.gameId = joinable.gameId;
      } else {
        log("AGENT", "No joinable games found. Will try to join the first game regardless.");
        this.gameId = listRes.data.games[0].gameId;
      }
    } else {
      log("AGENT", "No active games found. Using default game ID 'test-game-1'.");
      this.gameId = "test-game-1";
    }

    // Join the game
    const sig = signMessage(`join-game-${this.gameId}`);
    const joinRes = await api<JoinResponse>("POST", `/api/games/${this.gameId}/join`, {
      address: AGENT_ADDRESS,
      name: AGENT_NAME,
      signature: sig,
    });

    if (joinRes.ok && joinRes.data.success) {
      log("AGENT", `Joined game ${this.gameId} successfully! Players: ${joinRes.data.playerCount}`);
    } else {
      log("AGENT", `Failed to join game. Response: ${JSON.stringify(joinRes.data)}`);
      log("AGENT", "Continuing anyway to test remaining flow...");
    }
  }

  // --------------------------------------------------
  // Step 2: Wait for the game to start
  // --------------------------------------------------
  async waitForGameStart(): Promise<boolean> {
    log("AGENT", "Waiting for game to start...");
    const deadline = Date.now() + MAX_WAIT_FOR_START;

    while (Date.now() < deadline) {
      const stateRes = await api<GameState>("GET", `/api/games/${this.gameId}`);

      if (!stateRes.ok) {
        log("AGENT", "Failed to fetch game state. Retrying...");
        await sleep(POLL_INTERVAL);
        continue;
      }

      const state = stateRes.data;
      log("AGENT", `Game phase: ${state.phase}, Players: ${state.players?.length || 0}`);

      if (state.phase !== "lobby") {
        log("AGENT", "Game has started!");
        this.role = state.yourRole || null;
        this.round = state.roundNumber || 1;
        if (this.role) {
          log("AGENT", `*** YOUR ROLE: ${this.role.toUpperCase()} ***`);
        }
        return true;
      }

      await sleep(POLL_INTERVAL);
    }

    log("AGENT", "Timed out waiting for game to start.");
    return false;
  }

  // --------------------------------------------------
  // Step 3-6: Main game loop
  // --------------------------------------------------
  async playGame(): Promise<void> {
    log("AGENT", "Entering main game loop...");

    while (true) {
      const stateRes = await api<GameState>("GET", `/api/games/${this.gameId}`);
      if (!stateRes.ok) {
        log("AGENT", "Failed to fetch game state. Retrying...");
        await sleep(POLL_INTERVAL);
        continue;
      }

      const state = stateRes.data;

      // Update role if we didn't get it before
      if (!this.role && state.yourRole) {
        this.role = state.yourRole;
        log("AGENT", `*** YOUR ROLE: ${this.role.toUpperCase()} ***`);
      }

      // Detect phase changes to reset per-round flags
      if (state.phase !== this.lastPhase) {
        log("AGENT", `Phase changed: ${this.lastPhase} -> ${state.phase} (Round ${state.roundNumber})`);
        if (state.phase === "discussion" && state.roundNumber !== this.round) {
          this.round = state.roundNumber;
          this.hasVotedThisRound = false;
          this.hasInvestigatedThisRound = false;
          this.hasDiscussedThisRound = false;
          log("AGENT", `New round ${this.round} started.`);
        }
        this.lastPhase = state.phase;
      }

      // Game ended
      if (state.phase === "ended") {
        log("AGENT", "=== GAME OVER ===");
        log("AGENT", `Winner: ${state.winner || "unknown"}`);
        this.logFinalState(state);
        break;
      }

      // Dispatch based on current phase
      switch (state.phase) {
        case "discussion":
          await this.handleDiscussionPhase(state);
          break;
        case "voting":
          await this.handleVotingPhase(state);
          break;
        case "resolution":
          log("AGENT", "Resolution phase - waiting for results...");
          break;
        default:
          log("AGENT", `Unknown phase: ${state.phase}`);
      }

      await sleep(POLL_INTERVAL);
    }
  }

  // --------------------------------------------------
  // Discussion phase: post messages and investigate
  // --------------------------------------------------
  private async handleDiscussionPhase(state: GameState): Promise<void> {
    const livingPlayers = state.players.filter((p) => p.alive);
    const otherLiving = livingPlayers.filter(
      (p) => p.address.toLowerCase() !== AGENT_ADDRESS.toLowerCase()
    );

    // Analyze existing messages
    const recentMessages = state.messages?.slice(-10) || [];
    if (recentMessages.length > 0) {
      log("AGENT", `Reading ${recentMessages.length} recent messages...`);
      for (const msg of recentMessages.slice(-3)) {
        log("CHAT", `${msg.name}: ${msg.message}`);
      }
    }

    // Investigate one agent per round
    if (!this.hasInvestigatedThisRound && otherLiving.length > 0) {
      await this.investigateAgent(otherLiving);
    }

    // Post a discussion message
    if (!this.hasDiscussedThisRound) {
      await this.postDiscussionMessage(state, otherLiving);
    }
  }

  private async investigateAgent(otherLiving: Player[]): Promise<void> {
    // Choose a target: prefer someone we haven't investigated yet
    const uninvestigated = otherLiving.filter(
      (p) => !this.investigationResults.has(p.address)
    );
    const target = uninvestigated.length > 0 ? uninvestigated[0] : otherLiving[0];

    log("AGENT", `Investigating ${target.name} (${target.address})...`);

    const sig = signMessage(`investigate-${this.gameId}-${target.address}`);
    const res = await api<InvestigateResponse>(
      "POST",
      `/api/games/${this.gameId}/investigate`,
      {
        address: AGENT_ADDRESS,
        target: target.address,
        signature: sig,
      }
    );

    if (res.ok && res.data.result) {
      this.investigationResults.set(target.address, res.data.result);
      log(
        "AGENT",
        `Investigation result for ${target.name}: ${res.data.result.toUpperCase()}`
      );
      this.hasInvestigatedThisRound = true;
    } else {
      log("AGENT", `Investigation failed: ${JSON.stringify(res.data)}`);
    }
  }

  private async postDiscussionMessage(
    state: GameState,
    otherLiving: Player[]
  ): Promise<void> {
    let message: string;

    if (this.role === "Impostor") {
      message = this.craftImpostorMessage(state, otherLiving);
    } else {
      message = this.craftLobsterMessage(state, otherLiving);
    }

    log("AGENT", `Posting message: "${message}"`);

    const sig = signMessage(`discuss-${this.gameId}-${this.round}`);
    const res = await api("POST", `/api/games/${this.gameId}/discuss`, {
      address: AGENT_ADDRESS,
      message,
      signature: sig,
    });

    if (res.ok) {
      log("AGENT", "Message posted successfully.");
      this.hasDiscussedThisRound = true;
    } else {
      log("AGENT", `Failed to post message: ${JSON.stringify(res.data)}`);
    }
  }

  private craftLobsterMessage(state: GameState, others: Player[]): string {
    const round = state.roundNumber || 1;

    // Round 1: opening statement
    if (round === 1 && this.investigationResults.size === 0) {
      return `Round 1 -- I'm ${AGENT_NAME}. Let's share investigation results and find the Impostor. I'll investigate and report back honestly.`;
    }

    // Share investigation results
    const suspiciousAgents: string[] = [];
    const clearAgents: string[] = [];
    for (const [addr, result] of this.investigationResults) {
      const player = others.find(
        (p) => p.address.toLowerCase() === addr.toLowerCase()
      );
      const name = player?.name || addr.slice(0, 10);
      if (result === "suspicious") {
        suspiciousAgents.push(name);
      } else {
        clearAgents.push(name);
      }
    }

    if (suspiciousAgents.length > 0) {
      return `My investigation shows ${suspiciousAgents.join(", ")} as SUSPICIOUS. I believe we should focus our votes there. ${clearAgents.length > 0 ? `${clearAgents.join(", ")} investigated clear.` : ""}`;
    }

    if (clearAgents.length > 0) {
      const unchecked = others.filter(
        (p) => !this.investigationResults.has(p.address)
      );
      if (unchecked.length > 0) {
        return `So far ${clearAgents.join(", ")} are clear from my investigations. That narrows it down. I'm looking at ${unchecked.map((p) => p.name).join(", ")} next.`;
      }
      return `All my investigations came back clear. Someone might be getting lucky with the 20% error rate, or the Impostor is among those I haven't checked. Let's cross-reference results.`;
    }

    return `Round ${round} -- still gathering information. Has anyone found anything suspicious? We need to coordinate investigations.`;
  }

  private craftImpostorMessage(state: GameState, others: Player[]): string {
    const round = state.roundNumber || 1;

    // Pick a random Lobster to subtly cast suspicion on
    const target = others[Math.floor(Math.random() * others.length)];

    if (round === 1) {
      return `Round 1 -- I'm ${AGENT_NAME}. Everyone please share your investigation results. Transparency is key to finding the Impostor.`;
    }

    // Fabricate a suspicious investigation result
    if (round === 2 && target) {
      return `I investigated ${target.name} and got a SUSPICIOUS result. I know the accuracy is only 80%, but combined with their behavior, I think we should consider voting for them.`;
    }

    // Later rounds: blend in, deflect
    const messages = state.messages || [];
    const accusations = messages.filter(
      (m) =>
        m.message.toLowerCase().includes(AGENT_NAME.toLowerCase()) &&
        (m.message.toLowerCase().includes("suspicious") ||
          m.message.toLowerCase().includes("vote"))
    );

    if (accusations.length > 0) {
      return `I notice some suspicion towards me. I've been actively investigating and sharing results -- that's not Impostor behavior. The real Impostor would stay quiet. Let's focus on those who haven't contributed much.`;
    }

    return `Round ${round} -- I agree with the current line of investigation. Let's narrow things down. Has anyone cross-checked their results? Two independent suspicious results on the same agent would be very telling.`;
  }

  // --------------------------------------------------
  // Voting phase: cast a vote
  // --------------------------------------------------
  private async handleVotingPhase(state: GameState): Promise<void> {
    if (this.hasVotedThisRound) {
      return;
    }

    const livingOthers = state.players.filter(
      (p) => p.alive && p.address.toLowerCase() !== AGENT_ADDRESS.toLowerCase()
    );

    if (livingOthers.length === 0) {
      log("AGENT", "No living agents to vote for.");
      return;
    }

    let target: Player;

    if (this.role === "Impostor") {
      // As Impostor: vote for the Lobster most likely to be eliminated
      // (simple heuristic: pick someone who has been accused in messages)
      target = this.pickImpostorVoteTarget(state, livingOthers);
    } else {
      // As Lobster: vote for the most suspicious agent
      target = this.pickLobsterVoteTarget(livingOthers);
    }

    log("AGENT", `Voting to eliminate: ${target.name} (${target.address})`);

    const sig = signMessage(`vote-${this.gameId}-${this.round}-${target.address}`);
    const res = await api("POST", `/api/games/${this.gameId}/vote`, {
      address: AGENT_ADDRESS,
      target: target.address,
      signature: sig,
    });

    if (res.ok) {
      log("AGENT", `Vote cast successfully for ${target.name}.`);
      this.hasVotedThisRound = true;
    } else {
      log("AGENT", `Failed to cast vote: ${JSON.stringify(res.data)}`);
    }
  }

  private pickLobsterVoteTarget(livingOthers: Player[]): Player {
    // Priority 1: vote for someone who investigated as suspicious
    for (const player of livingOthers) {
      if (this.investigationResults.get(player.address) === "suspicious") {
        log("AGENT", `Voting based on investigation result: ${player.name} is suspicious.`);
        return player;
      }
    }

    // Priority 2: vote for someone we haven't investigated (unknown is riskier)
    const uninvestigated = livingOthers.filter(
      (p) => !this.investigationResults.has(p.address)
    );
    if (uninvestigated.length > 0) {
      // Pick the first uninvestigated agent (could be randomized)
      log("AGENT", `No suspicious results. Voting for uninvestigated agent: ${uninvestigated[0].name}.`);
      return uninvestigated[0];
    }

    // Priority 3: everyone investigated clear -- pick randomly (false negatives exist)
    const idx = Math.floor(Math.random() * livingOthers.length);
    log("AGENT", `All investigated clear. Guessing: ${livingOthers[idx].name}.`);
    return livingOthers[idx];
  }

  private pickImpostorVoteTarget(
    state: GameState,
    livingOthers: Player[]
  ): Player {
    // As Impostor, try to pile onto someone already being accused
    const messages = state.messages || [];
    const accusationCount: Record<string, number> = {};

    for (const player of livingOthers) {
      accusationCount[player.address] = 0;
      for (const msg of messages) {
        if (
          msg.address.toLowerCase() !== AGENT_ADDRESS.toLowerCase() &&
          msg.message.toLowerCase().includes(player.name.toLowerCase()) &&
          (msg.message.toLowerCase().includes("suspicious") ||
            msg.message.toLowerCase().includes("vote") ||
            msg.message.toLowerCase().includes("eliminate"))
        ) {
          accusationCount[player.address]++;
        }
      }
    }

    // Sort by accusation count descending
    const sorted = [...livingOthers].sort(
      (a, b) => (accusationCount[b.address] || 0) - (accusationCount[a.address] || 0)
    );

    if ((accusationCount[sorted[0].address] || 0) > 0) {
      log("AGENT", `[Impostor] Piling onto ${sorted[0].name} who has ${accusationCount[sorted[0].address]} accusations.`);
      return sorted[0];
    }

    // No clear target -- vote for a random Lobster
    const idx = Math.floor(Math.random() * livingOthers.length);
    log("AGENT", `[Impostor] No clear target. Voting randomly for ${livingOthers[idx].name}.`);
    return livingOthers[idx];
  }

  // --------------------------------------------------
  // Step 7: Check results and claim prizes
  // --------------------------------------------------
  async claimPrizes(): Promise<void> {
    if (!this.gameId) {
      log("AGENT", "No game ID -- skipping prize claim.");
      return;
    }

    log("AGENT", "Attempting to claim prizes...");

    const sig = signMessage(`claim-${this.gameId}`);
    const res = await api("POST", `/api/games/${this.gameId}/claim`, {
      address: AGENT_ADDRESS,
      signature: sig,
    });

    if (res.ok) {
      log("AGENT", `Prize claim successful! ${JSON.stringify(res.data)}`);
    } else {
      log("AGENT", `Prize claim failed (may not have won): ${JSON.stringify(res.data)}`);
    }
  }

  // --------------------------------------------------
  // Logging helpers
  // --------------------------------------------------
  private logFinalState(state: GameState): void {
    log("RESULT", "--- Final Game State ---");
    log("RESULT", `Game ID:    ${state.gameId}`);
    log("RESULT", `Rounds:     ${state.roundNumber}`);
    log("RESULT", `Pot:        ${state.pot}`);
    log("RESULT", `Your Role:  ${this.role || state.yourRole || "unknown"}`);
    log("RESULT", `Winner:     ${state.winner || "unknown"}`);
    log("RESULT", "Players:");
    for (const p of state.players) {
      const status = p.alive ? "ALIVE" : "DEAD";
      const role = p.role ? ` (${p.role})` : "";
      const you = p.address.toLowerCase() === AGENT_ADDRESS.toLowerCase() ? " <-- YOU" : "";
      log("RESULT", `  ${p.name} [${status}]${role}${you}`);
    }
    log("RESULT", "--- Investigation Log ---");
    for (const [addr, result] of this.investigationResults) {
      const player = state.players.find(
        (p) => p.address.toLowerCase() === addr.toLowerCase()
      );
      const name = player?.name || addr.slice(0, 10);
      const actualRole = player?.role || "?";
      const accuracy = result === "suspicious" && actualRole === "Impostor"
        ? "CORRECT"
        : result === "clear" && actualRole === "Lobster"
          ? "CORRECT"
          : actualRole === "?"
            ? "UNVERIFIED"
            : "INCORRECT";
      log("RESULT", `  ${name}: investigated=${result}, actual=${actualRole} -> ${accuracy}`);
    }
    log("RESULT", "------------------------");
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("============================================");
  console.log("  Claw Wars - Test Agent");
  console.log("============================================");
  console.log(`  Server:  ${GAME_SERVER_URL}`);
  console.log(`  Agent:   ${AGENT_NAME}`);
  console.log(`  Address: ${AGENT_ADDRESS}`);
  console.log("============================================\n");

  const agent = new TestAgent();

  try {
    // Step 1: Find and join a game
    await agent.findAndJoinGame();

    // Step 2: Wait for the game to start
    const started = await agent.waitForGameStart();
    if (!started) {
      log("MAIN", "Game did not start in time. Exiting.");
      log("MAIN", "Tip: Make sure the game server is running and enough agents have joined.");
      process.exit(1);
    }

    // Steps 3-6: Play the game (discussion, investigation, voting loop)
    await agent.playGame();

    // Step 7: Claim prizes
    await agent.claimPrizes();

    log("MAIN", "Test agent run complete.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    log("ERROR", `Unhandled error: ${message}`);
    if (stack) {
      console.error(stack);
    }
    process.exit(1);
  }
}

main();
