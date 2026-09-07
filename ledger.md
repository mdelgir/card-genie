# Card Genie progress ledger

This is the current progress record. [goals.md](goals.md) defines the target outcomes; [LOG.md](LOG.md) preserves the earlier development history. Add dated entries after meaningful work, recording changes, validation, limitations, and the next task. Do not mark untested behavior complete.

## Current status

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Room creation and joining | Verified locally | Creator automatically occupies host seat; joiners select an available seat; names, credentials, room codes, and QR sharing retained. |
| Waiting room and start | Verified | Host-only start checks occupied seats on the server; no shuffle/draw before start; synchronized transition tested over SocketIO and in two browser tabs. |
| Deck and demo rules | Implemented | Standard 52-card deck, shuffle, randomized turn order, explicit one-card draw per player, highest-card winner/tie. The explicit draw is intentionally the Phase 1 demo's deal mechanic; no separate automatic initial deal is required. |
| Player and spectator privacy | Verified in automated tests | Private deck excluded; own hand only before reveal; public draw status; initial-sync guard removes historical secrets and random state. |
| Synchronization | Verified locally | Authenticated SocketIO players, spectator/late join, draw, reveal, winner, and replay covered. |
| Independent table entry | Verified locally | `/?table=<matchID>` opens a credential-less public table without consuming a seat. Player pages mount only their own board. |
| Round completion and replay | Verified locally | Explicit waiting/playing/complete status; final-draw/current player alone may replay. Fresh deck, cleared private state, and refreshed full turn order verified. |
| Card graphics | Verified visually | All 52 SVG faces, patterned backs, card slots, deck stack, and winner emphasis; desktop/mobile browser checks and private-card labels verified. |
| Builds | Verified | Both production builds pass; compiled server responds to /games; built client preview returns HTTP 200. |
| Device / hosted validation | Partial | Local multi-tab/browser validation is complete. Physical phones, TV/tablet layout, LAN reachability, and hosted end-to-end use remain unverified. |

## 2025-12-29 — Existing foundation

Historical work recorded in LOG.md: scaffolded workspaces, reusable game logic, boardgame.io server, React client, Lobby flow, turn-based draws, replay, and basic tests. The inspected checkout also includes host-aware server URLs and QR sharing.

## 2026-09-06 — Repository assessment and privacy repair

- Inspected the Windows checkout for `mdelgir/card-genie`, initially at commit `d28b883`. WSL was inaccessible. `AGENTS.md` and `PROJECT_CONTEXT.md` were absent.
- Initial workflow: install succeeded; server/client builds failed; two existing tests passed. Local network probes demonstrated draw/winner/replay synchronization and exposed private-state leaks.
- Fixed player/spectator filtering, introduced public deck counts and draw-status fields, and made draw/replay server-only moves.
- Added `PrivateStateSocketIO` to guard boardgame.io 0.50.2's unfiltered `initialState` sync field, including random-plugin secrets. Normal current-state filtering still uses boardgame.io playerView.
- Nine tests pass, including actual SocketIO connections and a late spectator join. Existing lockfile modifications were preserved.

## 2026-09-06 — Build repair and project records

- Expanded the server compilation root to include shared game logic, excluded tests from production output, and enabled noEmitOnError.
- Aligned the production start command with `server/dist/server/src/index.js`.
- Added QRCode declarations and Vite environment types; used boardgame.io's BoardProps and handled nullable winners explicitly.
- Moved generated Vite configuration output under client/dist to prevent a generated JavaScript config from shadowing the source TypeScript config.
- Added this ledger and goals.md; linked both from README and preserved LOG.md history.
- Validation in the original checkout: npm install (workspace cache), npm run build:server, npm run build:client, and npm test all pass; nine tests pass. Compiled server startup and /games response pass; built client preview returns HTTP 200.
- Vite uses its module-runner config loader and an ESM-compatible alias path to avoid config bundling blocked by this Windows sandbox. TypeScript build caches live under node_modules/.cache.
- Development-mode dependency optimization still encounters an esbuild ancestor-directory access denial in this Codex sandbox. Production builds and preview pass; dev-mode browser use outside this sandbox remains unverified.
- Installation reports 23 dependency vulnerabilities (4 low, 6 moderate, 13 high). No automatic dependency audit upgrades were applied.

## 2026-09-06 — Authoritative waiting room and start

