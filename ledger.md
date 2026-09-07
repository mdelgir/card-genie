# Card Genie progress ledger

This is the current progress record. [goals.md](goals.md) defines the target outcomes; [LOG.md](LOG.md) preserves earlier development history. Add dated entries after meaningful work, recording changes, validation, limitations, and the next task. Do not mark untested behavior complete.

## Current status

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Room creation and joining | Verified | Creator automatically occupies host seat; joiners select an available seat; names, credentials, room codes, and QR sharing work locally, over LAN, and in the hosted deployment. |
| Waiting room and start | Verified | Host-only start checks occupied seats on the server; no shuffle/draw before start; synchronized transition tested over SocketIO and in real multiplayer runs. |
| Deck and demo rules | Verified | Standard 52-card deck, shuffle, randomized turn order, explicit one-card draw per player, highest-card winner/tie. The explicit draw is intentionally the Phase 1 demo's deal mechanic. |
| Player and spectator privacy | Verified | Private deck excluded; own hand only before reveal; public draw status; initial-sync guard removes historical secrets and random state. Automated SocketIO coverage protects reconnect/spectator paths. |
| Synchronization | Verified | Authenticated SocketIO players, spectator/late join, draw, reveal, winner, and replay covered by automated tests and browser/device validation. |
| Independent table entry | Verified | `/?table=<matchID>` opens a credential-less public table without consuming a seat. Verified in browser and on a TV over LAN. |
| Round completion and replay | Verified | Explicit waiting/playing/complete status; final-draw/current player alone may replay. Fresh deck, cleared private state, and refreshed full turn order verified. |
| Card graphics | Verified visually | All 52 SVG faces, patterned backs, card slots, deck stack, winner emphasis, desktop/mobile checks, and private-card labels verified. |
| Builds / CI | Verified | Server/client production builds and GitHub CI pass; compiled server responds to `/games`; production server starts on a non-default `PORT`. |
| Physical LAN validation | Verified | Real phones and a TV/public-table browser reached the development host over LAN; full create/join/start/draw/reveal/replay flow was exercised. |
| Hosted validation | Verified | Railway HTTPS frontend/backend deployed successfully. A complete two-player hosted game was played with a PC and phone participating. Hosted transport, room creation/join, authoritative turns, draw/reveal, and game completion worked end-to-end. |
| Phase 1 | **Complete** | The Phase 1 vertical slice is complete based on combined automated, local browser, physical LAN/table, production-runtime, and Railway-hosted validation. |
| Phase 2A definition model | **Complete** | Versioned data-only schema, structured validator, and Highest Card definition pass focused tests and JSON round-trip validation. |
| Phase 2B isolated runtime | **Complete** | Validated v0 definitions drive deterministic round setup/actions/outcomes and allowlisted views. |
| Phase 2C live runtime migration | **Complete** | Highest Card delegates setup/actions/visibility to the runtime; 33 tests, both builds, and local player/table browser checks pass. This migration has not been deployed to Railway. |

## Next priorities

1. Wire War into the playable app with a thin adapter/UI; generic runtime execution is complete.
2. Prove the abstraction further with Crazy Eights before building the user-facing Game Creator.

## Known limitations / backlog

- Room credentials currently live in React memory; refreshing a player page does not restore the authenticated player session.
- There is no host transfer or credential recovery yet; if the creator loses credentials or leaves, create a new room.
- Hosted room state is in memory and the Phase 1 deployment must remain a single backend instance; redeploy/restart loses active rooms. Persistence and horizontal scaling are later work.
- The SocketIO privacy guard is specific to pinned boardgame.io 0.50.2. Keep the initial-snapshot regression test when changing dependencies; do not casually upgrade boardgame.io.
- The TV/public-table viewport needs layout polish on some TV browsers; tracked as low-priority GitHub issue #1 and not a Phase 1 blocker.
- The earlier guest-seat selection/retry UX issue remains non-blocking backlog work.
- Installation previously reported dependency vulnerabilities; no automatic audit upgrades were applied because dependency changes could affect the pinned multiplayer stack.

## 2025-12-29 — Existing foundation

Historical work recorded in LOG.md: scaffolded workspaces, reusable game logic, boardgame.io server, React client, Lobby flow, turn-based draws, replay, and basic tests. The inspected checkout also included host-aware server URLs and QR sharing.

## 2026-09-06 — Repository assessment and privacy repair

