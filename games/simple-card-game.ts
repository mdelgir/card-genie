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
  deck: Card[];
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
  setup: ({ ctx, random }): SimpleCardGameState => {
    const deck = random.Shuffle(createDeck());
    const hands: Record<string, Card | null> = {};
    for (let i = 0; i < ctx.numPlayers; i += 1) {
      hands[String(i)] = null;
    }
    const playOrder = random.Shuffle(
      Array.from({ length: ctx.numPlayers }, (_, index) => String(index))
    );

    return {
      deck,
      hands,
      winner: null,
      revealed: false,
      playOrder,
    };
  },
  turn: {
    order: TurnOrder.CUSTOM_FROM("playOrder"),
  },
  moves: {
    drawCard: ({ G, playerID, events }) => {
      if (!playerID) return INVALID_MOVE;
      if (G.hands[playerID]) return INVALID_MOVE;

      const [card, ...rest] = G.deck;
      if (!card) return INVALID_MOVE;

      G.deck = rest;
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
    restartGame: ({ G, ctx, random, events }) => {
      if (!G.revealed) return INVALID_MOVE;

      const deck = random.Shuffle(createDeck());
      const hands: Record<string, Card | null> = {};
      for (let i = 0; i < ctx.numPlayers; i += 1) {
        hands[String(i)] = null;
      }

      G.deck = deck;
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
  playerView: ({ G, playerID }) => {
    if (!playerID || G.revealed) return G;

    const maskedHands: Record<string, Card | null> = {};
    Object.keys(G.hands).forEach((id) => {
      maskedHands[id] = id === playerID ? G.hands[id] : null;
    });

    return {
      ...G,
      hands: maskedHands,
    };
  },
};
