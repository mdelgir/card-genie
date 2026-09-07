import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { readServerConfig, isAllowedOrigin } from "./config";
import { createCardGenieServer } from "./room-server";

test("production config requires exact origins and a valid port; LAN defaults remain", () => {
  const local = readServerConfig({});
  assert.equal(local.port, 8000);
  assert.ok(isAllowedOrigin("http://192.168.1.25:5173", local.origins));
  const production = readServerConfig({ NODE_ENV: "production", PORT: "9123",
    ALLOWED_ORIGINS: " https://cards.example/, https://preview.example " });
  assert.equal(production.port, 9123);
  assert.deepEqual(production.origins, ["https://cards.example", "https://preview.example"]);
  assert.ok(isAllowedOrigin(undefined, production.origins));
  assert.equal(isAllowedOrigin("https://cards.example.evil.test", production.origins), false);
  assert.throws(() => readServerConfig({ NODE_ENV: "production" }), /ALLOWED_ORIGINS/);
  for (const origin of ["*", "null", "https://*.example", "https://cards.example/path", "https://user:pass@cards.example", "ftp://cards.example"]) {
    assert.throws(() => readServerConfig({ ALLOWED_ORIGINS: origin }));
  }
  for (const port of ["", "0", "-1", "65536", "8e3", "8000junk"]) {
    assert.throws(() => readServerConfig({ PORT: port }), /PORT/);
  }
});

test("production origins protect Lobby, room API, polling and direct WebSocket connections", async () => {
  const allowed = "https://cards.example";
  const denied = "https://untrusted.example";
  const server = createCardGenieServer(readServerConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: allowed }));
  const running = await server.run(0);
  const address = running.appServer.address();
  assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`;
  try {
    for (const path of ["/games", "/rooms/example/start"]) {
      const preflight = await fetch(url + path, { method: "OPTIONS", headers: {
        Origin: allowed, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), allowed);
      assert.match(preflight.headers.get("access-control-allow-headers")!, /authorization/i);
      assert.equal((await fetch(url + path, { headers: { Origin: denied } })).status, 403);
    }
    const created = await fetch(url + "/games/simple-card-game/create", { method: "POST",
      headers: { Origin: allowed, "Content-Type": "application/json" }, body: JSON.stringify({ numPlayers: 2 }) });
    assert.equal(created.status, 200);
    assert.equal(created.headers.get("access-control-allow-origin"), allowed);
    const { matchID } = await created.json() as { matchID: string };
    assert.equal((await fetch(`${url}/rooms/${matchID}/start`, { method: "POST", headers: { Origin: allowed } })).status, 403,
      "allowed origins do not replace creator authentication");
    assert.equal((await fetch(url + "/games")).status, 200, "health checks may omit Origin");
    for (const transport of ["polling", "websocket"]) {
      for (const origin of [allowed, denied]) {
        const socket = io(url + "/simple-card-game", { transports: [transport],
          extraHeaders: { Origin: origin }, reconnection: false, timeout: 2000, forceNew: true });
        try {
          const connected = await new Promise<boolean>(resolve => {
            socket.once("connect", () => resolve(true));
            socket.once("connect_error", () => resolve(false));
          });
          assert.equal(connected, origin === allowed, `${transport} must enforce the origin allowlist`);
          if (connected) {
            const sync = new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error("No spectator sync")), 2000);
              socket.once("sync", (_id, info) => {
                clearTimeout(timer);
                try {
                  assert.deepEqual(info.state.G.deck, []);
                  assert.deepEqual(info.initialState.plugins, {});
                  resolve();
                } catch (error) { reject(error); }
              });
            });
            socket.emit("sync", matchID, undefined, undefined, 2);
            await sync;
          }
        } finally { socket.disconnect(); }
      }
    }
    const polling = await fetch(url + "/socket.io/?EIO=4&transport=polling", { headers: { Origin: allowed } });
    assert.equal(polling.status, 200);
    assert.equal(polling.headers.get("access-control-allow-origin"), allowed);
  } finally { server.kill(running); }
});
