import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { warDefinition } from "../definitions/war";

const built = createGameRuntime(warDefinition);
assert.ok(built.ok);
const runtime = built.runtime;
const stateOf = (result: RuntimeResult) => { assert.ok(result.ok); return result.state; };
const start = () => stateOf(runtime.startRound(["a", "b"], indices => indices));
const reveal = (s: RoundState) => stateOf(runtime.applyAction(s, s.currentPlayer, { type: "reveal-top" }));
const cards = Object.values(start().hands).flat().sort((a, b) =>
  ["spades", "hearts", "diamonds", "clubs"].indexOf(a.suit) - ["spades", "hearts", "diamonds", "clubs"].indexOf(b.suit) || a.value - b.value);
function piles(a: number[], b?: number[]) {
  const s = start();
  s.hands = { a: a.map(i => cards[i]), b: (b ?? cards.map((_, i) => i).filter(i => !a.includes(i))).map(i => cards[i]) };
  return s;
}
function conserved(s: RoundState) {
  const all = [...s.deck, ...Object.values(s.hands).flat(), ...(s.battle?.pot ?? [])];
  assert.equal(all.length, 52);
  assert.equal(new Set(all.map(c => `${c.suit}:${c.rank}`)).size, 52);
}
function privateViews(s: RoundState) {
  const before = structuredClone(s);
  for (const id of ["a", "b", null, undefined, "unknown"]) {
    const v = runtime.playerView({ ...s, secret: "hidden" } as RoundState, id);
    assert.deepEqual(v.hands, { a: [], b: [] });
    assert.equal(v.deckCount, 0);
    assert.equal(v.potCount, s.battle!.pot.length);
    assert.deepEqual(v.pileCounts, { a: s.hands.a.length, b: s.hands.b.length });
    assert.deepEqual(v.contributions, s.battle!.contributions);
    assert.equal(v.tablePlacements!.length, s.battle!.placements.length);
    for (const placement of v.tablePlacements!) {
      if (placement.face === "down") assert.equal(placement.card, null);
      else assert.ok(placement.card);
    }
    assert.deepEqual(Object.keys(v).sort(), ["deckCount", "hands", "playOrder", "currentPlayer", "hasActed", "roundStatus", "revealed", "winner", "pileCounts", "potCount", "contributions", "tablePlacements", "battleResult"].sort());
    assert.equal(v.revealed, false);
    if (v.contributions!.length) v.contributions![0].card.rank = "A";
    if (v.tablePlacements!.length) v.tablePlacements![0].ownerID = "mutated";
    v.pileCounts!.a = -1;
  }
  assert.deepEqual(s, before);
}

test("paired setup deals 26/26 round-robin with one injected shuffle and hidden piles", () => {
  let calls = 0;
  const s = stateOf(runtime.startRound(["a", "b"], indices => { calls++; return indices.reverse(); }));
  assert.equal(calls, 1);
  assert.deepEqual(s.playOrder, ["a", "b"]);
  assert.equal(s.currentPlayer, "a");
  assert.deepEqual(s.hands.a, [...cards].reverse().filter((_, i) => i % 2 === 0));
  assert.deepEqual(s.hands.b, [...cards].reverse().filter((_, i) => i % 2 === 1));
  conserved(s); privateViews(s);
  assert.equal(runtime.startRound(["a", "b", "c"], i => i).ok, false);
  assert.equal(runtime.startRound(["a", "b"], () => []).ok, false);
});

test("ordinary battles append in seat order, alternate authorization and replace public contributions", () => {
  const s = start(); const before = structuredClone(s);
  const n = reveal(s);
  assert.deepEqual(s, before);
  assert.deepEqual(n.hands.b, [...s.hands.b.slice(1), s.hands.a[0], s.hands.b[0]]);
  assert.deepEqual(n.battle!.result, { type: "player", playerID: "b" });
  assert.equal(n.winner, null); assert.equal(n.currentPlayer, "b");
  assert.equal(n.battle!.placements.length, 2);
  assert.ok(n.battle!.placements.every(item => item.face === "up" && item.card));
  const next = reveal(n);
  assert.equal(next.currentPlayer, "a");
  assert.equal(next.battle!.contributions.length, 2);
  assert.deepEqual(reveal(s), n);
  conserved(next); privateViews(next);
});

