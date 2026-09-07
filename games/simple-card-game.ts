import { INVALID_MOVE, TurnOrder } from "boardgame.io/core";
import type { Game } from "boardgame.io";
import type { Card } from "./engine/cards";
import { createGameRuntime, type RoundState, type RoundView, type Winner } from "./engine/runtime";
import { highestCardDefinition } from "./definitions/highest-card";

export type { Card, Rank, Suit } from "./engine/cards";

export interface SimpleCardGameState {
  // Authoritative deck; playerView always replaces it with an empty array.
  deck: Card[];
  started: boolean;
  roundStatus: "waiting" | "playing" | "complete";
  deckCount: number;
  hasDrawn: Record<string, boolean>;
  hands: Record<string, Card | null>;
  winner: string | "tie" | null;
  revealed: boolean;
  playOrder: string[];
}

const initialized = createGameRuntime(highestCardDefinition);
if (!initialized.ok) {
  throw new Error(`Invalid built-in Highest Card definition: ${JSON.stringify(initialized.errors)}`);
}
const runtime = initialized.runtime;
const copyCard = (card: Card): Card => ({ suit: card.suit, rank: card.rank, value: card.value });
const wireWinner = (winner: Winner): SimpleCardGameState["winner"] =>
  winner === null ? null : winner.type === "tie" ? "tie" : winner.playerID;

// Explicit copies detach boardgame.io Immer drafts before the pure runtime clones state.
const toRound = (G: SimpleCardGameState, currentPlayer = G.playOrder[0]): RoundState => ({
  deck: G.deck.map(copyCard),
  hands: Object.fromEntries(Object.entries(G.hands).map(([id, card]) => [id, card ? [copyCard(card)] : []])),
  playOrder: [...G.playOrder],
  currentPlayer,
  hasActed: { ...G.hasDrawn },
  // Waiting belongs to the room adapter; its empty state still uses runtime visibility.
  roundStatus: G.roundStatus === "waiting" ? "playing" : G.roundStatus,
  revealed: G.revealed,
  winner: G.winner === null ? null : G.winner === "tie" ? { type: "tie" } : { type: "player", playerID: G.winner },
});

const wireFields = (round: RoundState | RoundView) => ({
  hands: Object.fromEntries(Object.entries(round.hands).map(([id, cards]) => [id, cards[0] ?? null])),
  hasDrawn: round.hasActed,
  playOrder: round.playOrder,
  winner: wireWinner(round.winner),
  revealed: round.revealed,
});
const acceptRound = (G: SimpleCardGameState, round: RoundState) => {
  Object.assign(G, wireFields(round), {
    deck: round.deck, deckCount: round.deck.length, started: true, roundStatus: round.roundStatus,
  });
};

export const SimpleCardGame: Game<SimpleCardGameState> = {
  name: "simple-card-game",
  minPlayers: highestCardDefinition.players.min,
  maxPlayers: highestCardDefinition.players.max,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: { waiting: { start: true }, playing: { turn: { order: TurnOrder.CUSTOM_FROM("playOrder") } } },
  setup: ({ ctx }): SimpleCardGameState => {
    const playOrder = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));
    return {
      deck: [], started: false, roundStatus: "waiting", deckCount: 0,
      hasDrawn: Object.fromEntries(playOrder.map(id => [id, false])),
      hands: Object.fromEntries(playOrder.map(id => [id, null])),
      winner: null, revealed: false, playOrder,
    };
  },
  moves: {
    startGame: {
      client: false,
      undoable: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
        const result = runtime.startRound(Object.keys(G.hands), indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        events.setPhase("playing");
      },
    },
    drawCard: {
      client: false,
      move: ({ G, ctx, playerID, events }) => {
        if (G.roundStatus !== "playing") return INVALID_MOVE;
        const result = runtime.applyAction(toRound(G, ctx.currentPlayer), playerID, { type: "draw" });
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        if (result.state.roundStatus === "playing") {
          events.endTurn({ next: result.state.currentPlayer });
        }
        return G;
      },
    },
    restartGame: {
      client: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.roundStatus !== "complete" || !playerID || playerID !== ctx.currentPlayer) return INVALID_MOVE;
        const seats = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));
        const result = runtime.startRound(seats, indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        // Re-enter the phase to refresh ctx.playOrder as well as its first player.
        events.setPhase("playing");
        return G;
      },
    },
  },
  playerView: ({ G, playerID }) => {
    const visible = runtime.playerView(toRound(G), playerID);
    return {
      ...wireFields(visible),
      deck: [], started: G.started, roundStatus: G.roundStatus, deckCount: visible.deckCount,
    };
  },
};
