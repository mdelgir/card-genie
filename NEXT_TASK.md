# Next Task — Round Completion and Replay Cleanup

This file is the focused implementation brief for the next Astra/Codex session. `ledger.md` remains the source of truth for verified project status; update it after this task is completed and tested.

## Objective

Finish the next Phase 1 lifecycle gap: make round completion explicit, make replay permissions match the UI, and prove that replay starts a clean new round with a valid fresh turn order and no privacy regression.

Do **not** begin the user-defined rule engine or broaden the game beyond the existing Highest Card demo.

## Current behavior found in the repository

The existing demo already completes a round functionally:

- each player draws one card,
- the final draw sets `G.revealed = true`,
- `G.winner` becomes a player ID or `"tie"`,
- all cards then become public through `playerView`,
- `restartGame` reshuffles a full deck, clears hands/progress, reshuffles `playOrder`, and calls `events.endTurn({ next: G.playOrder[0] })`.

However, the lifecycle is still ambiguous:

1. `revealed` currently doubles as both a presentation flag and the effective "round complete" flag.
2. There is no explicit domain-level round status.
3. `GameBoard` shows a "Play again" button to every player after reveal, while boardgame.io move authorization still depends on the active/current player. This means some users are shown a control they cannot actually use.
4. Replay turn order is implemented but needs explicit regression coverage proving that `ctx.currentPlayer`, `G.playOrder`, legal-move ownership, and fresh private state agree after restart.

The standalone public table is already complete. Preserve it.

## Recommended Phase 1 design

### 1. Add explicit round state

Prefer a small domain-level status instead of using `ctx.gameover` for this Phase 1 demo. A suggested shape is:

```ts
type RoundStatus = "waiting" | "playing" | "complete";
```

or an equally clear equivalent.

Expected semantics:

- initial room: `waiting`
- host start: `playing`
- final draw / winner computed: `complete`
- replay: `playing`

Keep `revealed` only if it remains useful for rendering/privacy, but do not make UI/lifecycle logic depend on an ambiguous proxy when an explicit status can be used.

Do not introduce boardgame.io `endGame` merely to satisfy the phrase "completed round" if doing so complicates in-match replay. The goal is an explicit authoritative round-complete state, not necessarily a terminal match/gameover state.

### 2. Make replay permission intentional and visible

For the smallest Phase 1 fix, use the existing boardgame.io turn authorization rather than inventing a new lifecycle endpoint.

Recommended policy for this demo:

> The player who is still the authoritative current player when the round completes may start the next round.

That is normally the player who made the final draw.

Update the UI so:

- only the player who is actually allowed to replay gets an enabled "Play again" control,
- other players see a clear waiting message such as "Waiting for <name> to start the next round",
- the public table never receives replay controls,
- an unauthorized/non-current player replay attempt is rejected authoritatively even if they forge a move packet.

If repository inspection reveals a clean, small boardgame.io-native way to allow **all seated players** to replay without weakening move authorization or adding brittle lifecycle logic, that is acceptable, but explain the approach before implementing it. Do not bypass boardgame.io authorization just to make the button work for everyone.

### 3. Make replay a clean new round

After an accepted replay, verify all of the following authoritative state:

```text
round status     -> playing
revealed         -> false
winner           -> null
hands            -> all null
hasDrawn         -> all false
deck             -> fresh full 52-card shuffled deck on server
deckCount        -> 52 publicly
playOrder        -> valid permutation of every player ID
ctx.currentPlayer-> playOrder[0]
```

The next legal draw must belong to the new first player. A player who is not the new current player must not be able to draw.

Do not rely only on UI checks; add direct game/network assertions.

### 4. Preserve privacy across round boundaries

Replay must not expose the fresh deck, card order, random-plugin state, or any player's next-round card through:

- current state,
- initial/reconnect snapshots,
- undo/redo history,
- spectator/table synchronization.

Keep the existing `playerView` allowlist and `PrivateStateSocketIO` regression coverage intact.

### 5. Keep round completion deterministic

On the final draw:

- compute winner/tie once,
- transition the explicit round status to complete,
- reveal only because the authoritative round is complete,
- do not advance into a phantom next turn before replay,
- do not allow further draws until replay.

## Likely files

The task is expected to focus on:

```text
games/simple-card-game.ts
games/simple-card-game.test.ts
client/src/GameBoard.tsx
ledger.md
```

`server/src/room-server.ts` should probably not need changes if the recommended current-player replay policy is used.

`server/src/private-state-transport.ts` should not change unless a new failing privacy regression proves a concrete need.

`client/src/App.tsx`, the standalone table URL, room creation/joining, and QR behavior are out of scope unless a lifecycle bug directly requires a minimal correction.

## Required automated coverage

Add or strengthen tests so they prove at least:

1. The game begins with the explicit non-complete round status.
2. Host start moves the round to the active/playing status.
3. The final legal draw sets the explicit complete status and winner/tie.
4. Further draws while complete are rejected.
5. Replay before round completion is rejected.
6. Under the chosen replay policy, an unauthorized player cannot replay.
7. An authorized replay resets all round state.
8. Replay creates a valid full 52-card server deck while every client/table still receives an empty private deck representation.
9. `G.playOrder` after replay is a valid permutation of all seats.
10. `ctx.currentPlayer === G.playOrder[0]` after replay synchronization.
11. Only that new current player can make the first draw of the new round.
12. Player and spectator privacy remain correct before reveal, after reveal, after replay, and on reconnect.

Use the existing real SocketIO test where appropriate instead of relying only on direct move-function tests.

## UI acceptance criteria

After the final draw:

- all players and the table see the same winner/tie result,
- the round is visibly complete,
- only a player who is actually authorized to replay sees an actionable replay control,
- other players see who they are waiting for,
- the table remains view-only.

After replay:

- old cards disappear,
- all public draw slots return to the undrawn state,
- deck count returns to 52,
- the UI identifies the correct new first player,
- no stale winner/reveal state remains.

## Validation commands

Run from the repository root:

```bash
npm run build:server
npm run build:client
npm test
```

GitHub CI now runs the same build/test sequence on pushes and pull requests. Local validation is still required before committing; CI is an independent check, not a substitute.

Then manually verify with at least:

```text
Browser 1: host/player
Browser 2: guest/player
Browser 3: ?table=<matchID>
```

Complete one round, confirm replay permissions, replay, then complete at least the first draw of the new round.

## Scope boundaries

Do not include any of the following in this task:

- explicit initial-deal redesign (that is the next roadmap decision),
- GameDefinition / configurable games,
- generic rule engine,
- War or Crazy Eights,
- account/persistence/session recovery,
- host transfer,
- boardgame.io upgrade,
- hosted deployment work,
- LAN device validation,
- elaborate animations,
- unrelated UI cleanup.

## Completion record

After implementation and validation:

1. update `ledger.md` with exactly what changed and what was verified,
2. record the chosen replay-permission policy,
3. note any remaining limitation,
4. commit the completed work,
5. stop before the initial-deal decision / next roadmap item unless explicitly asked.
