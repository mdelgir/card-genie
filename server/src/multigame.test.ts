import test from "node:test";
import assert from "node:assert/strict";
import { Client, LobbyClient } from "boardgame.io/client";
import { SocketIO } from "boardgame.io/multiplayer";
import { WarGame, type WarGameState } from "../../games/war-game";
import { createCardGenieServer } from "./room-server";

test("server registers War and preserves private piles over SocketIO", async () => {
  const server = createCardGenieServer();
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  const lobby = new LobbyClient({ server: url });
  const clients: ReturnType<typeof Client<WarGameState>>[] = [];
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for War SocketIO state");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  try {
    const gamesResponse = await fetch(`${url}/games`);
    assert.equal(gamesResponse.status, 200);
    const games = await gamesResponse.json() as string[];
    assert.ok(games.includes("simple-card-game"));
    assert.ok(games.includes("war"));

    const created = await fetch(`${url}/games/war/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numPlayers: 2, setupData: { hostName: "War Host" } }),
    });
    assert.equal(created.status, 200);
    const { matchID, playerCredentials: hostCredentials } = await created.json() as {
      matchID: string; playerCredentials: string;
    };
    assert.match(hostCredentials, /^host_/);
    const guest = await lobby.joinMatch("war", matchID, { playerID: "1", playerName: "War Guest" });

    for (const [playerID, credentials] of [["0", hostCredentials], ["1", guest.playerCredentials], [undefined, undefined]] as const) {
      const client = Client({ game: WarGame, matchID, playerID, credentials,
        multiplayer: SocketIO({ server: url }), debug: false });
      clients.push(client);
      client.start();
    }
    await waitFor(() => clients.every(client => Boolean(client.getState())));

    const started = await fetch(`${url}/rooms/${matchID}/start`, {
      method: "POST", headers: { Authorization: `Bearer ${hostCredentials}` },
    });
    assert.equal(started.status, 200);
    await waitFor(() => clients.every(client => client.getState()!.G.started));

    for (const client of clients) {
      const state = client.getState()!;
      const initial = client.getInitialState();
      assert.deepEqual(state.G.deck, []);
      assert.deepEqual(state.G.piles, { "0": [], "1": [] });
      assert.deepEqual(state.G.pot, []);
      assert.deepEqual(state.G.pileCounts, { "0": 26, "1": 26 });
      assert.deepEqual(initial.G.deck, []);
      assert.deepEqual(initial.G.piles, { "0": [], "1": [] });
      assert.deepEqual(initial.G.pot, []);
      assert.deepEqual(initial.plugins, {});
    }

    const actor = clients[0].getState()!.ctx.currentPlayer;
    clients[Number(actor)].moves.revealBattle();
    await waitFor(() => clients.every(client => client.getState()!.G.contributions.length >= 2));
    for (const client of clients) {
      const G = client.getState()!.G;
      assert.deepEqual(G.deck, []);
      assert.deepEqual(G.piles, { "0": [], "1": [] });
      assert.deepEqual(G.pot, []);
      assert.equal(G.pileCounts["0"] + G.pileCounts["1"] + G.potCount, 52);
      assert.ok(G.contributions.every(entry => entry.card.rank && entry.card.suit));
    }
  } finally {
    clients.forEach(client => client.stop());
    server.kill(running);
  }
});
