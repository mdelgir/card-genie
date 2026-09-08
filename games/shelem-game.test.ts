import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { createGameRuntime } from "./engine/runtime";
import { shelemDefinition } from "./definitions/shelem";
const projected = createGameRuntime(shelemDefinition); if (!projected.ok) throw new Error("Invalid fixture"); const projection = projected.runtime;
import { INVALID_MOVE } from "boardgame.io/core";
import { ShelemGame, type ShelemGameState } from "./shelem-game";
import { legalTrickIndices } from "./engine/trick-runtime";

test("Shelem adapter completes a seeded match, controls every stage and resets replay", async () => {
  const multiplayer = Local();
  const fixtureGame = { ...ShelemGame, seed: "shelem-completion" };
  const clients = ["0", "1", "2", "3"].map(playerID => Client({ game: fixtureGame, numPlayers: 4, playerID, multiplayer, debug: false }));
  try {
    clients.forEach(c => c.start());
    clients[0].moves.startGame();
    let count = 0;
    while (clients[0].getState()!.G.roundStatus !== "complete") {
      assert.ok(count++ < 2500, "Match should finish within deterministic fixture bound");
      const state = clients[0].getState()!;
      const current = clients[Number(state.ctx.currentPlayer)]; const cg = current.getState()!.G; const v = cg.view ?? projection.playerView(cg.round!, state.ctx.currentPlayer); const a = v.auction!;
      const hand = v.hands[state.ctx.currentPlayer];
      assert.equal(v.currentPlayer, state.ctx.currentPlayer);
      if (a.phase === "bidding") a.highBid === null && Number(state.ctx.currentPlayer) % 2 === 1 ? current.moves.bid(165) : current.moves.passBid();
      else if (a.phase === "choose-trump") {
        const suit = [...hand].sort((x,y) => hand.filter(c => c.suit === y.suit).length - hand.filter(c => c.suit === x.suit).length)[0].suit;
        current.moves.chooseTrump(suit);
      } else if (a.phase === "take-kitty") current.moves.takeKitty();
      else if (a.phase === "discard") {
        const indices = hand.map((_, i) => i).sort((i,j) => Number(hand[i].suit === a.trump) - Number(hand[j].suit === a.trump));
        current.moves.discardCards(indices.slice(0,4));
      } else {
        assert.ok(a.tricks && a.trump);
        const legal = legalTrickIndices(hand, a.tricks.active, a.tricks.completed, a.trump);
        assert.ok(legal.length); current.moves.playCard(legal[0]);
      }
    }
    const terminal = clients[0].getState()!; assert.ok((terminal.G.view ?? projection.playerView(terminal.G.round!)).auction!.matchWinner);
    const actor = Number(terminal.ctx.currentPlayer);
    clients[(actor+1)%4].moves.restartGame(); assert.equal(clients[0].getState()!.G.roundStatus, "complete");
    clients[actor].moves.restartGame();
    const fresh = clients[0].getState()!;
    assert.equal(fresh.G.roundStatus, "playing"); assert.equal(fresh.ctx.currentPlayer, "1");
    assert.equal((fresh.G.view ?? projection.playerView(fresh.G.round!)).auction!.dealer, "0"); assert.deepEqual((fresh.G.view ?? projection.playerView(fresh.G.round!)).auction!.scores, { "0": 0, "1": 0 });
    assert.equal((fresh.G.view ?? projection.playerView(fresh.G.round!)).auction!.trump, null); assert.equal((fresh.G.view ?? projection.playerView(fresh.G.round!)).auction!.matchWinner, undefined);
  } finally { clients.forEach(c=>c.stop()); }
});

test("Shelem move boundary refuses premature and wrong-player actions without state mutation", () => {
  const G = ShelemGame.setup!({ ctx: { numPlayers: 4 } } as any);
  const original = structuredClone(G);
  for (const name of ["bid", "passBid", "chooseTrump", "takeKitty", "discardCards", "playCard", "restartGame"]) {
    const move = ShelemGame.moves![name]; assert.ok(typeof move !== "function");
    assert.equal(move.client, false);
    assert.equal(move.move({ G, ctx: { phase: "waiting", currentPlayer: "0" }, playerID: "0" } as any), INVALID_MOVE);
    assert.deepEqual(G, original);
  }
  const start = ShelemGame.moves!.startGame; assert.ok(typeof start !== "function");
  assert.equal(start.move({ G, ctx: { phase: "waiting" }, playerID: "1" } as any), INVALID_MOVE);
});
