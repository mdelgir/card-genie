# Next Task — Phase 2B: Generic Authoritative Runtime

Phase 1 and Phase 2A are complete. The repository now has a versioned, data-only `GameDefinition` schema, a deterministic validator, and a Highest Card reference definition.

This task builds the **generic authoritative runtime for the currently supported v0 vocabulary only**. Do **not** migrate the live Highest Card boardgame.io game yet; that is the next task after the runtime is proven in isolation.

`ledger.md` remains the source of truth for verified progress. `goals.md` defines the Phase 2 roadmap.

## Objective

Implement a small server-side runtime under `games/engine/` that executes a validated `GameDefinition` deterministically and authoritatively.

The runtime should prove that the current Highest Card reference definition is not merely descriptive: the same definition must be sufficient to drive round setup, legal player actions, turn progression, round completion, winner/tie calculation, and public/private views without hard-coding a separate Highest Card rules path.

The runtime is an engine foundation, not a boardgame.io migration in this task.

## Core principles

1. **The definition describes the game; the runtime decides what is legal and authoritative.**
2. The runtime must reject invalid definitions before play begins.
3. The client must not be trusted to decide legality, turn ownership, hidden information, winner state, or canonical transitions.
4. Do not execute callbacks, JavaScript source strings, `eval`, dynamic imports, or user-supplied code.
5. Randomness must be supplied by the authoritative caller through an injectable shuffle/random interface. Do not call `Math.random()` inside rule execution.
6. Keep the runtime limited to the primitives that Phase 2A actually defines. Do not expand the DSL speculatively.
7. Keep the code simple enough that the live boardgame.io game can adopt it in the following task without duplicating rules.

## Current v0 vocabulary

The Phase 2A schema currently supports:

- one standard 52-card deck,
- shuffle at round start,
- 2–8 players,
- random player order,
- one explicit `draw` action per player,
- `next-player` progression,
- owner-only hands before reveal,
- reveal at round end,
- `all-players-acted`,
- rank comparison,
- highest-wins or lowest-wins,
- ace high,
- ties remain ties.

Implement these semantics faithfully. If the runtime exposes a concrete ambiguity in the schema, make only the smallest schema/validator change needed and add tests for it. Do not add deal/play/discard/scoring merely because they appear in the long-term roadmap.

## Suggested shape

Keep the implementation compact. A reasonable shape is:

```text
games/
  engine/
    types.ts          # existing schema/runtime types as needed
    validator.ts      # existing validator
    runtime.ts        # authoritative state + transitions
    runtime.test.ts   # focused runtime tests
```

A small `cards.ts` or `visibility.ts` helper is fine if it materially improves clarity. Do not split the engine into many speculative modules.

## Runtime state

Define a data-only authoritative state sufficient for the current v0 rules. Exact names are flexible, but the runtime needs to represent at least:

- lifecycle: playing / complete,
- authoritative deck contents,
- public deck count,
- player order,
- current player / turn position,
- whether each player has acted,
- private hand/card for each player,
- reveal state,
- winner player ID or tie.

Do not put credentials, sockets, room metadata, or UI state in the game runtime.

## Round creation

Provide a clear entry point that starts a round from:

- a definition (validated at the boundary),
- an explicit list of seated player IDs,
- an authoritative shuffle/random provider.

Requirements:

- player count must satisfy the definition's min/max,
- create exactly one standard 52-card deck for `standard-52`,
- shuffle the deck according to the definition,
- randomize player order according to the definition,
- begin with empty private hands,
- begin with no winner and no public reveal,
- set a valid current player from the authoritative play order.

For deterministic tests, allow a fixed/seeded or explicit shuffle implementation to be injected.

## Player actions

Provide a generic action entry point rather than a `highestCardDraw()` function.

For the current v0 definition, support the `draw` action and enforce all legality server-side:

- only while the round is playing,
- only the authoritative current player may act,
- the action must be permitted by the definition,
- a player may not perform the one-card draw twice,
- the deck must contain the required card,
- the draw count and semantics come from the validated definition,
- accepted actions update only authoritative state,
- rejected actions must not mutate state.

Return a structured accepted/rejected result rather than throwing for ordinary illegal player actions. Include a stable rejection code useful to a future boardgame.io adapter and UI.

## Turn progression and round end

Drive progression from the definition:

- after an accepted non-final action, advance according to `next-player`,
- `all-players-acted` completes the round exactly when every seated player has acted,
- do not advance past the final actor when the round completes,
- mark the round complete and reveal cards at the configured reveal point.

