import type { GameDefinition } from "../engine/types";

/** Executable by the generic runtime and playable through the War adapter. */
export const warDefinition = {
  schemaVersion: 1,
  id: "war",
  name: "War",
  players: { min: 2, max: 2 },
  setup: {
    deck: "standard-52",
    roundStart: { type: "shuffle" },
    deal: { type: "deal-equal", count: 26, face: "down", order: "round-robin" },
  },
  visibility: {
    deck: "server-only", hand: "server-only",
    reveal: { type: "reveal", when: "contribution" },
  },
  turn: {
    order: "seat-order", action: { type: "reveal-top", count: 1 },
    progression: { type: "next-battle" },
  },
  battle: {
    type: "compare-contributions", comparison: "compare-rank", direction: "highest-wins", ace: "high",
    collect: { type: "append-pot", order: "contribution-order" },
    table: { zone: "battle", ownership: "neutral", attribution: "placer" },
    ties: { type: "repeat-contribution", faceDown: 3, faceUp: 1, insufficient: "lose", bothInsufficient: "tie" },
  },
  roundEnd: { type: "all-cards-owned" },
  winner: { type: "all-cards-owner" },
} satisfies GameDefinition;
