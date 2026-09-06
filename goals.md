# Card Genie goals

This file records intended outcomes and engineering constraints. See [ledger.md](ledger.md) for verified progress and remaining work. Update the ledger after meaningful changes; change goals when project scope changes.

## Product

Build a multiplayer platform for games using a standard 52-card deck. Support both online sessions through a hosted game server and local/LAN sessions through the same server architecture on a local IP, without requiring an external boardgame.io service.

The long-term product direction is to let users create and share new card games by describing player counts, setup/deal behavior, legal actions, visibility, round structure, scoring, and win conditions while Card Genie provides the multiplayer runtime, privacy boundaries, synchronization, and presentation.

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

## Phase 1 closeout plan

Before beginning the generalized game-definition system, close the remaining Phase 1 gaps:

1. **Standalone public table entry**
   - A TV/tablet/browser can join an existing room as a spectator/public table.
   - The table does not consume a player seat.
   - It receives public state only and no private hand data.

2. **Round completion and replay cleanup**
   - Use an explicit completed-round state.
   - Make replay permissions consistent and intentional.
   - Start a replay with fresh shuffled/private state.
   - Verify turn order and lifecycle state after replay.

3. **Deal semantics**
   - Decide whether Highest Card should automatically deal at round start or intentionally retain the explicit draw action.
   - Make that behavior an explicit game rule rather than an accidental property of the demo.

4. **Real-device validation**
   - Run the server on the development PC.
   - Connect at least two player phones and a separate table device over LAN.
   - Complete a full game and replay.
   - Validate the equivalent hosted flow before declaring Phase 1 complete.

## Engineering constraints

- Keep Node.js, TypeScript, boardgame.io/WebSockets, React, and Vite.
- Keep reusable game rules in `/games`, transport/server concerns in `/server`, and presentation in `/client`.
- Server authority covers deck creation, shuffle, dealing, legal moves, turn progression, win conditions, and public/private visibility.
- Never trust client state for authoritative decisions. Use boardgame.io mechanisms instead of rebuilding synchronization.
- Private data must be absent from network payloads, including initial snapshots, reconnects, history, and spectator state; hiding UI elements is insufficient.
- Add tests for game rules and privacy-sensitive behavior, and keep installation, builds, and tests reproducible.
- Preserve the existing implementation and keep modules simple enough for a solo developer.
- Use React card/zone components that can later support dealing, flips, movement, reveals, and winning-card emphasis. Elaborate animation is outside Phase 1.
- Do not execute arbitrary user-supplied JavaScript as game rules.
- Keep the same core runtime for LAN and hosted play.

## Phase 2 roadmap — user-defined games

Phase 2 begins only after the Phase 1 closeout above is complete. The goal is to let users define new games through a constrained, validated rule model rather than arbitrary executable code.

### Phase 2A — GameDefinition v0

Create a small, versioned TypeScript schema that represents a configurable card game. Every persisted definition must include a schema version from the beginning, for example:

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

Keep v0 intentionally limited. Initial primitives should cover a useful subset such as:

- shuffle,
- deal,
- draw,
- play-card,
- discard,
- reveal,
- next-player,
- compare-rank,
- highest-wins,
- lowest-wins,
- all-players-acted,
- score-points.

Definitions must be validated before a session can start. Unsupported or contradictory rule combinations should fail clearly rather than fall through to undefined behavior.

### Phase 2B — Generic authoritative runtime

Create a generic engine under `/games/engine` that interprets validated `GameDefinition` data and runs it through the existing boardgame.io server-authoritative architecture.

Suggested shape:

```text
games/
  engine/
    types.ts
    validator.ts
    runtime.ts
    visibility.ts
    conditions.ts
    actions.ts
```

Core principle:

> The definition describes the game; the server runtime decides what is legal and authoritative.

Clients may render available actions, but they must not independently decide legality, hidden information, outcomes, or canonical state transitions.

### Phase 2C — Prove the abstraction with real games

Before building a public game-creator UI, prove the engine with multiple games that stress different mechanics.

1. **Highest Card**
   - Migrate the existing demo to the new definition/runtime model.
   - Use it as the compatibility baseline.

2. **War**
   - Exercise repeated rounds, comparisons, piles, ties, and continuing play.

3. **Crazy Eights**
   - Exercise persistent hands, conditional legal-card rules, draw/play choices, changing public state, and a nontrivial win condition.

If these games require repeated one-off exceptions in the generic engine, revise the model before exposing it to users.

### Phase 2D — Game Creator UI

Once the schema/runtime is stable, build a guided creator rather than requiring users to edit JSON directly.

The flow should conceptually cover:

```text
Game name
  -> player count
  -> starting deal
  -> turn actions
  -> legal-card conditions
  -> public/private visibility
  -> round-end condition
  -> winner/scoring
  -> preview
  -> validate
  -> test game
```

The editor produces the same validated `GameDefinition` consumed by the runtime. The UI is an authoring layer, not a separate rules engine.

### Phase 2E — Save, share, and AI-assisted rule creation

After the deterministic creator/runtime works:

- persist game definitions,
- load and select custom games,
- share definitions between users/sessions,
- add schema migration support as the rule format evolves,
- optionally let users describe a game in natural language and have AI propose a `GameDefinition`.

The AI-assisted path must remain:

```text
Natural-language rules
  -> AI proposes GameDefinition
  -> validator
  -> deterministic authoritative runtime
```

Do not use:

```text
Natural-language rules
  -> AI generates arbitrary server code
  -> execute that code
```

AI output should be reviewable, validated, and rejected when it cannot be represented safely by the supported rule vocabulary.

## Phase 2 success criteria

Phase 2 is successful when:

1. A versioned `GameDefinition` schema exists and is validated.
2. The generic runtime executes definitions authoritatively without client-side rule trust.
3. Highest Card, War, and Crazy Eights can run through the same engine without game-specific transport or UI architecture forks.
4. Privacy rules remain enforced for configurable games.
5. Users can create a supported game through a guided UI without writing code.
6. Saved definitions can be loaded and played across the same online/LAN session model.
7. Natural-language assistance, if introduced, produces validated definitions rather than executable code.

## Later direction

After several hand-written and configurable games prove the shared abstractions, expand the rule vocabulary gradually. Potential later areas include richer scoring, teams, bidding, trick-taking, multi-round matches, custom zones/piles, and more expressive conditions.

Do not broaden the DSL or runtime speculatively. Add primitives in response to concrete games and keep compatibility through explicit schema versioning and migrations.
