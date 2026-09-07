import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RuntimeResult, type RoundState, type Shuffle } from "./runtime";
import { highestCardDefinition } from "../definitions/highest-card";

const identity: Shuffle = indices => indices;
const reverse: Shuffle = indices => indices.reverse();
const runtimeFor = (definition = highestCardDefinition) => {
  const result = createGameRuntime(definition);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.runtime;
};
const stateOf = (result: RuntimeResult): RoundState => {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};
const runtime = runtimeFor();
const draw = (state: RoundState) => stateOf(runtime.applyAction(state, state.currentPlayer, { type: "draw" }));

test("runtime validates definitions and actual seat counts before shuffling", () => {
  assert.equal(createGameRuntime({}).ok, false);
  assert.equal(createGameRuntime({ ...highestCardDefinition, schemaVersion: 2 }).ok, false);
  const definition = structuredClone(highestCardDefinition);
  definition.players = { min: 3, max: 4 };
  const restricted = runtimeFor(definition);
  for (const seats of [[], ["a"], ["a", "b"], ["a", "b", "c", "d", "e"], ["a", "a", "b"], ["a", " ", "b"]]) {
    const result = restricted.startRound(seats, () => { throw new Error("Must not shuffle"); });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "invalid-players");
  }
  assert.equal(restricted.startRound(["a", "b", "c"], identity).ok, true);
  assert.equal(restricted.startRound(["a", "b", "c", "d"], identity).ok, true);
});

test("injected shuffle deterministically creates a full deck and turn order", () => {
  const seats = ["alice", "bob", "carol"];
  const first = stateOf(runtime.startRound(seats, reverse));
  assert.deepEqual(stateOf(runtime.startRound(seats, reverse)), first);
  assert.deepEqual(seats, ["alice", "bob", "carol"]);
  assert.equal(first.deck.length, 52);
  assert.equal(new Set(first.deck.map(c => `${c.suit}:${c.rank}`)).size, 52);
  assert.deepEqual(first.deck[0], { suit: "clubs", rank: "A", value: 14 });
  assert.deepEqual(first.playOrder, ["carol", "bob", "alice"]);
  assert.equal(first.currentPlayer, "carol");
  assert.equal(first.roundStatus, "playing");
  assert.deepEqual(first.hands, { alice: [], bob: [], carol: [] });
  assert.deepEqual(first.hasActed, { alice: false, bob: false, carol: false });
  for (const shuffle of [() => [], (items: number[]) => items.map(() => 0), () => { throw new Error("bad RNG"); },
    (items: number[]) => { delete items[0]; return items; }]) {
    const result = runtime.startRound(seats, shuffle);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "invalid-shuffle");
  }
});

test("generic actions enforce ownership and reject invalid/duplicate requests without mutation", () => {
  const start = stateOf(runtime.startRound(["a", "b", "c"], identity));
  const before = structuredClone(start);
  const reject = (state: RoundState, player: string | null, action: unknown, code: string) => {
    const snapshot = structuredClone(state);
    const result = runtime.applyAction(state, player, action);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, code);
    assert.deepEqual(state, snapshot);
  };
  reject(start, "b", { type: "draw" }, "out-of-turn");
  reject(start, null, { type: "draw" }, "unknown-player");
  reject(start, "outsider", { type: "draw" }, "unknown-player");
  for (const action of [null, "draw", {}, { type: "discard" }, { type: "draw", count: 52 }]) {
    reject(start, "a", action, "invalid-action");
  }
  const next = draw(start);
  assert.deepEqual(start, before);
  assert.equal(next.deck.length, 51);
  assert.deepEqual(next.hands.a, [before.deck[0]]);
  assert.equal(next.hasActed.a, true);
  assert.equal(next.currentPlayer, "b");
  assert.equal(next.revealed, false);
  reject(next, "a", { type: "draw" }, "already-acted");
  const complete = draw(draw(next));
  assert.equal(complete.roundStatus, "complete");
  assert.equal(complete.currentPlayer, "c");
  assert.equal(complete.revealed, true);
  assert.deepEqual(complete.winner, { type: "player", playerID: "c" });
  reject(complete, "c", { type: "draw" }, "round-complete");
  assert.equal(complete.deck.length + Object.values(complete.hands).flat().length, 52);
});

