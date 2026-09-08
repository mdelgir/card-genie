import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { shelemDefinition } from "../definitions/shelem";
import { contractAward, matchWinner, scoreContract } from "./contract-scoring";
import { validateGameDefinition } from "./validator";
const rules = shelemDefinition.auction.scoring;
const built = createGameRuntime(shelemDefinition); assert.ok(built.ok);
export const game = built.runtime;
export const ok = (r: RuntimeResult) => { assert.ok(r.ok, JSON.stringify(r)); return r.state; };
export function scoringFixture(defenderRaw = 85, contract = 100): RoundState {
  const s = ok(game.startRound(["0", "1", "2", "3"], i => i));
  const cards = [...Object.values(s.hands).flat(), ...s.auction!.kitty];
  const n = defenderRaw === 0 ? 0 : 16;
  const target = defenderRaw - n / 4 * 5;
  const dp = new Map<string, number[]>([["0:0", []]]);
  cards.forEach((c, i) => {
    const value = c.rank === "5" ? 5 : c.rank === "10" || c.rank === "A" ? 10 : 0;
    for (const [key, indices] of [...dp]) {
      const [count, points] = key.split(":").map(Number);
      if (count < n && points + value <= target) dp.set(`${count + 1}:${points + value}`, [...indices, i]);
    }
  });
  const chosen = dp.get(`${n}:${target}`)!; assert.ok(chosen);
  const defenders = chosen.map(i => cards[i]);
  const rest = cards.filter((_, i) => !chosen.includes(i));
  s.hands = Object.fromEntries(s.playOrder.map(id => [id, []]));
  Object.assign(s.auction!, { phase: "ready-scoring", declarer: "1", highBidder: "1", highBid: contract, trump: "spades", kitty: [],
    discardStack: { cards: rest.slice(0, 4), teamID: "1", placedBy: "1" },
    tricks: { active: [], leader: "1", lastWinner: "1", completed: 12, teamCounts: { "0": n / 4, "1": 12 - n / 4 }, collections: { "0": defenders, "1": rest.slice(4) } } });
  return s;
}

test("contract awards cover ordinary success, sweep, 165 precedence and exact failure threshold", () => {
  assert.equal(contractAward(100, 105, 60, 4, rules), 100);
  assert.equal(contractAward(100, 165, 0, 0, rules), 200);
  assert.equal(contractAward(165, 165, 0, 0, rules), 660);
  assert.equal(contractAward(100, 85, 80, 4, rules), -100);
  assert.equal(contractAward(100, 81, 84, 4, rules), -100);
  assert.equal(contractAward(100, 80, 85, 4, rules), -200);
  for (const [raw, contract, expected] of [[60, 100, 100], [0, 100, 200], [0, 165, 660], [80, 100, -100], [85, 100, -200], [90, 165, -330]]) {
    const s = scoringFixture(raw, contract); const result = scoreContract(s.auction!, rules);
    assert.equal(result.cumulativeScores["0"], raw); assert.equal(result.cumulativeScores["1"], expected);
    assert.equal(result.deck.length, 52);
  }
  const broken = scoringFixture(); broken.auction!.tricks!.collections["0"][0] = broken.auction!.tricks!.collections["0"][1];
  assert.throws(() => scoreContract(broken.auction!, rules));
});

test("exact merged stack is cut-only, rotates dealer once and publishes updated cumulative scores", () => {
  const s = scoringFixture(); s.auction!.scores = { "0": 25, "1": 50 };
  const before = structuredClone(s);
  const a = s.auction!;
  const merged = [...a.tricks!.collections["0"], ...a.discardStack!.cards, ...a.tricks!.collections["1"]];
  let cuts = 0;
  const n = ok(game.advanceLifecycle!(s, length => { cuts++; assert.equal(length, 52); return 9; }));
  assert.deepEqual(s, before); assert.equal(cuts, 1); assert.equal(n.auction!.dealer, "1"); assert.equal(n.currentPlayer, "2");
  const reconstructed = [...n.hands["2"], ...n.hands["3"], ...n.hands["0"], ...n.auction!.kitty, ...n.hands["1"]];
  assert.deepEqual(reconstructed, [...merged.slice(9), ...merged.slice(0, 9)]);
  assert.deepEqual(n.auction!.scores, { "0": 110, "1": -150 });
  const bid = ok(game.applyAction(n, "2", { type: "bid", amount: 100 }));
  assert.deepEqual(game.playerView(bid).auction!.scores, n.auction!.scores);
  assert.equal(game.advanceLifecycle!(s, () => 52).ok, false); assert.deepEqual(s, before);
});

test("match threshold and lead outcomes, simultaneous thresholds and terminal lifecycle are deterministic", () => {
  for (const [scores, winner] of [[{ "0": 1165, "1": 100 }, "0"], [{ "0": 500, "1": -665 }, "0"], [{ "0": 1200, "1": 1300 }, "1"], [{ "0": 1200, "1": 1200 }, null], [{ "0": 100, "1": 1165 }, "1"]] as const) assert.equal(matchWinner(scores, 1165), winner);
  const s = scoringFixture(); s.auction!.scores = { "0": 1100, "1": 0 };
  const end = ok(game.advanceLifecycle!(s, () => { throw new Error("Must not cut after match end"); }));
  assert.equal(end.roundStatus, "complete"); assert.equal(end.auction!.matchWinner, "0");
  assert.deepEqual(game.playerView(end).auction!.scores, { "0": 1185, "1": -200 });
  assert.deepEqual(ok(game.advanceLifecycle!(end, () => 0)), end);
  const fresh = ok(game.startRound(["0", "1", "2", "3"], i => i.reverse()));
  assert.deepEqual(fresh.auction!.scores, { "0": 0, "1": 0 }); assert.equal(fresh.auction!.dealer, "0"); assert.equal(fresh.auction!.matchWinner, undefined);
});

test("scoring schema is closed and requires the full trick dependency", () => {
  for (const change of [{ failureDoubleAt: 80 }, { matchTarget: 1000 }, { maximumContractMultiplier: 2 }, { merge: "random" }, { callback: "code" }]) assert.equal(validateGameDefinition({ ...shelemDefinition, auction: { ...shelemDefinition.auction, scoring: { ...rules, ...change } } }).ok, false);
});
