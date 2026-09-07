import test from "node:test";
import assert from "node:assert/strict";
import type { Card, Rank, Suit } from "./cards";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { crazyEightsDefinition } from "../definitions/crazy-eights";

const built = createGameRuntime(crazyEightsDefinition);
assert.ok(built.ok);
const runtime = built.runtime;
const identity = (indices: number[]) => [...indices];
const stateOf = (result: RuntimeResult) => { assert.ok(result.ok); return result.state; };
const rankOrder: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const card = (suit: Suit, rank: Rank): Card => ({ suit, rank, value: rankOrder.indexOf(rank) + 2 });

function controlled(handA: Card[], handB: Card[], top = card("spades", "Q"), deck: Card[] = [card("clubs", "2")]): RoundState {
  const state = stateOf(runtime.startRound(["a", "b"], identity));
  return {
    ...state,
    deck: deck.map(c => ({ ...c })),
    hands: { a: handA.map(c => ({ ...c })), b: handB.map(c => ({ ...c })) },
    currentPlayer: "a",
    discard: [{ ...top }],
    activeSuit: top.suit,
    roundStatus: "playing",
    winner: null,
  };
}

function rejects(state: RoundState, playerID: string | null, action: unknown, code = "invalid-action") {
  const before = structuredClone(state);
  const result = runtime.applyAction(state, playerID, action);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
  assert.deepEqual(state, before);
}

test("matching setup deals five each, seeds one public discard, and preserves seat order", () => {
  for (const seats of [["a", "b"], ["a", "b", "c", "d"]]) {
    let calls = 0;
    const state = stateOf(runtime.startRound(seats, indices => { calls++; return [...indices]; }));
    assert.equal(calls, 1);
    assert.deepEqual(state.playOrder, seats);
    assert.equal(state.currentPlayer, seats[0]);
    assert.equal(state.discard?.length, 1);
    assert.equal(state.activeSuit, state.discard?.[0].suit);
    assert.equal(state.deck.length, 52 - seats.length * 5 - 1);
    for (const id of seats) assert.equal(state.hands[id].length, 5);
    const all = [...state.deck, ...Object.values(state.hands).flat(), ...(state.discard ?? [])];
    assert.equal(all.length, 52);
    assert.equal(new Set(all.map(c => `${c.suit}:${c.rank}`)).size, 52);
  }
});

test("normal matching play advances; wild play requires and changes the active suit", () => {
  let state = controlled(
    [card("hearts", "Q"), card("clubs", "8")],
    [card("diamonds", "3")],
  );
  let result = runtime.applyAction(state, "a", { type: "play-card", cardIndex: 0 });
  assert.ok(result.ok);
  state = result.state;
  assert.equal(state.hands.a.length, 1);
  assert.deepEqual(state.discard?.at(-1), card("hearts", "Q"));
  assert.equal(state.activeSuit, "hearts");
  assert.equal(state.currentPlayer, "b");
  assert.equal(state.roundStatus, "playing");

  state.currentPlayer = "a";
  const beforeWild = structuredClone(state);
  rejects(state, "a", { type: "play-card", cardIndex: 0 });
  assert.deepEqual(state, beforeWild);
  result = runtime.applyAction(state, "a", { type: "play-card", cardIndex: 0, suit: "diamonds" });
  assert.ok(result.ok);
  state = result.state;
  assert.equal(state.hands.a.length, 0);
  assert.equal(state.activeSuit, "diamonds");
  assert.deepEqual(state.discard?.at(-1), card("clubs", "8"));
  assert.equal(state.roundStatus, "complete");
  assert.deepEqual(state.winner, { type: "player", playerID: "a" });
  assert.equal(state.currentPlayer, "a");
});

test("illegal cards, extra suit choices, wrong turns and malformed actions reject without mutation", () => {
  const state = controlled([card("hearts", "5")], [card("clubs", "3")]);
  rejects(state, "a", { type: "play-card", cardIndex: 0 });
  const matching = controlled([card("spades", "5")], [card("clubs", "3")]);
  rejects(matching, "a", { type: "play-card", cardIndex: 0, suit: "hearts" });
  rejects(matching, "b", { type: "play-card", cardIndex: 0 }, "out-of-turn");
  rejects(matching, null, { type: "play-card", cardIndex: 0 }, "unknown-player");
  for (const action of [null, "draw", {}, { type: "play-card" }, { type: "play-card", cardIndex: -1 },
    { type: "discard", cardIndex: 0 }, { type: "draw", extra: true }]) {
    rejects(matching, "a", action);
  }
});

test("draw is fallback-only, draws one and ends turn; blocked empty stock ends tied", () => {
  let state = controlled([card("hearts", "5")], [card("clubs", "3")], card("spades", "Q"), [card("diamonds", "2")]);
  let result = runtime.applyAction(state, "a", { type: "draw" });
  assert.ok(result.ok);
  state = result.state;
  assert.deepEqual(state.hands.a, [card("hearts", "5"), card("diamonds", "2")]);
  assert.equal(state.deck.length, 0);
  assert.equal(state.currentPlayer, "b");
  assert.equal(state.roundStatus, "playing");

  const hasWild = controlled([card("hearts", "8")], [card("clubs", "3")]);
  rejects(hasWild, "a", { type: "draw" });

  const blocked = controlled([card("hearts", "5")], [card("clubs", "3")], card("spades", "Q"), []);
  result = runtime.applyAction(blocked, "a", { type: "draw" });
  assert.ok(result.ok);
  assert.equal(result.state.roundStatus, "complete");
  assert.deepEqual(result.state.winner, { type: "tie" });
  assert.equal(result.state.currentPlayer, "a");
});

test("matching views expose owner hand, public counts/discard/suit, and no other identities", () => {
  const state = controlled(
    [card("hearts", "5"), card("clubs", "8")],
    [card("diamonds", "3")],
    card("spades", "Q"),
    [card("clubs", "2"), card("hearts", "A")],
  );
  const before = structuredClone(state);
  for (const viewer of ["a", "b", "unknown", null, undefined]) {
    const view = runtime.playerView(state, viewer);
    assert.deepEqual(view.handCounts, { a: 2, b: 1 });
    assert.deepEqual(view.discardTop, card("spades", "Q"));
    assert.equal(view.activeSuit, "spades");
    assert.equal(view.deckCount, 2);
    assert.deepEqual(view.hands.a, viewer === "a" ? state.hands.a : []);
    assert.deepEqual(view.hands.b, viewer === "b" ? state.hands.b : []);
    assert.equal("discard" in view, false);
    assert.equal("deck" in view, false);
    if (view.hands.a.length) view.hands.a[0].rank = "A";
    if (view.discardTop) view.discardTop.rank = "2";
    if (view.handCounts) view.handCounts.a = -1;
  }
  assert.deepEqual(state, before);

  const complete = structuredClone(state);
  complete.roundStatus = "complete";
  complete.winner = { type: "player", playerID: "a" };
  const spectator = runtime.playerView(complete);
  assert.deepEqual(spectator.hands, { a: [], b: [] });
  assert.deepEqual(spectator.winner, { type: "player", playerID: "a" });
});
