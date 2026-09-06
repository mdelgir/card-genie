# Project Context

## Product vision

Card Genie is a multiplayer platform for games played with a standard 52-card deck.

The long-term goal is to let users add their own games by defining the number of players and the game rules, while the platform handles multiplayer state, card visibility, turns, and presentation.

A core use case is an in-person game night:

- Each player uses their own phone as a private hand/controller.
- A nearby TV or tablet can act as the shared table.
- The same system should also support fully online play.

The product should eventually support web, mobile, tablet, and TV form factors.

## MVP / Phase 1 scope

The current focus is a small but complete vertical slice rather than a generalized user-programmable rule system.

Phase 1 should prove that the architecture can support:

1. Create a room.
2. Join the room from multiple devices.
3. Assign player seats / identities.
4. Start a game.
5. Create and shuffle a standard 52-card deck.
6. Deal private cards to players.
7. Show public game state on a shared table view.
8. Allow at least one simple game move.
9. Synchronize state in real time across all connected devices.
10. Complete a simple demo game end-to-end.

User-defined game rules are a later phase and should not drive unnecessary complexity into the Phase 1 implementation.

## Chosen technology stack

The chosen stack is:

- TypeScript throughout.
- Node.js backend.
- `boardgame.io` for game state, moves, turn flow, multiplayer synchronization, and player-specific state filtering.
- WebSocket-based real-time multiplayer through boardgame.io's multiplayer transport.
- React + TypeScript + Vite for the frontend.
- Monorepo layout with shared game definitions.

Current repository layout:

- `client/` — React + Vite frontend.
- `server/` — Node.js + boardgame.io backend.
- `games/` — shared / modular game logic.

The repository currently pins `boardgame.io` to 0.50.2. Do not casually upgrade it during Phase 1.

## Why this stack was chosen

The project is being developed solo, so minimizing duplicated platform-specific work matters.

A browser-first client gives immediate coverage for phones, tablets, desktops, and many TV/browser scenarios. Native wrappers or dedicated mobile / TV apps can be considered later if necessary.

Using TypeScript on both client and server also reduces context switching and makes it easier to share types and game models.

`boardgame.io` is a library, not an external hosted service. It runs as part of this application's server and client code. The platform therefore does not depend on a third-party boardgame.io cloud service to host a session.

## Online and local-network sessions

The architecture should support both internet-hosted and LAN-hosted sessions.

For a local-network session, one machine can run the Node.js / boardgame.io server and frontend. Other phones, tablets, or a TV browser on the same network connect to that machine using its LAN IP address.

This means a local session can work without an external game backend, provided the devices can reach the host machine over the network.

The same game rules and synchronization model should be used for LAN and internet play. Avoid creating separate gameplay implementations for those modes.

## Authoritative state and privacy

The server is authoritative.

Critical game logic must execute on the server side, including:

- shuffling,
- dealing,
- validating moves,
- advancing turns,
- determining results.

Do not trust a client to decide game outcomes or manipulate canonical game state.

Card visibility is a core architectural requirement, not just a UI detail.

Each player should receive only information they are allowed to know. A player may see their own private hand and public table state, but should not receive another player's private cards.

The table / spectator view should receive public state only and must never expose private hands.

Use boardgame.io player-specific state filtering (`playerView` or equivalent supported mechanism) rather than merely hiding secret information with CSS or client-side rendering.

## Player view vs table view

The application should support at least two presentation roles:

### Player view

Intended mainly for a phone or personal device.

It can show:

- that player's private hand,
- legal actions,
- turn / status information,
- public game state as useful.

### Table view

Intended for a TV, tablet, laptop, or other shared display.

It should show:

- cards / objects visible to everyone,
- turn information,
- player names / seats,
- scores or round state,
- other public game information.

It must not display any player's private hand.

The underlying game state should be shared; these are different views of the same session, not separate games.

## Graphics and animation expectations

Cards are expected to have real visual representations rather than remain text-only.

The React frontend can use SVG or image-based card assets. Later polish may include animations such as:

- dealing cards,
- card flips,
- moving a card from a hand to the table,
- collecting tricks / piles,
- highlighting the active player,
- win / round-complete feedback.

Animations are a frontend concern and should not alter or duplicate authoritative game logic. The client should animate transitions in response to state changes from the server.

A React animation library may be introduced when useful, but Phase 1 should prioritize a reliable multiplayer flow before visual polish.

## User-defined games: future direction

The long-term differentiator is allowing users to add their own card games and rules.

Do not implement arbitrary user-supplied JavaScript execution in Phase 1.

For now, keep game-specific logic modular so multiple games can later conform to a common platform contract. Future approaches may include a constrained rule DSL, declarative rule definitions, templates, or carefully sandboxed extensions, but that design should be based on experience gained from implementing several real games first.

## Repository history and current state

The repository was scaffolded as a TypeScript monorepo using Node.js, React + Vite, and boardgame.io.

The current codebase already contains more than an empty scaffold. According to the repository progress log, it includes work for:

- a 52-card demo game,
- shuffled deck handling,
- per-player hands,
- hidden / masked hand state,
- a boardgame.io server,
- React player and table views,
- lobby-based create / join flow,
- player names and credentials,
- room codes,
- randomized turn order,
- a turn-based draw flow,
- winner detection,
- a play-again / reset flow,
- basic tests.

Before changing architecture, inspect the repository and verify which of these features are currently functional.

## Development environment

Development has been set up on Arch Linux running under WSL.

Typical root-level commands are:

```bash
npm install
npm run dev:server
npm run dev:client
npm test
```

The development server is expected on port 8000 and the Vite client on port 5173 unless the current code says otherwise.

Keep package dependencies local to the project where practical. Do not rely on global TypeScript or Vite installations for the repository to build.

## Guidance for coding agents

Read `AGENTS.md` first for repository-specific working instructions.

Then inspect the code before proposing large changes. Prefer the smallest complete vertical slice that moves Phase 1 forward.

In particular:

- preserve the Node.js + TypeScript + boardgame.io + React/Vite architecture unless there is a concrete technical reason to change it,
- keep game-specific rules separate from transport and presentation,
- keep private information server-filtered,
- keep LAN and online gameplay on the same core architecture,
- add tests for game logic and visibility boundaries,
- avoid premature scaling infrastructure,
- avoid building the user-defined rule engine until the basic multiplayer experience is solid.

## Immediate handoff goal

When continuing development in ChatGPT Astra / Codex or another coding agent, begin by reading `AGENTS.md`, this file, `README.md`, and `LOG.md`, then run the existing build / tests and inspect the current Phase 1 implementation.

The first task should be to identify the smallest missing piece required to make this entire experience work reliably:

`Create room -> join from multiple devices -> assign players -> start -> shuffle/deal -> private hands -> public table -> perform move -> synchronized result`

Do not assume the progress log is proof that every feature currently works; verify the implementation and tests first.
