import test from "node:test";
import assert from "node:assert/strict";
import { INVALID_MOVE } from "boardgame.io/core";
import type { Card, Suit } from "./engine/cards";
import { createGameRuntime, type RoundState } from "./engine/runtime";
import { crazyEightsDefinition } from "./definitions/crazy-eights";
import { CrazyEightsGame, type CrazyEightsGameState } from "./crazy-eights-game";

const identity = <T,>(items: T[]) => [...items];
const setupContext = {
  ctx: { numPlayers: 2, phase: "waiting", currentPlayer: "0" },
  random: { Shuffle: identity },
} as any;
const move = (name: "startGame" | "playCard" | "drawCard" | "restartGame") => {
  const definition = CrazyEightsGame.moves![name];
  assert.equal(typeof definition, "object");
  if (typeof definition === "function") throw new Error("Expected server-only move");
  return definition.move;
};
const view = (G: CrazyEightsGameState, playerID: string | null | undefined) =>
  CrazyEightsGame.playerView!({ G, playerID } as any);
const built = createGameRuntime(crazyEightsDefinition);
assert.ok(built.ok);
const runtime = built.runtime;

function authoritative(G: CrazyEightsGameState, state: RoundState) {
  assert.deepEqual(G.deck, state.deck);
  assert.deepEqual(G.hands, state.hands);
  assert.deepEqual(G.discard, state.discard);
  assert.deepEqual(G.discardTop, state.discard?.at(-1) ?? null);
  assert.equal(G.activeSuit, state.activeSuit ?? null);
  assert.deepEqual(G.handCounts, Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])));
  assert.deepEqual(G.winner, state.winner);
  assert.equal(G.roundStatus, state.roundStatus);
}

test("Crazy Eights adapter delegates start and legal play to runtime", () => {
  const G = CrazyEightsGame.setup!(setupContext);
  const ctx = { numPlayers: 2, phase: "waiting", currentPlayer: "0" };
  const context = {
    ...setupContext, G, ctx,
    events: {
      setPhase: (phase: string) => { ctx.phase = phase; ctx.currentPlayer = G.playOrder[0]; },
      endTurn: ({ next }: { next: string }) => { ctx.currentPlayer = next; },
    },
  };
  assert.equal(move("drawCard")({ ...context, playerID: "0" }), INVALID_MOVE);
  assert.equal(move("startGame")({ ...context, playerID: "1" }), INVALID_MOVE);

  const started = runtime.startRound(["0", "1"], indices => [...indices]);
  assert.ok(started.ok);
  let state = started.state;
  assert.notEqual(move("startGame")({ ...context, playerID: "0" }), INVALID_MOVE);
  authoritative(G, state);
  assert.equal(ctx.phase, "playing");

  const index = state.hands["0"].findIndex(card => card.rank === "8" || card.suit === state.activeSuit || card.rank === state.discard?.at(-1)?.rank);
  assert.ok(index >= 0);
  const selected = state.hands["0"][index];
  const suit: Suit | undefined = selected.rank === "8" ? "diamonds" : undefined;
  const action = suit ? { type: "play-card", cardIndex: index, suit } : { type: "play-card", cardIndex: index };
  const expected = runtime.applyAction(state, "0", action);
  assert.ok(expected.ok);
  state = expected.state;
  assert.notEqual(move("playCard")({ ...context, playerID: "0" }, index, suit), INVALID_MOVE);
  authoritative(G, state);
  assert.equal(ctx.currentPlayer, state.currentPlayer);
});

test("Crazy Eights adapter views keep other hands/deck/discard history private", () => {
  const started = runtime.startRound(["0", "1"], indices => [...indices]);
  assert.ok(started.ok);
  const state = started.state;
  const G = CrazyEightsGame.setup!(setupContext);
  Object.assign(G, {
    deck: state.deck, hands: state.hands, discard: state.discard,
    discardTop: state.discard?.at(-1) ?? null, activeSuit: state.activeSuit ?? null,
    started: true, roundStatus: state.roundStatus, playOrder: state.playOrder,
    handCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])), winner: state.winner,
  });
  for (const playerID of ["0", "1", null, undefined, "unknown"]) {
    const actual = view(G, playerID);
    assert.deepEqual(actual.deck, []);
    assert.deepEqual(actual.discard, []);
    assert.equal(actual.hands["0"].length, playerID === "0" ? 5 : 0);
    assert.equal(actual.hands["1"].length, playerID === "1" ? 5 : 0);
    assert.deepEqual(actual.handCounts, { "0": 5, "1": 5 });
    assert.deepEqual(actual.discardTop, state.discard?.at(-1));
    assert.equal(actual.activeSuit, state.activeSuit);
  }
});

test("Crazy Eights replay is terminal-current-player only and starts clean", () => {
  const G = CrazyEightsGame.setup!(setupContext);
  const ctx = { numPlayers: 2, phase: "waiting", currentPlayer: "0" };
  const context = {
    ...setupContext, G, ctx,
    events: {
      setPhase: (phase: string) => { ctx.phase = phase; ctx.currentPlayer = G.playOrder[0]; },
      endTurn: ({ next }: { next: string }) => { ctx.currentPlayer = next; },
    },
  };
  assert.notEqual(move("startGame")({ ...context, playerID: "0" }), INVALID_MOVE);
  G.roundStatus = "complete";
  G.winner = { type: "player", playerID: "0" };
  const before = structuredClone(G);
  assert.equal(move("restartGame")({ ...context, playerID: "1" }), INVALID_MOVE);
  assert.deepEqual(G, before);
  assert.notEqual(move("restartGame")({ ...context, playerID: ctx.currentPlayer }), INVALID_MOVE);
  assert.equal(G.roundStatus, "playing");
  assert.equal(G.winner, null);
  assert.deepEqual(G.handCounts, { "0": 5, "1": 5 });
  assert.equal(G.discard.length, 1);
  assert.equal(G.deck.length, 41);
});
