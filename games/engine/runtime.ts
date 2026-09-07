import type { Card, Rank, Suit } from "./cards";
import type { ValidationError } from "./types";
import { validateGameDefinition } from "./validator";

/** Trusted server randomness: return a permutation of the supplied indices.
 * Called for the deck, then seats. No random state is stored in game state.
 */
export type Shuffle = (indices: number[]) => number[];
export type Winner = { type: "player"; playerID: string } | { type: "tie" } | null;
export interface RoundState {
  deck: Card[]; // server-only
  hands: Record<string, Card[]>; // private until reveal
  playOrder: string[];
  currentPlayer: string;
  hasActed: Record<string, boolean>;
  roundStatus: "playing" | "complete";
  revealed: boolean;
  winner: Winner;
}
export interface RoundView {
  deckCount: number;
  hands: Record<string, Card[]>;
  playOrder: string[];
  currentPlayer: string;
  hasActed: Record<string, boolean>;
  roundStatus: "playing" | "complete";
  revealed: boolean;
  winner: Winner;
}
type ErrorCode = "invalid-players" | "invalid-shuffle" | "invalid-action" |
  "unknown-player" | "round-complete" | "already-acted" | "out-of-turn" | "empty-deck";
export type RuntimeResult = { ok: true; state: RoundState } |
  { ok: false; error: { code: ErrorCode; message: string } };
const reject = (code: ErrorCode, message: string): RuntimeResult => ({ ok: false, error: { code, message } });
const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export interface GameRuntime {
  /** Caller authorizes start/replay and supplies server-owned seat IDs.
   * Calling again creates a clean round; it never modifies a previous round.
   */
  startRound(playerIDs: readonly string[], shuffle: Shuffle): RuntimeResult;
  /** State and authenticated player identity must come from the server, never a client payload. */
  applyAction(state: RoundState, playerID: string | null, action: unknown): RuntimeResult;
  /** Use for every outbound snapshot, including spectator reconnects. */
  playerView(state: RoundState, playerID?: string | null): RoundView;
}

export function createGameRuntime(input: unknown):
  { ok: true; runtime: GameRuntime } | { ok: false; errors: ValidationError[] } {
  const validation = validateGameDefinition(input);
  if (!validation.ok) return validation;
  // Caller edits to the reference definition cannot change an initialized runtime.
  const definition = structuredClone(validation.definition);
  const permute = <T>(items: T[], shuffle: Shuffle): T[] => {
    const indices = shuffle(items.map((_, index) => index));
    if (!Array.isArray(indices) || indices.length !== items.length || new Set(indices).size !== items.length ||
        Array.from(indices).some(index => !Number.isInteger(index) || index < 0 || index >= items.length)) {
      throw new Error("Shuffle must return every supplied index exactly once.");
    }
    return indices.map(index => items[index]);
  };
  const runtime: GameRuntime = {
    startRound(playerIDs, shuffle) {
      if (!Array.isArray(playerIDs) || playerIDs.length < definition.players.min || playerIDs.length > definition.players.max ||
          Array.from(playerIDs).some(id => typeof id !== "string" || !id.trim()) || new Set(playerIDs).size !== playerIDs.length) {
        return reject("invalid-players", `Provide ${definition.players.min}–${definition.players.max} unique nonblank player IDs.`);
      }
      // v0 validation admits only standard-52/shuffle and random turn ordering.
      const cards = suits.flatMap(suit => ranks.map((rank, index) => ({ suit, rank, value: index + 2 })));
      let deck: Card[], playOrder: string[];
      try {
        deck = permute(cards, shuffle);
        playOrder = permute([...playerIDs], shuffle);
      } catch {
        return reject("invalid-shuffle", "Shuffle must return a complete index permutation for deck and seats.");
      }
      return { ok: true, state: {
        deck, playOrder, currentPlayer: playOrder[0],
        hands: Object.fromEntries(playerIDs.map(id => [id, []])),
        hasActed: Object.fromEntries(playerIDs.map(id => [id, false])),
        roundStatus: "playing", revealed: false, winner: null,
      } };
    },
    applyAction(state, playerID, action) {
      // No arguments are supported by the v0 draw action. Do not invoke getters.
      if (!action || typeof action !== "object" || Object.getPrototypeOf(action) !== Object.prototype ||
          Reflect.ownKeys(action).length !== 1 ||
          Object.getOwnPropertyDescriptor(action, "type")?.value !== definition.turn.action.type) {
        return reject("invalid-action", "Expected the action { type: 'draw' } without arguments.");
      }
      if (playerID === null || !state.playOrder.includes(playerID)) return reject("unknown-player", "Only a seated player may act.");
      if (state.roundStatus !== "playing") return reject("round-complete", "Start a new round before acting.");
      if (state.hasActed[playerID]) return reject("already-acted", "This player has already acted.");
      if (state.currentPlayer !== playerID) return reject("out-of-turn", "Wait for this player's turn.");
      if (state.deck.length < definition.turn.action.count) return reject("empty-deck", "Not enough cards to draw.");
      const next = structuredClone(state);
      next.hands[playerID] = next.deck.splice(0, definition.turn.action.count);
      next.hasActed[playerID] = true;
      // all-players-acted ends the round before next-player progression.
      if (next.playOrder.every(id => next.hasActed[id])) {
        next.roundStatus = "complete";
        next.revealed = true; // v0 reveal.when is round-end
        const values = next.playOrder.map(id => ranks.indexOf(next.hands[id][0].rank));
        const best = definition.winner.type === "highest-wins" ? Math.max(...values) : Math.min(...values);
        const winners = next.playOrder.filter((_, index) => values[index] === best);
        next.winner = winners.length === 1 ? { type: "player", playerID: winners[0] } : { type: "tie" };
      } else {
        next.currentPlayer = next.playOrder[next.playOrder.indexOf(playerID) + 1];
      }
      return { ok: true, state: next };
    },
    playerView(state, playerID) {
      // Never spread authoritative state: future private fields must not leak.
      const revealed = state.roundStatus === "complete" && state.revealed;
      return {
        deckCount: state.deck.length,
        hands: Object.fromEntries(state.playOrder.map(id => [id,
          revealed || id === playerID ? state.hands[id].map(card => ({ suit: card.suit, rank: card.rank, value: card.value })) : [],
        ])),
        playOrder: [...state.playOrder], currentPlayer: state.currentPlayer,
        hasActed: Object.fromEntries(state.playOrder.map(id => [id, state.hasActed[id]])),
        roundStatus: state.roundStatus, revealed,
        winner: revealed && state.winner ? state.winner.type === "tie" ? { type: "tie" } :
          { type: "player", playerID: state.winner.playerID } : null,
      };
    },
  };
  return { ok: true, runtime };
}
