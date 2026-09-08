import type { Card } from "./cards";
import type { AuctionDefinition } from "./types";
import type { Contribution, RoundState, RuntimeResult } from "./runtime";

export interface TrickView {
  active: Contribution[];
  leader: string;
  completed: number;
  lastWinner: string | null;
  teamCounts: Record<string, number>;
}
export interface TrickState extends TrickView {
  /** Top-first piles; each trick's cards retain play order. Never transmitted. */
  collections: Record<string, Card[]>;
}
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const reject = (message: string): RuntimeResult => ({ ok: false, error: { code: "invalid-action", message } });

/** Shared legal-card projection for controls; the server rechecks every move. */
export function legalTrickIndices(hand: Card[], active: Contribution[], completed: number, trump: Card["suit"]): number[] {
  const led = active[0]?.card.suit;
  const required = !led && completed === 0 ? trump : led && hand.some(c => c.suit === led) ? led : null;
  return hand.flatMap((card, index) => !required || card.suit === required ? [index] : []);
}

/** Caller has parsed the action and checked authenticated current-player identity. */
export function playTrickCard(state: RoundState, playerID: string, index: unknown, rules: NonNullable<AuctionDefinition["trickPlay"]>): RuntimeResult {
  const a = state.auction!;
  const trick = a.tricks;
  if (!trick || !a.trump || !a.discardStack || trick.completed >= rules.count ||
      (a.phase !== "ready" && a.phase !== "trick-play")) return reject("Trick play is not ready.");
  const hand = state.hands[playerID];
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= hand.length) return reject("Select an owned card index.");
  const card = hand[index];
  const led = trick.active[0]?.card.suit;
  if (!led && trick.completed === 0 && card.suit !== a.trump) return reject("First lead must be trump.");
  if (led && card.suit !== led && hand.some(c => c.suit === led)) return reject("Must follow the led suit.");
  const next = structuredClone(state);
  const t = next.auction!.tricks!;
  t.active.push({ playerID, card: next.hands[playerID].splice(index, 1)[0] });
  next.auction!.phase = "trick-play";
  if (t.active.length === next.playOrder.length) {
    const suit = t.active.some(c => c.card.suit === a.trump) ? a.trump : t.active[0].card.suit;
    const winning = t.active.filter(c => c.card.suit === suit).reduce((best, entry) =>
      ranks.indexOf(entry.card.rank) > ranks.indexOf(best.card.rank) ? entry : best);
    const team = a.teams[winning.playerID];
    t.collections[team] = [...t.active.map(c => c.card), ...t.collections[team]];
    t.teamCounts[team]++;
    t.completed++;
    t.lastWinner = winning.playerID;
    t.leader = winning.playerID;
    t.active = [];
    next.currentPlayer = winning.playerID;
    if (t.completed === rules.count) next.auction!.phase = "ready-scoring";
  } else {
    next.currentPlayer = next.playOrder[(next.playOrder.indexOf(playerID) + 1) % next.playOrder.length];
  }
  return { ok: true, state: next };
}

export function trickView(t: TrickState): TrickView {
  return {
    active: t.active.map(c => ({ playerID: c.playerID, card: { suit: c.card.suit, rank: c.card.rank, value: c.card.value } })),
    leader: t.leader, completed: t.completed, lastWinner: t.lastWinner,
    teamCounts: { "0": t.teamCounts["0"], "1": t.teamCounts["1"] },
  };
}
