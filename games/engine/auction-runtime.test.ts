import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { validateGameDefinition } from "./validator";
import { shelemDefinition } from "../definitions/shelem";

const built = createGameRuntime(shelemDefinition);
assert.ok(built.ok);
const runtime = built.runtime;
const ok = (r: RuntimeResult) => { assert.ok(r.ok, JSON.stringify(r)); return r.state; };
const start = () => ok(runtime.startRound(["0", "1", "2", "3"], i => i));
const act = (s: RoundState, action: unknown) => ok(runtime.applyAction(s, s.currentPlayer, action));
const cancel = (s = start()) => act(act(act(s, { type: "pass" }), { type: "pass" }), { type: "pass" });
const stack = (s: RoundState) => {
  const idx = s.playOrder.indexOf(s.auction!.dealer);
  return [...Array.from({ length: 3 }, (_, i) => s.hands[s.playOrder[(idx + i + 1) % 4]]).flat(), ...s.auction!.kitty, ...s.hands[s.auction!.dealer]];
};
const rejected = (s: RoundState, id: string | null, action: unknown) => {
  const before = structuredClone(s);
  assert.equal(runtime.applyAction(s, id, action).ok, false);
  assert.deepEqual(s, before);
};

test("auction definition round-trips and rejects unsupported/mixed/executable rules", () => {
  assert.ok(validateGameDefinition(JSON.parse(JSON.stringify(shelemDefinition))).ok);
  assert.ok(validateGameDefinition({ ...shelemDefinition, id: "four-seat-contract" }).ok);
  for (const input of [
    { ...shelemDefinition, players: { min: 2, max: 4 } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, max: 170 } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, packet: { hand: 13, kitty: 0, kittyBefore: "dealer" } } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, preparation: "shuffle" } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, scores: "live" } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, pass: "temporary" } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, teams: "adjacent-seats" } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, direction: "left" } },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, dealer: "rotate-always" } },
    { ...shelemDefinition, handPlay: {} },
    { ...shelemDefinition, visibility: { ...shelemDefinition.visibility, hand: "public" } },
    { ...shelemDefinition, auction: null },
    { ...shelemDefinition, auction: { ...shelemDefinition.auction, callback: () => {} } },
  ]) assert.equal(validateGameDefinition(input).ok, false);
  let called = false;
  const input = structuredClone(shelemDefinition);
  Object.defineProperty(input.auction, "max", { enumerable: true, get() { called = true; return 165; } });
  assert.equal(validateGameDefinition(input).ok, false); assert.equal(called, false);
});

test("four-seat packet setup assigns opposite teams and the exact kitty position", () => {
  let calls = 0;
  const s = ok(runtime.startRound(["0", "1", "2", "3"], i => { calls++; return i; }));
  assert.equal(calls, 1); assert.equal(s.currentPlayer, "1"); assert.equal(s.auction!.dealer, "0");
  assert.deepEqual(s.auction!.teams, { "0": "0", "1": "1", "2": "0", "3": "1" });
  assert.deepEqual(Object.values(s.hands).map(h => h.length), [12, 12, 12, 12]);
  assert.equal(s.deck.length, 0); assert.equal(s.auction!.kitty.length, 4);
  assert.equal(s.hands["1"][0].rank, "2"); assert.equal(s.hands["2"][0].rank, "A");
  assert.deepEqual(s.auction!.kitty.map(c => c.rank), ["Q", "K", "A", "2"]);
  assert.equal(s.hands["0"][0].rank, "3");
  assert.equal(new Set(stack(s).map(c => `${c.suit}:${c.rank}`)).size, 52);
  for (const ids of [["0", "1", "2"], ["0", "1", "2", "2"], ["0", "1", "2", " "]]) assert.equal(runtime.startRound(ids, i => i).ok, false);
  assert.equal(runtime.startRound(["0", "1", "2", "3"], () => []).ok, false);
});

test("opening passes redeal with same dealer and only a cyclic cut of the previous stack", () => {
  const s = cancel(); const original = stack(s); const before = structuredClone(s);
  assert.equal(s.auction!.phase, "redeal-required");
  rejected(s, "0", { type: "bid", amount: 100 });
  const next = ok(runtime.nextDeal!(s, length => { assert.equal(length, 52); return 7; }));
  assert.deepEqual(s, before); assert.equal(next.auction!.dealer, "0");
  assert.deepEqual(stack(next), [...original.slice(7), ...original.slice(0, 7)]);
  const again = ok(runtime.nextDeal!(cancel(next), () => 45));
  assert.deepEqual(stack(again), original);
  for (const n of [-1, 52, 1.5, NaN]) assert.equal(runtime.nextDeal!(s, () => n).ok, false);
  assert.equal(runtime.nextDeal!(s, () => { throw new Error(); }).ok, false);
  assert.equal(runtime.nextDeal!(start(), () => 0).ok, false);
});

