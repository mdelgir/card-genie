# Next Task — Execute War in Generic Runtime

Extend the **generic runtime only** so `warDefinition` executes. Do not make War playable in the app yet.

Read `AGENTS.md`, `ledger.md`, this file; inspect `runtime.ts`, `types.ts`, `validator.ts`, `definitions/war.ts`, and focused tests only.

## Do

- Preserve Highest Card behavior/API and all existing tests.
- `startRound` with `warDefinition` + 2 seats must shuffle, deal 26 each round-robin, keep pile identities server-only, and leave no undealt deck.
- Extend generic state/view only as needed for piles, pot, public face-up contributions, battle result, and terminal winner/tie.
- `{type:"reveal-top"}` resolves one whole battle atomically: reveal both top cards; higher rank collects the whole ordered pot; ties repeat 3 face-down + 1 face-up until resolved; face-down cards never become public; insufficient-card rules follow the definition; then `all-cards-owned` completes or `next-battle` progresses.
- Keep action authorization deterministic through the existing current-player boundary. If `next-battle` current-player semantics are ambiguous, make the smallest generic schema/comment clarification and test it; no game-name branching.
- Rejected actions must not mutate state.
- Views are allowlisted: public pile/pot counts and face-up contributions only; never pile/deck/pot/face-down identities.
- Keep injected randomness; no `Math.random()`.

## Tests

Cover 26/26 deal + privacy, ordinary battle/collection order, repeated tie, one-side insufficient, both-insufficient tie, terminal all-52 ownership, deterministic progression, rejection non-mutation, spectator/player privacy, and Highest Card regression.

No boardgame.io War registration, UI/client, rooms, persistence, AI, Crazy Eights, dependency upgrades, or TV work.

Run `npm run build:server`, `npm run build:client`, `npm test`; update `ledger.md`, commit, stop.

Next: wire War into the playable app with a thin adapter/UI.