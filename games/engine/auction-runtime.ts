import type { Card, Suit } from "./cards";
import type { AuctionDefinition } from "./types";
import type { GameRuntime, RoundState, RuntimeResult } from "./runtime";
import { playTrickCard, trickView, type TrickState, type TrickView } from "./trick-runtime";
import { scoreContract, matchWinner } from "./contract-scoring";

/** Trusted source returns a cut offset, not a permutation or client argument. */
export type Cut = (length: number) => number;
export interface CompletedDeal {
  /** Already gathered top-first by future authoritative trick/scoring logic. */
  deck: readonly Card[];
  cumulativeScores: { "0": number; "1": number };
}
export interface AuctionView {
  matchWinner?: string | null;
  dealer: string;
  teams: Record<string, string>;
  scores: { "0": number; "1": number };
  phase: "bidding" | "redeal-required" | "choose-trump" | "take-kitty" | "discard" | "ready" | "trick-play" | "ready-scoring";
  tricks?: TrickView;
  passed: string[];
  highBid: number | null;
  highBidder: string | null;
  declarer: string | null;
  trump: Suit | null;
  kittyCount: number;
  history: { playerID: string; bid: number | null }[];
  discardStack?: { count: number; face: "down"; teamID: string; placedBy: string };
}
export interface AuctionState extends Omit<AuctionView, "kittyCount" | "discardStack" | "tricks"> {
  tricks?: TrickState;
  kitty: Card[];
  /** Separate initial stack for later merge with the team's trick collection. */
  discardStack?: { cards: Card[]; teamID: string; placedBy: string };
}
const cardCopy = (c: Card): Card => ({ suit: c.suit, rank: c.rank, value: c.value });
const fail = (message: string): RuntimeResult => ({ ok: false, error: { code: "invalid-action", message } });

