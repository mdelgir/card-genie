import test from "node:test";
import assert from "node:assert/strict";
import { Client, LobbyClient } from "boardgame.io/client";
import { SocketIO } from "boardgame.io/multiplayer";
import { CustomCardGame, type CustomCardGameState } from "../../games/custom-card-game";
import { highestCardDefinition } from "../../games/definitions/highest-card";
import { createCardGenieServer } from "./room-server";

test("custom game rooms validate definitions and preserve private state over SocketIO", async () => {
  const server = createCardGenieServer();
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  const lobby = new LobbyClient({ server: url });
  const clients: ReturnType<typeof Client<CustomCardGameState>>[] = [];
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for custom-game SocketIO state");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  try {
    const bad = await fetch(`${url}/games/custom-card-game/create`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numPlayers: 2, setupData: { hostName: "Host", definition: { schemaVersion: 1 } } }),
    });
    assert.equal(bad.status, 400);

    const definition = structuredClone(highestCardDefinition);
    definition.id = "creator-network-test";
    definition.name = "Creator Network Test";
    const created = await fetch(`${url}/games/custom-card-game/create`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numPlayers: 2, setupData: { hostName: "Host", definition } }),
    });
    const createdText = await created.text();
    assert.equal(created.status, 200, createdText);
    const { matchID, playerCredentials: hostCredentials } = JSON.parse(createdText) as {
      matchID: string; playerCredentials: string;
    };
    const guest = await lobby.joinMatch("custom-card-game", matchID, { playerID: "1", playerName: "Guest" });

    for (const [playerID, credentials] of [["0", hostCredentials], ["1", guest.playerCredentials], [undefined, undefined]] as const) {
      const client = Client({ game: CustomCardGame, matchID, playerID, credentials,
        multiplayer: SocketIO({ server: url }), debug: false });
      clients.push(client); client.start();
    }
    await waitFor(() => clients.every(client => Boolean(client.getState())));

    for (const client of clients) {
      const initial = client.getInitialState();
      assert.equal(initial.G.started, false);
      assert.equal(initial.G.round, null);
      assert.equal(initial.G.view, null);
      assert.equal(initial.G.definition.id, "creator-network-test");
      assert.deepEqual(initial.plugins, {});
    }

    const started = await fetch(`${url}/rooms/${matchID}/start`, {
      method: "POST", headers: { Authorization: `Bearer ${hostCredentials}` },
    });
    assert.equal(started.status, 200);
    await waitFor(() => clients.every(client => client.getState()!.G.started));

    for (const client of clients) {
      const G = client.getState()!.G;
      assert.equal(G.round, null);
      assert.ok(G.view);
      assert.equal(G.view.deckCount, 52);
      assert.deepEqual(G.view.hands, { "0": [], "1": [] });
    }

    const actor = clients[0].getState()!.ctx.currentPlayer;
    clients[Number(actor)].moves.drawCard();
    await waitFor(() => clients.every(client => client.getState()!.G.view!.hasActed[actor]));

    for (let index = 0; index < clients.length; index++) {
      const G = clients[index].getState()!.G;
      assert.equal(G.round, null);
      assert.ok(G.view);
      assert.equal(G.view.deckCount, 51);
      assert.equal(G.view.hands[actor].length, index === Number(actor) ? 1 : 0);
      const other = actor === "0" ? "1" : "0";
      assert.equal(G.view.hands[other].length, 0);
    }
  } finally {
    clients.forEach(client => client.stop());
    server.kill(running);
  }
});
