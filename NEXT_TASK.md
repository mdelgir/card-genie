# Next Task — Hosted End-to-End Validation

This is the final Phase 1 acceptance task. The physical LAN flow has now been exercised manually on real devices, and the compiled production server has been verified on a non-default port. Do **not** begin Phase 2 until this hosted check passes.

`ledger.md` remains the source of truth and should be updated after the hosted validation succeeds.

## Already verified

- Local multi-browser gameplay and privacy.
- Standalone public table entry.
- Physical LAN reachability from phones and a TV browser.
- Full LAN create/join/start/draw/reveal/replay flow.
- Production server configuration for `PORT`, `ALLOWED_ORIGINS`, and `VITE_SERVER_URL`.
- Compiled production server startup on `PORT=9123` with `NODE_ENV=production` and an explicit allowed origin.
- `GET /games` returned HTTP 200 with `["simple-card-game"]` on the compiled custom-port server.
- GitHub CI passes the production builds and 15 automated tests.

A low-priority TV viewport/layout issue is tracked separately in GitHub issue #1 and is not a Phase 1 blocker.

## Objective

Deploy the current repository revision to a real HTTPS-hosted environment and verify the same authoritative multiplayer flow over the public internet.

Use a simple two-service shape:

```text
HTTPS static frontend
  -> VITE_SERVER_URL
HTTPS Node / boardgame.io backend
  -> one long-lived instance with WebSocket upgrades
```

See `HOSTING.md` for provider-neutral production requirements.

## Backend requirements

Set:

```text
NODE_ENV=production
PORT=<platform supplied port>
ALLOWED_ORIGINS=https://<frontend-host>
```

Build and run the existing server without changing the game architecture.

Requirements:

- persistent Node process,
- WebSocket upgrades supported,
- one backend instance only for Phase 1,
- `/games`, `/rooms`, and `/socket.io/` available at the backend origin with no extra URL prefix,
- do not add persistence, accounts, horizontal scaling, or a boardgame.io upgrade.

## Frontend requirements

Build with:

```text
VITE_SERVER_URL=https://<backend-host>
```

Publish `client/dist` through HTTPS.

The existing links must continue to work:

```text
/?room=<matchID>
/?table=<matchID>
```

## Hosted acceptance flow

Use at least three browser contexts, preferably on separate devices or networks:

1. Host/player opens the hosted frontend and creates a 2-player room.
2. Guest/player joins through the hosted join URL.
3. Public table opens through the hosted `?table=<matchID>` URL.
4. Confirm the table consumes no player seat.
5. Host starts after both real player seats are filled.
6. First legal draw is visible face-up only to the drawing player.
7. Other player and public table see only public draw progress / a face-down card.
8. Deck count and current turn synchronize in real time.
9. Final draw reveals both cards and the same winner/tie everywhere.
10. Only the authoritative final-draw/current player can replay.
11. Replay clears old cards/winner, restores deck count to 52, and selects a valid new first player.
12. The first draw of the next round is private again.
13. Refresh/reconnect a spectator/table and confirm no private historical state appears.

## Production checks

Also verify:

- frontend is HTTPS,
- backend is HTTPS,
- SocketIO connects successfully through the hosted proxy,
- WebSocket/polling requests from the allowed frontend origin succeed,
- requests from the deployed frontend are not blocked by CORS,
- `/games` returns HTTP 200 from the backend,
- no mixed-content errors appear in browser developer tools.

## Pass criteria

Hosted validation passes only when the complete create/join/start/private draw/reveal/replay/next-round flow succeeds against the real deployment.

Automated tests, local production mode, and a successful `/games` health check are necessary but do not substitute for this end-to-end hosted run.

## After success

Update `ledger.md` to record:

- physical LAN validation as verified,
- compiled non-default production startup as verified,
- hosted end-to-end validation as verified,
- the actual hosting provider / service URLs used for the test,
- any non-blocking limitations discovered.

Then mark Phase 1 complete and set the next task to **Phase 2A — `GameDefinition v0`**.

Do not work on the low-priority TV layout issue or begin the user-facing Game Creator before `GameDefinition v0` and the generic runtime are proven.
