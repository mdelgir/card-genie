import type { GameDefinition } from "../engine/types";

/** Through declarer setup only; no trick play or scoring yet. */
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
  },
} satisfies GameDefinition;
