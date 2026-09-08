import type { Card, Rank, Suit } from "./cards";
import type { ValidationError } from "./types";
import { validateGameDefinition } from "./validator";
import { createAuctionRuntime, type AuctionState, type AuctionView, type Cut, type CompletedDeal } from "./auction-runtime";

/** Trusted server randomness: return a permutation of the supplied indices.
 * Called for the deck, then seats only with random ordering. No random state is stored.
 */
export type Shuffle = (indices: number[]) => number[];
export type Winner = { type: "player"; playerID: string } | { type: "tie" } | null;
export interface Contribution { playerID: string; card: Card }

/** A placement record describes what was put on a public table zone during the
 * latest authoritative action. The server keeps the card identity; playerView
 * replaces face-down identities with null while preserving zone/ownership/
 * attribution and sequence so clients can render the physical layout safely.
 */
export interface TablePlacement {
  zone: string;
  sequence: number;
  face: "up" | "down";
  ownerID: string | null;
  placedBy: string | null;
  card: Card | null;
}

export interface BattleState {
  pot: Card[];
  contributions: Contribution[];
  placements: TablePlacement[];
  result: Winner;
}
export interface RoundState {
  auction?: AuctionState;
  deck: Card[];
  hands: Record<string, Card[]>;
  playOrder: string[];
  currentPlayer: string;
  hasActed: Record<string, boolean>;
  roundStatus: "playing" | "complete";
  revealed: boolean;
  winner: Winner;
  battle?: BattleState;
  discard?: Card[];
  activeSuit?: Suit;
}
export interface RoundView {
  auction?: AuctionView;
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
  tablePlacements?: TablePlacement[];
  battleResult?: Winner;
  handCounts?: Record<string, number>;
  discardTop?: Card | null;
  activeSuit?: Suit;
}
type ErrorCode = "invalid-players" | "invalid-shuffle" | "invalid-action" |
  "unknown-player" | "round-complete" | "already-acted" | "out-of-turn" | "empty-deck";
export type RuntimeResult = { ok: true; state: RoundState } |
  { ok: false; error: { code: ErrorCode; message: string } };
const reject = (code: ErrorCode, message: string): RuntimeResult => ({ ok: false, error: { code, message } });
const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const copyCard = (card: Card): Card => ({ suit: card.suit, rank: card.rank, value: card.value });
const copyWinner = (winner: Winner): Winner => winner === null ? null :
  winner.type === "tie" ? { type: "tie" } : { type: "player", playerID: winner.playerID };

export interface GameRuntime {
  /** Trusted server lifecycle only, never a player action. */
  nextDeal?(state: RoundState, cut: Cut, completed?: CompletedDeal): RuntimeResult;
  startRound(playerIDs: readonly string[], shuffle: Shuffle): RuntimeResult;
  applyAction(state: RoundState, playerID: string | null, action: unknown): RuntimeResult;
  playerView(state: RoundState, playerID?: string | null): RoundView;
}

