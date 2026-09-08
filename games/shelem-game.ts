import { INVALID_MOVE } from "boardgame.io/core";
import type { Game, Move } from "boardgame.io";
import { createGameRuntime, type RoundState, type RoundView } from "./engine/runtime";
import { shelemDefinition } from "./definitions/shelem";

export interface ShelemGameState {
  started: boolean;
  roundStatus: "waiting" | "playing" | "complete";
  playOrder: string[];
  round: RoundState | null;
  view: RoundView | null;
}
const built = createGameRuntime(shelemDefinition);
if (!built.ok) throw new Error(`Invalid Shelem definition: ${JSON.stringify(built.errors)}`);
const runtime = built.runtime;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function accept(G: ShelemGameState, round: RoundState) {
  G.round = round; G.view = null; G.started = true; G.roundStatus = round.roundStatus;
  G.playOrder = [...round.playOrder];
}
function perform({ G, ctx, playerID, random, events }: Parameters<Exclude<Move<ShelemGameState>, { move: unknown }>>[0], action: unknown) {
  if (!G.round || G.roundStatus !== "playing" || ctx.currentPlayer !== playerID) return INVALID_MOVE;
  const result = runtime.applyAction(copy(G.round), playerID, action);
  if (!result.ok) return INVALID_MOVE;
  const transitioned = runtime.advanceLifecycle!(result.state, length => random.Die(length) - 1);
  if (!transitioned.ok) return INVALID_MOVE;
  accept(G, transitioned.state);
  events.endTurn({ next: transitioned.state.currentPlayer });
}
export const ShelemGame: Game<ShelemGameState> = {
  name: "shelem", minPlayers: 4, maxPlayers: 4,
  events: { endGame: false, endPhase: false, endTurn: false, setPhase: false,
    endStage: false, setStage: false, pass: false, setActivePlayers: false },
  phases: {
    waiting: { start: true },
    playing: { turn: { order: {
      first: ({ G }) => G.playOrder.indexOf(G.round!.currentPlayer),
      next: ({ G }) => G.playOrder.indexOf(G.round!.currentPlayer),
      playOrder: ({ G }) => G.playOrder,
    } } },
  },
  setup: ({ ctx }) => {
    if (ctx.numPlayers !== 4) throw new Error("Shelem requires exactly four seats.");
    return { started: false, roundStatus: "waiting", playOrder: ["0", "1", "2", "3"], round: null, view: null };
  },
  moves: {
    startGame: { client: false, undoable: false, move: ({ G, ctx, playerID, random, events }) => {
      if (G.started || ctx.phase !== "waiting" || playerID !== "0") return INVALID_MOVE;
      const result = runtime.startRound(G.playOrder, indices => random.Shuffle(indices));
      if (!result.ok) return INVALID_MOVE;
      accept(G, result.state); events.setPhase("playing");
    } },
    bid: { client: false, move: (context, amount: unknown) => perform(context, { type: "bid", amount }) },
    passBid: { client: false, move: context => perform(context, { type: "pass" }) },
    chooseTrump: { client: false, move: (context, suit: unknown) => perform(context, { type: "choose-trump", suit }) },
    takeKitty: { client: false, move: context => perform(context, { type: "take-kitty" }) },
    discardCards: { client: false, redact: true, move: (context, cardIndices: unknown) => perform(context, { type: "discard-owned", cardIndices }) },
    playCard: { client: false, move: (context, cardIndex: unknown) => perform(context, { type: "play-card", cardIndex }) },
    restartGame: { client: false, move: ({ G, ctx, playerID, random, events }) => {
      if (G.roundStatus !== "complete" || !playerID || ctx.currentPlayer !== playerID) return INVALID_MOVE;
      const result = runtime.startRound(G.playOrder, indices => random.Shuffle(indices));
      if (!result.ok) return INVALID_MOVE;
      accept(G, result.state); events.setPhase("playing");
    } },
  },
  playerView: ({ G, playerID }) => ({
    started: G.started, roundStatus: G.roundStatus, playOrder: [...G.playOrder], round: null,
    view: G.round ? runtime.playerView(G.round, playerID) : G.view,
  }),
};
