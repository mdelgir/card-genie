# Next Task — War boardgame.io adapter

Add a **thin War adapter only**. Do not add game selection/UI or register War on the server yet.

Read `AGENTS.md`, `ledger.md`, this file; inspect the runtime, `warDefinition`, and `simple-card-game.ts` only as needed.

## Do

- Add a War boardgame.io `Game` that delegates setup/battles/views to the generic runtime.
- Preserve runtime privacy: piles/pot/face-down cards never leave authoritative state; public snapshots expose only allowed counts, face-up contributions, battle result, lifecycle/winner.
- Keep server-authoritative current-player action and replay/start boundaries; map runtime rejections to `INVALID_MOVE`.
- Avoid duplicating War rules in the adapter.
- Add focused adapter/runtime-equivalence and privacy tests.
- Do not change Highest Card behavior.

No client UI, room game selector, server registration, transport changes, Crazy Eights, persistence, AI, dependency upgrades, or TV work.

Run `npm run build:server`, `npm run build:client`, `npm test`; update `ledger.md`, commit, stop.

Next: register both games and add a minimal room/game selector + War board UI.