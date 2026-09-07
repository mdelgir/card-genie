import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { INVALID_MOVE } from "boardgame.io/core";
import { SimpleCardGame, type SimpleCardGameState } from "./simple-card-game";
import { createGameRuntime, type RoundState } from "./engine/runtime";
import { highestCardDefinition } from "./definitions/highest-card";

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
  move("drawCard")({ G, ctx: { currentPlayer: playerID }, playerID, events: { endTurn: () => {} } } as any);

const viewers = ["0", "1", null, undefined, "unknown"];

for (const numPlayers of [2, 3, 8]) {
  for (const tie of [false, true]) {
    test(`live adapter matches runtime for ${numPlayers} players, ${tie ? "tie" : "winner"}, and replay`, () => {
      const initialized = createGameRuntime(highestCardDefinition);
      assert.ok(initialized.ok);
      const runtime = initialized.runtime;
      const seats = Array.from({ length: numPlayers }, (_, index) => String(index));
      // Ace first, optionally a second ace; reverse seats to exercise non-host starts.
      const shuffle = (indices: number[]) => indices.length === 52
        ? [...(tie ? [12, 25] : [12]), ...indices.filter(i => i !== 12 && (!tie || i !== 25))]
        : [...indices].reverse();
      let shuffleCalls = 0;
      const G = SimpleCardGame.setup!({ ...setupContext, ctx: { numPlayers } });
      const ctx = { numPlayers, phase: "waiting", currentPlayer: "0" };
      const context = {
        ...setupContext, G, ctx,
        random: { Shuffle: (indices: number[]) => { shuffleCalls++; return shuffle(indices); } },
        events: {
          setPhase: (phase: string) => { ctx.phase = phase; ctx.currentPlayer = G.playOrder[0]; },
          endTurn: ({ next }: { next: string }) => { ctx.currentPlayer = next; },
        },
      };
      assert.equal(shuffleCalls, 0);
      assert.equal(G.roundStatus, "waiting");
      assert.equal(move("drawCard")({ ...context, playerID: "0" }), INVALID_MOVE);
      assert.equal(move("startGame")({ ...context, playerID: "1" }), INVALID_MOVE);

      const compare = (state: RoundState) => {
        assert.deepEqual(G.deck, state.deck);
        assert.equal(ctx.currentPlayer, state.currentPlayer);
        assert.deepEqual(G.playOrder, state.playOrder);
        assert.equal(ctx.phase, "playing");
        assert.equal(G.started, true);
        for (const playerID of [...seats, null, undefined, "unknown"]) {
          const expected = runtime.playerView(state, playerID);
          assert.deepEqual(view(G, playerID), {
            deck: [], started: true, roundStatus: expected.roundStatus,
            deckCount: expected.deckCount, hasDrawn: expected.hasActed,
            hands: Object.fromEntries(Object.entries(expected.hands).map(([id, cards]) => [id, cards[0] ?? null])),
            winner: expected.winner === null ? null : expected.winner.type === "tie" ? "tie" : expected.winner.playerID,
            revealed: expected.revealed, playOrder: expected.playOrder,
          });
        }
      };
      for (let round = 0; round < 2; round++) {
        const started = runtime.startRound(seats, shuffle);
        assert.ok(started.ok);
        let state = started.state;
        const actor = round === 0 ? "0" : ctx.currentPlayer;
        assert.notEqual(move(round === 0 ? "startGame" : "restartGame")({ ...context, playerID: actor }), INVALID_MOVE);
        assert.equal(shuffleCalls, (round + 1) * 2);
        compare(state);
        const before = structuredClone(G);
        for (const playerID of [null, "unknown", state.playOrder[1]]) {
          assert.equal(move("drawCard")({ ...context, playerID }), INVALID_MOVE);
          assert.deepEqual(G, before);
        }
        for (const playerID of state.playOrder) {
          const result = runtime.applyAction(state, playerID, { type: "draw" });
          assert.ok(result.ok);
          state = result.state;
          assert.notEqual(move("drawCard")({ ...context, playerID }), INVALID_MOVE);
          compare(state);
          assert.equal(move("drawCard")({ ...context, playerID }), INVALID_MOVE);
        }
        assert.equal(G.winner, tie ? "tie" : state.playOrder[0]);
        const completed = structuredClone(G);
        for (const playerID of [null, "unknown", state.playOrder[0]]) {
          assert.equal(move("restartGame")({ ...context, playerID }), INVALID_MOVE);
          assert.deepEqual(G, completed);
        }
      }
    });
  }
}