- Room creation now reserves seat 0 for its creator and returns the creator's opaque credentials. Guests choose available seats; the waiting room refreshes public Lobby metadata once per second.
- The game starts in a waiting phase with no deck. Only an authenticated creator can POST /rooms/:id/start once every seat is occupied. Start/seat mutations use the same per-match queue as gameplay.
- The server dispatches the accepted start through boardgame.io Master, preserving existing filtering and synchronization. The game shuffles the deck and turn order at this transition; the one-card draw demo is unchanged.
- Network clients may submit only draw and replay moves. Direct start, phase/event, undo, and reset packets are blocked; game checks reject premature draws and repeated starts.
- Creator credentials cannot be acquired by reclaiming a departed host's seat. There is no host transfer or credential recovery yet; if the creator leaves or loses credentials, create a new room.
- Validation: both builds pass, eleven tests pass, including missing/guest credentials, empty/vacated seats, forged start/phase changes, simultaneous starts, host-seat reclamation, privacy, winner, and replay.
- Browser verification: create, disabled premature start, guest seat selection/join, enabled host start, synchronized turn progression, private first draw, and shared winner verified using two tabs with public table views.
- The earlier Vite development optimizer access failure is resolved with the session's unrestricted filesystem permissions. Development mode starts and the browser renders the join form successfully.
- Existing replay-permission/turn-order limitations remain deferred to the next lifecycle task.

## 2026-09-06 — Graphical cards and felt table

- Replaced text cards with a reusable SVG PlayingCard component: ivory faces, accurate number-card pip layouts, ornamental aces, mirrored J/Q/K court art, and navy/gold patterned backs. No external artwork or new dependencies.
- Extracted GameBoard from App and centralized the server URL. Card rendering stays independent of transport and game rules; face/back/empty variants and stable player slots support future animation.
- Added a green felt surface, deck stack, responsive hand/public-card layouts, gold winner emphasis, keyboard focus styles, and reduced-motion support.
- Public card slots remain face down until the authoritative reveal; the private hand alone displays the player's card beforehand. Face-down accessibility labels contain no rank or suit.
- Verified all 52 card designs in a temporary visual proof, a two-browser draw/reveal flow, winner styling, and a 390px mobile layout with no horizontal overflow. Existing eleven tests pass and the client production build passes.
- Game/server rules and the known replay/session limitations are unchanged. Elaborate dealing/flipping animations remain deferred.

## Next priorities

1. Manually verify the complete flow on physical LAN devices: development PC + at least two player phones + a separate public-table device.
2. Validate the equivalent complete flow against a hosted server/client configuration.
3. After both validations pass and the ledger is updated, declare Phase 1 complete and begin Phase 2A (`GameDefinition v0`).

## Known limitations

- Room credentials currently live in React memory; a browser refresh does not restore the player session.
- Development server CORS is permissive by default; production requires an explicit allowed-origin list. Real hosted validation remains pending (see HOSTING.md).
- The SocketIO guard is specific to the pinned boardgame.io version. Keep the initial-snapshot regression test when changing dependencies. The library's unguarded Local transport is for tests here, not a privacy-safe deployment substitute.
- No Phase 1 user-defined rule engine or elaborate animations are planned.

## 2026-09-06 — Release checkpoint

- Integrated the remote AGENTS.md and PROJECT_CONTEXT.md additions (through 57978fc) before committing the accumulated implementation work.
- Revalidated both production builds and all eleven tests. This checkpoint includes privacy repairs, build fixes, project records, the authoritative waiting/start flow, and graphical cards.

## 2026-09-06 — Standalone public table

- Completed the standalone-table brief in NEXT_TASK.md. Open `/?table=<matchID>` directly or use “Open public table” beside a joined player's existing join link and QR code.
- Table entry mounts only a spectator GameClient, with no player ID or credentials and no player form. Public Lobby metadata validates the room; empty/invalid links show an error with a return link.
- Removed the embedded second board from player pages and made the standalone table full-width. Disabled the boardgame.io debug panel so public displays expose no debug player/move controls.
- Preserved the game, server, and transport privacy implementations. Extended the real SocketIO regression test to assert that an additional table does not alter player-seat metadata; existing coverage verifies private hands, deck, historical snapshots, random state, reveal, and replay.
- Validation: both production builds and all eleven tests pass. Three separate browser tabs verified host creation, guest seat selection/join, table waiting with an empty seat, host start after both player seats filled, live face-down draw progress, public reveal/winner, and one board per player. Empty and nonexistent table IDs show useful errors; full-width felt presentation inspected visually.
- Physical LAN devices and hosted use remain unverified. Round/replay cleanup and all later roadmap work remain pending; this task does not change them. The previously reported guest-seat selection/retry UX issue is outside this brief and remains unresolved.

