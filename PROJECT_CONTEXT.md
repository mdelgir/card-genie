# Project Context

## Product vision

Card Genie is a multiplayer platform for games played with a standard 52-card deck.

The long-term goal is to let users add their own games by defining the number of players and the game rules, while the platform handles multiplayer state, card visibility, turns, synchronization, and presentation.

A core use case is an in-person game night:

- Each player uses their own phone as a private hand/controller.
- A nearby TV or tablet acts as the shared public table.
- The same system also supports fully online play.

The product should eventually support web, mobile, tablet, and TV form factors.

## MVP / Phase 1 scope

The current focus is a small but complete vertical slice rather than a generalized user-programmable rule system.

Phase 1 should prove that the architecture can support:

1. Create a room.
2. Join the room from multiple devices.
3. Assign player seats / identities.
4. Start a game through an authoritative lifecycle.
5. Create and shuffle a standard 52-card deck.
6. Deal or draw private cards according to the demo rules.
7. Show public game state on an independently accessible shared table view.
8. Allow at least one legal player action and reject illegal actions authoritatively.
9. Synchronize state in real time across all connected devices.
10. Reach an explicit completed-round winner/tie state.
11. Replay/reset with consistent permissions and fresh private state.
12. Verify the complete flow on physical LAN devices and in a hosted configuration.

User-defined game rules are a later phase and should not drive unnecessary complexity into Phase 1.

## Chosen technology stack

The chosen stack is:

- TypeScript throughout.
- Node.js backend.
- `boardgame.io` for game state, moves, turn flow, multiplayer synchronization, and player-specific state filtering.
- WebSocket-based real-time multiplayer through boardgame.io's SocketIO transport.
- React + TypeScript + Vite for the frontend.
- npm workspaces with shared game definitions.

Repository layout:

- `client/` — React + Vite frontend.
- `server/` — Node.js + boardgame.io backend.
- `games/` — shared / modular game logic.
- `goals.md` — target outcomes and acceptance criteria.
- `ledger.md` — current verified progress and next priorities.
- `LOG.md` — historical development log.

The repository pins `boardgame.io` to 0.50.2. Do not casually upgrade it during Phase 1 because the current server includes a transport-level privacy guard specific to this version's initial synchronization behavior.

## Why this stack was chosen

The project is being developed solo, so minimizing duplicated platform-specific work matters.

A browser-first client gives immediate coverage for phones, tablets, desktops, and many TV/browser scenarios. Native wrappers or dedicated mobile / TV apps can be considered later if necessary.

Using TypeScript on both client and server reduces context switching and makes it easier to share types and game models.

`boardgame.io` is a library, not an external hosted service. It runs as part of this application's server and client code. The platform therefore does not depend on a third-party boardgame.io cloud service to host a session.

## Online and local-network sessions

The architecture supports both internet-hosted and LAN-hosted sessions through the same protocol.

For a local-network session, one machine can run the Node.js / boardgame.io server and frontend. Other phones, tablets, or a TV browser on the same network connect to that machine using its LAN IP address.

The client derives the game-server hostname from the current browser hostname by default and can use `VITE_SERVER_URL` for a hosted deployment. Avoid separate LAN-only game logic.

## Authoritative state and privacy

The server is authoritative.

Critical game logic must execute or be validated on the server side, including:

- deck creation,
- shuffling,
- dealing / drawing,
- legal moves,
- turn progression,
- game start,
- winner/tie calculation,
- replay/reset.

Do not trust a client to decide outcomes or manipulate canonical game state.

Card visibility is a core architectural requirement, not just a UI concern.

Each player should receive only information they are allowed to know. A player may see their own private hand and public table state, but should not receive another player's private cards.

The table / spectator view should receive public state only and must never expose private hands.

The current implementation uses boardgame.io `playerView` filtering plus a custom `PrivateStateSocketIO` guard because boardgame.io 0.50.2 can include an unfiltered historical `initialState` snapshot in synchronization payloads. Keep the regression tests for this path whenever transport or boardgame.io dependencies change.

## Player view vs table view

### Player view

Intended mainly for a phone or personal device. It can show:

- that player's private hand,
- legal actions,
- turn / status information,
- public game state as useful.

### Table view

Intended for a TV, tablet, laptop, or other shared display. It should show:

- only public cards / objects,
- turn information,
- player names / seats,
- scores or round state,
- other public game information.