test("repeated ties preserve chronological pot order and expose only face-up identities", () => {
  const a = Array.from({ length: 13 }, (_, i) => i).concat(Array.from({ length: 13 }, (_, i) => 26 + i));
  const b = cards.map((_, i) => i).filter(i => !a.includes(i));
  [b[8], b[12]] = [b[12], b[8]];
  const s = piles(a, b); const n = reveal(s);
  const expectedPot = [s.hands.a[0], s.hands.b[0], ...s.hands.a.slice(1, 5), ...s.hands.b.slice(1, 5), ...s.hands.a.slice(5, 9), ...s.hands.b.slice(5, 9)];
  assert.deepEqual(n.hands.b, [...s.hands.b.slice(9), ...expectedPot]);
  assert.deepEqual(n.battle!.contributions.map(c => c.card), [s.hands.a[0], s.hands.b[0], s.hands.a[4], s.hands.b[4], s.hands.a[8], s.hands.b[8]]);
  assert.equal(n.battle!.placements.filter(item => item.face === "down").length, 12);
  assert.deepEqual([...new Set(n.battle!.placements.map(item => item.sequence))], [0, 1, 2]);
  conserved(n); privateViews(n);
});

test("one insufficient pile loses atomically and all cards transfer", () => {
  const s = piles([0], [13, ...cards.map((_, i) => i).filter(i => i !== 0 && i !== 13)]);
  const n = reveal(s);
  assert.equal(n.roundStatus, "complete");
  assert.deepEqual(n.winner, { type: "player", playerID: "b" });
  assert.deepEqual(n.hands.b, [...s.hands.b.slice(1), s.hands.a[0], s.hands.b[0]]);
  assert.equal(n.currentPlayer, "a"); conserved(n); privateViews(n);
  const empty = reveal(piles([]));
  assert.deepEqual(empty.winner, { type: "player", playerID: "b" }); conserved(empty);
});

test("both insufficient terminates tied with the uncollected pot private", () => {
  const s = piles([...Array.from({ length: 13 }, (_, i) => i), ...Array.from({ length: 13 }, (_, i) => i + 26)]);
  const n = reveal(s);
  assert.equal(n.roundStatus, "complete"); assert.deepEqual(n.winner, { type: "tie" });
  assert.equal(n.battle!.pot.length, 50); assert.equal(n.battle!.contributions.length, 14);
  assert.equal(n.hands.a.length, 1); assert.equal(n.hands.b.length, 1);
  conserved(n); privateViews(n);
  assert.deepEqual(runtime.playerView(n).winner, { type: "tie" });
});

test("all 52 ownership completes without revealing the winning pile; fresh setup clears results", () => {
  const s = piles([12, ...cards.map((_, i) => i).filter(i => i !== 12 && i !== 11)], [11]);
  const n = reveal(s);
  assert.deepEqual(n.winner, { type: "player", playerID: "a" });
  assert.equal(n.roundStatus, "complete"); assert.equal(n.hands.a.length, 52);
  conserved(n); privateViews(n);
  const fresh = start(); assert.equal(fresh.battle!.result, null); assert.equal(fresh.winner, null);
  assert.deepEqual(fresh.battle!.contributions, []); assert.deepEqual(fresh.battle!.placements, []); privateViews(fresh);
});

test("paired actions reject wrong identities, actions and completed rounds without mutation", () => {
  const s = start();
  for (const [id, action] of [[null, { type: "reveal-top" }], ["other", { type: "reveal-top" }], ["b", { type: "reveal-top" }], ["a", { type: "draw" }], ["a", { type: "reveal-top", count: 2 }]] as const) {
    const before = structuredClone(s); assert.equal(runtime.applyAction(s, id, action).ok, false); assert.deepEqual(s, before);
  }
  const n = reveal(piles([])); const before = structuredClone(n);
  assert.equal(runtime.applyAction(n, n.currentPlayer, { type: "reveal-top" }).ok, false); assert.deepEqual(n, before);
});