export function createGameRuntime(input: unknown):
  { ok: true; runtime: GameRuntime } | { ok: false; errors: ValidationError[] } {
  const validation = validateGameDefinition(input);
  if (!validation.ok) return validation;
  const definition = structuredClone(validation.definition);
  if (definition.auction) return { ok: true, runtime: createAuctionRuntime(definition.auction,
    suits.flatMap(suit => ranks.map((rank, index) => ({ suit, rank, value: index + 2 })))) };
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
      let matchingState: Pick<RoundState, "discard" | "activeSuit"> | undefined;
      if (definition.handPlay) {
        const starter = deck.shift();
        if (!starter) return reject("empty-deck", "A public starter card is required after the initial deal.");
        matchingState = { discard: [starter], activeSuit: starter.suit };
      }
      return { ok: true, state: {
        deck, playOrder, currentPlayer: playOrder[0], hands,
        hasActed: Object.fromEntries(playerIDs.map(id => [id, false])),
        roundStatus: "playing", revealed: false, winner: null,
        ...(definition.battle ? { battle: { pot: [], contributions: [], placements: [], result: null } } : {}),
        ...(matchingState ?? {}),
      } };
    },
    applyAction(state, playerID, action) {
      if (definition.handPlay) {
        let keys: PropertyKey[];
        let type: unknown;
        let cardIndex: unknown;
        let chosenSuit: unknown;
        try {
          if (!action || typeof action !== "object" || Object.getPrototypeOf(action) !== Object.prototype) {
            return reject("invalid-action", "Expected a plain play-card or draw action.");
          }
          keys = Reflect.ownKeys(action);
          if (keys.some(key => typeof key !== "string")) return reject("invalid-action", "Action fields must be plain strings.");
          const value = (key: string) => {
            const descriptor = Object.getOwnPropertyDescriptor(action, key);
            return descriptor && descriptor.enumerable && "value" in descriptor ? descriptor.value : undefined;
          };
          type = value("type");
          cardIndex = value("cardIndex");
          chosenSuit = value("suit");
        } catch {
          return reject("invalid-action", "Action could not be inspected as plain data.");
        }
        const isDraw = type === "draw" && keys.length === 1 && keys[0] === "type";
        const isPlay = type === "play-card" && (keys.length === 2 || keys.length === 3) &&
          keys.includes("type") && keys.includes("cardIndex") && keys.every(key => ["type", "cardIndex", "suit"].includes(key as string)) &&
          Number.isInteger(cardIndex);
        if (!isDraw && !isPlay) return reject("invalid-action", "Expected {type:'draw'} or {type:'play-card', cardIndex, suit?}.");
        if (playerID === null || !state.playOrder.includes(playerID)) return reject("unknown-player", "Only a seated player may act.");
        if (state.roundStatus !== "playing") return reject("round-complete", "Start a new round before acting.");
        if (state.currentPlayer !== playerID) return reject("out-of-turn", "Wait for this player's turn.");
        const discard = state.discard;
        const activeSuit = state.activeSuit;
        if (!discard?.length || !activeSuit || !suits.includes(activeSuit)) {
          return reject("invalid-action", "Matching-hand state is missing its discard top or active suit.");
        }
        const top = discard[discard.length - 1];
        const legal = (card: Card) => card.rank === definition.handPlay!.legal.wildRank ||
          card.suit === activeSuit || card.rank === top.rank;
        const hand = state.hands[playerID];
        if (!hand) return reject("unknown-player", "Only a seated player may act.");

        if (isPlay) {
          const index = cardIndex as number;
          if (index < 0 || index >= hand.length) return reject("invalid-action", "Card index is outside the authenticated player's hand.");
          const card = hand[index];
          if (!legal(card)) return reject("invalid-action", "That card does not match the active suit/rank and is not wild.");
          const wild = card.rank === definition.handPlay.wild.rank;
          if (wild && !suits.includes(chosenSuit as Suit)) return reject("invalid-action", "A wild card requires a valid chosen suit.");
          if (!wild && keys.includes("suit")) return reject("invalid-action", "Only a wild card may choose the active suit.");
          const next = structuredClone(state);
          const [played] = next.hands[playerID].splice(index, 1);
          next.discard!.push(played);
          next.activeSuit = wild ? chosenSuit as Suit : played.suit;
          if (next.hands[playerID].length === 0) {
            next.roundStatus = "complete";
            next.winner = { type: "player", playerID };
          } else {
            const indexInOrder = next.playOrder.indexOf(playerID);
            next.currentPlayer = next.playOrder[(indexInOrder + 1) % next.playOrder.length];
          }
          return { ok: true, state: next };
        }

        if (hand.some(legal)) return reject("invalid-action", "Draw is allowed only when the player has no legal card.");
        const next = structuredClone(state);
        if (next.deck.length < definition.handPlay.fallback.count) {
          next.roundStatus = "complete";
          next.winner = { type: "tie" };
          return { ok: true, state: next };
        }
        next.hands[playerID].push(...next.deck.splice(0, definition.handPlay.fallback.count));
        const indexInOrder = next.playOrder.indexOf(playerID);
        next.currentPlayer = next.playOrder[(indexInOrder + 1) % next.playOrder.length];
        return { ok: true, state: next };
      }

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
        const battle: BattleState = { pot: [], contributions: [], placements: [], result: null };
        next.battle = battle;
        let faceDown = 0;
        let faceUp = actionCount;
        let sequence = 0;
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
            const ownerID = rules.table.ownership === "placer" ? id : null;
            const placedBy = rules.table.attribution === "placer" ? id : null;
            for (let index = 0; index < cards.length; index++) {
              battle.placements.push({
                zone: rules.table.zone,
                sequence,
                face: index < faceDown ? "down" : "up",
                ownerID,
                placedBy,
                card: copyCard(cards[index]),
              });
            }
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
          sequence += 1;
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
      if (definition.handPlay) {
        const top = state.discard?.length ? copyCard(state.discard[state.discard.length - 1]) : null;
        return {
          deckCount: state.deck.length,
          hands: Object.fromEntries(state.playOrder.map(id => [id,
            id === playerID ? state.hands[id].map(copyCard) : [],
          ])),
          playOrder: [...state.playOrder], currentPlayer: state.currentPlayer,
          hasActed: Object.fromEntries(state.playOrder.map(id => [id, state.hasActed[id]])),
          roundStatus: state.roundStatus, revealed: false,
          winner: state.roundStatus === "complete" ? copyWinner(state.winner) : null,
          handCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])),
          discardTop: top,
          activeSuit: state.activeSuit,
        };
      }
      const pilesHidden = definition.visibility.hand === "server-only";
      const revealed = !pilesHidden && state.roundStatus === "complete" && state.revealed;
      return {
        deckCount: state.deck.length,
        hands: Object.fromEntries(state.playOrder.map(id => [id,
          !pilesHidden && (revealed || id === playerID) ? state.hands[id].map(copyCard) : [],
        ])),
        playOrder: [...state.playOrder], currentPlayer: state.currentPlayer,
        hasActed: Object.fromEntries(state.playOrder.map(id => [id, state.hasActed[id]])),
        roundStatus: state.roundStatus, revealed,
        winner: state.roundStatus === "complete" && (revealed || pilesHidden) ? copyWinner(state.winner) : null,
        ...(definition.battle ? {
          pileCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])),
          potCount: state.battle?.pot.length ?? 0,
          contributions: (state.battle?.contributions ?? []).map(({ playerID, card }) => ({ playerID, card: copyCard(card) })),
          tablePlacements: (state.battle?.placements ?? []).map(placement => ({
            zone: placement.zone,
            sequence: placement.sequence,
            face: placement.face,
            ownerID: placement.ownerID,
            placedBy: placement.placedBy,
            card: placement.face === "up" && placement.card ? copyCard(placement.card) : null,
          })),
          battleResult: copyWinner(state.battle?.result ?? null),
        } : {}),
      };
    },
  };
  return { ok: true, runtime };
}
