import { INVALID_MOVE, TurnOrder } from "boardgame.io/core";
import type { Game } from "boardgame.io";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
}

export interface SimpleCardGameState {
  // Authoritative deck; playerView always replaces it with an empty array.
  deck: Card[];
  started: boolean;
  deckCount: number;
  hasDrawn: Record<string, boolean>;
  hands: Record<string, Card | null>;
  winner: string | "tie" | null;
  revealed: boolean;
  playOrder: string[];
}

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const ranks: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    ranks.forEach((rank, index) => {
      deck.push({ suit, rank, value: index + 2 });
    });
  }
  return deck;
};

const computeWinner = (hands: Record<string, Card | null>): string | "tie" => {
  let bestValue = -1;
  let bestPlayer: string | null = null;
  let isTie = false;

  Object.entries(hands).forEach(([playerID, card]) => {
    if (!card) return;
    if (card.value > bestValue) {
      bestValue = card.value;
      bestPlayer = playerID;
      isTie = false;
    } else if (card.value === bestValue) {
      isTie = true;
    }
  });

  if (isTie || bestPlayer === null) return "tie";
  return bestPlayer;
};

export const SimpleCardGame: Game<SimpleCardGameState> = {
  name: "simple-card-game",
  minPlayers: 2,
  maxPlayers: 8,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: { waiting: { start: true }, playing: { turn: { order: TurnOrder.CUSTOM_FROM("playOrder") } } },
  setup: ({ ctx }): SimpleCardGameState => {
    const deck: Card[] = [];
    const hands: Record<string, Card | null> = {};
    for (let i = 0; i < ctx.numPlayers; i += 1) {
      hands[String(i)] = null;
    }
    const playOrder = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));

    return {
      deck,
      started: false,
      deckCount: deck.length,
      hasDrawn: Object.fromEntries(Object.keys(hands).map((id) => [id, false])),
      hands,
      winner: null,
      revealed: false,
      playOrder,
    };
  },
  moves: {
    startGame: {
      client: false,
      undoable: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
        G.deck = random.Shuffle(createDeck());
        G.deckCount = G.deck.length;
        G.playOrder = random.Shuffle(Object.keys(G.hands));
        G.started = true;
        events.setPhase("playing");
      },
    },
    drawCard: {
      client: false,
      move: ({ G, playerID, events }) => {
        if (!G.started || !playerID) return INVALID_MOVE;
        if (G.hands[playerID]) return INVALID_MOVE;

        const [card, ...rest] = G.deck;
        if (!card) return INVALID_MOVE;

        G.deck = rest;
        G.deckCount = rest.length;
        G.hasDrawn[playerID] = true;
        G.hands[playerID] = card;

        const allDrawn = Object.values(G.hands).every(Boolean);
        if (allDrawn) {
          G.revealed = true;
          G.winner = computeWinner(G.hands);
        } else {
          events.endTurn();
        }

        return G;
      },
    },
    restartGame: {
      client: false,
      move: ({ G, ctx, random, events }) => {
        if (!G.started || !G.revealed) return INVALID_MOVE;

        const deck = random.Shuffle(createDeck());
        const hands: Record<string, Card | null> = {};
        for (let i = 0; i < ctx.numPlayers; i += 1) {
          hands[String(i)] = null;
        }

        G.deck = deck;
        G.deckCount = deck.length;
        G.hasDrawn = Object.fromEntries(Object.keys(hands).map((id) => [id, false]));
        G.hands = hands;
        G.winner = null;
        G.revealed = false;
        G.playOrder = random.Shuffle(
          Array.from({ length: ctx.numPlayers }, (_, index) => String(index))
        );

        events.endTurn({ next: G.playOrder[0] });

        return G;
      },
    },
  },
  playerView: ({ G, playerID }) => {
    const maskedHands: Record<string, Card | null> = {};
    Object.keys(G.hands).forEach((id) => {
      maskedHands[id] = G.revealed || id === playerID ? G.hands[id] : null;
    });

    return {
      // Allowlist public fields so future private zones cannot leak by default.
      deck: [],
      started: G.started,
      deckCount: G.deck.length,
      hasDrawn: Object.fromEntries(
        Object.entries(G.hands).map(([id, card]) => [id, Boolean(card)])
      ),
      hands: maskedHands,
      winner: G.winner,
      revealed: G.revealed,
      playOrder: G.playOrder,
    };
  },
};