test("bids increase in fives, passes are permanent, last bidder chooses trump only", () => {
  let s = start();
  for (const amount of [95, 101, 170, 100.5, "100", null]) rejected(s, "1", { type: "bid", amount });
  rejected(s, null, { type: "pass" }); rejected(s, "0", { type: "bid", amount: 100 });
  s = act(s, { type: "bid", amount: 100 });
  rejected(s, "2", { type: "bid", amount: 100 });
  s = act(s, { type: "pass" }); // 2 out
  s = act(s, { type: "bid", amount: 105 }); // 3
  s = act(s, { type: "pass" }); // 0 out
  s = act(s, { type: "bid", amount: 165 }); // 1
  assert.equal(s.currentPlayer, "3");
  rejected(s, "2", { type: "bid", amount: 165 });
  s = act(s, { type: "pass" });
  assert.equal(s.auction!.phase, "choose-trump"); assert.equal(s.auction!.declarer, "1");
  assert.equal(s.auction!.highBid, 165);
  rejected(s, "3", { type: "choose-trump", suit: "hearts" });
  rejected(s, "1", { type: "choose-trump", suit: "stars" });
  const old = structuredClone(s);
  s = act(s, { type: "choose-trump", suit: "hearts" });
  assert.equal(s.auction!.phase, "take-kitty"); assert.equal(s.auction!.trump, "hearts");
  assert.equal(s.roundStatus, "playing"); assert.deepEqual(s.hands, old.hands);
  assert.deepEqual(s.auction!.kitty, old.auction!.kitty);
  for (const action of [{ type: "choose-trump", suit: "clubs" }, { type: "pass" }]) rejected(s, "1", action);
  assert.equal(runtime.nextDeal!(s, () => 0).ok, false);
});

test("trusted completed-deal boundary rotates dealer and freezes new score snapshot", () => {
  const s = start();
  // Simulate future authoritative completed-play/scoring output, not a player move.
  s.roundStatus = "complete";
  const ordered = stack(s).reverse(); const scores = { "0": -100, "1": 65 };
  const before = structuredClone(s);
  const next = ok(runtime.nextDeal!(s, () => 3, { deck: ordered, cumulativeScores: scores }));
  assert.deepEqual(s, before); assert.equal(next.auction!.dealer, "1"); assert.equal(next.currentPlayer, "2");
  assert.deepEqual(stack(next), [...ordered.slice(3), ...ordered.slice(0, 3)]);
  scores["0"] = 999; ordered[0] = ordered[1];
  assert.deepEqual(next.auction!.scores, { "0": -100, "1": 65 });
  const bid = act(next, { type: "bid", amount: 100 });
  assert.deepEqual(bid.auction!.scores, next.auction!.scores);
  assert.equal(runtime.nextDeal!(s, () => 0).ok, false);
  assert.equal(runtime.nextDeal!(s, () => 0, { deck: ordered, cumulativeScores: scores }).ok, false);
});

test("auction views exclude kitty, other hands, cuts and live totals; actions never invoke accessors", () => {
  const s = act(start(), { type: "bid", amount: 100 });
  const secret = { ...s, liveDealTotals: { "0": 55 }, cutOffset: 12 };
  const before = structuredClone(s);
  for (const id of ["0", "1", "2", "3", null, undefined, "unknown"]) {
    const v = runtime.playerView(secret, id);
    assert.deepEqual(Object.keys(v).sort(), ["deckCount", "hands", "handCounts", "playOrder", "currentPlayer", "hasActed", "roundStatus", "revealed", "winner", "auction"].sort());
    assert.deepEqual(Object.keys(v.auction!).sort(), ["dealer", "teams", "scores", "phase", "passed", "highBid", "highBidder", "declarer", "trump", "kittyCount", "history"].sort());
    for (const seat of s.playOrder) assert.deepEqual(v.hands[seat], seat === id ? s.hands[seat] : []);
    assert.equal(v.auction!.kittyCount, 4);
    v.auction!.scores["0"] = 999; v.auction!.history[0].bid = 165;
    if (id && v.hands[id]?.length) v.hands[id][0].rank = "A";
  }
  assert.deepEqual(s, before);
  let invoked = false;
  rejected(s, "2", { type: "bid", get amount() { invoked = true; return 105; } });
  rejected(s, "2", { type: "pass", extra: true });
  rejected(s, "2", JSON.parse('{"type":"pass","__proto__":{}}'));
  assert.equal(invoked, false);
});
