import type { GameDefinition } from "../engine/types";

/** Compatibility reference only; not wired into the live boardgame.io game. */
export const highestCardDefinition: GameDefinition = {
  schemaVersion: 1,
  id: "highest-card",
  name: "Highest Card",
  players: { min: 2, max: 8 },
  setup: { deck: "standard-52", roundStart: { type: "shuffle" } },
  visibility: {
    deck: "server-only", hand: "owner-only",
    reveal: { type: "reveal", when: "round-end" },
  },
  turn: {
    order: "random", action: { type: "draw", count: 1 },
    progression: { type: "next-player" },
  },
  roundEnd: { type: "all-players-acted" },
  winner: { type: "highest-wins", comparison: "compare-rank", ace: "high", ties: "tie" },
};
