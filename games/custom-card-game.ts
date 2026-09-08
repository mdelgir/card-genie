import { INVALID_MOVE, TurnOrder } from "boardgame.io/core";
import type { Game } from "boardgame.io";
import type { GameDefinition } from "./engine/types";
import type { RoundState, RoundView } from "./engine/runtime";
import { createGameRuntime } from "./engine/runtime";
import { validateGameDefinition } from "./engine/validator";
import type { Suit } from "./engine/cards";

export interface CustomGameSetupData {
  hostName?: string;
  definition: GameDefinition;
}

export interface CustomCardGameState {
  definition: GameDefinition;
  started: boolean;
  roundStatus: "waiting" | "playing" | "complete";
  playOrder: string[];
  /** Authoritative only. playerView always replaces this with null. */
  round: RoundState | null;
  /** Filtered client projection. Authoritative state leaves this null. */
  view: RoundView | null;
}

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function runtimeFor(definition: GameDefinition) {
  const built = createGameRuntime(copy(definition));
  if (!built.ok) throw new Error(`Invalid custom game definition: ${JSON.stringify(built.errors)}`);
  return built.runtime;
}

function acceptRound(G: CustomCardGameState, round: RoundState) {
  G.round = copy(round);
  G.playOrder = [...round.playOrder];
  G.roundStatus = round.roundStatus;
  G.started = true;
  G.view = null;
}

function apply(
  G: CustomCardGameState,
  currentPlayer: string,
  playerID: string | null,
  action: unknown,
) {
  if (!G.round || G.roundStatus !== "playing") return null;
  const result = runtimeFor(G.definition).applyAction(copy(G.round), playerID, action);
  if (!result.ok) return null;
  acceptRound(G, result.state);
  return result.state;
}

export const CustomCardGame: Game<CustomCardGameState> = {
  name: "custom-card-game",
  minPlayers: 2,
  maxPlayers: 8,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: {
    waiting: { start: true },
    playing: { turn: { order: TurnOrder.CUSTOM_FROM("playOrder") } },
  },
  setup: ({ ctx }, setupData?: CustomGameSetupData): CustomCardGameState => {
    const validation = validateGameDefinition(setupData?.definition);
    if (!validation.ok) throw new Error(`Invalid custom game definition: ${JSON.stringify(validation.errors)}`);
    if (ctx.numPlayers < validation.definition.players.min || ctx.numPlayers > validation.definition.players.max) {
      throw new Error(`Custom game requires ${validation.definition.players.min}–${validation.definition.players.max} players.`);
    }
    const playOrder = Array.from({ length: ctx.numPlayers }, (_, index) => String(index));
    return {
      definition: copy(validation.definition), started: false, roundStatus: "waiting",
      playOrder, round: null, view: null,
    };
  },
  moves: {
    startGame: {
      client: false, undoable: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
        const result = runtimeFor(G.definition).startRound(G.playOrder, indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        events.setPhase("playing");
        return G;
      },
    },
    drawCard: {
      client: false,
      move: ({ G, ctx, playerID, events }) => {
        const round = apply(G, ctx.currentPlayer, playerID, { type: "draw" });
        if (!round) return INVALID_MOVE;
        if (round.roundStatus === "playing") events.endTurn({ next: round.currentPlayer });
        return G;
      },
    },
    revealBattle: {
      client: false,
      move: ({ G, ctx, playerID, events }) => {
        const round = apply(G, ctx.currentPlayer, playerID, { type: "reveal-top" });
        if (!round) return INVALID_MOVE;
        if (round.roundStatus === "playing") events.endTurn({ next: round.currentPlayer });
        return G;
      },
    },
    playCard: {
      client: false,
      move: ({ G, ctx, playerID, events }, cardIndex: number, suit?: Suit) => {
        const action = suit === undefined ? { type: "play-card", cardIndex } : { type: "play-card", cardIndex, suit };
        const round = apply(G, ctx.currentPlayer, playerID, action);
        if (!round) return INVALID_MOVE;
        if (round.roundStatus === "playing") events.endTurn({ next: round.currentPlayer });
        return G;
      },
    },
    restartGame: {
      client: false,
      move: ({ G, ctx, playerID, random, events }) => {
        if (G.roundStatus !== "complete" || !playerID || playerID !== ctx.currentPlayer) return INVALID_MOVE;
        const result = runtimeFor(G.definition).startRound(G.playOrder, indices => random.Shuffle(indices));
        if (!result.ok) return INVALID_MOVE;
        acceptRound(G, result.state);
        events.setPhase("playing");
        return G;
      },
    },
  },
  playerView: ({ G, playerID }) => {
    const definition = copy(G.definition);
    if (!G.round) return { definition, started: G.started, roundStatus: G.roundStatus,
      playOrder: [...G.playOrder], round: null, view: null };
    const view = runtimeFor(definition).playerView(copy(G.round), playerID);
    return { definition, started: G.started, roundStatus: G.roundStatus,
      playOrder: [...G.playOrder], round: null, view };
  },
};
