import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { SimpleCardGame, type SimpleCardGameState } from "./simple-card-game";

const setupContext = {
  ctx: { numPlayers: 2, phase: "waiting" },
  random: { Shuffle: <T,>(cards: T[]) => [...cards] },
} as any;

const setup = () => {
  const state = SimpleCardGame.setup!(setupContext);
  move("startGame")({ ...setupContext, G: state, playerID: "0", events: { setPhase: () => {} } });
  return state;
};
const view = (G: SimpleCardGameState, playerID: string | null | undefined) =>
  SimpleCardGame.playerView!({ G, playerID } as any);
const move = (name: "drawCard" | "restartGame" | "startGame") => {
  const definition = SimpleCardGame.moves![name];
  assert.equal(typeof definition, "object");
  if (typeof definition === "function") throw new Error("Expected server-only move");
  assert.equal(definition.client, false);
  return definition.move;
};
const draw = (G: SimpleCardGameState, playerID: string) =>
  move("drawCard")({ G, playerID, events: { endTurn: () => {} } } as any);

const viewers = ["0", "1", null, undefined, "unknown"];

test("setup creates a full deck and empty hands", () => {
  const state = setup();
  assert.equal(state.deck.length, 52);
  assert.equal(new Set(state.deck.map(c => `${c.suit}:${c.rank}`)).size, 52);
  assert.equal(state.deckCount, 52);
  assert.deepEqual(state.hasDrawn, { "0": false, "1": false });
  assert.deepEqual(state.hands, { "0": null, "1": null });
  assert.equal(state.revealed, false);
  assert.equal(state.winner, null);
});

test("initial views never expose the shuffled deck", () => {
  const state = setup();
  for (const id of viewers) {
    const filtered = view(state, id);
    assert.deepEqual(filtered.deck, []);
    assert.equal(filtered.deckCount, 52);
    assert.deepEqual(filtered.hands, { "0": null, "1": null });
  }
});

test("drawCard assigns cards and sets winner once all drawn", () => {
  const state = setup();
  draw(state, "0");
  assert.equal(state.deckCount, 51);
  assert.deepEqual(state.hasDrawn, { "0": true, "1": false });
  draw(state, "1");
  assert.ok(state.hands["0"]);
  assert.ok(state.hands["1"]);
  assert.equal(state.deckCount, 50);
  assert.equal(state.revealed, true);
  assert.equal(state.winner, "1");
});

test("each player sees only their own card; spectators see public progress", () => {
  for (const drawingPlayer of ["0", "1"]) {
    const state = setup();
    draw(state, drawingPlayer);
    const before = structuredClone(state);
    for (const id of viewers) {
      const filtered = view(state, id);
      assert.deepEqual(filtered.deck, []);
      assert.equal(filtered.deckCount, 51);
      assert.deepEqual(filtered.hasDrawn, state.hasDrawn);
      for (const seat of ["0", "1"]) {
        assert.deepEqual(filtered.hands[seat], seat === id ? state.hands[seat] : null);
      }
    }
    assert.deepEqual(state, before, "filtering must preserve authoritative state");
  }
});

test("revealed cards are public but undealt cards remain private", () => {
  const state = setup();
  draw(state, "0");
  draw(state, "1");
  for (const id of viewers) {
    const filtered = view(state, id);
    assert.deepEqual(filtered.deck, []);
    assert.equal(filtered.deckCount, 50);
    assert.deepEqual(filtered.hands, state.hands);
    assert.equal(filtered.winner, "1");
  }
});

test("new private state fields are excluded unless explicitly exposed", () => {
  const state = { ...setup(), futurePrivateZone: { secret: "hidden" } };
  for (const id of viewers) {
    assert.equal("futurePrivateZone" in view(state, id), false);
  }
});

