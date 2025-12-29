import test from "node:test";
import assert from "node:assert/strict";
import { SimpleCardGame, type SimpleCardGameState } from "./simple-card-game";

const setupContext = {
  ctx: {
    numPlayers: 2,
  },
  random: {
    Shuffle: <T,>(cards: T[]) => [...cards],
  },
} as any;

test("setup creates a full deck and empty hands", () => {
  const state = SimpleCardGame.setup?.(setupContext) as SimpleCardGameState;

  assert.equal(state.deck.length, 52);
  assert.equal(state.hands["0"], null);
  assert.equal(state.hands["1"], null);
  assert.equal(state.revealed, false);
  assert.equal(state.winner, null);
});

test("drawCard assigns cards and sets winner once all drawn", () => {
  const state = SimpleCardGame.setup?.(setupContext) as SimpleCardGameState;
  const drawCard = SimpleCardGame.moves?.drawCard;

  assert.ok(drawCard);
  const events = { endTurn: () => {} };
  drawCard({ G: state, playerID: "0", events } as any);
  drawCard({ G: state, playerID: "1", events } as any);

  assert.ok(state.hands["0"]);
  assert.ok(state.hands["1"]);
  assert.equal(state.revealed, true);
  assert.equal(state.winner, "1");
});
