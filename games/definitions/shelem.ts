import type { GameDefinition } from "../engine/types";

/** Complete four-seat contract game using validated generic primitives. */
export const shelemDefinition = {
  schemaVersion: 1, id: "shelem", name: "Shelem", players: { min: 4, max: 4 },
  setup: { deck: "standard-52", roundStart: { type: "shuffle" } },
  visibility: { deck: "server-only", hand: "owner-only", reveal: { type: "reveal", when: "never" } },
  turn: { order: "seat-order", action: { type: "bid-or-pass" }, progression: { type: "next-player" } },
  roundEnd: { type: "external-completion" }, winner: { type: "deferred" },
  auction: {
    type: "ascending-bid", min: 100, max: 165, step: 5, pass: "permanent", openingPasses: 3,
    trump: "choose-suit", teams: "opposite-seats", direction: "right",
    dealer: "rotate-after-completed-deal", preparation: "shuffle-first-cut-later",
    packet: { hand: 12, kitty: 4, kittyBefore: "dealer" }, scores: "frozen-at-deal-start",
    declarerSetup: {
      pickup: { type: "take-kitty" },
      discard: { type: "discard-owned", count: 4, face: "down", destination: "declarer-team", order: "submitted" },
      next: "declarer-leads",
    },
    trickPlay: { type: "follow-suit-trump", firstLead: "trump", rank: "ace-high", nextLeader: "winner", collection: "newest-trick-on-top", count: 12 },
    scoring: {
      type: "contract-team-points", cards: { "5": 5, "10": 10, A: 10 }, trick: 5, discard: 5, total: 165,
      sweepMultiplier: 2, maximumContractMultiplier: 4, failureDoubleAt: 85, matchTarget: 1165,
      merge: "defenders-discard-declarers", simultaneousWin: "higher-score-tie-continues",
    },
  },
} satisfies GameDefinition;