test("completion is deterministic for a tie and rejects further draws without changing state", () => {
  const G = setup();
  G.deck = [{ suit: "clubs", rank: "A", value: 14 }, { suit: "hearts", rank: "A", value: 14 }];
  draw(G, "0");
  assert.equal(G.roundStatus, "playing");
  draw(G, "1");
  assert.equal(G.roundStatus, "complete");
  assert.equal(G.winner, "tie");
  const before = structuredClone(G);
  assert.equal(draw(G, "1"), INVALID_MOVE);
  assert.deepEqual(G, before);
});

test("three-player replays refresh the entire turn sequence", async () => {
  const multiplayer = Local();
  const game = { ...SimpleCardGame, seed: "replay-order-regression" };
  const clients = ["0", "1", "2"].map(playerID => Client({
    game, numPlayers: 3, playerID, multiplayer, matchID: "replay-order", debug: false,
  }));
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 3000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "Timed out waiting for replay turn order");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const orders = new Set<string>();
  try {
    clients.forEach(c => c.start());
    await waitFor(() => clients.every(c => Boolean(c.getState())));
    clients[0].moves.startGame();
    await waitFor(() => clients.every(c => c.getState()!.G.roundStatus === "playing"));
    for (let round = 0; round < 3; round++) {
      const order = clients[0].getState()!.G.playOrder;
      orders.add(order.join(","));
      assert.deepEqual([...order].sort(), ["0", "1", "2"]);
      for (let position = 0; position < order.length; position++) {
        clients.forEach(c => {
          assert.deepEqual(c.getState()!.ctx.playOrder, order);
          assert.equal(c.getState()!.ctx.currentPlayer, order[position]);
          assert.equal(c.getState()!.ctx.playOrderPos, position);
        });
        clients[Number(order[position])].moves.drawCard();
        await waitFor(() => clients.every(c => c.getState()!.G.deckCount === 51 - position));
      }
      clients.forEach(c => assert.equal(c.getState()!.G.roundStatus, "complete"));
      clients[Number(order[2])].moves.restartGame();
      await waitFor(() => clients.every(c => c.getState()!.G.deckCount === 52));
    }
    assert.ok(orders.size > 1, "fixture must exercise a changed order across rounds");
  } finally { clients.forEach(c => c.stop()); }
});

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
  assert.equal(state.roundStatus, "complete");
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
  move("restartGame")({ ...setupContext, ctx: { numPlayers: 2, currentPlayer: "1" }, playerID: "1", G: state, events: { setPhase: () => {} } } as any);
  assert.equal(state.roundStatus, "playing");
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
    assert.deepEqual(state._undo, []);
    assert.deepEqual(state._redo, []);
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
    assert.equal(waiting.state!.G.roundStatus, "waiting");
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
    clients.forEach(c => assert.equal(c.getState()!.G.roundStatus, "playing"));
    assert.equal((await startRoom(hostCredentials)).status, 409, "repeat start is rejected");
    const first = clients[0].getState()!.ctx.currentPlayer;
    // Send directly over SocketIO so client-side move checks cannot mask a bypass.
    const rejectMove = async (playerID: string | null, type: string) => {
      const before = (await server.db.fetch(matchID, { state: true })).state!;
      const canonical = (state: typeof before) => structuredClone({
        G: state.G, ctx: state.ctx, _stateID: state._stateID,
        plugins: Object.fromEntries(Object.entries(state.plugins).map(([key, plugin]) => [key, plugin.data])),
      });
      const expected = canonical(before);
      const socket = io(url + "/simple-card-game", { forceNew: true });
      try {
        await new Promise<void>((resolve, reject) => {
          socket.once("connect", resolve);
          socket.once("connect_error", reject);
        });
        const credentials = playerID === "0" ? hostCredentials : playerID === "1" ? guestCredentials : undefined;
        socket.emit("update", { type: "MAKE_MOVE", payload: { type, args: [], playerID, credentials } },
          before._stateID, matchID, playerID);
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.deepEqual(canonical((await server.db.fetch(matchID, { state: true })).state!), expected,
          `${playerID ?? "spectator"} cannot ${type} in this state`);
      } finally { socket.disconnect(); }
    };
    await rejectMove(first, "restartGame");
    clients[Number(first)].moves.drawCard();
    await waitFor(() => clients.every(c => c.getState()!.G.deckCount === 51));
    clients.forEach((client, index) => {
      assertPrivate(client);
      assert.equal(Boolean(client.getState()!.G.hands[first]), String(index) === first);
      assert.equal(client.getState()!.G.hasDrawn[first], true);
    });
    // A fresh spectator sync must not reveal history or current hands.
    const seatsBeforeTable = (await lobby.getMatch(SimpleCardGame.name!, matchID)).players;
    const reconnect = Client({ game: SimpleCardGame, matchID,
      multiplayer: SocketIO({ server: url }), debug: false });
    clients.push(reconnect);
    reconnect.start();
    await waitFor(() => Boolean(reconnect.getState()));
    assertPrivate(reconnect);
    assert.deepEqual(reconnect.getState()!.G.hands, { "0": null, "1": null });
    assert.deepEqual((await lobby.getMatch(SimpleCardGame.name!, matchID)).players, seatsBeforeTable,
      "opening another public table must not change player seats");
    const last = clients[0].getState()!.ctx.currentPlayer;
    clients[Number(last)].moves.drawCard();
    await waitFor(() => clients.every(c => c.getState()!.G.revealed));
    const winner = clients[0].getState()!.G.winner;
    clients.forEach(client => {
      assert.equal(client.getState()!.G.roundStatus, "complete");
      assert.equal(client.getState()!.ctx.currentPlayer, last, "final draw must not advance the turn");
      assertPrivate(client);
      assert.ok(client.getState()!.G.hands["0"]);
      assert.ok(client.getState()!.G.hands["1"]);
      assert.equal(client.getState()!.G.winner, winner);
    });
    await rejectMove(last, "drawCard");
    await rejectMove(first, "restartGame");
    await rejectMove(null, "restartGame");
    clients[Number(last)].moves.restartGame();
    await waitFor(() => clients.every(c => !c.getState()!.G.revealed));
    clients.forEach(client => {
      assertPrivate(client);
      assert.equal(client.getState()!.G.roundStatus, "playing");
      assert.equal(client.getState()!.G.winner, null);
      assert.deepEqual([...client.getState()!.G.playOrder].sort(), ["0", "1"]);
      assert.deepEqual(client.getState()!.ctx.playOrder, client.getState()!.G.playOrder);
      assert.equal(client.getState()!.ctx.currentPlayer, client.getState()!.G.playOrder[0]);
      assert.equal(client.getState()!.G.deckCount, 52);
      assert.deepEqual(client.getState()!.G.hasDrawn, { "0": false, "1": false });
      assert.deepEqual(client.getState()!.G.hands, { "0": null, "1": null });
    });
    const fresh = (await server.db.fetch(matchID, { state: true })).state!;
    assert.equal(fresh.G.deck.length, 52);
    assert.equal(new Set(fresh.G.deck.map((c: { suit: string; rank: string }) => `${c.suit}:${c.rank}`)).size, 52);
    const nextFirst = fresh.ctx.currentPlayer;
    await rejectMove(nextFirst === "0" ? "1" : "0", "drawCard");
    clients[Number(nextFirst)].moves.drawCard();
    await waitFor(() => clients.every(c => c.getState()!.G.deckCount === 51));
    // Reconnect both an authenticated player and a new table after a next-round draw.
    for (const playerID of [nextFirst, undefined]) {
      const client = Client({ game: SimpleCardGame, matchID, playerID,
        credentials: playerID === undefined ? undefined : playerID === "0" ? hostCredentials : guestCredentials,
        multiplayer: SocketIO({ server: url }), debug: false });
      clients.push(client);
      client.start();
      await waitFor(() => Boolean(client.getState()));
      assertPrivate(client);
      assert.equal(Boolean(client.getState()!.G.hands[nextFirst]), playerID === nextFirst);
      assert.equal(client.getState()!.G.hands[nextFirst === "0" ? "1" : "0"], null);
    }
    clients.slice(0, 4).forEach((client, index) => {
      assertPrivate(client);
      assert.equal(Boolean(client.getState()!.G.hands[nextFirst]), String(index) === nextFirst);
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
  assert.equal(G.roundStatus, "waiting");
  assert.equal(move("drawCard")({ G, playerID: "0" } as any), INVALID_MOVE);
  assert.equal(move("restartGame")({ G } as any), INVALID_MOVE);
  const before = structuredClone(G);
  assert.equal(move("startGame")({ ...setupContext, G, playerID: "1" } as any), INVALID_MOVE);
  assert.deepEqual(G, before);
  let phase = "waiting";
  move("startGame")({ ...setupContext, G, playerID: "0", events: { setPhase: (next: string) => { phase = next; } } });
  assert.equal(phase, "playing");
  assert.equal(G.started, true);
  assert.equal(G.roundStatus, "playing");
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