export function createAuctionRuntime(rules: AuctionDefinition, standard: Card[]): GameRuntime {
  const deal = (seats: readonly string[], dealer: string, deck: readonly Card[], scores: CompletedDeal["cumulativeScores"]): RoundState => {
    const index = seats.indexOf(dealer);
    const order = Array.from({ length: 4 }, (_, i) => seats[(index + i + 1) % 4]);
    const stack = deck.map(cardCopy);
    const hands: Record<string, Card[]> = Object.fromEntries(seats.map(id => [id, []]));
    for (const id of order.slice(0, -1)) hands[id] = stack.splice(0, rules.packet.hand);
    const kitty = stack.splice(0, rules.packet.kitty);
    hands[dealer] = stack.splice(0, rules.packet.hand);
    return {
      deck: [], hands, playOrder: [...seats], currentPlayer: order[0],
      hasActed: Object.fromEntries(seats.map(id => [id, false])),
      roundStatus: "playing", revealed: false, winner: null,
      auction: {
        dealer, teams: Object.fromEntries(seats.map((id, i) => [id, String(i % 2)])),
        scores: { "0": scores["0"], "1": scores["1"] }, phase: "bidding", kitty,
        passed: [], highBid: null, highBidder: null, declarer: null, trump: null, history: [],
      },
    };
  };
  return {
    advanceLifecycle(state, cut) {
      const a = state.auction;
      if (!a || state.roundStatus === "complete") return { ok: true, state };
      if (a.phase === "redeal-required") return this.nextDeal!(state, cut);
      if (a.phase !== "ready-scoring" || !rules.scoring) return { ok: true, state };
      try {
        if (Object.values(state.hands).some(hand => hand.length)) return fail("Hands must be empty before scoring.");
        const completed = scoreContract(a, rules.scoring);
        const next = structuredClone(state);
        next.roundStatus = "complete";
        const winner = matchWinner(completed.cumulativeScores, rules.scoring.matchTarget);
        if (winner !== null) {
          next.auction!.scores = completed.cumulativeScores;
          next.auction!.matchWinner = winner;
          return { ok: true, state: next };
        }
        return this.nextDeal!(next, cut, completed);
      } catch { return fail("Unable to finalize contract deal."); }
    },
    startRound(seats, shuffle) {
      if (!Array.isArray(seats) || seats.length !== 4 || new Set(seats).size !== 4 ||
          Array.from(seats).some(id => typeof id !== "string" || !id.trim())) {
        return { ok: false, error: { code: "invalid-players", message: "Four unique nonblank seats are required." } };
      }
      try {
        const indices = shuffle(standard.map((_, i) => i));
        if (!Array.isArray(indices) || indices.length !== 52 || new Set(indices).size !== 52 ||
            Array.from(indices).some(i => !Number.isInteger(i) || i < 0 || i >= 52)) throw new Error();
        return { ok: true, state: deal(seats, seats[0], indices.map(i => standard[i]), { "0": 0, "1": 0 }) };
      } catch { return { ok: false, error: { code: "invalid-shuffle", message: "A complete deck permutation is required." } }; }
    },
    nextDeal(state, cut, completed) {
      const a = state.auction;
      if (!a) return fail("Missing auction state.");
      const isComplete = state.roundStatus === "complete";
      if (isComplete ? !completed : a.phase !== "redeal-required" || completed !== undefined) {
        return fail("Only a cancelled auction or a trusted completed deal can redeal.");
      }
      let deck: readonly Card[];
      let dealer = a.dealer;
      let scores = a.scores;
      if (isComplete && completed) {
        deck = completed.deck;
        scores = completed.cumulativeScores;
        dealer = state.playOrder[(state.playOrder.indexOf(dealer) + 1) % 4];
      } else {
        // No hand/kitty movement is allowed in the cancelled auction. Reassemble
        // the exact packet stack rather than inventing a collection order.
        const index = state.playOrder.indexOf(dealer);
        const order = Array.from({ length: 3 }, (_, i) => state.playOrder[(index + i + 1) % 4]);
        deck = [...order.flatMap(id => state.hands[id]), ...a.kitty, ...state.hands[dealer]];
      }
      if (!Array.isArray(deck) || deck.length !== 52 || new Set(deck.map(c => `${c.suit}:${c.rank}`)).size !== 52 ||
          deck.some(c => !standard.some(s => s.suit === c.suit && s.rank === c.rank && s.value === c.value)) ||
          !scores || !Number.isSafeInteger(scores["0"]) || !Number.isSafeInteger(scores["1"])) return fail("Invalid completed deck or cumulative scores.");
      try {
        const offset = cut(deck.length);
        if (!Number.isInteger(offset) || offset < 0 || offset >= deck.length) return fail("Cut offset must be from 0 to 51.");
        return { ok: true, state: deal(state.playOrder, dealer, [...deck.slice(offset), ...deck.slice(0, offset)], scores) };
      } catch { return fail("Trusted cut failed."); }
    },
    applyAction(state, playerID, action) {
      const a = state.auction;
      if (!a || state.roundStatus !== "playing" || !playerID || !state.playOrder.includes(playerID) ||
          state.currentPlayer !== playerID || (a.phase === "bidding" && a.passed.includes(playerID))) return fail("Only the active participant may act.");
      const fields: Record<string, unknown> = Object.create(null);
      try {
        if (!action || typeof action !== "object" || Object.getPrototypeOf(action) !== Object.prototype) return fail("Expected a plain action.");
        for (const key of Reflect.ownKeys(action)) {
          const d = Object.getOwnPropertyDescriptor(action, key)!;
          if (typeof key !== "string" || !d.enumerable || !("value" in d)) return fail("Only data fields are allowed.");
          fields[key] = d.value;
        }
      } catch { return fail("Action could not be inspected."); }
      const keys = Object.keys(fields);
      if (rules.trickPlay && fields.type === "play-card") {
        if (keys.length !== 2 || !keys.includes("cardIndex")) return fail("Expected an owned card index only.");
        return playTrickCard(state, playerID, fields.cardIndex, rules.trickPlay);
      }
      if (a.phase === "choose-trump") {
        if (playerID !== a.declarer || fields.type !== "choose-trump" || keys.length !== 2 ||
            !keys.includes("suit") || !["spades", "hearts", "diamonds", "clubs"].includes(fields.suit as string)) return fail("Declarer must choose a suit.");
        const next = structuredClone(state);
        next.auction!.trump = fields.suit as Suit;
        next.auction!.phase = rules.declarerSetup ? "take-kitty" : "ready";
        return { ok: true, state: next };
      }
      if (rules.declarerSetup && (a.phase === "take-kitty" || a.phase === "discard")) {
        if (playerID !== a.declarer || !a.trump || a.discardStack) return fail("Only the declarer may complete setup once.");
        const hand = state.hands[playerID];
        if (a.phase === "take-kitty") {
          if (fields.type !== "take-kitty" || keys.length !== 1 || hand.length !== rules.packet.hand ||
              a.kitty.length !== rules.packet.kitty) return fail("Expected one kitty pickup after trump selection.");
          const next = structuredClone(state);
          next.hands[playerID].push(...next.auction!.kitty.splice(0));
          next.auction!.phase = "discard";
          return { ok: true, state: next };
        }
        if (fields.type !== "discard-owned" || keys.length !== 2 || !keys.includes("cardIndices") ||
            hand.length !== rules.packet.hand + rules.packet.kitty) return fail("Select exactly four owned cards.");
        const indices: number[] = [];
        try {
          const input = fields.cardIndices;
          const count = rules.declarerSetup.discard.count;
          if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== count ||
              Reflect.ownKeys(input).length !== count + 1) return fail("Expected four plain card indices.");
          for (let i = 0; i < count; i++) {
            const d = Object.getOwnPropertyDescriptor(input, String(i));
            if (!d || !d.enumerable || !("value" in d) || !Number.isInteger(d.value) ||
                d.value < 0 || d.value >= hand.length) return fail("Invalid owned-card index.");
            indices.push(d.value);
          }
        } catch { return fail("Card selection could not be inspected."); }
        if (new Set(indices).size !== indices.length) return fail("Discard cards must be distinct.");
        const next = structuredClone(state);
        next.auction!.discardStack = {
          cards: indices.map(i => next.hands[playerID][i]), teamID: a.teams[playerID], placedBy: playerID,
        };
        next.hands[playerID] = next.hands[playerID].filter((_, i) => !indices.includes(i));
        next.auction!.phase = "ready";
        next.currentPlayer = playerID;
        if (rules.trickPlay) next.auction!.tricks = {
          active: [], leader: playerID, completed: 0, lastWinner: null,
          teamCounts: { "0": 0, "1": 0 }, collections: { "0": [], "1": [] },
        };
        return { ok: true, state: next };
      }
      if (a.phase !== "bidding") return fail("Auction is not accepting bids.");
      const pass = fields.type === "pass" && keys.length === 1;
      const bid = fields.type === "bid" && keys.length === 2 && keys.includes("amount") &&
        typeof fields.amount === "number" && Number.isInteger(fields.amount) && fields.amount >= rules.min &&
        fields.amount <= rules.max && fields.amount % rules.step === 0 && fields.amount > (a.highBid ?? 0);
      if (!pass && !bid) return fail("Expected pass or a strictly increasing bid from 100 to 165 in steps of 5.");
      const next = structuredClone(state);
      const auction = next.auction!;
      auction.history.push({ playerID, bid: pass ? null : fields.amount as number });
      if (pass) auction.passed.push(playerID);
      else { auction.highBid = fields.amount as number; auction.highBidder = playerID; }
      if (auction.highBid === null && auction.passed.length === rules.openingPasses) {
        auction.phase = "redeal-required";
      } else {
        const active = next.playOrder.filter(id => !auction.passed.includes(id));
        if (active.length === 1 && auction.highBidder === active[0]) {
          auction.declarer = active[0]; auction.phase = "choose-trump"; next.currentPlayer = active[0];
        } else {
          const index = next.playOrder.indexOf(playerID);
          for (let i = 1; i <= 4; i++) {
            const id = next.playOrder[(index + i) % 4];
            if (active.includes(id)) { next.currentPlayer = id; break; }
          }
        }
      }
      return { ok: true, state: next };
    },
    playerView(state, playerID) {
      const a = state.auction!;
      return {
        deckCount: state.deck.length, hands: Object.fromEntries(state.playOrder.map(id =>
          [id, id === playerID ? state.hands[id].map(cardCopy) : []])),
        ...(rules.scoring ? { handCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])) } : {}),
        playOrder: [...state.playOrder], currentPlayer: state.currentPlayer,
        hasActed: Object.fromEntries(state.playOrder.map(id => [id, false])),
        roundStatus: state.roundStatus, revealed: false, winner: null,
        auction: {
          dealer: a.dealer, teams: Object.fromEntries(state.playOrder.map(id => [id, a.teams[id]])),
          scores: { "0": a.scores["0"], "1": a.scores["1"] }, phase: a.phase,
          passed: [...a.passed], highBid: a.highBid, highBidder: a.highBidder,
          declarer: a.declarer, trump: a.trump, kittyCount: a.kitty.length,
          history: a.history.map(h => ({ playerID: h.playerID, bid: h.bid })),
          ...(state.roundStatus === "complete" && a.matchWinner !== undefined ? { matchWinner: a.matchWinner } : {}),
          ...(a.tricks ? { tricks: trickView(a.tricks) } : {}),
          ...(a.discardStack ? { discardStack: {
            count: a.discardStack.cards.length, face: "down" as const,
            teamID: a.discardStack.teamID, placedBy: a.discardStack.placedBy,
          } } : {}),
        },
      };
    },
  };
}
