# Next Task — Phase 2A: GameDefinition v0

Phase 1 is complete. The next task begins the user-defined game architecture, but **does not** build the user-facing Game Creator and **does not** implement the generic runtime yet.

`ledger.md` remains the source of truth for verified progress. `goals.md` defines the Phase 2 roadmap.

## Objective

Create a small, versioned, data-only TypeScript schema for configurable card games plus a deterministic validator.

The schema should be expressive enough to describe the current Highest Card demo and establish the vocabulary needed for the next runtime task, while staying intentionally narrow.

This phase is about **describing and validating rules**, not executing them.

## Core principles

1. `GameDefinition` must be plain serializable data.
2. Every definition must include `schemaVersion: 1`.
3. Do not allow functions, callbacks, JavaScript source strings, `eval`, dynamic imports, or arbitrary executable code in a definition.
4. Unsupported or contradictory rules must fail validation clearly.
5. Keep the initial vocabulary intentionally small; do not design a speculative universal card-game language.
6. The schema should support future LAN and hosted play through the same authoritative runtime, but this task must not alter transport or boardgame.io behavior.

## Suggested location

Prefer a small engine foundation under:

```text
games/
  engine/
    types.ts
    validator.ts
```

A small definition fixture/example may live alongside the existing game code or under a clearly named definitions directory if that fits the repository better.

Do not add `runtime.ts`, `actions.ts`, `visibility.ts`, or other Phase 2B implementation files unless a tiny shared type is genuinely required for the schema itself.

## Required schema shape

Start from the roadmap shape in `goals.md`:

```ts
type GameDefinition = {
  schemaVersion: 1;
  id: string;
  name: string;
  players: { min: number; max: number };
  setup: SetupDefinition;
  visibility: VisibilityDefinition;
  turn: TurnDefinition;
  roundEnd: ConditionDefinition;
  winner: WinnerDefinition;
};
```

The exact nested representation should use discriminated/tagged unions where useful and remain straightforward to serialize as JSON.

## Initial rule vocabulary

Keep v0 limited to primitives needed for Highest Card plus a sensible small foundation for the next examples. The roadmap currently names primitives such as:

- shuffle
- deal
- draw
- play-card
- discard
- reveal
- next-player
- compare-rank
- highest-wins
- lowest-wins
- all-players-acted
- score-points

Do not force every primitive into production types if it cannot yet be defined cleanly. Prefer a coherent minimal vocabulary over placeholder fields with vague semantics.

At minimum, the schema must be able to represent the current Highest Card behavior conceptually:

- standard 52-card deck,
- 2+ supported players,
- shuffle at round start,
- each player explicitly draws one private card on their legal turn,
- drawn cards remain private until round reveal,
- round ends after every player has acted,
- compare ranks,
- highest rank wins,
- ties are representable,
- replay/next-round behavior is not encoded as executable code.

## Validator requirements

Add a deterministic validator that accepts unknown input and returns a clear result rather than throwing for ordinary malformed definitions.

Prefer a structured result such as:

```ts
{
  ok: false,
  errors: [
    { path: "players.min", code: "invalid-range", message: "..." }
  ]
}
```

Exact naming is flexible, but callers must be able to identify where and why a definition is invalid.

Validation should cover at least:

- unsupported `schemaVersion`,
- missing or invalid `id` / `name`,
- invalid player counts and `min > max`,
- malformed/unknown tagged rule primitives,
- invalid numeric/count fields,
- obviously contradictory Highest-Card-style combinations where the schema makes those contradictions detectable,
- definitions that contain unsupported executable/function values.

Do not attempt deep semantic theorem-proving. Reject what can be checked clearly and leave runtime-dependent legality to Phase 2B.

## Highest Card reference definition

Add one hand-written `GameDefinition` representing the current Highest Card demo as a schema/validator compatibility fixture.

Important:

- It is a **definition fixture/reference**, not a migration of the live game yet.
- The existing `simple-card-game` implementation must continue to run exactly as it does now.
- Do not wire this definition into boardgame.io in this task.

The reference definition should pass the validator and survive a JSON stringify/parse round trip.

## Tests

Add focused unit tests for the schema/validator. Cover at least:

1. the Highest Card reference definition is valid,
2. JSON round-trip remains valid,
3. unsupported schema version is rejected,
4. malformed player ranges are rejected,
5. unknown rule primitive is rejected,
6. malformed primitive fields are rejected,
7. function/executable values are rejected,
8. validation produces useful paths/messages or codes.

Preserve all existing Phase 1 rule/privacy/network tests.

## Scope boundaries

Do **not** in this task:

- build the Game Creator UI,
- build a generic rule runtime,
- migrate the live Highest Card game to the new engine,
- add War or Crazy Eights,
- add persistence/database storage,
- add AI-generated rules,
- change room/session behavior,
- change privacy transport,
- upgrade boardgame.io,
- address the low-priority TV layout issue.

## Before coding

1. Read `AGENTS.md`, `goals.md`, `ledger.md`, `README.md`, and `PROJECT_CONTEXT.md`.
2. Inspect the current `/games` layout and tests.
3. Briefly state the proposed schema shape and files you expect to add/change.
4. Keep the implementation small enough that Phase 2B can evolve it after Highest Card, War, and Crazy Eights expose real requirements.

## Validation

Run:

```text
npm run build:server
npm run build:client
npm test
```

Also verify the Highest Card definition round-trips through JSON and validates successfully.

Update `ledger.md` with exactly what was implemented and verified.

Commit the completed work.

Do not move on to Phase 2B in the same task.

## Pass criteria

Phase 2A is complete when:

1. a versioned `GameDefinition` TypeScript model exists,
2. definitions are plain data and contain no executable rule hooks,
3. malformed/unsupported definitions are rejected with structured validation errors,
4. a hand-written Highest Card definition validates and JSON-round-trips,
5. the current live Highest Card game remains unchanged and all Phase 1 tests still pass,
6. builds/tests pass,
7. `ledger.md` records the result.

After that, the next task will be **Phase 2B — generic authoritative runtime**.