test("replay resets public progress and keeps the fresh deck private", () => {
  const state = setup();
  draw(state, "0");
  draw(state, "1");
  move("restartGame")({ ...setupContext, G: state, events: { endTurn: () => {} } });
  assert.equal(state.deck.length, 52);
  assert.equal(state.deckCount, 52);
  assert.deepEqual(state.hasDrawn, { "0": false, "1": false });
  assert.equal(state.revealed, false);
  assert.equal(state.winner, null);
  for (const id of viewers) {
    assert.deepEqual(view(state, id).deck, []);
    assert.deepEqual(view(state, id).hands, { "0": null, "1": null });
  }
});

test("multiplayer filters initial sync, updates and replay for players and table", async () => {
  const multiplayer = Local();
  const clients = ["0", "1", undefined].map(playerID => Client({
    game: SimpleCardGame, numPlayers: 2, playerID, multiplayer,
    matchID: "privacy-regression", debug: false,
  }));
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 3000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for synchronized state");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const states = () => clients.map(client => {
    const state = client.getState();
    assert.ok(state);
    return state;
  });
  try {
    clients.forEach(client => client.start());
    await waitFor(() => clients.every(client => client.getState() !== null));
    for (const client of clients) {
      // Local transport only exercises current-state filtering; SocketIO is tested below.
      assert.deepEqual(client.getState()!.G.deck, []);
    }
    clients[0].moves.startGame();
    await waitFor(() => states().every(state => state.G.started));
    const first = states()[0].ctx.currentPlayer;
    clients[Number(first)].moves.drawCard();
    await waitFor(() => states().every(state => state.G.deckCount === 51));
    states().forEach((state, index) => {
      assert.deepEqual(state.G.deck, []);
      assert.equal(state.G.hasDrawn[first], true);
      assert.equal(Boolean(state.G.hands[first]), String(index) === first);
      // Verify the received store too, not only the client's rendered view.
      assert.deepEqual(clients[index].store.getState().G, state.G);
      assert.deepEqual(state._undo, []);
      assert.deepEqual(state._redo, []);
    });
    const last = states()[0].ctx.currentPlayer;
    clients[Number(last)].moves.drawCard();
    await waitFor(() => states().every(state => state.G.revealed));
    const winner = states()[0].G.winner;
    for (const state of states()) {
      assert.deepEqual(state.G.deck, []);
      assert.equal(state.G.deckCount, 50);
      assert.ok(state.G.hands["0"]);
      assert.ok(state.G.hands["1"]);
      assert.equal(state.G.winner, winner);
    }
    clients[Number(last)].moves.restartGame();
    await waitFor(() => states().every(state => !state.G.revealed));
    for (const state of states()) {
      assert.deepEqual(state.G.deck, []);
      assert.equal(state.G.deckCount, 52);
      assert.deepEqual(state.G.hands, { "0": null, "1": null });
      assert.deepEqual(state.G.hasDrawn, { "0": false, "1": false });
    }
  } finally {
    clients.forEach(client => client.stop());
  }
});


