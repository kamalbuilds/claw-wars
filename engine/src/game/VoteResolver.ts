import { logger } from "../utils/logger.js";

const voteLogger = logger.child("VoteResolver");

interface VoteRecord {
  voter: `0x${string}`;
  target: `0x${string}`;
  timestamp: number;
}

// gameId -> list of votes
const voteStorage = new Map<string, VoteRecord[]>();

export function recordVote(
  gameId: string,
  voter: `0x${string}`,
  target: `0x${string}`
): void {
  if (!voteStorage.has(gameId)) {
    voteStorage.set(gameId, []);
  }

  const votes = voteStorage.get(gameId)!;

  // Check if voter already voted this round, replace if so
  const existingIdx = votes.findIndex(
    (v) => v.voter.toLowerCase() === voter.toLowerCase()
  );
  if (existingIdx >= 0) {
    voteLogger.info(
      `Player ${voter} changed vote from ${votes[existingIdx].target} to ${target} in game ${gameId}`
    );
    votes[existingIdx] = { voter, target, timestamp: Date.now() };
  } else {
    votes.push({ voter, target, timestamp: Date.now() });
    voteLogger.info(
      `Player ${voter} voted for ${target} in game ${gameId}`
    );
  }
}

export function resolveVotes(gameId: string): `0x${string}` | null {
  const tally = getVoteTally(gameId);

  if (tally.size === 0) {
    voteLogger.info(`No votes cast in game ${gameId}`);
    return null;
  }

  // Find the maximum vote count
  let maxVotes = 0;
  let maxTargets: `0x${string}`[] = [];

  for (const [target, count] of tally) {
    if (count > maxVotes) {
      maxVotes = count;
      maxTargets = [target];
    } else if (count === maxVotes) {
      maxTargets.push(target);
    }
  }

  // If tie, no elimination
  if (maxTargets.length > 1) {
    voteLogger.info(
      `Vote tie in game ${gameId} between ${maxTargets.join(", ")} with ${maxVotes} votes each`
    );
    return null;
  }

  const eliminated = maxTargets[0];
  voteLogger.info(
    `Player ${eliminated} eliminated in game ${gameId} with ${maxVotes} votes`
  );
  return eliminated;
}

export function getVoteTally(gameId: string): Map<`0x${string}`, number> {
  const votes = voteStorage.get(gameId) || [];
  const tally = new Map<`0x${string}`, number>();

  for (const vote of votes) {
    const normalizedTarget = vote.target.toLowerCase() as `0x${string}`;
    const current = tally.get(normalizedTarget) || 0;
    tally.set(normalizedTarget, current + 1);
  }

  return tally;
}

export function getVoteRecords(gameId: string): VoteRecord[] {
  return voteStorage.get(gameId) || [];
}

export function resetVotes(gameId: string): void {
  voteStorage.set(gameId, []);
  voteLogger.info(`Votes reset for game ${gameId}`);
}

export function cleanupVotes(gameId: string): void {
  voteStorage.delete(gameId);
}