## 2026-09-06 — Round completion and replay cleanup

- Completed the round/replay brief in NEXT_TASK.md. Added public authoritative `roundStatus` (`waiting`, `playing`, `complete`) to setup, start, final draw, replay, and the playerView allowlist. Retained `revealed` for card visibility and `started` for existing room-start checks; a completed round is not a terminal boardgame.io gameover.
- Replay policy: only the authoritative current player at completion (the final-draw player) can replay. Game checks and boardgame.io authorization enforce this; that player's button is disabled when disconnected. Other players see who must replay, and the public table has no player controls. Every board labels the completed round explicitly.
- Replay now re-enters the playing phase through boardgame.io, refreshing `ctx.playOrder`, its position, and current player from the newly shuffled `G.playOrder`. Previously endTurn selected a new first player but retained the old engine turn sequence. The final draw does not advance the turn.
- Validation: both production builds and all 13 tests pass. Coverage includes deterministic winner/tie completion, rejected premature replay and post-completion draws, raw SocketIO unauthorized player/spectator replay attempts, a fresh unique 52-card server deck, cleared round state, and valid synchronized turn ownership. A seeded three-player test verifies changed full turn sequences over repeated rounds. Player/table current-state and reconnect privacy remain verified after a next-round draw, including empty deck payloads, filtered initial history, undo/redo, and random state.
- Three browser tabs verified host/guest/table completion with the same winner, replay available only to the final-draw guest, a waiting message for the host, no table actions, cleared cards/winner and 52-card count after replay, a changed first player, and the next legal private draw synchronized as a face-down card on the table.
- Existing sessions from before this state-schema change are not migrated; restart the server and create fresh rooms when updating. If the replay-authorized player loses credentials or leaves, recovery/host transfer remains unavailable. Physical LAN/hosted checks and the existing join UX issue remain pending. No initial-deal redesign or later roadmap work was undertaken.

## 2026-09-06 — Phase 1 deal semantics decision

- Highest Card will retain the explicit per-turn one-card draw. There is no separate automatic initial deal in the Phase 1 demo.
- The draw itself is the demo's deal mechanic and intentionally exercises authoritative turn ownership, private-card delivery, public draw progress, real-time synchronization, and reveal/winner behavior.
- This is a product/rule decision, not an implementation gap. No code change is required for Phase 1.
- Future configurable games may choose automatic setup dealing as part of `GameDefinition`; this decision does not constrain Phase 2 rule design.

## 2026-09-07 — Hosted configuration readiness

- Pulled latest main before implementation. The user is performing physical LAN validation and reports that phone and TV browsers reach the app; the full physical-device flow is not marked complete here. NEXT_TASK.md remains the manual LAN brief. TV layout work and Phase 2 were not undertaken.
- Added validated runtime PORT (default 8000) and exact comma-separated ALLOWED_ORIGINS. NODE_ENV=production requires a nonempty allowlist; development keeps permissive LAN access when no list is supplied. API requests carrying disallowed origins are rejected before room mutations. Origin-less health checks/non-browser clients remain supported and still require credentials for authorized actions.
- Applied the same list to boardgame.io API CORS and explicit SocketIO `cors.origin` plus `allowRequest`, correcting the pinned library's ineffective `cors.origins` option and checking direct WebSocket handshakes. Preserved boardgame.io 0.50.2, room lifecycle, rule authorization, and PrivateStateSocketIO filtering.
- All client connections already use the shared serverUrl: SocketIO, Lobby, room creation, and host start. Trimmed explicit VITE_SERVER_URL whitespace/trailing slashes and retained the automatic browser-hostname port-8000 LAN fallback. Added provider-neutral HOSTING.md covering build/runtime variables, HTTPS/WebSockets, existing start path, single-instance in-memory limits, and the real hosted acceptance flow.
- Validation: npm run build:server, npm run build:client, and npm test pass (15 tests). New tests cover port/origin validation, production failure without origins, development LAN defaults, allowed API preflight/creation, rejected origins, unchanged creator authorization, polling CORS headers, allowed/denied polling and WebSocket connections, and filtered spectator sync. All 13 prior game/privacy/network tests remain passing. A separate client production build with an explicit HTTPS backend URL also passes.
- The compiled non-default-port startup command (NODE_ENV=production, PORT=9123, ALLOWED_ORIGINS=http://localhost:4174, npm --prefix server start) was rejected by automatic approval review without a stated reason. That compiled runtime check remains unverified; automated tests successfully started the source server with production origin configuration on ephemeral ports. No real hosted deployment was performed, and hosted end-to-end acceptance is still pending.
