# Next Task — Standalone Public Table

This file is a focused implementation brief for the next Astra/Codex session. `ledger.md` remains the source of truth for verified project status; update it after this task is completed and tested.

## Objective

Finish the next Phase 1 gap by making the existing spectator/table capability independently accessible from a browser, tablet, or TV without occupying a player seat.

The public table must observe the same boardgame.io match as the players and receive public state only.

## Important finding from repository inspection

Most of the table functionality already exists. Do **not** redesign the server or game model unless testing proves it is necessary.

Current behavior in `client/src/App.tsx` mounts two `GameClient` instances after a player joins:

```tsx
<GameClient
  playerID={playerID}
  matchID={matchID}
  credentials={playerCredentials ?? undefined}
/>

<GameClient matchID={matchID} />
```

The second client is already a credential-less spectator/table client.

`client/src/GameBoard.tsx` already detects table mode with:

```ts
const isTable = !playerID;
```

and already:

- hides the private hand,
- hides player action buttons,
- renders the shared/public table presentation,
- shows public card slots,
- shows turn/reveal/winner status,
- reuses the existing SVG cards and felt styling.

The server/game privacy path is also already in place:

- `SimpleCardGame.playerView` masks all private hands for spectators before reveal.
- `PrivateStateSocketIO` strips the unsafe historical `initialState`, random-plugin state, undo/redo history, and other private sync data.
- Existing SocketIO tests already cover credential-less spectators and a late-joining spectator after a player has drawn.

Because of this, this task should primarily be a client-entry / presentation change, not a server redesign.

## Recommended implementation

### 1. Add an independent table URL

Use a query-parameter entry point for the Phase 1 MVP:

```text
/?table=<matchID>
```

Example:

```text
http://192.168.1.25:5173/?table=abc123
```

Prefer this over introducing React Router or a `/table/<id>` route right now because:

- the client currently has no routing dependency,
- static hosting does not need SPA rewrite rules for a query-param URL,
- it is the smallest change that proves the table-device use case.

A future routing cleanup can replace this later if needed.

### 2. Render only the spectator client in table mode

When `?table=<matchID>` is present:

- do not show the create/join-player form,
- do not request a player name,
- do not request/select a seat,
- do not create player credentials,
- do not occupy a seat,
- mount only:

```tsx
<GameClient matchID={matchID} />
```

This should connect to the same boardgame.io match as the players with `playerID` undefined.

### 3. Stop mounting a table inside every player browser

After this feature exists, the normal joined-player page should render only the authenticated player `GameClient`.

Remove the extra credential-less spectator `GameClient` that is currently mounted beneath/alongside every joined player.

Target architecture:

```text
Phone A
  -> authenticated player GameClient

Phone B
  -> authenticated player GameClient

TV / tablet
  -> credential-less spectator GameClient

All three
  -> same match / same authoritative server state
```

### 4. Add an "Open public table" link

Near the existing room/join sharing controls, expose a table link such as:

```text
Join players:  /?room=<matchID>
Public table:  /?table=<matchID>
```

The table link should be easy to copy/open on a separate browser or shared display.

Do not replace the existing player join link or QR behavior unless necessary.

### 5. Handle invalid table room IDs cleanly

Reuse existing lobby metadata / `useRoomSeats` behavior where practical so a bad or missing room ID produces a useful error instead of leaving a spectator client in an indefinite loading state.

Do not require credentials for room existence checks.

### 6. Make standalone table layout full-width

The current `main` layout is optimized for two columns because the player and table boards were previously rendered together.

In standalone table mode, make the table use the available page width and remain suitable for a tablet/TV display.

Keep the existing graphical card components and green-felt styling. Avoid unrelated visual redesign.

## Expected files

The smallest implementation is expected to touch approximately:

```text
client/src/App.tsx
client/src/index.css
games/simple-card-game.test.ts   # small explicit spectator/seat assertion only if useful
ledger.md
```

Likely **no changes** should be needed in:

```text
client/src/GameBoard.tsx
client/src/WaitingRoom.tsx
server/src/room-server.ts
server/src/private-state-transport.ts
games/simple-card-game.ts
```

If one of those files must change, explain the concrete reason before broadening the implementation.

## Privacy and authority requirements

Do not weaken any existing privacy protection.

The standalone table must:

- have no `playerID`,
- have no player credentials,
- never receive another player's private hand before reveal,
- never receive the authoritative deck,
- never receive private historical initial state,
- never receive random-plugin / PRNG state,
- never gain access to player moves or host-only lifecycle controls.

Do not implement privacy by hiding UI elements alone. Preserve the existing server filtering and transport guard.

## Seat / lifecycle requirements

Opening one or more public-table clients must not:

- occupy a player seat,
- change room metadata seat occupancy,
- affect the host's "all seats filled" start requirement,
- create credentials,
- make the table eligible to start/replay/draw as a player.

Add an explicit test assertion for spectator seat neutrality if the current suite does not already prove this directly.

## Acceptance criteria

The task is complete when all of the following are verified:

1. Host creates a room normally.
2. Guest joins a normal player seat.
3. A separate browser opens `/?table=<matchID>`.
4. The table occupies no player seat.
5. The table can be opened before the game starts and displays the waiting state.
6. The host can start once actual player seats are filled.
7. The table updates live as players draw.
8. Before reveal, the table sees only public draw status / face-down cards and no private rank/suit data.
9. After reveal, the table shows the public cards and winner/tie.
10. Player browsers no longer automatically render an embedded second table board.
11. Existing room creation/joining, QR sharing, privacy, and player gameplay still work.
12. Both production builds pass.
13. All automated tests pass.

## Validation commands

Run from the repository root:

```bash
npm run build:server
npm run build:client
npm test
```

Then manually verify with at least three browser contexts if possible:

```text
Browser 1: host/player
Browser 2: guest/player
Browser 3: ?table=<matchID>
```

If the environment permits, also verify the table URL from a second physical device over LAN.

## Scope boundaries

Do not begin any of the following as part of this task:

- GameDefinition / user-defined rules,
- generic rule engine,
- account system,
- persistence/session recovery,
- host transfer,
- deployment hardening,
- elaborate animations,
- React Router migration,
- boardgame.io upgrade.

Keep this task narrowly focused on turning the already-existing spectator board into an independently accessible shared table.

## Completion record

After implementation and validation:

1. update `ledger.md` with what changed and what was actually verified,
2. note any remaining limitations,
3. commit the completed task,
4. do not move on to round/replay cleanup in the same task unless explicitly asked.
