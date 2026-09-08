import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { shelemDefinition } from "../definitions/shelem";
import { validateGameDefinition } from "./validator";
const built = createGameRuntime(shelemDefinition);
assert.ok(built.ok);
const runtime = built.runtime;
const ok = (r: RuntimeResult) => { assert.ok(r.ok, JSON.stringify(r)); return r.state; };
const act = (s: RoundState, action: unknown) => ok(runtime.applyAction(s, s.currentPlayer, action));
function won() {
  let s = ok(runtime.startRound(["0", "1", "2", "3"], i => i));
  s.auction!.scores = { "0": -100, "1": 65 };
  s = act(s, { type: "bid", amount: 100 });
  for (let i = 0; i < 3; i++) s = act(s, { type: "pass" });
  return s;
}
const chosen = () => act(won(), { type: "choose-trump", suit: "hearts" });
const pickup = () => act(chosen(), { type: "take-kitty" });
const discard = { type: "discard-owned", cardIndices: [15, 2, 12, 0] };
function reject(s: RoundState, id: string | null, action: unknown) {
  const before = structuredClone(s);
  assert.equal(runtime.applyAction(s, id, action).ok, false); assert.deepEqual(s, before);
}
function conserved(s: RoundState) {
  const cards = [...Object.values(s.hands).flat(), ...s.auction!.kitty, ...(s.auction!.discardStack?.cards ?? [])];
  assert.equal(cards.length, 52); assert.equal(new Set(cards.map(c => `${c.suit}:${c.rank}`)).size, 52);
}

test("declarer setup vocabulary validates closed data and legacy auction still works", () => {
  assert.ok(validateGameDefinition(JSON.parse(JSON.stringify(shelemDefinition))).ok);
  const original = shelemDefinition.auction.declarerSetup;
  for (const setup of [null, {}, { ...original, next: "dealer-leads" }, { ...original, pickup: { type: "reveal-kitty" } },
    ...[3, 5, "4", 4.5].map(count => ({ ...original, discard: { ...original.discard, count } })),
    ...[{ face: "up" }, { destination: "player" }, { order: "random" }, { callback: "code" }].map(change => ({ ...original, discard: { ...original.discard, ...change } }))]) {
    const result = validateGameDefinition({ ...shelemDefinition, auction: { ...shelemDefinition.auction, declarerSetup: setup } });
    assert.ok(!result.ok); assert.ok(result.errors.some(e => e.path.startsWith("auction.declarerSetup")));
  }
  const { declarerSetup, trickPlay, ...legacyAuction } = shelemDefinition.auction;
  const legacy = createGameRuntime({ ...shelemDefinition, auction: legacyAuction });
  assert.ok(legacy.ok);
  const s = ok(legacy.runtime.applyAction(won(), "1", { type: "choose-trump", suit: "clubs" }));
  assert.equal(s.auction!.phase, "ready");
  assert.equal(legacy.runtime.applyAction(s, "1", { type: "take-kitty" }).ok, false);
});

test("pickup and submitted-order discard conserve cards and freeze contract/trump/scores", () => {
  const s = chosen(); const before = structuredClone(s);
  const taken = act(s, { type: "take-kitty" });
  assert.deepEqual(s, before);
  assert.deepEqual(taken.hands["1"], [...s.hands["1"], ...s.auction!.kitty]);
  assert.equal(taken.hands["1"].length, 16); assert.equal(taken.auction!.kitty.length, 0);
  const snapshot = structuredClone(taken);
  const ready = act(taken, discard);
  assert.deepEqual(taken, snapshot);
  assert.deepEqual(ready.auction!.discardStack, { cards: discard.cardIndices.map(i => taken.hands["1"][i]), teamID: "1", placedBy: "1" });
  assert.deepEqual(ready.hands["1"], taken.hands["1"].filter((_, i) => !discard.cardIndices.includes(i)));
  assert.equal(ready.hands["1"].length, 12); assert.equal(ready.currentPlayer, "1");
  assert.equal(ready.auction!.phase, "ready"); assert.equal(ready.roundStatus, "playing");
  for (const state of [s, taken, ready]) {
    conserved(state); assert.deepEqual(state.auction!.scores, { "0": -100, "1": 65 });
    assert.equal(state.auction!.highBid, 100); assert.equal(state.auction!.trump, "hearts");
    assert.equal(runtime.nextDeal!(state, () => 0).ok, false);
  }
});

test("setup rejects unauthorized, repeated, wrong-phase and malformed selections without mutation", () => {
  const s = chosen(); const taken = pickup(); const ready = act(taken, discard);
  for (const id of ["0", "2", "3", "unknown", null]) {
    reject(s, id, { type: "take-kitty" }); reject(taken, id, discard);
  }
  reject(won(), "1", { type: "take-kitty" }); reject(s, "1", discard);
  reject(taken, "1", { type: "take-kitty" }); reject(ready, "1", discard);
  reject(ready, "1", { type: "play-card", cardIndex: 0 });
  const sparse = [0, 1, 2, 3]; delete sparse[2];
  for (const indices of [[], [0, 1, 2], [0, 1, 2, 3, 4], [0, 0, 1, 2], [-1, 1, 2, 3], [16, 1, 2, 3], [0.5, 1, 2, 3], ["0", 1, 2, 3], null, {}, sparse]) reject(taken, "1", { type: "discard-owned", cardIndices: indices });
  reject(taken, "1", { ...discard, teamID: "0" });
  let invoked = false;
  const indices = [0, 1, 2, 3]; Object.defineProperty(indices, "0", { get() { invoked = true; return 0; } });
  reject(taken, "1", { type: "discard-owned", cardIndices: indices }); assert.equal(invoked, false);
});

test("all viewers see only opaque team stack, never discarded identities or live scores", () => {
  for (const s of [chosen(), pickup(), act(pickup(), discard)]) {
    const before = structuredClone(s);
    for (const id of ["0", "1", "2", "3", "unknown", null, undefined]) {
      const v = runtime.playerView({ ...s, liveDealTotals: { "1": 50 } } as RoundState, id);
      for (const seat of s.playOrder) assert.deepEqual(v.hands[seat], seat === id ? s.hands[seat] : []);
      assert.equal("liveDealTotals" in v, false); assert.equal("kitty" in v.auction!, false);
      if (s.auction!.discardStack) {
        assert.deepEqual(v.auction!.discardStack, { count: 4, face: "down", teamID: "1", placedBy: "1" });
        const payload = JSON.stringify(v);
        for (const c of s.auction!.discardStack.cards) assert.equal(payload.includes(JSON.stringify(c)), false);
        v.auction!.discardStack!.count = 99;
      }
      v.auction!.scores["1"] = 999;
    }
    assert.deepEqual(s, before);
  }
});
