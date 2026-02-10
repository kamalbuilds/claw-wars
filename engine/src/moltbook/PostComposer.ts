import { GameResult } from "../game/GameRoom.js";

export function gameStartPost(
  gameId: string,
  players: Array<{ address: `0x${string}`; name: string }>
): string {
  const playerList = players
    .map((p, i) => `${i + 1}. ${p.name} (${shortenAddress(p.address)})`)
    .join("\n");

  return [
    `🎮 **AMONG CLAWS** - Game Started!`,
    ``,
    `Game ID: \`${gameId}\``,
    `Players: ${players.length}`,
    ``,
    playerList,
    ``,
    `The impostor walks among us... Who will survive?`,
    ``,
    `#AmongClaws #Monad #AIGaming`,
  ].join("\n");
}

export function discussionComment(
  gameId: string,
  agentName: string,
  message: string
): string {
  return `[Game ${shortenId(gameId)}] **${agentName}**: ${message}`;
}

export function investigationComment(
  gameId: string,
  scannerName: string,
  targetName: string,
  result: "suspicious" | "clear"
): string {
  const emoji = result === "suspicious" ? "🔴" : "🟢";
  return `[Game ${shortenId(gameId)}] ${emoji} **${scannerName}** scanned **${targetName}**: ${result.toUpperCase()}`;
}

export function voteResultComment(
  gameId: string,
  eliminated: string | null,
  role: string | null,
  round: number
): string {
  if (!eliminated || !role) {
    return `[Game ${shortenId(gameId)}] Round ${round}: No one was eliminated (tie vote).`;
  }

  return [
    `[Game ${shortenId(gameId)}] Round ${round}: **${eliminated}** was eliminated!`,
    `They were a **${role}**.`,
  ].join("\n");
}

export function gameEndPost(
  gameId: string,
  result: GameResult,
  winners: Array<{ address: `0x${string}`; name: string }>,
  payouts: Map<`0x${string}`, bigint>
): string {
  const resultText =
    result === GameResult.CrewmatesWin
      ? "CREWMATES WIN!"
      : "IMPOSTOR WINS!";

  const winnerList = winners
    .map((w) => {
      const payout = payouts.get(w.address);
      const payoutStr = payout
        ? ` (+${formatMON(payout)} MON)`
        : "";
      return `- ${w.name} (${shortenAddress(w.address)})${payoutStr}`;
    })
    .join("\n");

  return [
    `🏆 **AMONG CLAWS** - Game Over!`,
    ``,
    `Game ID: \`${gameId}\``,
    `Result: **${resultText}**`,
    ``,
    `Winners:`,
    winnerList,
    ``,
    `GG! Play again at Among Claws.`,
    ``,
    `#AmongClaws #Monad #AIGaming`,
  ].join("\n");
}

export function phaseChangeComment(
  gameId: string,
  phaseName: string,
  round: number,
  duration: number
): string {
  return `[Game ${shortenId(gameId)}] Round ${round}: **${phaseName}** phase started (${duration}s)`;
}

function shortenAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenId(gameId: string): string {
  return gameId.slice(0, 8);
}

function formatMON(wei: bigint): string {
  const mon = Number(wei) / 1e18;
  return mon.toFixed(4);
}
