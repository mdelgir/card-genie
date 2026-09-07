import type { GameDefinition } from "../engine/types";

/** Validated schema fixture. Runtime support lands in the next task. */
export const crazyEightsDefinition = {
  schemaVersion: 1,
  id: "crazy-eights",
  name: "Crazy Eights",
  players: { min: 2, max: 4 },
  setup: {
    deck: "standard-52",
    roundStart: { type: "shuffle" },
    deal: { type: "deal-equal", count: 5, face: "down", order: "round-robin" },
    discard: { type: "seed-discard", count: 1, face: "up" },
  },
  visibility: {
    deck: "server-only",
    hand: "owner-only",
    handCount: "public",
    discard: "top-public",
    reveal: { type: "reveal", when: "discard" },
  },
  turn: {
    order: "seat-order",
    action: { type: "play-or-draw" },
    progression: { type: "next-player" },
  },
  handPlay: {
    type: "matching-discard",
    legal: { type: "match-suit-or-rank", wildRank: "8" },
    wild: { type: "choose-suit", rank: "8" },
    fallback: { type: "draw-if-no-legal-play", count: 1, after: "end-turn" },
  },
  roundEnd: { type: "empty-hand" },
  winner: { type: "first-empty-hand" },
} satisfies GameDefinition;
