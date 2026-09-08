import test from "node:test";
import assert from "node:assert/strict";
import { createGameRuntime, type RoundState, type RuntimeResult } from "./runtime";
import { shelemDefinition } from "../definitions/shelem";
import { validateGameDefinition } from "./validator";
import type { Card, Suit, Rank } from "./cards";
const built = createGameRuntime(shelemDefinition); assert.ok(built.ok);
const game = built.runtime;
const ok = (r: RuntimeResult) => { assert.ok(r.ok, JSON.stringify(r)); return r.state; };
const act = (s: RoundState, action: unknown) => ok(game.applyAction(s, s.currentPlayer, action));
function ready() {
  let s = ok(game.startRound(["0", "1", "2", "3"], i => i));
  s.auction!.scores = { "0": -100, "1": 65 };
  s = act(s, { type: "bid", amount: 100 });
  for (let i = 0; i < 3; i++) s = act(s, { type: "pass" });
  s = act(s, { type: "choose-trump", suit: "spades" });
  s = act(s, { type: "take-kitty" });
  return act(s, { type: "discard-owned", cardIndices: [12, 13, 14, 15] });
}
const play = (s: RoundState, cardIndex: number) => act(s, { type: "play-card", cardIndex });
function reject(s: RoundState, playerID: string | null, action: unknown) {
  const before = structuredClone(s);
  assert.equal(game.applyAction(s, playerID, action).ok, false); assert.deepEqual(s, before);
}
function conservation(s: RoundState) {
  const a = s.auction!;
  const all = [...Object.values(s.hands).flat(), ...a.kitty, ...a.discardStack!.cards,
    ...a.tricks!.active.map(c => c.card), ...Object.values(a.tricks!.collections).flat()];
  assert.equal(all.length, 52); assert.equal(new Set(all.map(c => `${c.suit}:${c.rank}`)).size, 52);
}
const card = (suit: Suit, rank: Rank): Card => ({ suit, rank, value: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].indexOf(rank) + 2 });

test("trick vocabulary rejects unsupported rules and requires declarer setup", () => {
  assert.ok(validateGameDefinition(JSON.parse(JSON.stringify(shelemDefinition))).ok);
  for (const change of [{ type: "free-play" }, { firstLead: "any" }, { rank: "ace-low" }, { nextLeader: "next-seat" }, { collection: "append" }, { count: 13 }, { callback: "code" }]) {
    assert.equal(validateGameDefinition({ ...shelemDefinition, auction: { ...shelemDefinition.auction, trickPlay: { ...shelemDefinition.auction.trickPlay, ...change } } }).ok, false);
  }
  const { declarerSetup, ...auction } = shelemDefinition.auction;
  assert.equal(validateGameDefinition({ ...shelemDefinition, auction }).ok, false);
  assert.equal(validateGameDefinition({ ...shelemDefinition, auction: { ...auction, trickPlay: null } }).ok, false);
});

test("first trump lead, rightward turns and follow-suit are authoritative", () => {
  const s = ready();
  // Put an off-suit card in the declarer's hand while keeping all 52 cards.
  [s.hands["1"][0], s.hands["0"][0]] = [s.hands["0"][0], s.hands["1"][0]];
  reject(s, "1", { type: "play-card", cardIndex: 0 });
  for (const id of ["0", "2", "3", "unknown", null]) reject(s, id, { type: "play-card", cardIndex: 1 });
  for (const index of [-1, 12, 1.5, "1", null]) reject(s, "1", { type: "play-card", cardIndex: index });
  reject(s, "1", { type: "play-card", cardIndex: 1, suit: "hearts" });
  const next = play(s, 1); assert.equal(next.currentPlayer, "2");
  // Seat 2 holds A spades and must follow even though its other cards are hearts.
  reject(next, "2", { type: "play-card", cardIndex: 1 });
  const n = play(next, 0); assert.equal(n.currentPlayer, "3");
  assert.equal(s.auction!.tricks!.active.length, 0); conservation(n);
});

