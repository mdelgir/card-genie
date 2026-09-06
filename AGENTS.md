# AGENTS.md

## Project

Card Genie is a multiplayer platform for card games based on a standard 52-card deck.

The product goal is to support both:
- online sessions where players connect from separate devices, and
- local/LAN sessions where each player uses their own phone while a tablet or TV acts as a shared public table.

The long-term goal is to support many game types and eventually user-defined game rules. Phase 1 is focused on proving the core multiplayer architecture with a simple card game.

## Current stack

- Node.js
- TypeScript
- `boardgame.io` 0.50.2
- React + TypeScript
- Vite
- boardgame.io multiplayer transport / WebSocket synchronization
- npm workspaces

Repository structure:

```text
card-genie/
├── client/   # React + Vite UI
├── server/   # Node.js + boardgame.io server
├── games/    # Shared / reusable game logic
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
- dealing,
- turn order,
- legal moves,
- score / winner calculation,
- game resets,
- state transitions.

Never rely on the client to enforce rules or determine hidden/random game state.

### 2. Private information must stay private

This is a hard requirement.

A player must receive only the private state they are permitted to see. Another player's hand must never be sent to an unauthorized client merely because the UI hides it.

Use boardgame.io mechanisms such as `playerView` or equivalent server-side filtering for hidden information.

The shared table / spectator view must receive only public information.

Think in terms of these visibility categories:
- public state: safe for all players and the shared table,
- player-private state: visible only to one player,
- server-only state: information that clients should not receive at all.

When adding state fields, explicitly decide which category they belong to.

### 3. Game rules must remain modular

Keep game-specific logic separate from platform/infrastructure code.

`games/` should contain reusable game definitions and game-domain logic. The networking layer and React UI should not contain game rules that belong in a game module.

Favor pure or deterministic helper functions for game logic where practical so they are easy to test.

Design new APIs with the assumption that the platform will eventually host multiple very different card games.

Avoid hard-coding assumptions such as:
- exactly two players,
- a fixed hand size,
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

Do not make the table a normal player seat unless there is a strong reason. Prefer an observer/spectator-style role.

### 5. Online and LAN play should use the same core protocol

Avoid creating two separate gameplay implementations for cloud and local play.

The same game server/client protocol should work whether the server is reached through:
- an internet hostname, or
- a LAN address such as `192.168.x.x`.

Keep server addresses and origins configurable. Do not hard-code `localhost` into game logic.

For LAN development, the client/server may need to bind to a non-loopback interface so phones and tablets on the same network can connect.

### 6. Keep Phase 1 small

Do not prematurely add:
- user-generated JavaScript execution,
- a full rule DSL,
- matchmaking,
- accounts/authentication systems,
- payments,
- chat,
- databases unless persistence becomes necessary,
- microservices,
- Redis / distributed state,
- native mobile apps,
- elaborate animation systems.

Those are later-phase concerns.

## Existing Phase 1 functionality

The current scaffold already includes work toward:
- a standard shuffled 52-card deck,
- per-player hands,
- winner detection,
- masked/private hand views,
- a boardgame.io server on port 8000,
- React + Vite client integration,
- player and table views,
- Lobby-based room creation/joining,
- player names and credentials,
- randomized turn order,
- turn-based draw flow,
- status messaging,
- play-again/reset behavior,
- basic server-side game tests.

Before implementing a feature, inspect the repository to avoid duplicating functionality that already exists.

## Phase 1 target experience

The minimum complete vertical slice is:

```text
Create room
  -> Join room from multiple devices
  -> Assign player seats
  -> Open an optional shared table view
  -> Start game
  -> Shuffle a standard 52-card deck
  -> Deal / draw cards according to the demo game
  -> Show each player only their own private cards
  -> Show public state on the table
  -> Allow one legal player action
  -> Synchronize the result to all connected devices
  -> Finish the game and identify the winner
  -> Allow another round / reset
```

This flow should work both on one computer with multiple browser windows and across devices on the same LAN.

## Development workflow

From the repository root:

```bash
npm install
```

Run the backend:

```bash
npm run dev:server
```

Run the frontend in another terminal:

```bash
npm run dev:client
```

Build checks:

```bash
npm run build:server
npm run build:client
```

Tests:

```bash
npm test
```

Before considering a task complete, run the relevant build and tests. If a change affects both client and server, run both builds.

## Coding conventions

- Use TypeScript for new application code.
- Keep strict typing where practical; avoid introducing `any` merely to bypass compiler errors.
- Prefer small modules and clear domain types.
- Reuse card/game types instead of redefining slightly different versions in multiple layers.
- Keep UI components focused on presentation and interaction; keep game rules out of React components.
- Keep network/session concerns out of reusable game-domain helpers.
- Validate untrusted client input on the server.
- Preserve compatibility with the currently pinned boardgame.io version unless deliberately upgrading it.
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

The game/server state should describe facts such as:
- which card was played,
- where it is,
- whether it is face-up,
- which player owns it,
- what action occurred.

The client can then animate transitions such as deal, flip, play, collect, or reveal without embedding animation concepts in the authoritative game state.

Prefer CSS transforms/transitions or a lightweight React animation library when animations are introduced. Do not make animation timing authoritative for gameplay.

## Testing priorities

Add or extend tests for game/domain behavior when modifying rules.

High-priority invariants include:
- a deck contains exactly 52 unique cards,
- shuffling/dealing cannot duplicate cards,
- cards do not disappear unexpectedly,
- illegal/out-of-turn moves are rejected,
- hidden cards are not exposed through player views,
- table/spectator views never contain private hands,
- game end/winner logic is deterministic from the state,
- reset/play-again produces a valid new round.

For multiplayer changes, also manually test with at least two separate browser contexts or devices.

## LAN testing

When working on LAN support, verify the following:
- server listens on an address reachable from the LAN when needed,
- Vite dev server is exposed to the LAN when needed,
- frontend does not assume `localhost` means the game server,
- WebSocket connections use the configured host,
- CORS/origin rules are appropriate for development,
- two phones plus a table/browser can join the same room.

Do not weaken production security merely to make LAN development convenient. Keep development-only settings clearly scoped.

## Change discipline for coding agents

When asked to implement a task:

1. Inspect the relevant existing files first.
2. Explain briefly what you found if the task is non-trivial.
3. Make the smallest coherent change that completes the requested slice.
4. Preserve existing working behavior unless the task explicitly changes it.
5. Add/update tests for rule or state changes.
6. Run tests and builds.
7. Report exactly what changed, what was tested, and any remaining limitations.

Do not perform broad refactors unrelated to the requested task.

## Near-term priorities

Unless instructed otherwise, prioritize work in roughly this order:

1. Reliable room create/join flow.
2. Correct player-seat/credential handling.
3. Robust private-state filtering.
4. Shared table/spectator role.
5. Stable turn/action synchronization.
6. LAN usability across phones/tablet/TV browser.
7. Responsive player/table UI.
8. Card graphics and simple animations.
9. More reusable game abstractions.
10. Additional games.

The user-defined game/rule system comes after the platform has proven that several hand-written game modules can share the same infrastructure cleanly.
