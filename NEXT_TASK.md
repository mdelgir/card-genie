# Next Task — Phase 2B: Generic Authoritative Runtime

Implement the generic server-side runtime for the **current v0 `GameDefinition` only**. Keep the live boardgame.io Highest Card game unchanged; migration is the next task.

Read `AGENTS.md`, `goals.md`, `ledger.md`, then inspect:
- `games/engine/types.ts`
- `games/engine/validator.ts`
- `games/definitions/highest-card.ts`
- `games/simple-card-game.ts`

## Build

Under `games/engine/`, add the smallest runtime needed to:

- validate a definition before use;
- start a round from a definition, player IDs, and injected deterministic shuffle/randomness;
- create authoritative state: deck, play order/current player, acted status, private hands, lifecycle, reveal, winner;
- expose a **generic action API** for the v0 `draw` action;
- reject invalid/out-of-turn/duplicate actions with a structured result and no state mutation;
- drive `next-player`, `all-players-acted`, `compare-rank`, `highest-wins`, `lowest-wins`, and ties from the definition;
- build new allowlisted player/spectator views: never expose deck identities; before reveal, only the owner sees their hand; after reveal, hands/winner are public;
- start a fresh clean round after the caller authorizes replay.

Prefer pure/deterministic functions. Do not call `Math.random()` inside rule execution.

## Tests

Cover: valid/invalid initialization, player-count limits, deterministic shuffle/order, legal draw, out-of-turn/duplicate rejection without mutation, turn advance, final-round completion, highest/lowest/tie results, owner/other/spectator privacy, and fresh-round reset. Preserve all existing tests.

## Do not

Do not migrate `simple-card-game.ts`, change client/rooms/transport/privacy, add War/Crazy Eights/Game Creator/persistence/AI, expand the DSL beyond a necessary ambiguity fix, upgrade boardgame.io, or work on the TV issue.

## Finish

Run:

```text
npm run build:server
npm run build:client
npm test
```

Update `ledger.md`, commit the work, and stop. Phase 2B is done when the isolated runtime passes these tests and the live game remains unchanged.

Next task: migrate live Highest Card onto the runtime with a thin boardgame.io adapter.