test("SocketIO never transmits private initial snapshots, including on reconnect", async () => {
  const { createCardGenieServer } = await import("../server/src/room-server");
  const { SocketIO } = await import("boardgame.io/multiplayer");
  const { LobbyClient } = await import("boardgame.io/client");
  const server = createCardGenieServer();
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  const lobby = new LobbyClient({ server: url });
  const clients: ReturnType<typeof Client<SimpleCardGameState>>[] = [];
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for SocketIO");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const assertPrivate = (client: typeof clients[number]) => {
    const state = client.getState()!;
    const initial = client.getInitialState();
    assert.deepEqual(state.G.deck, []);
    assert.deepEqual(initial.G.deck, []);
    assert.deepEqual(initial.G.hands, { "0": null, "1": null });
    assert.deepEqual(initial.plugins, {});
    assert.deepEqual(initial._undo, []);
    assert.deepEqual(initial._redo, []);
    assert.equal(JSON.stringify(state.plugins).includes('"seed"'), false);
    assert.equal(JSON.stringify(state.plugins).includes('"prngstate"'), false);
  };
  try {
    const created = await fetch(`${url}/games/simple-card-game/create`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numPlayers: 2, setupData: { hostName: "Creator" } }) });
    assert.equal(created.status, 200);
    const { matchID, playerCredentials: hostCredentials } = await created.json() as { matchID: string; playerCredentials: string };
    const startRoom = (credentials: string) => fetch(`${url}/rooms/${matchID}/start`, { method: "POST", headers: { Authorization: `Bearer ${credentials}` } });
    assert.equal((await startRoom("")).status, 403);
    assert.equal((await startRoom(hostCredentials)).status, 409, "empty seats prevent starting");
    const waiting = await server.db.fetch(matchID, { state: true });
    assert.equal(waiting.state!.ctx.phase, "waiting");
    assert.deepEqual(waiting.state!.G.deck, []);
    let guestCredentials = "";
    for (const playerID of ["0", "1", undefined]) {
      const credentials = playerID === undefined ? undefined : playerID === "0" ? hostCredentials :
        (await lobby.joinMatch(SimpleCardGame.name!, matchID, { playerID, playerName: `Audit ${playerID}` })).playerCredentials;
      if (playerID === "1") guestCredentials = credentials!;
      const client = Client({ game: SimpleCardGame, matchID, playerID, credentials,
        multiplayer: SocketIO({ server: url }), debug: false });
      clients.push(client);
      client.start();
    }
    await waitFor(() => clients.every(c => Boolean(c.getState())));
    clients.forEach(assertPrivate);
    assert.equal((await startRoom(guestCredentials)).status, 403, "guest cannot start");
    const { io } = await import("socket.io-client");
    const raw = io(url + "/simple-card-game", { forceNew: true });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Raw socket timeout")), 3000);
        raw.once("connect", () => { clearTimeout(timer); resolve(); });
      });
      const rejected = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Start bypass was not rejected")), 3000);
        raw.once("roomError", () => { clearTimeout(timer); resolve(); });
      });
      raw.emit("update", { type: "MAKE_MOVE", payload: { type: "startGame", args: [true], playerID: "0", credentials: hostCredentials } },
        clients[0].getState()!._stateID, matchID, "0");
      await rejected;
      assert.equal((await server.db.fetch(matchID, { state: true })).state!.G.started, false);
      raw.emit("update", { type: "GAME_EVENT", payload: { type: "setPhase", args: ["playing"], playerID: "0", credentials: hostCredentials } },
        clients[0].getState()!._stateID, matchID, "0");
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.equal((await server.db.fetch(matchID, { state: true })).state!.ctx.phase, "waiting");
    } finally { raw.disconnect(); }
    await lobby.leaveMatch(SimpleCardGame.name!, matchID, { playerID: "1", credentials: guestCredentials });
    assert.equal((await startRoom(hostCredentials)).status, 409, "a vacated seat prevents starting");
    guestCredentials = (await lobby.joinMatch(SimpleCardGame.name!, matchID, { playerID: "1", playerName: "Returned guest" })).playerCredentials;
    clients[1].updateCredentials(guestCredentials);
    clients[0].moves.drawCard();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(clients[0].getState()!.G.started, false);
    assert.equal(clients[0].getState()!.G.deckCount, 0);
    const simultaneous = await Promise.all([startRoom(hostCredentials), startRoom(hostCredentials)]);
    assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409]);
    await waitFor(() => clients.every(c => c.getState()!.G.started));
    assert.equal((await startRoom(hostCredentials)).status, 409, "repeat start is rejected");
    const first = clients[0].getState()!.ctx.currentPlayer;
    clients[Number(first)].moves.drawCard();
    await waitFor(() => clients.every(c => c.getState()!.G.deckCount === 51));
    clients.forEach((client, index) => {
      assertPrivate(client);
      assert.equal(Boolean(client.getState()!.G.hands[first]), String(index) === first);
      assert.equal(client.getState()!.G.hasDrawn[first], true);
    });
    // A fresh spectator sync must not reveal history or current hands.
    const reconnect = Client({ game: SimpleCardGame, matchID,
      multiplayer: SocketIO({ server: url }), debug: false });
    clients.push(reconnect);
    reconnect.start();
    await waitFor(() => Boolean(reconnect.getState()));
    assertPrivate(reconnect);
    assert.deepEqual(reconnect.getState()!.G.hands, { "0": null, "1": null });
    const last = clients[0].getState()!.ctx.currentPlayer;
    clients[Number(last)].moves.drawCard();
    await waitFor(() => clients.every(c => c.getState()!.G.revealed));
    const winner = clients[0].getState()!.G.winner;
    clients.forEach(client => {
      assertPrivate(client);
      assert.ok(client.getState()!.G.hands["0"]);
      assert.ok(client.getState()!.G.hands["1"]);
      assert.equal(client.getState()!.G.winner, winner);
    });
    clients[Number(last)].moves.restartGame();
    await waitFor(() => clients.every(c => !c.getState()!.G.revealed));
    clients.forEach(client => {
      assertPrivate(client);
      assert.equal(client.getState()!.G.deckCount, 52);
      assert.deepEqual(client.getState()!.G.hasDrawn, { "0": false, "1": false });
      assert.deepEqual(client.getState()!.G.hands, { "0": null, "1": null });
    });
  } finally {
    clients.forEach(client => client.stop());
    server.kill(running);
  }
});