It must not display private hands. The underlying game is the same session; the table is an observer/spectator role, not a player seat.

## Graphics and animation expectations

Cards now have reusable SVG rendering in the React client, including all 52 faces, patterned backs, card slots, responsive layouts, and winner emphasis.

Future polish may include:

- dealing animations,
- card flips,
- moving a card from a hand to the table,
- collecting tricks / piles,
- active-player highlighting,
- round-complete transitions.

Animations remain a frontend concern and must react to authoritative state changes rather than drive game logic.

## Current verified state — 2026-09-06

Astra/Codex completed and committed a substantial Phase 1 checkpoint after the original scaffold and handoff documents were created.

Verified in the repository now:

- Room creation automatically reserves the host seat and returns opaque credentials.
- Guests can inspect public seat occupancy, choose an available seat, and join.
- Room codes, join links, and QR sharing are present.
- The host can start only after all required seats are occupied; the server independently enforces the rule.
- Premature draws and raw lifecycle bypasses are blocked.
- The 52-card deck, shuffle, randomized turn order, one-card draw demo, reveal, winner/tie detection, and replay behavior work.
- Private-state leakage was repaired: clients receive no private deck, players see only their own card before reveal, spectators see public progress only, and the initial SocketIO sync path is explicitly filtered.
- Automated coverage expanded to 11 tests, including authenticated players, spectators, late joins, privacy, start authorization, forged lifecycle actions, reveal, winner, and replay.
- Both server and client production builds pass.
- Development mode, compiled-server startup, and built-client preview were verified.
- The client now has graphical SVG cards and a responsive green-felt presentation.
- A two-browser end-to-end flow was manually verified.

The authoritative current-status record is `ledger.md`; use it instead of treating this file as a live task tracker.

## Remaining Phase 1 work

The current priority order from `ledger.md` is:

1. Add an independently accessible public-table entry point. The table currently appears alongside a joined player's board rather than as a standalone shared-display session.
2. Make round completion / replay permissions consistent and verify turn order after replay.
3. Decide whether Phase 1 requires an explicit initial-deal step distinct from the existing one-card draw action.
4. Expand lifecycle / authorization coverage as needed and validate the complete flow on physical LAN devices and on a hosted server.

Known session limitations include browser-memory-only credentials, no refresh recovery, no host transfer, permissive development CORS, and no hosted deployment hardening yet.

## User-defined games: future direction

The long-term differentiator is allowing users to add their own card games and rules.

Do not implement arbitrary user-supplied JavaScript execution in Phase 1.

Keep game-specific logic modular so multiple games can later conform to a common platform contract. Future approaches may include a constrained rule DSL, declarative rule definitions, templates, or carefully sandboxed extensions, but that design should be based on experience gained from implementing several real games first.

## Development environment

The active local Windows checkout used with the ChatGPT desktop/Astra workflow is:

```text
C:\Users\mdelg\Documents\card-genie
```

Earlier setup work also used Arch Linux under WSL, but do not assume the WSL checkout is the active copy.

From the repository root, the standard workflow is:

```bash
npm install
npm run build:server
npm run build:client
npm test
npm run dev:server
npm run dev:client
```

The server is expected on port 8000 and the Vite client on port 5173 unless the current code says otherwise.

Current README prerequisites require Node.js 20.19+ within major 20, or Node.js 22.12+; the latest verified Astra run used Node.js 24.12.0 and npm 11.6.2.

Keep package dependencies local to the project where practical. Do not rely on global TypeScript or Vite installations for the repository to build.

## Guidance for coding agents

Read, in order:

1. `AGENTS.md` for repository-specific working instructions.
2. `goals.md` for Phase 1 acceptance criteria and architecture constraints.
3. `ledger.md` for current verified progress, limitations, and next priorities.
4. `README.md` for the actual run/build workflow.
5. This file for product history and design rationale.
6. `LOG.md` only when historical context is useful.

Then inspect the relevant code before proposing large changes.

Preserve the Node.js + TypeScript + boardgame.io + React/Vite architecture unless there is a concrete technical reason to change it. Keep game rules separate from transport and presentation, keep private information server-filtered, keep LAN and online gameplay on the same protocol, and avoid premature scaling or the user-defined-rule engine.

When continuing development, start from the current `ledger.md` priorities rather than re-implementing the already completed room, privacy, build, or card-graphics work.