test("trump wins, highest led suit wins, and off-suit aces cannot win", () => {
  const cases: [Card[], string][] = [
    [[card("hearts", "A"), card("hearts", "K"), card("spades", "2"), card("clubs", "A")], "3"],
    [[card("hearts", "K"), card("hearts", "A"), card("clubs", "A"), card("diamonds", "A")], "2"],
    [[card("hearts", "A"), card("spades", "K"), card("spades", "A"), card("spades", "2")], "3"],
  ];
  for (const [cards, winner] of cases) {
    let s = ready(); s.auction!.tricks!.completed = 1; // isolated later-trick fixture
    for (const [i, id] of ["1", "2", "3", "0"].entries()) s.hands[id] = [cards[i]];
    for (let i = 0; i < 4; i++) s = play(s, 0);
    assert.equal(s.currentPlayer, winner); assert.equal(s.auction!.tricks!.lastWinner, winner);
    assert.deepEqual(s.auction!.tricks!.collections[s.auction!.teams[winner]], cards);
  }
});

test("twelve tricks preserve exact collection order, all 52 cards and frozen state", () => {
  let s = ready(); const initial = structuredClone(s.auction!);
  const expected: Record<string, Card[]> = { "0": [], "1": [] };
  let trickCards: Card[] = [];
  for (let n = 0; n < 48; n++) {
    const t = s.auction!.tricks!;
    const hand = s.hands[s.currentPlayer];
    const led = t.active[0]?.card.suit;
    const required = t.completed === 0 && !led ? s.auction!.trump : led;
    let index = hand.findIndex(c => c.suit === required); if (index < 0) index = 0;
    trickCards.push(hand[index]);
    const previous = structuredClone(s);
    s = play(s, index); conservation(s);
    assert.equal(previous.hands[previous.currentPlayer].length, s.hands[previous.currentPlayer].length + 1);
    if ((n + 1) % 4 === 0) {
      const team = s.auction!.teams[s.currentPlayer];
      expected[team] = [...trickCards, ...expected[team]]; trickCards = [];
      assert.deepEqual(s.auction!.tricks!.collections, expected);
      assert.equal(s.auction!.tricks!.active.length, 0);
    }
    assert.deepEqual(s.auction!.scores, initial.scores);
    assert.deepEqual(s.auction!.discardStack, initial.discardStack);
    assert.equal(s.auction!.dealer, initial.dealer); assert.equal(s.auction!.highBid, initial.highBid);
    assert.equal(s.auction!.trump, initial.trump);
  }
  assert.equal(s.auction!.phase, "ready-scoring"); assert.equal(s.auction!.tricks!.completed, 12);
  assert.equal(Object.values(s.auction!.tricks!.teamCounts).reduce((a, b) => a + b, 0), 12);
  assert.ok(Object.values(s.hands).every(h => h.length === 0));
  assert.equal(s.roundStatus, "playing"); assert.equal(s.winner, null);
  reject(s, s.currentPlayer, { type: "play-card", cardIndex: 0 });
  assert.equal(game.nextDeal!(s, () => 0).ok, false);
});

test("active cards are public but collected piles and point totals never appear", () => {
  let s = ready(); s = play(s, 0);
  const active = structuredClone(s);
  s = play(s, 0); s = play(s, 0); s = play(s, 0);
  for (const state of [active, s]) {
    const before = structuredClone(state);
    for (const id of ["0", "1", "2", "3", null, undefined, "unknown"]) {
      const view = game.playerView(state, id);
      assert.deepEqual(view.auction!.tricks!.active, state.auction!.tricks!.active);
      assert.deepEqual(Object.keys(view.auction!.tricks!).sort(), ["active", "leader", "completed", "lastWinner", "teamCounts"].sort());
      for (const seat of state.playOrder) assert.deepEqual(view.hands[seat], seat === id ? state.hands[seat] : []);
      const payload = JSON.stringify(view);
      for (const c of Object.values(state.auction!.tricks!.collections).flat()) assert.equal(payload.includes(JSON.stringify(c)), false);
      view.auction!.tricks!.teamCounts["0"] = 99;
      if (view.auction!.tricks!.active.length) view.auction!.tricks!.active[0].card.rank = "A";
    }
    assert.deepEqual(state, before);
  }
});