test("waiting setup does not shuffle; only the host can transition once", () => {
  const { INVALID_MOVE } = require("boardgame.io/core");
  const context = { ...setupContext, random: { Shuffle: () => { throw new Error("Premature shuffle"); } } };
  const G = SimpleCardGame.setup!(context);
  assert.deepEqual(G.deck, []);
  assert.equal(G.started, false);
  assert.equal(move("drawCard")({ G, playerID: "0" } as any), INVALID_MOVE);
  assert.equal(move("restartGame")({ G } as any), INVALID_MOVE);
  const before = structuredClone(G);
  assert.equal(move("startGame")({ ...setupContext, G, playerID: "1" } as any), INVALID_MOVE);
  assert.deepEqual(G, before);
  let phase = "waiting";
  move("startGame")({ ...setupContext, G, playerID: "0", events: { setPhase: (next: string) => { phase = next; } } });
  assert.equal(phase, "playing");
  assert.equal(G.started, true);
  assert.equal(G.deck.length, 52);
  const started = structuredClone(G);
  assert.equal(move("startGame")({ ...setupContext, G, playerID: "0" } as any), INVALID_MOVE);
  assert.deepEqual(G, started);
});

test("reclaiming the host seat does not grant creator privileges", async () => {
  const { createCardGenieServer } = await import("../server/src/room-server");
  const { LobbyClient } = await import("boardgame.io/client");
  const server = createCardGenieServer();
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  const lobby = new LobbyClient({ server: url });
  try {
    const response = await fetch(`${url}/games/simple-card-game/create`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numPlayers: 2 }) });
    const { matchID, playerCredentials } = await response.json() as { matchID: string; playerCredentials: string };
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(await lobby.getMatch(SimpleCardGame.name!, matchID)).includes(playerCredentials), false);
    await lobby.joinMatch(SimpleCardGame.name!, matchID, { playerID: "1", playerName: "Guest" });
    await lobby.leaveMatch(SimpleCardGame.name!, matchID, { playerID: "0", credentials: playerCredentials });
    const replacement = await lobby.joinMatch(SimpleCardGame.name!, matchID, { playerID: "0", playerName: "Replacement" });
    const start = await fetch(`${url}/rooms/${matchID}/start`, { method: "POST",
      headers: { Authorization: `Bearer ${replacement.playerCredentials}` } });
    assert.equal(start.status, 403);
    assert.equal((await server.db.fetch(matchID, { state: true })).state!.G.started, false);
  } finally { server.kill(running); }
});
