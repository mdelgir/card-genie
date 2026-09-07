import type { Card, Rank, Suit } from "./cards";
import type { ValidationError } from "./types";
import { validateGameDefinition } from "./validator";

/** Trusted server randomness: return a permutation of the supplied indices.
 * Called for the deck, then seats only with random ordering. No random state is stored.
 */
export type Shuffle = (indices: number[]) => number[];
export type Winner = { type: "player"; playerID: string } | { type: "tie" } | null;
export interface Contribution { playerID: string; card: Card }
export interface BattleState {
  pot: Card[]; // server-only, retained on a terminal tie
  contributions: Contribution[]; // only face-up cards from the latest battle
  result: Winner;
}
export interface RoundState {
  deck: Card[]; // server-only
  hands: Record<string, Card[]>; // private until reveal
  playOrder: string[];
  currentPlayer: string;
  hasActed: Record<string, boolean>;
  roundStatus: "playing" | "complete";
  revealed: boolean;
  winner: Winner;
  battle?: BattleState;
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
  pileCounts?: Record<string, number>;
  potCount?: number;
  contributions?: Contribution[];
  battleResult?: Winner;
}
type ErrorCode = "invalid-players" | "invalid-shuffle" | "invalid-action" |
  "unknown-player" | "round-complete" | "already-acted" | "out-of-turn" | "empty-deck";
export type RuntimeResult = { ok: true; state: RoundState } |
  { ok: false; error: { code: ErrorCode; message: string } };
const reject = (code: ErrorCode, message: string): RuntimeResult => ({ ok: false, error: { code, message } });
const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const copyWinner = (winner: Winner): Winner => winner === null ? null :
  winner.type === "tie" ? { type: "tie" } : { type: "player", playerID: winner.playerID };

export interface GameRuntime {
  startRound(playerIDs: readonly string[], shuffle: Shuffle): RuntimeResult;
  applyAction(state: RoundState, playerID: string | null, action: unknown): RuntimeResult;
  playerView(state: RoundState, playerID?: string | null): RoundView;
}

