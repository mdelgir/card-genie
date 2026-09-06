# AGENTS.md

## Project

Card Genie is a multiplayer platform for card games based on a standard 52-card deck.

The product goal is to support both:
- online sessions where players connect from separate devices, and
- local/LAN sessions where each player uses their own phone while a tablet or TV acts as a shared public table.

The long-term goal is to support many game types and eventually user-defined game rules. Phase 1 is focused on proving the core multiplayer architecture with a simple card game.

## Read these first

Before making changes, read:

1. `goals.md` — target outcomes and Phase 1 acceptance criteria.
2. `ledger.md` — current verified progress, known limitations, and next priorities. This is the source of truth for what is already done.
3. `README.md` — current install/build/run instructions.
4. `PROJECT_CONTEXT.md` — product history, architecture rationale, and environment context.
5. `LOG.md` — historical development record only.

Do not infer current work from old chat context or older sections of this file when `ledger.md` says otherwise.

## Current stack

- Node.js
- TypeScript
- `boardgame.io` 0.50.2
- React + TypeScript
- Vite
- boardgame.io multiplayer / SocketIO synchronization
- npm workspaces

Repository structure:

```text
card-genie/
├── client/           # React + Vite UI
├── server/           # Node.js + boardgame.io server / transport
├── games/            # Shared / reusable game logic
├── goals.md          # Acceptance criteria and constraints
├── ledger.md         # Current verified progress
├── PROJECT_CONTEXT.md
├── README.md
├── LOG.md
└── package.json
```

Do not replace the current stack or introduce another game/networking framework unless there is a concrete technical reason and the change is explicitly requested.

## Architecture principles

### 1. The server is authoritative

The server owns the canonical game state.

The server must control or validate:
- deck creation,
- shuffling,
- dealing / drawing,
- turn order,
- legal moves,
- score / winner calculation,
- game start,
- game resets,
- state transitions.

Never rely on the client to enforce rules or determine hidden/random game state.

### 2. Private information must stay private

This is a hard requirement.

A player must receive only the private state they are permitted to see. Another player's hand must never be sent to an unauthorized client merely because the UI hides it.

Use boardgame.io player filtering plus the existing transport-level protection where required by the pinned version.

The current implementation has a `PrivateStateSocketIO` guard because boardgame.io 0.50.2 may include an unfiltered historical `initialState` snapshot during synchronization. Do not remove or bypass that protection without proving the replacement is safe. Keep the associated regression tests when changing transport or boardgame.io dependencies.

The shared table / spectator view must receive only public information.

Think in terms of:
- public state,
- player-private state,
- server-only state.

When adding state fields, explicitly decide which category they belong to.

### 3. Game rules must remain modular

Keep game-specific logic separate from platform/infrastructure code.

`games/` should contain reusable game definitions and game-domain logic. Networking/session code belongs in `server/`; presentation belongs in `client/`.

Favor pure or deterministic helper functions for game logic where practical so they are easy to test.

Design new APIs with the assumption that the platform will eventually host multiple very different card games.

Avoid hard-coding assumptions such as:
- exactly two players,
- fixed hand size,
- clockwise turn order,
- one shared pile,
- poker-specific or trick-taking-specific concepts,
unless those assumptions live inside a specific game's implementation.

### 4. Player view and table view are distinct roles

The same session may have several player devices plus one shared display.

Player mode should be optimized for:
- private hand visibility,
- player-specific controls,
- legal actions,
- compact phone layouts.

Table mode should be optimized for:
- public shared state,
- large-screen readability,
- scores / turn indicators,
- cards or piles visible to everyone,
- no private player controls or hidden cards.

Do not make the table a normal player seat unless there is a strong reason. Prefer an observer/spectator role.

### 5. Online and LAN play use the same core protocol

Avoid separate gameplay implementations for cloud and local play.

The same game server/client protocol should work whether the server is reached through:
- an internet hostname, or
- a LAN address such as `192.168.x.x`.

Keep server addresses and origins configurable. Do not hard-code `localhost` into game logic.

### 6. Keep Phase 1 small

Do not prematurely add:
- user-generated JavaScript execution,
- a full rule DSL,
- matchmaking,
- general account/auth systems,
- payments,
- chat,
- microservices,
- Redis / distributed state,
- native mobile apps,
- elaborate animation systems.

Those are later-phase concerns.

## Current verified Phase 1 functionality

