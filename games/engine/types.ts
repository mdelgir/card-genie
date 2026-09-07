/** Data-only v0 vocabulary. These definitions do not execute game rules. */
export interface SetupDefinition {
  /** One standard deck, no jokers; hands begin empty unless deal is specified. */
  deck: "standard-52";
  roundStart: { type: "shuffle" };
  /** Deal from the front, one card per seat in input seat order, repeatedly. */
  deal?: { type: "deal-equal"; count: number; face: "down"; order: "round-robin" };
  /** Remove one card after dealing and expose it as the initial discard top. */
  discard?: { type: "seed-discard"; count: 1; face: "up" };
}

export interface VisibilityDefinition {
  deck: "server-only";
  /** server-only hides pile identities even from their owner; counts are public. */
  hand: "owner-only" | "server-only";
  /** Optional public metadata for persistent-hand games. */
  handCount?: "public";
  discard?: "top-public";
  /** contribution exposes battle cards; discard exposes cards when played. */
  reveal: { type: "reveal"; when: "round-end" | "contribution" | "discard" };
}

export type TurnActionDefinition =
  | { type: "draw" | "reveal-top"; count: number }
  | { type: "play-or-draw" };

export interface TurnDefinition {
  /** random shuffles seats each round; seat-order preserves supplied seat order. */
  order: "random" | "seat-order";
  action: TurnActionDefinition;
  /** next-player advances seats; next-battle repeats paired reveals after pot
   * collection and passes current-player authorization to the next seat cyclically.
   * The first seat starts. Ties resolve fully before progression; terminal battles
   * retain the acting seat. Authorization does not affect contribution ordering.
   */
  progression: { type: "next-player" | "next-battle" };
}

export type ConditionDefinition = { type: "all-players-acted" | "all-cards-owned" | "empty-hand" };

/** Compare each player's sole card, 2 < ... < 10 < J < Q < K < A.
 * Equal best ranks produce a tie; suits never break ties.
 */
export type WinnerDefinition = {
  type: "highest-wins" | "lowest-wins";
  comparison: "compare-rank";
  ace: "high";
  ties: "tie";
} | { type: "all-cards-owner" } | { type: "first-empty-hand" };

/** Paired contributions are atomic: all seats contribute top cards together.
 * Pot order is chronological contribution order, then seat order within each
 * contribution (all of a seat's face-down cards followed by its face-up card).
 */
export interface BattleDefinition {
  type: "compare-contributions";
  comparison: "compare-rank";
  direction: "highest-wins";
  ace: "high";
  collect: { type: "append-pot"; order: "contribution-order" };
  ties: {
    type: "repeat-contribution";
    faceDown: number;
    faceUp: number;
    insufficient: "lose";
    bothInsufficient: "tie";
  };
}

/** Persistent-hand play against a public discard top. A normal card is legal
 * when its suit or rank matches the active suit/rank. The configured wild rank
 * is always legal and requires choosing the next active suit. The initial active
 * suit is the starter discard's suit. The fallback draw is legal only when the
 * player has no legal card and ends the turn immediately.
 */
export interface HandPlayDefinition {
  type: "matching-discard";
  legal: { type: "match-suit-or-rank"; wildRank: "8" };
  wild: { type: "choose-suit"; rank: "8" };
  fallback: { type: "draw-if-no-legal-play"; count: 1; after: "end-turn" };
}

/** A new round repeats setup and turn ordering. Permission to start/replay a
 * round belongs to the session lifecycle, not executable hooks in this data.
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
  battle?: BattleDefinition;
  handPlay?: HandPlayDefinition;
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