test("rank comparison follows highest/lowest rules, ace high and equal-rank ties", () => {
  for (const type of ["highest-wins", "lowest-wins"] as const) {
    const definition = structuredClone(highestCardDefinition);
    definition.winner.type = type;
    const game = runtimeFor(definition);
    // Bring A spades and 2 hearts to the front; preserve all 52 cards.
    const arranged: Shuffle = indices => indices.length === 52 ? [12, 13, ...indices.filter(i => i !== 12 && i !== 13)] : indices;
    let state = stateOf(game.startRound(["a", "b"], arranged));
    for (const player of ["a", "b"]) state = stateOf(game.applyAction(state, player, { type: "draw" }));
    assert.deepEqual(state.winner, { type: "player", playerID: type === "highest-wins" ? "a" : "b" });
    const tied: Shuffle = indices => indices.length === 52 ? [0, 13, ...indices.filter(i => i !== 0 && i !== 13)] : indices;
    state = stateOf(game.startRound(["a", "b"], tied));
    for (const player of ["a", "b"]) state = stateOf(game.applyAction(state, player, { type: "draw" }));
    assert.deepEqual(state.winner, { type: "tie" });
  }
});

test("views allowlist owner/public fields without secrets or references to state", () => {
  const state = draw(stateOf(runtime.startRound(["a", "b"], identity)));
  const extended = { ...state, random: { seed: "secret" }, history: ["private"], futureZone: "hidden" };
  for (const viewer of ["a", "b", "unknown", null, undefined]) {
    const view = runtime.playerView(extended, viewer);
    assert.equal(view.deckCount, 51);
    assert.deepEqual(Object.keys(view).sort(), ["deckCount", "hands", "playOrder", "currentPlayer", "hasActed", "roundStatus", "revealed", "winner"].sort());
    assert.deepEqual(view.hands.a, viewer === "a" ? state.hands.a : []);
    assert.deepEqual(view.hands.b, []);
    assert.equal(JSON.stringify(view).includes("secret"), false);
    if (view.hands.a.length) view.hands.a[0].rank = "A";
    view.playOrder.reverse();
    view.hasActed.a = false;
  }
  assert.equal(state.hands.a[0].rank, "2");
  assert.equal(state.hasActed.a, true);
  const complete = draw(state);
  for (const viewer of ["a", "b", null, undefined]) {
    const view = runtime.playerView(complete, viewer);
    assert.deepEqual(view.hands, complete.hands);
    assert.deepEqual(view.winner, complete.winner);
    assert.equal("deck" in view, false);
  }
});

test("authorized caller can start a fresh round; definition edits cannot change runtime", () => {
  const definition = structuredClone(highestCardDefinition);
  const game = runtimeFor(definition);
  definition.winner.type = "lowest-wins";
  let old = stateOf(game.startRound(["a", "b"], identity));
  for (const player of ["a", "b"]) old = stateOf(game.applyAction(old, player, { type: "draw" }));
  assert.deepEqual(old.winner, { type: "player", playerID: "b" });
  const snapshot = structuredClone(old);
  const fresh = stateOf(game.startRound(["a", "b"], reverse));
  assert.deepEqual(old, snapshot);
  assert.equal(fresh.deck.length, 52);
  assert.equal(fresh.currentPlayer, "b");
  assert.equal(fresh.roundStatus, "playing");
  assert.equal(fresh.revealed, false);
  assert.equal(fresh.winner, null);
  assert.deepEqual(fresh.hands, { a: [], b: [] });
  assert.deepEqual(fresh.hasActed, { a: false, b: false });
  const firstDraw = stateOf(game.applyAction(fresh, "b", { type: "draw" }));
  assert.equal(game.playerView(firstDraw, "b").hands.b.length, 1);
  assert.deepEqual(game.playerView(firstDraw).hands, { a: [], b: [] });
});