As of the 2026-09-06 Astra checkpoint, the repository has verified work for:
- room creation with host-seat reservation and credentials,
- public seat occupancy and guest seat selection,
- host-only start after all seats are filled,
- room codes, join links, and QR sharing,
- a standard shuffled 52-card deck,
- randomized turn order,
- turn-based one-card draw demo,
- winner/tie detection and replay behavior,
- server-side blocking of premature and forged lifecycle actions,
- per-player private-state filtering,
- spectator / late-join privacy,
- transport-level filtering of boardgame.io initial synchronization state,
- React player/table presentation,
- graphical SVG card faces and backs,
- responsive green-felt UI,
- eleven automated tests,
- passing server and client production builds,
- successful local two-browser end-to-end verification.

Do not duplicate or rewrite these features merely because an older prompt describes them as missing. Verify `ledger.md` and the code first.

## Phase 1 target experience

The minimum complete vertical slice is:

```text
Create room
  -> Join room from multiple devices
  -> Assign player seats
  -> Open a standalone shared table view
  -> Start game
  -> Shuffle a standard 52-card deck
  -> Deal / draw cards according to the demo game
  -> Show each player only their own private cards
  -> Show public state on the table
  -> Allow a legal player action
  -> Synchronize the result to all connected devices
  -> Finish the round explicitly and identify winner/tie
  -> Replay/reset with consistent permissions
```

This flow should work both on one computer with multiple browser windows and across physical devices on the same LAN; hosted end-to-end validation is also part of Phase 1 acceptance.

## Current near-term priorities

Unless explicitly instructed otherwise, follow the priorities in `ledger.md`. At the current checkpoint they are:

1. Add an independently accessible public-table entry point.
2. Make round completion / replay permissions consistent and verify turn order on replay.
3. Decide whether Phase 1 needs an explicit initial-deal step distinct from the existing draw action.
4. Expand lifecycle/authorization tests where needed and validate the complete flow on physical LAN devices and a hosted server.

Do not start the user-defined rule engine yet.

## Development workflow

From the repository root:

```bash
npm install
npm run build:server
npm run build:client
npm test
```

Development servers:

```bash
npm run dev:server
npm run dev:client
```

Before considering a task complete, run the relevant build and tests. If a change affects both client and server, run both builds.

## Coding conventions

- Use TypeScript for new application code.
- Keep strict typing where practical; avoid `any` merely to bypass compiler errors.
- Prefer small modules and clear domain types.
- Reuse card/game types instead of redefining slightly different versions in multiple layers.
- Keep UI components focused on presentation and interaction; keep game rules out of React components.
- Keep network/session concerns out of reusable game-domain helpers.
- Validate untrusted client input on the server.
- Preserve compatibility with the pinned boardgame.io version unless deliberately upgrading it.
- Avoid adding dependencies when a small amount of straightforward code is enough.

## Card representation

Use an explicit card model rather than opaque numeric IDs when practical. A card should conceptually contain a rank and suit, for example:

```ts
type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

type Card = {
  suit: Suit;
  rank: Rank;
};
```

If the existing implementation uses another representation, do not perform a gratuitous rewrite. Migrate only when it improves a feature or fixes a concrete problem.

## Graphics and animation

Card graphics and animation belong in the client presentation layer.

The current client already has reusable SVG card rendering. Future animation should react to authoritative state changes and may cover deal, flip, play, collect, reveal, or winner emphasis.

Do not make animation timing authoritative for gameplay. Respect reduced-motion preferences.

## Testing priorities

Add or extend tests for game/domain behavior when modifying rules.

High-priority invariants include:
- a deck contains exactly 52 unique cards,
- shuffle/deal/draw cannot duplicate cards,
- cards do not disappear unexpectedly,
- illegal/out-of-turn moves are rejected,
- hidden cards are absent from unauthorized payloads,
- initial sync / reconnect / late spectator state does not leak secrets,
- table/spectator views never contain private hands,
- game end/winner logic is deterministic from state,
- replay/reset produces a valid fresh round,
- lifecycle endpoints require the correct authority/credentials.

For multiplayer changes, manually test with at least two separate browser contexts or devices when possible.

## LAN testing

When working on LAN support, verify:
- server listens on an address reachable from the LAN,
- Vite dev server is exposed to the LAN when needed,
- frontend does not assume `localhost` means the game server,
- WebSocket connections use the configured host,
- CORS/origin rules are appropriate for development,
- two phones plus a standalone table/browser can join the same room.

Do not weaken production security merely to make LAN development convenient.

## Change discipline for coding agents

When asked to implement a task:

1. Inspect the relevant existing files first.
2. Read `ledger.md` before deciding something is missing.
3. Explain briefly what you found if the task is non-trivial.
4. Make the smallest coherent change that completes the requested slice.
5. Preserve existing working behavior unless the task explicitly changes it.
6. Add/update tests for rule, authorization, transport, or state changes.
7. Run tests and builds.
8. Update `ledger.md` after meaningful verified work.
9. Report exactly what changed, what was tested, and any remaining limitations.

Do not perform broad refactors unrelated to the requested task.