- Inspected the active Windows checkout and repaired private-state leaks.
- Added server-side player/spectator filtering, public deck counts/draw-status fields, and server-only draw/replay moves.
- Added `PrivateStateSocketIO` to guard boardgame.io 0.50.2's unfiltered `initialState` sync field, including random-plugin secrets.
- Added real SocketIO privacy coverage, including a late spectator join.

## 2026-09-06 — Build repair and project records

- Repaired server compilation boundaries and production start path.
- Fixed client typing/configuration issues and Vite config shadowing.
- Added `goals.md`, this ledger, AGENTS/project handoff records, and repeatable build/test commands.
- Both production builds, compiled server startup, `/games`, and built-client preview were verified.

## 2026-09-06 — Authoritative waiting room and start

- Room creation reserves seat 0 for the creator and returns opaque credentials; guests choose available seats.
- The game begins in a waiting lifecycle with no deck. Only the authenticated creator can start after all seats are occupied.
- Start, seat mutation, and gameplay remain authoritative and synchronized through boardgame.io.
- Direct lifecycle/reset/undo bypasses are blocked; premature draw/start attempts are rejected.
- Browser and automated tests verified create/join/start/private draw/winner behavior.

## 2026-09-06 — Graphical cards and felt table

- Added reusable SVG card faces/backs for the full standard deck, green felt presentation, deck stack, responsive private/public layouts, winner emphasis, focus styles, and reduced-motion support.
- Public cards remain face down until authoritative reveal; private hands alone display their player's card beforehand.
- Desktop/mobile visual checks and the existing game/privacy tests passed.

## 2026-09-06 — Standalone public table

- Added `/?table=<matchID>` as an independent credential-less spectator/public-table entry point.
- Table entry consumes no player seat and receives only public state through the existing privacy path.
- Removed the embedded spectator board from joined-player pages and made standalone table mode full-width.
- Three browser contexts verified waiting/start/live draw progress/reveal, and automated coverage asserts that table entry does not alter seat metadata.

## 2026-09-06 — Round completion and replay cleanup

- Added explicit public `roundStatus` (`waiting`, `playing`, `complete`).
- Replay policy is authoritative: only the current/final-draw player may replay; spectators and other players cannot.
- Replay refreshes the shuffled deck/private state and boardgame.io play order rather than retaining stale turn sequence state.
- Builds passed and 13 tests covered completion, replay authorization, fresh deck/private state, synchronized turn ownership, reconnect privacy, and repeated seeded turn-order checks.

## 2026-09-06 — Phase 1 deal semantics decision

- Highest Card intentionally retains an explicit one-card draw per player rather than an automatic initial deal.
- The draw itself is the demo's deal mechanic and exercises turn ownership, private-card delivery, public draw progress, synchronization, and reveal.
- Future configurable games may choose automatic setup dealing through `GameDefinition`.

## 2026-09-07 — Hosted configuration readiness

- Added validated runtime `PORT` and exact comma-separated `ALLOWED_ORIGINS`; production requires a nonempty allowlist while development remains LAN-friendly.
- Applied origin policy to boardgame.io APIs, SocketIO CORS, and direct WebSocket handshakes without weakening room authorization or `PrivateStateSocketIO` filtering.
- Centralized hosted client connections through `VITE_SERVER_URL` while retaining automatic local/LAN fallback.
- Added provider-neutral `HOSTING.md` for the two-service HTTPS frontend + Node/boardgame.io backend shape.
- Server/client builds and 15 tests passed, including production origin configuration, allowed/denied polling/WebSocket access, authorization, and spectator privacy.

## 2026-09-07 — Phase 1 device and production validation

- Physical LAN flow was exercised manually with real phones plus a TV/public-table browser. Create/join/start/draw/reveal/replay worked over the local network.
- The compiled production server was manually started with `NODE_ENV=production`, `PORT=9123`, and an explicit `ALLOWED_ORIGINS`; `GET /games` returned HTTP 200 with `["simple-card-game"]`.
- The TV browser exposed a non-blocking viewport/vertical-fit issue, recorded separately as GitHub issue #1.

## 2026-09-07 — Railway hosted validation and Phase 1 completion

- Deployed the project to Railway using separate HTTPS services:
  - Frontend: `https://card-genie-web-production.up.railway.app`
  - Backend: `https://card-genie-production.up.railway.app`
