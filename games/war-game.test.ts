import test from "node:test";
import assert from "node:assert/strict";
import { INVALID_MOVE } from "boardgame.io/core";
import { createGameRuntime, type RoundState, type RoundView } from "./engine/runtime";
import { warDefinition } from "./definitions/war";
import { WarGame, type WarGameState } from "./war-game";

const identity = <T,>(items: T[]) => [...items];
const setupContext = {
  ctx: { numPlayers: 2, phase: "waiting", currentPlayer: "0" },
  random: { Shuffle: identity },
} as any;

const move = (name: "startGame" | "revealBattle" | "restartGame") => {
  const definition = WarGame.moves![name];
  assert.equal(typeof definition, "object");
  if (typeof definition === "function") throw new Error("Expected server-only move");
  assert.equal(definition.client, false);
  return definition.move;
};

const view = (G: WarGameState, playerID: string | null | undefined) =>
  WarGame.playerView!({ G, playerID } as any);

const built = createGameRuntime(warDefinition);
assert.ok(built.ok);
const runtime = built.runtime;

function expectedWire(state: RoundState, visible: RoundView) {
  return {
    deck: [],
    piles: Object.fromEntries(state.playOrder.map(id => [id, []])),
    pot: [],
    contributions: visible.contributions,
    tablePlacements: visible.tablePlacements,
    started: true,
    roundStatus: state.roundStatus,
    playOrder: visible.playOrder,
    pileCounts: visible.pileCounts,
    potCount: visible.potCount,
    battleResult: visible.battleResult,
    winner: visible.winner,
  };
}

function compareAuthoritative(G: WarGameState, state: RoundState) {
  assert.deepEqual(G.deck, state.deck);
  assert.deepEqual(G.piles, state.hands);
  assert.deepEqual(G.pot, state.battle?.pot ?? []);
  assert.deepEqual(G.contributions, state.battle?.contributions ?? []);
  assert.deepEqual(G.tablePlacements, state.battle?.placements ?? []);
  assert.deepEqual(G.playOrder, state.playOrder);
  assert.deepEqual(G.pileCounts, Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])));
  assert.equal(G.potCount, state.battle?.pot.length ?? 0);
  assert.deepEqual(G.battleResult, state.battle?.result ?? null);
  assert.deepEqual(G.winner, state.winner);
  assert.equal(G.roundStatus, state.roundStatus);
}

test("War adapter delegates setup and a battle to the generic runtime", () => {
  const G = WarGame.setup!(setupContext);
  const ctx = { numPlayers: 2, phase: "waiting", currentPlayer: "0" };
  const context = {
    ...setupContext,
    G,
    ctx,
    events: {
      setPhase: (phase: string) => { ctx.phase = phase; ctx.currentPlayer = G.playOrder[0]; },
      endTurn: ({ next }: { next: string }) => { ctx.currentPlayer = next; },
    },
  };

  assert.equal(move("revealBattle")({ ...context, playerID: "0" }), INVALID_MOVE);
  assert.equal(move("startGame")({ ...context, playerID: "1" }), INVALID_MOVE);

  const started = runtime.startRound(["0", "1"], indices => [...indices]);
  assert.ok(started.ok);
  let state = started.state;
  assert.notEqual(move("startGame")({ ...context, playerID: "0" }), INVALID_MOVE);
  compareAuthoritative(G, state);
  assert.equal(ctx.phase, "playing");
  assert.equal(ctx.currentPlayer, state.currentPlayer);
  assert.deepEqual(G.pileCounts, { "0": 26, "1": 26 });
  assert.equal(G.deck.length, 0);

  const before = structuredClone(G);
  assert.equal(move("revealBattle")({ ...context, playerID: "1" }), INVALID_MOVE);
  assert.deepEqual(G, before);

  const resolved = runtime.applyAction(state, state.currentPlayer, { type: "reveal-top" });
  assert.ok(resolved.ok);
  state = resolved.state;
  assert.notEqual(move("revealBattle")({ ...context, playerID: "0" }), INVALID_MOVE);
  compareAuthoritative(G, state);
  assert.equal(ctx.currentPlayer, state.currentPlayer);
  assert.equal(G.contributions.length, 2);
  assert.equal(G.tablePlacements.length, 2);
  assert.equal(G.potCount, 0);
});

test("War adapter views expose table structure but no face-down card identities", () => {
  const started = runtime.startRound(["0", "1"], indices => [...indices]);
  assert.ok(started.ok);
  const resolved = runtime.applyAction(started.state, "0", { type: "reveal-top" });
  assert.ok(resolved.ok);
  const state = resolved.state;

  const G = WarGame.setup!(setupContext);
  Object.assign(G, {
    deck: state.deck,
    piles: state.hands,
    pot: state.battle?.pot ?? [],
    contributions: state.battle?.contributions ?? [],
    tablePlacements: state.battle?.placements ?? [],
    started: true,
    roundStatus: state.roundStatus,
    playOrder: state.playOrder,
    pileCounts: Object.fromEntries(state.playOrder.map(id => [id, state.hands[id].length])),
    potCount: state.battle?.pot.length ?? 0,
    battleResult: state.battle?.result ?? null,
    winner: state.winner,
  });

  for (const playerID of ["0", "1", null, undefined, "unknown"]) {
    const visible = runtime.playerView(state, playerID);
    const actual = view(G, playerID);
    assert.deepEqual(actual, expectedWire(state, visible));
    assert.deepEqual(actual.deck, []);
    assert.deepEqual(actual.pot, []);
    assert.deepEqual(actual.piles, { "0": [], "1": [] });
    assert.equal(actual.contributions.length, 2);
    assert.ok(actual.tablePlacements.every(item => item.face === "up" ? item.card !== null : item.card === null));
  }
});

test("War replay remains authorized by the terminal current player and starts a clean round", () => {
  const G = WarGame.setup!(setupContext);
  const ctx = { numPlayers: 2, phase: "waiting", currentPlayer: "0" };
  const context = {
    ...setupContext,
    G,
    ctx,
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
  assert.equal(G.potCount, 0);
  assert.deepEqual(G.pileCounts, { "0": 26, "1": 26 });
  assert.equal(G.contributions.length, 0);
  assert.equal(G.tablePlacements.length, 0);
  assert.equal(G.deck.length, 0);
});
