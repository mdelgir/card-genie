# Card Genie goals

This file records intended outcomes and engineering constraints. See [ledger.md](ledger.md) for verified progress and remaining work. Update the ledger after meaningful changes; change goals when project scope changes.

## Product

Build a multiplayer platform for games using a standard 52-card deck. Support both online sessions through a hosted game server and local/LAN sessions through the same server architecture on a local IP, without requiring an external boardgame.io service.

## Device roles

- Player: own private hand, public table state, turn/action controls, and player-specific information.
- Table: public shared state only, suitable for a tablet, laptop, or TV, with no private hands before an explicit public reveal.
- Each player can use their own phone, including when everyone is in the same room.

## Phase 1 acceptance criteria

Deliver the smallest complete vertical slice:

1. Create a room.
2. Join it and assign player seats.
3. Start the game through an authoritative session lifecycle.
4. Create and shuffle a standard 52-card deck on the server.
5. Deal cards according to the demo's rules.
6. Show each player only their own private cards.
7. Show public shared state on an independently accessible table view.
8. Accept at least one legal player action and reject illegal actions authoritatively.
9. Synchronize accepted actions across connected devices.
10. Reach a deterministic winner/tie and explicit completed-round state.
11. Allow replay/reset with consistent permissions and fresh private state.
12. Verify this flow on player devices and a shared table, including LAN and hosted configurations.

The existing highest-card demo is the foundation. Avoid expanding game rules before this slice is complete.

## Engineering constraints

- Keep Node.js, TypeScript, boardgame.io/WebSockets, React, and Vite.
- Keep reusable game rules in `/games`, transport/server concerns in `/server`, and presentation in `/client`.
- Server authority covers deck creation, shuffle, dealing, legal moves, turn progression, win conditions, and public/private visibility.
- Never trust client state for authoritative decisions. Use boardgame.io mechanisms instead of rebuilding synchronization.
- Private data must be absent from network payloads, including initial snapshots, reconnects, history, and spectator state; hiding UI elements is insufficient.
- Add tests for game rules and privacy-sensitive behavior, and keep installation, builds, and tests reproducible.
- Preserve the existing implementation and keep modules simple enough for a solo developer.
- Use React card/zone components that can later support dealing, flips, movement, reveals, and winning-card emphasis. Elaborate animation is outside Phase 1.

## Later direction (not Phase 1)

Allow users to define games through player counts, setup/deal rules, turn sequences, legal actions, public/private zones, and win conditions. Keep current boundaries compatible with this direction, but do not implement a user-defined rule engine yet.