export function createGameRuntime(input: unknown):
  { ok: true; runtime: GameRuntime } | { ok: false; errors: ValidationError[] } {
  const validation = validateGameDefinition(input);
  if (!validation.ok) return validation;
  // Schema acceptance deliberately leads runtime support. Refuse partial execution.
  if (validation.definition.handPlay) return { ok: false, errors: [{
    path: "handPlay", code: "unsupported-rule",
    message: "Persistent matching-hand execution is not implemented by the current runtime yet.",
  }] };
  const definition = structuredClone(validation.definition);
  const actionCount = "count" in definition.turn.action ? definition.turn.action.count : 0;
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
      const cards = suits.flatMap(suit => ranks.map((rank, index) => ({ suit, rank, value: index + 2 })));
      let deck: Card[], playOrder: string[];
      try {
        deck = permute(cards, shuffle);
        playOrder = definition.turn.order === "random" ? permute([...playerIDs], shuffle) : [...playerIDs];
      } catch {
        return reject("invalid-shuffle", "Shuffle must return a complete index permutation for deck and seats.");
      }
      const hands: Record<string, Card[]> = Object.fromEntries(playerIDs.map(id => [id, []]));
      if (definition.setup.deal) {
        for (let i = 0; i < definition.setup.deal.count; i++) {
          for (const id of playerIDs) hands[id].push(deck.shift()!);
        }
      }
      return { ok: true, state: {
        deck, playOrder, currentPlayer: playOrder[0], hands,
        hasActed: Object.fromEntries(playerIDs.map(id => [id, false])),
        roundStatus: "playing", revealed: false, winner: null,
        ...(definition.battle ? { battle: { pot: [], contributions: [], result: null } } : {}),
      } };
    },
    applyAction(state, playerID, action) {
      if (!action || typeof action !== "object" || Object.getPrototypeOf(action) !== Object.prototype ||
          Reflect.ownKeys(action).length !== 1 ||
          Object.getOwnPropertyDescriptor(action, "type")?.value !== definition.turn.action.type) {
        return reject("invalid-action", `Expected the action { type: '${definition.turn.action.type}' } without arguments.`);
      }
      if (playerID === null || !state.playOrder.includes(playerID)) return reject("unknown-player", "Only a seated player may act.");
      if (state.roundStatus !== "playing") return reject("round-complete", "Start a new round before acting.");
      if (!definition.battle && state.hasActed[playerID]) return reject("already-acted", "This player has already acted.");
      if (state.currentPlayer !== playerID) return reject("out-of-turn", "Wait for this player's turn.");
      if (definition.battle) {
        const rules = definition.battle;
        const next = structuredClone(state);
        const battle: BattleState = { pot: [], contributions: [], result: null };
        next.battle = battle;
        let faceDown = 0;
        let faceUp = actionCount;
        while (true) {
          const unable = next.playOrder.filter(id => next.hands[id].length < faceDown + faceUp);
          if (unable.length) {
            next.roundStatus = "complete";
            if (unable.length === next.playOrder.length) {
              next.winner = { type: "tie" };
            } else {
              const winner = next.playOrder.find(id => !unable.includes(id))!;
              next.hands[winner].push(...battle.pot);
              battle.pot = [];
              for (const id of unable) next.hands[winner].push(...next.hands[id].splice(0));
              next.winner = { type: "player", playerID: winner };
            }
            battle.result = copyWinner(next.winner);
            break;
          }
          const compared: Contribution[] = [];
          for (const id of next.playOrder) {
            const cards = next.hands[id].splice(0, faceDown + faceUp);
            battle.pot.push(...cards);
            compared.push({ playerID: id, card: cards[faceDown] });
          }
          battle.contributions.push(...compared);
          const best = Math.max(...compared.map(c => ranks.indexOf(c.card.rank)));
          const winners = compared.filter(c => ranks.indexOf(c.card.rank) === best);
          if (winners.length === 1) {
            const winner = winners[0].playerID;
            next.hands[winner].push(...battle.pot);
            battle.pot = [];
            battle.result = { type: "player", playerID: winner };
            if (next.hands[winner].length === 52) {
              next.roundStatus = "complete";
              next.winner = copyWinner(battle.result);
            }
            break;
          }
          faceDown = rules.ties.faceDown;
          faceUp = rules.ties.faceUp;
        }
        next.revealed = false;
        next.hasActed = Object.fromEntries(next.playOrder.map(id => [id, false]));
        if (next.roundStatus === "playing") {
          next.currentPlayer = next.playOrder[(next.playOrder.indexOf(playerID) + 1) % next.playOrder.length];
        }
        return { ok: true, state: next };
      }
      if (state.deck.length < actionCount) return reject("empty-deck", "Not enough cards to draw.");
      const next = structuredClone(state);
      next.hands[playerID] = next.deck.splice(0, actionCount);
      next.hasActed[playerID] = true;
      if (next.playOrder.every(id => next.hasActed[id])) {
        next.roundStatus = "complete";
        next.revealed = true;
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
      const pilesHidden = definition.visibility.hand === "server-only";
      const revealed = !pilesHidden && state.roundStatus === "complete" && state.revealed;
      return {
        deckCount: state.deck.length,
        hands: Object.fromEntries(state.playOrder.map(id => [id,
          !pilesHidden && (revealed || id === playerID) ? state.hands[id].map(card => ({ suit: card.suit, rank: card.rank, value: card.value })) : [],
        ])),
        playOrder: [...state.playOrder], currentPlayer: state.currentPlayer,
        hasActed: Object.fromEntries(state.playOrder.map(id => [id, state.hasActed[id]])),
        roundStatus: state.roundStatus, revealed,
        winner: state.roundStatus === "complete" && (revealed || pilesHidden) ? copyWinner(state.winner) : null,
        ...(definition.battle ? {
          pileCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])),
          potCount: state.battle?.pot.length ?? 0,
          contributions: (state.battle?.contributions ?? []).map(({ playerID, card }) => ({
            playerID, card: { suit: card.suit, rank: card.rank, value: card.value },
          })),
          battleResult: copyWinner(state.battle?.result ?? null),
        } : {}),
      };
    },
  };
  return { ok: true, runtime };
}
