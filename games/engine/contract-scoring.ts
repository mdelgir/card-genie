import type { Card } from "./cards";
import type { AuctionState, CompletedDeal } from "./auction-runtime";
import type { ContractScoringDefinition } from "./types";

export function contractAward(contract: number, declarerRaw: number, defenderRaw: number, defenderTricks: number, rules: ContractScoringDefinition): number {
  if (declarerRaw < contract) return -contract * (defenderRaw >= rules.failureDoubleAt ? 2 : 1);
  if (contract === rules.total) return contract * rules.maximumContractMultiplier;
  return contract * (defenderTricks === 0 ? rules.sweepMultiplier : 1);
}
export function matchWinner(scores: CompletedDeal["cumulativeScores"], target: number): string | null {
  const a = scores["0"], b = scores["1"];
  if (a === b) return null;
  const winner = a > b ? "0" : "1";
  return Math.max(a, b) >= target || Math.abs(a - b) >= target ? winner : null;
}
/** Authoritative only: raw totals and the gathered stack never enter public views. */
export function scoreContract(a: AuctionState, rules: ContractScoringDefinition): CompletedDeal {
  const t = a.tricks;
  if (!a.declarer || a.highBid === null || !t || t.completed !== 12 || t.active.length || !a.discardStack || a.discardStack.cards.length !== 4) throw new Error("Incomplete contract deal.");
  const declarers = a.teams[a.declarer] as "0" | "1";
  const defenders = declarers === "0" ? "1" : "0";
  const points = (cards: Card[]) => cards.reduce((sum, c) => sum + (rules.cards[c.rank as keyof typeof rules.cards] ?? 0), 0);
  const declarerRaw = points(t.collections[declarers]) + t.teamCounts[declarers] * rules.trick + points(a.discardStack.cards) + rules.discard;
  const defenderRaw = points(t.collections[defenders]) + t.teamCounts[defenders] * rules.trick;
  const deck = [...t.collections[defenders], ...a.discardStack.cards, ...t.collections[declarers]];
  if (declarerRaw + defenderRaw !== rules.total || deck.length !== 52 || new Set(deck.map(c => `${c.suit}:${c.rank}`)).size !== 52 ||
      t.teamCounts["0"] + t.teamCounts["1"] !== 12 || ["0", "1"].some(team => t.collections[team].length !== t.teamCounts[team] * 4)) throw new Error("Invalid scoring conservation.");
  const cumulativeScores = { ...a.scores };
  cumulativeScores[declarers] += contractAward(a.highBid, declarerRaw, defenderRaw, t.teamCounts[defenders], rules);
  cumulativeScores[defenders] += defenderRaw;
  return { deck, cumulativeScores };
}
