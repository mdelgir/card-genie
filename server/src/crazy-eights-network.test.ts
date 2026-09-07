import test from "node:test";
import assert from "node:assert/strict";
import { Client, LobbyClient } from "boardgame.io/client";
import { SocketIO } from "boardgame.io/multiplayer";
import { CrazyEightsGame, type CrazyEightsGameState } from "../../games/crazy-eights-game";
import { createCardGenieServer } from "./room-server";

test("Crazy Eights room sync exposes only owner hand and public discard metadata", async () => {
  const server = createCardGenieServer();
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  const lobby = new LobbyClient({ server: url });
  const clients: ReturnType<typeof Client<CrazyEightsGameState>>[] = [];
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for Crazy Eights SocketIO state");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  try {
    const gamesResponse = await fetch(`${url}/games`);
    assert.equal(gamesResponse.status, 200);
    const games = await gamesResponse.json() as string[];
    assert.ok(games.includes("crazy-eights"));

    const created = await fetch(`${url}/games/crazy-eights/create`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numPlayers: 2, setupData: { hostName: "Eight Host" } }),
    });
    assert.equal(created.status, 200);
    const { matchID, playerCredentials: hostCredentials } = await created.json() as {
      matchID: string; playerCredentials: string;
    };
    const guest = await lobby.joinMatch("crazy-eights", matchID, { playerID: "1", playerName: "Eight Guest" });

    for (const [playerID, credentials] of [["0", hostCredentials], ["1", guest.playerCredentials], [undefined, undefined]] as const) {
      const client = Client({ game: CrazyEightsGame, matchID, playerID, credentials,
        multiplayer: SocketIO({ server: url }), debug: false });
      clients.push(client); client.start();
    }
    await waitFor(() => clients.every(client => Boolean(client.getState())));
    const start = await fetch(`${url}/rooms/${matchID}/start`, {
      method: "POST", headers: { Authorization: `Bearer ${hostCredentials}` },
    });
    assert.equal(start.status, 200);
    await waitFor(() => clients.every(client => client.getState()!.G.started));

    for (let index = 0; index < clients.length; index++) {
      const state = clients[index].getState()!;
      const initial = clients[index].getInitialState();
      assert.deepEqual(state.G.deck, []);
      assert.equal(state.G.deckCount, 41);
      assert.deepEqual(state.G.discard, []);
      assert.deepEqual(state.G.handCounts, { "0": 5, "1": 5 });
      assert.ok(state.G.discardTop);
      assert.ok(state.G.activeSuit);
      assert.equal(state.G.hands["0"].length, index === 0 ? 5 : 0);
      assert.equal(state.G.hands["1"].length, index === 1 ? 5 : 0);
      // initialState is the historical waiting snapshot and must contain no later secrets.
      assert.deepEqual(initial.G.deck, []);
      assert.deepEqual(initial.G.discard, []);
      assert.equal(initial.G.hands["0"].length, 0);
      assert.equal(initial.G.hands["1"].length, 0);
      assert.deepEqual(initial.plugins, {});
    }

    const actor = clients[0].getState()!.ctx.currentPlayer;
    const actorClient = clients[Number(actor)];
    const G = actorClient.getState()!.G;
    const cardIndex = G.hands[actor].findIndex(card => card.rank === "8" || card.suit === G.activeSuit || card.rank === G.discardTop?.rank);
    const beforeCount = G.handCounts[actor];
    let expectedCount: number;
    if (cardIndex >= 0) {
      const selected = G.hands[actor][cardIndex];
      if (selected.rank === "8") actorClient.moves.playCard(cardIndex, "hearts");
      else actorClient.moves.playCard(cardIndex);
      expectedCount = beforeCount - 1;
    } else {
      actorClient.moves.drawCard();
      expectedCount = beforeCount + 1;
    }
    await waitFor(() => clients.every(client => client.getState()!.G.handCounts[actor] === expectedCount));

    for (let index = 0; index < clients.length; index++) {
      const state = clients[index].getState()!;
      assert.deepEqual(state.G.deck, []);
      assert.deepEqual(state.G.discard, []);
      assert.equal(state.G.handCounts[actor], expectedCount);
      assert.ok(state.G.discardTop);
      assert.equal(state.G.hands[actor].length, index === Number(actor) ? expectedCount : 0);
      const other = actor === "0" ? "1" : "0";
      assert.equal(state.G.hands[other].length, index === Number(other) ? 5 : 0);
    }
  } finally {
    clients.forEach(client => client.stop());
    server.kill(running);
  }
});
