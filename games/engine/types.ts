/** Data-only v0 vocabulary. These definitions do not execute game rules. */
export interface SetupDefinition {
  /** One standard deck, no jokers; hands begin empty unless deal is specified. */
  deck: "standard-52";
  roundStart: { type: "shuffle" };
  /** Deal from the front, one card per seat in input seat order, repeatedly.
   * Each player's pile front is its top. No randomness after setup.
   */
  deal?: { type: "deal-equal"; count: number; face: "down"; order: "round-robin" };
}

export interface VisibilityDefinition {
  deck: "server-only";
  /** server-only hides pile identities even from their owner; counts are public. */
  hand: "owner-only" | "server-only";
  /** contribution exposes only contributed face-up cards, never face-down cards. */
  reveal: { type: "reveal"; when: "round-end" | "contribution" };
}

export interface TurnDefinition {
  /** random shuffles seats each round; seat-order preserves supplied seat order. */
  order: "random" | "seat-order";
  /** draw: current player draws from the deck into their own hand.
   * reveal-top: all seats atomically contribute from pile fronts to the pot.
   * Counts are positive integers; v0 rank comparison requires exactly one card.
   */
  action: { type: "draw" | "reveal-top"; count: number };
  /** next-player advances seats; next-battle repeats paired reveals after pot
   * collection and passes current-player authorization to the next seat cyclically.
   * The first seat starts. Ties resolve fully before progression; terminal battles
   * retain the acting seat. Authorization does not affect contribution ordering.
   */
  progression: { type: "next-player" | "next-battle" };
}

/** Complete after every seated player has performed their action once. */
export type ConditionDefinition = { type: "all-players-acted" | "all-cards-owned" };

/** Compare each player's sole card, 2 < ... < 10 < J < Q < K < A.
 * Equal best ranks produce a tie; suits never break ties.
 */
export type WinnerDefinition = {
  type: "highest-wins" | "lowest-wins";
  comparison: "compare-rank";
  ace: "high";
  ties: "tie";
} | { type: "all-cards-owner" };

/** Paired contributions are atomic: all seats contribute top cards together.
 * Pot order is chronological contribution order, then seat order within each
 * contribution (all of a seat's face-down cards followed by its face-up card).
 * Append the entire pot unchanged to the winning pile's bottom; never shuffle.
 * Face-down identities remain server-only, even when the pot is collected.
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
    /** Check before removing any cards. A sole unable player loses and all
     * their cards plus the pot transfer to the opponent. If both are unable,
     * finish tied (no arbitrary seat advantage). Applies to initial reveal too.
     */
    insufficient: "lose";
    bothInsufficient: "tie";
  };
}

/** A new round repeats setup and turn ordering. Permission to start/replay a
 * round belongs to the session lifecycle, not executable hooks in this data.
 * all-cards-owned ends only when one seat owns the complete deck (including any
 * awarded pot); both-insufficient is an explicit terminal tie exception. Cycles
 * are possible: no turn limit, reshuffle or cycle adjudication is implied.
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
