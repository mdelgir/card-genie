import { INVALID_MOVE, TurnOrder } from "boardgame.io/core";
import type { Game } from "boardgame.io";
import type { Card } from "./engine/cards";
import {
  createGameRuntime,
  type Contribution,
  type RoundState,
  type RoundView,
  type TablePlacement,
  type Winner,
} from "./engine/runtime";
import { warDefinition } from "./definitions/war";

export interface WarGameState {
  deck: Card[];
  piles: Record<string, Card[]>;
  pot: Card[];
  contributions: Contribution[];
  tablePlacements: TablePlacement[];
  started: boolean;
  roundStatus: "waiting" | "playing" | "complete";
  playOrder: string[];
  pileCounts: Record<string, number>;
  potCount: number;
  battleResult: Winner;
  winner: Winner;
}

const initialized = createGameRuntime(warDefinition);
if (!initialized.ok) {
  throw new Error(`Invalid built-in War definition: ${JSON.stringify(initialized.errors)}`);
}
const runtime = initialized.runtime;

const copyCard = (card: Card): Card => ({ suit: card.suit, rank: card.rank, value: card.value });
const copyWinner = (winner: Winner): Winner => winner === null ? null :
  winner.type === "tie" ? { type: "tie" } : { type: "player", playerID: winner.playerID };
const copyPlacement = (placement: TablePlacement): TablePlacement => ({
  zone: placement.zone,
  sequence: placement.sequence,
  face: placement.face,
  ownerID: placement.ownerID,
  placedBy: placement.placedBy,
  card: placement.card ? copyCard(placement.card) : null,
});

// Explicit copies detach boardgame.io Immer drafts before the pure runtime clones state.
const toRound = (G: WarGameState, currentPlayer = G.playOrder[0]): RoundState => ({
  deck: G.deck.map(copyCard),
  hands: Object.fromEntries(Object.entries(G.piles).map(([id, cards]) => [id, cards.map(copyCard)])),
  playOrder: [...G.playOrder],
  currentPlayer,
  hasActed: Object.fromEntries(G.playOrder.map(id => [id, false])),
  roundStatus: G.roundStatus === "waiting" ? "playing" : G.roundStatus,
  revealed: false,
  winner: copyWinner(G.winner),
  battle: {
    pot: G.pot.map(copyCard),
    contributions: G.contributions.map(({ playerID, card }) => ({ playerID, card: copyCard(card) })),
    placements: G.tablePlacements.map(copyPlacement),
    result: copyWinner(G.battleResult),
  },
});

const acceptRound = (G: WarGameState, round: RoundState) => {
  const battle = round.battle ?? { pot: [], contributions: [], placements: [], result: null };
  Object.assign(G, {
    deck: round.deck.map(copyCard),
    piles: Object.fromEntries(Object.entries(round.hands).map(([id, cards]) => [id, cards.map(copyCard)])),
    pot: battle.pot.map(copyCard),
    contributions: battle.contributions.map(({ playerID, card }) => ({ playerID, card: copyCard(card) })),
    tablePlacements: battle.placements.map(copyPlacement),
    started: true,
    roundStatus: round.roundStatus,
    playOrder: [...round.playOrder],
    pileCounts: Object.fromEntries(round.playOrder.map(id => [id, round.hands[id].length])),
    potCount: battle.pot.length,
    battleResult: copyWinner(battle.result),
    winner: copyWinner(round.winner),
  });
};

const visibleFields = (visible: RoundView) => ({
  deck: [] as Card[],
  piles: Object.fromEntries(visible.playOrder.map(id => [id, [] as Card[]])),
  pot: [] as Card[],
  contributions: (visible.contributions ?? []).map(({ playerID, card }) => ({ playerID, card: copyCard(card) })),
  tablePlacements: (visible.tablePlacements ?? []).map(copyPlacement),
  playOrder: [...visible.playOrder],
  pileCounts: { ...(visible.pileCounts ?? {}) },
  potCount: visible.potCount ?? 0,
  battleResult: copyWinner(visible.battleResult ?? null),
  winner: copyWinner(visible.winner),
});

export const WarGame: Game<WarGameState> = {
  name: "war",
  minPlayers: warDefinition.players.min,
  maxPlayers: warDefinition.players.max,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: { waiting: { start: true }, playing: { turn: { order: TurnOrder.CUSTOM_FROM("playOrder") } } },
  setup: ({ ctx }): WarGameState => {
    const playOrder = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));
    return {
      deck: [],
      piles: Object.fromEntries(playOrder.map(id => [id, []])),
      pot: [],
      contributions: [],
      tablePlacements: [],
      started: false,
      roundStatus: "waiting",
      playOrder,
      pileCounts: Object.fromEntries(playOrder.map(id => [id, 0])),
      potCount: 0,
      battleResult: null,
      winner: null,
    };
  },
  moves: {
    startGame: {
      client: false,
      undoable: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
        const result = runtime.startRound(Object.keys(G.piles), indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        events.setPhase("playing");
      },
    },
    revealBattle: {
      client: false,
      move: ({ G, ctx, playerID, events }) => {
        if (G.roundStatus !== "playing") return INVALID_MOVE;
        const result = runtime.applyAction(toRound(G, ctx.currentPlayer), playerID, { type: "reveal-top" });
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
        events.setPhase("playing");
        return G;
      },
    },
  },
  playerView: ({ G, playerID }) => {
    const visible = runtime.playerView(toRound(G), playerID);
    return {
      ...visibleFields(visible),
      started: G.started,
      roundStatus: G.roundStatus,
    };
  },
};
