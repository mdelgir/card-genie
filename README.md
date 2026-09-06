# Card Genie

Multiplayer card game MVP scaffold using Node.js, TypeScript, boardgame.io, and React + Vite.

## Structure
- `client` React + Vite frontend
- `server` Node.js + boardgame.io backend
- `games` Shared game logic

## Quick start
Prerequisites: Node.js 20.19+ within major 20, or Node.js 22.12+, and npm. Verified with Node.js 24.12.0 and npm 11.6.2.

1) Install dependencies

```bash
npm install
```

2) Start the game server

```bash
npm run dev:server
```

3) Start the client

```bash
npm run dev:client
```

The server runs on `http://localhost:8000` and the client runs on `http://localhost:5173`.

## Build and test

Run from the repository root:

```bash
npm install
npm run build:server
npm run build:client
npm test
npm --prefix server start
```

The server build includes shared game logic under `server/dist/games` and starts from `server/dist/server/src/index.js`. Tests are excluded from production output. Client assets are emitted to `client/dist`; serve that directory separately from the game server. `npm --prefix client run preview` can preview the built client locally.

For LAN development, use the host machine's LAN address on every device; the Vite dev server listens on the network. The client defaults to that hostname on port 8000. For a hosted server, set `VITE_SERVER_URL` before building the client. Firewall, HTTPS, and hosted-device validation remain deployment tasks.

## Project records

- [goals.md](goals.md): product goals, Phase 1 acceptance criteria, architecture constraints, and later direction.
- [ledger.md](ledger.md): current progress, dated changes, validation, and next priorities. Update after meaningful work.
- [LOG.md](LOG.md): original development history.

The Vite scripts use the module-runner config loader. Both development mode and production preview have been verified locally. An earlier directory-access error was specific to a restricted Windows Codex session.

## Room flow

Enter your name and a player count (2–8), then choose Create room. Creation automatically joins you as the host. Share the room code, join link, or QR code; other players choose an available seat and join. The waiting room shows public seat occupancy. The host can start only after every seat is filled, and the server independently enforces this rule.

Starting shuffles the 52-card deck and turn order. Each player draws one card on their turn; after everyone draws, cards are revealed and the highest card wins. This task retains the existing replay behavior: only the active player can successfully replay, although the button is currently shown to all players.

Room credentials are held in browser memory. Refresh recovery, host transfer, and a standalone table entrance are still pending. Restart the server/create fresh rooms when updating from the pre-waiting-room version.

For API clients, POST /games/simple-card-game/create now returns matchID, playerID, and playerCredentials (with an optional setupData.hostName request value). POST /rooms/:id/start uses Authorization: Bearer <creator credentials>. Start remains a boardgame.io game transition; direct start moves over SocketIO are rejected.