- Added root Railway start scripts and fixed Vite Preview host validation (`preview.allowedHosts`) so Railway health checks and the public frontend domain succeed. The frontend fix landed in commit `8705b93`.
- Railway reported successful backend and frontend deployments after the host-check fix.
- The user loaded the hosted app on both PC and phone and completed a full two-player hosted game. This verifies the deployed frontend/backend connection, public HTTPS path, room creation/joining, SocketIO multiplayer synchronization, authoritative draw/turn flow, reveal, and game completion in the real hosted environment.
- The standalone public table and replay/privacy paths were already verified over physical LAN, browser, and automated SocketIO tests; they were not separately claimed as re-run in this particular two-device Railway game.
- With those combined checks, Phase 1 is considered complete. The next engineering task is Phase 2A: define and validate `GameDefinition v0` without yet building the Game Creator UI or generic runtime.

## 2026-09-07 — Phase 2A: GameDefinition v0

- Added `games/engine/types.ts` with schemaVersion 1, identity/player range, per-round standard-deck shuffle, private hand/server-only deck visibility, round-end reveal, randomized turns, explicit draw, next-player progression, all-players-acted completion, and highest/lowest rank comparison with ace high and ties. Type comments define the supported semantics; start/replay permission remains a session concern.
- Added `validateGameDefinition(unknown)` returning either a typed definition or ordered errors with path/code/message. It validates required fields, exact supported tags/values, 2–8 player ranges, integer counts, and the single-card requirement for rank comparison. Unknown fields are rejected rather than silently ignored. No rule expression/source-code fields or execution hooks exist.
- Plain-data checks reject functions, accessors, non-finite numbers, undefined, bigint, symbols, non-plain objects, cycles, and excessive nesting/size. Accessors and toJSON hooks are not invoked. The v0 object schema has no arrays; future vocabulary can evolve when concrete games require it. Validation does not mutate input or execute rules.
- Added `games/definitions/highest-card.ts` as a hand-written compatibility reference only. Added six validator tests covering the reference and JSON round-trip, unsupported versions, identity/required fields, malformed player/count fields, unknown primitives, contradictory multi-card comparison, lowest-wins support, executable/non-data rejection, and deterministic useful errors.
- Verification: npm run build:server, npm run build:client, and npm test all pass (21 tests, including all 15 prior game/privacy/network/production-configuration tests). The existing test glob discovers the new nested tests without script changes. The reference survives JSON stringify/parse and validates successfully.
- The live Highest Card game, client, room/session behavior, transport privacy, and boardgame.io version are unchanged. No generic runtime, Game Creator, additional games, persistence, AI rules, or TV layout changes were implemented. Phase 2B remains the next task.

## 2026-09-07 — Phase 2B: isolated authoritative runtime

- Added `games/engine/runtime.ts`. `createGameRuntime` validates unknown definitions and captures a private copy. `startRound` validates unique nonblank seat IDs against the definition's player limits, creates the full standard deck, and accepts injected index-permutation shuffling for the deck and player order. Invalid permutations return structured errors; execution does not call Math.random or store random state.
- The generic `applyAction(state, authenticatedPlayerID, { type: "draw" })` returns a new authoritative state on success or a structured error without mutation. It enforces seated/current-player ownership, one action per player, card availability and active lifecycle. Definition-driven rank direction supports highest/lowest outcomes, ace high and ties; completion reveals cards without advancing to a phantom next turn.
- `playerView` constructs fresh allowlisted snapshots: public deck count only, owner-only hands before completion, public hands/winner after reveal, no undealt identities or arbitrary server metadata. Views copy card fields and public collections rather than aliasing authoritative state. Repeating startRound creates clean replay state after the caller authorizes replay.
- Added six runtime tests for definition/seat validation, deterministic shuffling and invalid permutations, action rejection/non-mutation, full turn progression/completion, highest/lowest/ace/tie outcomes, player/other/spectator views, view isolation, clean replay and definition-copy isolation.
- Validation: both required production builds and all 27 tests pass, preserving the prior 21 schema/game/privacy/network/production tests. No DSL expansion, live-game migration, UI/session/transport changes, dependency upgrades, or TV work. Runtime callers must supply server-owned state/authenticated identities and authorize start/replay; integrating that contract through boardgame.io is the next task, not part of this isolated runtime delivery.

## 2026-09-07 — Phase 2C: live Highest Card runtime migration