Do not encode room-host or replay authorization here. Session lifecycle permissions remain a server/boardgame.io concern. The runtime may expose a clean way to initialize another fresh round after the caller authorizes replay.

## Winner calculation

Use the definition, not a Highest Card-specific branch name.

Implement:

- `compare-rank`,
- ace high,
- `highest-wins`,
- `lowest-wins`,
- equal best ranks => `tie`,
- suits do not break ties.

Winner calculation should happen only when the configured round-end condition is satisfied.

## Visibility / player views

Add a generic runtime view/filter operation driven by the definition's visibility rules.

For v0:

- deck contents are server-only,
- public viewers receive deck count but never deck card identities,
- before round-end reveal, a player receives only their own hand/card,
- another player's hand is absent or masked,
- a spectator receives no private hand identities,
- after reveal, all hands/cards are public,
- winner and public lifecycle fields are visible.

The view must be a newly constructed allowlisted data object; do not return the authoritative state and rely on callers to hide fields later.

This is a second privacy boundary for the future generic engine. Do not modify or weaken the existing `PrivateStateSocketIO` protection in this task.

## Tests

Add focused runtime tests. At minimum cover:

1. Highest Card reference definition initializes a valid 52-card round for 2 players.
2. Runtime refuses an invalid definition.
3. Player counts below/above the definition range are rejected.
4. Injected deterministic shuffle controls deck and/or turn order reproducibly.
5. Correct current player can draw exactly once.
6. Out-of-turn, duplicate, malformed, or unsupported actions are rejected without state mutation.
7. Turn advances after a legal non-final draw.
8. Final required draw completes the round without advancing past the final actor.
9. Highest-wins produces the correct winner.
10. Equal best ranks produce a tie.
11. Lowest-wins works from the same runtime using only a changed definition.
12. Spectator and other-player views cannot see a private first draw.
13. Owner view can see its own private draw.
14. Completed-round views reveal all cards and winner.
15. Starting a fresh authorized round produces clean hands/winner/reveal state and a full shuffled deck.

Preserve every existing Phase 1 and Phase 2A test.

## Relationship to boardgame.io

Do **not** replace `games/simple-card-game.ts` in this task.

The current live game remains the production compatibility baseline. Phase 2B should make the engine ready so the following task can migrate Highest Card onto it with a thin boardgame.io adapter.

In particular, do not:

- register a second production boardgame.io game,
- change room creation or hosted/LAN routing,
- change move packet authorization,
- change replay permissions,
- change `PrivateStateSocketIO`,
- change the current client action UI.

## Scope boundaries

Do **not** in this task:

- migrate the live Highest Card game,
- build War or Crazy Eights,
- build the Game Creator UI,
- add persistence/database storage,
- add AI-generated rules,
- add arbitrary expression evaluation,
- upgrade boardgame.io,
- redesign room/session behavior,
- address the low-priority TV layout issue.

## Before coding

1. Read `AGENTS.md`, `goals.md`, `ledger.md`, `README.md`, `PROJECT_CONTEXT.md`, and this file.
2. Inspect `games/engine/types.ts`, `games/engine/validator.ts`, `games/definitions/highest-card.ts`, and `games/simple-card-game.ts`.
3. Briefly state the proposed runtime API, authoritative state shape, and files you expect to change.
4. Prefer pure/deterministic transition functions where practical so rule behavior can be tested independently of boardgame.io and networking.

## Validation

Run:

```text
npm run build:server
npm run build:client
npm test
```

Also verify that all pre-existing tests still pass and that the live Highest Card implementation is unchanged.

Update `ledger.md` with exactly what was implemented and verified.

Commit the completed work.

Do not move on to the live Highest Card migration in the same task.

## Pass criteria

Phase 2B is complete when:

1. a validated `GameDefinition` can initialize authoritative runtime state,
2. legal actions are interpreted from the definition rather than a game-specific function,
3. illegal actions are rejected without mutating canonical state,
4. turn progression, round completion, reveal, winner/tie, and fresh-round behavior work for the v0 definition,
5. generic visibility filtering protects private hands and deck contents,
6. highest-wins and lowest-wins are both proven through the same runtime,
7. deterministic injected randomness is tested,
8. the live boardgame.io Highest Card game remains unchanged,
9. all builds/tests pass and `ledger.md` records the result.

After that, the next task is **Phase 2C — migrate the live Highest Card game onto the generic runtime with a thin boardgame.io adapter**.
