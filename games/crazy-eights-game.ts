import { INVALID_MOVE, TurnOrder } from "boardgame.io/core";
import type { Game } from "boardgame.io";
import type { Card, Suit } from "./engine/cards";
import { createGameRuntime, type RoundState, type RoundView, type Winner } from "./engine/runtime";
import { crazyEightsDefinition } from "./definitions/crazy-eights";

export interface CrazyEightsGameState {
  deck: Card[];
  deckCount: number;
  hands: Record<string, Card[]>;
  discard: Card[];
  discardTop: Card | null;
  activeSuit: Suit | null;
  started: boolean;
  roundStatus: "waiting" | "playing" | "complete";
  playOrder: string[];
  handCounts: Record<string, number>;
  winner: Winner;
}

const initialized = createGameRuntime(crazyEightsDefinition);
if (!initialized.ok) {
  throw new Error(`Invalid built-in Crazy Eights definition/runtime: ${JSON.stringify(initialized.errors)}`);
}
const runtime = initialized.runtime;
const copyCard = (card: Card): Card => ({ suit: card.suit, rank: card.rank, value: card.value });
const copyWinner = (winner: Winner): Winner => winner === null ? null :
  winner.type === "tie" ? { type: "tie" } : { type: "player", playerID: winner.playerID };

const toRound = (G: CrazyEightsGameState, currentPlayer = G.playOrder[0]): RoundState => ({
  deck: G.deck.map(copyCard),
  hands: Object.fromEntries(Object.entries(G.hands).map(([id, cards]) => [id, cards.map(copyCard)])),
  playOrder: [...G.playOrder], currentPlayer,
  hasActed: Object.fromEntries(G.playOrder.map(id => [id, false])),
  roundStatus: G.roundStatus === "waiting" ? "playing" : G.roundStatus,
  revealed: false, winner: copyWinner(G.winner),
  discard: G.discard.map(copyCard),
  ...(G.activeSuit ? { activeSuit: G.activeSuit } : {}),
});

const acceptRound = (G: CrazyEightsGameState, round: RoundState) => {
  const discard = (round.discard ?? []).map(copyCard);
  Object.assign(G, {
    deck: round.deck.map(copyCard), deckCount: round.deck.length,
    hands: Object.fromEntries(Object.entries(round.hands).map(([id, cards]) => [id, cards.map(copyCard)])),
    discard, discardTop: discard.length ? copyCard(discard[discard.length - 1]) : null,
    activeSuit: round.activeSuit ?? null, started: true, roundStatus: round.roundStatus,
    playOrder: [...round.playOrder],
    handCounts: Object.fromEntries(round.playOrder.map(id => [id, round.hands[id].length])),
    winner: copyWinner(round.winner),
  });
};

const visibleFields = (view: RoundView) => ({
  deck: [] as Card[], deckCount: view.deckCount,
  hands: Object.fromEntries(Object.entries(view.hands).map(([id, cards]) => [id, cards.map(copyCard)])),
  discard: [] as Card[], discardTop: view.discardTop ? copyCard(view.discardTop) : null,
  activeSuit: view.activeSuit ?? null, playOrder: [...view.playOrder],
  handCounts: { ...(view.handCounts ?? {}) }, winner: copyWinner(view.winner),
});

export const CrazyEightsGame: Game<CrazyEightsGameState> = {
  name: "crazy-eights",
  minPlayers: crazyEightsDefinition.players.min,
  maxPlayers: crazyEightsDefinition.players.max,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: { waiting: { start: true }, playing: { turn: { order: TurnOrder.CUSTOM_FROM("playOrder") } } },
  setup: ({ ctx }): CrazyEightsGameState => {
    const playOrder = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));
    return {
      deck: [], deckCount: 0, hands: Object.fromEntries(playOrder.map(id => [id, []])),
      discard: [], discardTop: null, activeSuit: null, started: false, roundStatus: "waiting", playOrder,
      handCounts: Object.fromEntries(playOrder.map(id => [id, 0])), winner: null,
    };
  },
  moves: {
    startGame: {
      client: false, undoable: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
        const result = runtime.startRound(Object.keys(G.hands), indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state); events.setPhase("playing");
      },
    },
    playCard: {
      client: false,
      move: ({ G, ctx, playerID, events }, cardIndex: number, suit?: Suit) => {
        if (G.roundStatus !== "playing") return INVALID_MOVE;
        const action = suit === undefined ? { type: "play-card", cardIndex } : { type: "play-card", cardIndex, suit };
        const result = runtime.applyAction(toRound(G, ctx.currentPlayer), playerID, action);
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        if (result.state.roundStatus === "playing") events.endTurn({ next: result.state.currentPlayer });
        return G;
      },
    },
    drawCard: {
      client: false,
      move: ({ G, ctx, playerID, events }) => {
        if (G.roundStatus !== "playing") return INVALID_MOVE;
        const result = runtime.applyAction(toRound(G, ctx.currentPlayer), playerID, { type: "draw" });
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        if (result.state.roundStatus === "playing") events.endTurn({ next: result.state.currentPlayer });
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
        acceptRound(G, result.state); events.setPhase("playing");
        return G;
      },
    },
  },
  playerView: ({ G, playerID }) => {
    const visible = runtime.playerView(toRound(G), playerID);
    return { ...visibleFields(visible), started: G.started, roundStatus: G.roundStatus };
  },
};
