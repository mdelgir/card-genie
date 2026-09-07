# Next Task — Phase 2C: Migrate Highest Card to the Runtime

Make the live `simple-card-game` use the Phase 2B runtime while preserving current gameplay, UI/wire state, room flow, privacy, and replay behavior.

Read `AGENTS.md`, `ledger.md`, this file, then inspect only the relevant game/runtime/tests. Do not reread broader docs unless blocked.

## Do

- First remove the engine's dependency on `games/simple-card-game.ts`: move `Card`/`Rank`/`Suit` to an engine-owned/shared card module, then have the live game import/re-export as needed.
- Create the runtime from `highestCardDefinition` once at module startup; fail fast if that built-in definition is invalid.
- `startGame` / `restartGame`: use `runtime.startRound(...)`, adapting boardgame.io `random.Shuffle` to the runtime shuffle interface.
- `drawCard`: use `runtime.applyAction(...)`; map rejected actions to `INVALID_MOVE`.
- `playerView`: derive visibility from `runtime.playerView(...)`, preserving the existing client-facing shape unless a tiny compatible change is unavoidable.
- Keep boardgame.io phases/turn context synchronized with runtime `playOrder/currentPlayer`; keep existing host start and replay authorization semantics.
- Remove duplicated Highest-Card rule logic (`createDeck`, winner calculation, etc.) from the live adapter.
- Add focused regression/equivalence tests proving the live game now follows the runtime for setup, draw/turn, winner/tie, replay, and private/spectator views.

## Do not

No client/room/transport redesign, no War/Crazy Eights/Game Creator/persistence/AI, no DSL expansion unless migration exposes a real ambiguity, no boardgame.io upgrade, no TV issue.

## Finish

Run:

```text
npm run build:server
npm run build:client
npm test
```

Update `ledger.md`, commit, and stop. Next task after this is War / the next concrete game used to stress the abstraction.
