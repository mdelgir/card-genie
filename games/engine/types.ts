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
  reveal: { type: "reveal"; when: "round-end" | "contribution" | "discard" | "never" };
}

export type TurnActionDefinition =
  | { type: "draw" | "reveal-top"; count: number }
  | { type: "play-or-draw" | "bid-or-pass" };

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

export type ConditionDefinition = { type: "all-players-acted" | "all-cards-owned" | "empty-hand" | "external-completion" };

export type WinnerDefinition = {
  type: "highest-wins" | "lowest-wins";
  comparison: "compare-rank";
  ace: "high";
  ties: "tie";
} | { type: "all-cards-owner" } | { type: "first-empty-hand" } | { type: "deferred" };

/** Public-table placement policy for cards contributed during a battle.
 * Face-up/down comes from the contribution rule itself. Ownership is separate
 * from attribution: a card may become neutral on the table while still recording
 * which player placed it. Zone names are inert identifiers, not executable UI.
 */
export interface TablePlacementDefinition {
  zone: string;
  ownership: "placer" | "neutral";
  attribution: "placer" | "none";
}

export interface BattleDefinition {
  type: "compare-contributions";
  comparison: "compare-rank";
  direction: "highest-wins";
  ace: "high";
  collect: { type: "append-pot"; order: "contribution-order" };
  table: TablePlacementDefinition;
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
 * player has no legal card and ends the turn immediately. If no draw card exists,
 * this v0 variant ends tied rather than silently passing or inventing a reshuffle.
 */
export interface HandPlayDefinition {
  type: "matching-discard";
  legal: { type: "match-suit-or-rank"; wildRank: "8" };
  wild: { type: "choose-suit"; rank: "8" };
  fallback: { type: "draw-if-no-legal-play"; count: 1; after: "end-turn"; emptyDeck: "tie" };
}

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
  auction?: AuctionDefinition;
}

/** Closed foundation vocabulary; seat array order proceeds to the right.
 * Packet order: three hands, kitty, dealer hand. Initial dealer is seat zero.
 * Later completed-deal stacks are supplied by trusted server lifecycle code;
 * this slice deliberately does not gather tricks or calculate scores.
 */
export interface AuctionDefinition {
  type: "ascending-bid";
  min: 100;
  max: 165;
  step: 5;
  pass: "permanent";
  openingPasses: 3;
  trump: "choose-suit";
  teams: "opposite-seats";
  direction: "right";
  dealer: "rotate-after-completed-deal";
  preparation: "shuffle-first-cut-later";
  packet: { hand: 12; kitty: 4; kittyBefore: "dealer" };
  scores: "frozen-at-deal-start";
  /** Optional staged setup. Discard indices refer to the current private hand;
   * submitted order defines the stack top-to-bottom, remaining hand order stays.
   */
  declarerSetup?: {
    pickup: { type: "take-kitty" };
    discard: { type: "discard-owned"; count: 4; face: "down"; destination: "declarer-team"; order: "submitted" };
    next: "declarer-leads";
  };
  trickPlay?: {
    type: "follow-suit-trump";
    firstLead: "trump";
    rank: "ace-high";
    nextLeader: "winner";
    collection: "newest-trick-on-top";
    count: 12;
  };
  scoring?: ContractScoringDefinition;
}

export interface ContractScoringDefinition {
  type: "contract-team-points";
  cards: { "5": 5; "10": 10; A: 10 };
  trick: 5;
  discard: 5;
  total: 165;
  sweepMultiplier: 2;
  maximumContractMultiplier: 4;
  failureDoubleAt: 85;
  matchTarget: 1165;
  merge: "defenders-discard-declarers";
  simultaneousWin: "higher-score-tie-continues";
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
