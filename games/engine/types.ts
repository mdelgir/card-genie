/** Data-only v0 vocabulary. These definitions do not execute game rules. */
export interface SetupDefinition {
  /** One standard deck, no jokers; hands begin empty on every new round. */
  deck: "standard-52";
  roundStart: { type: "shuffle" };
}

export interface VisibilityDefinition {
  deck: "server-only";
  hand: "owner-only";
  reveal: { type: "reveal"; when: "round-end" };
}

export interface TurnDefinition {
  /** Shuffle all seated player IDs at each round start. */
  order: "random";
  /** The current player explicitly draws from the deck into their own hand.
   * Counts are positive integers; v0 rank comparison requires exactly one card.
   */
  action: { type: "draw"; count: number };
  /** Advance in round order after the action, unless the round has ended. */
  progression: { type: "next-player" };
}

/** Complete after every seated player has performed their action once. */
export type ConditionDefinition = { type: "all-players-acted" };

/** Compare each player's sole card, 2 < ... < 10 < J < Q < K < A.
 * Equal best ranks produce a tie; suits never break ties.
 */
export type WinnerDefinition = {
  type: "highest-wins" | "lowest-wins";
  comparison: "compare-rank";
  ace: "high";
  ties: "tie";
};

/** A new round repeats setup and turn ordering. Permission to start/replay a
 * round belongs to the session lifecycle, not executable hooks in this data.
 * v0 supports 2–8 players and one explicit draw each. Deal/play/discard/scoring
 * primitives are deferred until their semantics are defined in later work.
 */
export interface GameDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  players: { min: number; max: number };
  setup: SetupDefinition;
  visibility: VisibilityDefinition;
  turn: TurnDefinition;
  roundEnd: ConditionDefinition;
  winner: WinnerDefinition;
}

export interface ValidationError {
  path: string;
  code: "invalid-type" | "invalid-value" | "invalid-range" | "unsupported-version" |
    "unknown-field" | "unsupported-rule" | "contradictory-rule" | "non-data";
  message: string;
}

export type ValidationResult =
  | { ok: true; definition: GameDefinition }
  | { ok: false; errors: ValidationError[] };
