# Next Task — War Schema Extension

Extend `GameDefinition` just enough to describe a deterministic 2-player War game. **Schema + validator + definition only**; do not implement War runtime/UI yet.

Read `AGENTS.md`, `ledger.md`, this file, then inspect only `games/engine/types.ts`, `validator.ts`, current definition/tests.

## War semantics to represent

- standard 52-card deck; shuffle, deal 26 face-down cards to each player;
- each battle reveals the top card from both players;
- higher rank wins the whole battle pot and appends it to the winner's pile;
- tie: each player contributes 3 face-down + 1 face-up, then compare again; repeated ties repeat this;
- if a player cannot supply the required war cards, that player loses;
- game ends when one player owns all cards.

Add only generic reusable primitives needed for those semantics. Do **not** add `gameType: "war"`, callbacks, expressions, or executable hooks. Preserve Highest Card compatibility and validation.

Add `games/definitions/war.ts` plus focused validator/JSON-round-trip tests. Reject contradictory/unsupported War-shaped definitions clearly.

Do not change runtime, live games, client, rooms, transport, boardgame.io, or other backlog items.

Run `npm run build:server`, `npm run build:client`, `npm test`; update `ledger.md`, commit, stop.

Next task: extend the generic runtime to execute this War definition.