- Moved Card/Rank/Suit to `games/engine/cards.ts`, removing the engine's dependency on the live game while retaining its type re-exports for existing consumers.
- The live adapter initializes and validates `highestCardDefinition` once, failing fast on an invalid built-in definition. Start/replay call runtime.startRound with boardgame.io shuffle; draw calls runtime.applyAction and maps rejections to INVALID_MOVE. Removed duplicate deck construction and winner rules.
- Explicit state conversion detaches Immer drafts for pure runtime actions and preserves the existing client/wire fields. Views delegate to runtime.playerView and retain an allowlist. Boardgame.io receives the runtime's next player and refreshes its full play order on start/replay; host start and final-player replay authorization remain intact. Room/UI/transport code and pinned boardgame.io 0.50.2 are unchanged.
- Added six equivalence tests covering 2, 3, and 8 players, winner/tie outcomes, setup/shuffle, draw/turn progression, rejected moves without mutation, replay, and all player/unknown/spectator views. Existing seeded multiplayer replay, real SocketIO authorization, historical snapshot privacy, reconnect, and production-origin regressions still pass.
- Validation: `npm run build:server`, `npm run build:client`, and `npm test` passed (33 tests). Started the compiled backend on port 8001 and the local Vite client on 5174. Two separate player tabs plus a public-table tab verified create/join/start, a first private draw, synchronized deck counts/turns, public reveal/winner, final-player-only replay controls, fresh 52-card replay with changed turn order, a new private draw, and a reopened spectator showing only face-down public progress. Test browsers and servers were stopped afterward.
- Browser checks verify presentation; automated SocketIO tests verify private data is absent from transmitted snapshots/history. This migration was not deployed or retested on physical LAN devices; those checks remain for a later deployment. No next-game or roadmap work was begun. Next task: War to stress the abstraction.

## 2026-09-07 — War schema extension

- Extended the data-only schema/validator with equal face-down round-robin dealing, paired top-card reveals, rank comparison, ordered whole-pot append, repeated tie contributions, insufficient-card loss, and all-card ownership completion. Added `games/definitions/war.ts`: exactly two players, 26 cards each, ace high, three face-down plus one face-up on every tie. No game-name dispatch or executable hooks.
- Documented deterministic queue/deal/pot ordering, atomic contributions, face-down identity privacy, and collection without reshuffling. A sole player unable to contribute loses and transfers their cards/pot to the opponent; simultaneous inability explicitly ends tied. Cycles are possible; no new cycle adjudication or turn limit is implied.
- Validator rejects incomplete or mixed draw/paired definitions, unsupported counts/order/tie policies, incompatible visibility and outcomes, unknown fields, and executable values. Added four tests covering JSON round-trip, identity independence, deterministic non-mutating errors, missing fields, contradictory rules and non-invocation of accessors/callbacks.
- Validation: `npm run build:server`, `npm run build:client`, and `npm test` pass (37 tests, including all 33 previous Highest Card/runtime/privacy/network/configuration tests). No runtime, live-game, UI, room, transport or dependency files changed. No browser or hosted checks were needed for this schema-only task.
- War is not registered or playable. Schema acceptance does not mean the existing draw runtime can execute these primitives; do not pass this fixture to it until the next runtime task is complete. Next task: generic runtime support for this definition; not started here.

## 2026-09-07 — Execute paired battles in the generic runtime

- The generic runtime now executes warDefinition through its validated primitives, without game-name branching. Setup shuffles once, deals 26 cards per seat round-robin, preserves seat order, and leaves the deck empty. Existing hands serve as server-only ordered piles.
- reveal-top resolves an entire battle atomically, including repeated three-down/one-up ties. Pot collection preserves chronological contribution/seat order and appends without reshuffling. A sole insufficient player loses; simultaneous insufficiency ends tied with the pot retained privately. All-52 ownership completes normally. Card conservation is covered in each outcome fixture.
- Clarified next-battle authorization: first seat starts, each nonterminal battle advances cyclically, terminal battles retain the acting seat. Contribution order always follows seat order. Illegal identities/actions/turns and completed-round actions reject without mutation.
- Added optional battle state and allowlisted public pile/pot counts, latest face-up contributions and battle result. Player and spectator views hide every pile and face-down identity even at completion; copied views cannot mutate authoritative state. New setup clears prior results. Highest Card state/view shape and behavior remain compatible.
- Verification: npm run build:server, npm run build:client, and npm test pass (44 tests). Seven new runtime tests cover deal/privacy, ordinary collection, repeated ties, insufficient outcomes, all-card ownership, deterministic progression, fresh setup, view isolation and rejection non-mutation. All 37 previous tests, including real SocketIO/privacy regressions, still pass.
- No playable War registration, UI, room, transport, dependencies or deployment changes. War browser/network integration is not yet implemented or verified. Next task is the thin playable adapter/UI; stopped before that work.
