# Progress Log

## 2025-12-29

- Scaffolded monorepo with `client`, `server`, and `games` folders plus root workspaces.
- Implemented `SimpleCardGame` with a shuffled 52-card deck, per-player hands, winner detection, and masked hands.
- Added server using `boardgame.io` on port 8000 with CORS configured for dev.
- Built React + Vite client with boardgame.io integration, player/table views, and styling.
- Added Lobby-based create/join flow with player names, credentials, and room codes.
- Implemented randomized turn order and turn-based draw flow with status messaging.
- Added “Play again” move to reset the game and reshuffle.
- Added a basic node:test suite for the game logic.
- Updated README with prerequisites and run steps.
- Pinned `boardgame.io` version and added workspace overrides to avoid peer conflicts.

## 2026-09-06

- Closed private-state leaks: every client receives an empty deck, only a player’s own card is visible before reveal, and spectators receive public progress only.
- Added public deck counts and draw-status indicators; draw and replay use boardgame.io server-only moves.
- Added a SocketIO guard for boardgame.io 0.50.2's unfiltered initial-state sync snapshot, removing historical private cards and random-plugin state without changing authoritative storage.
- Expanded regression coverage to nine tests, including real SocketIO connections for authenticated players, spectators, late joins, reveal, and replay. All pass; changed game/test/transport files also pass a standalone strict TypeScript check.
- Existing server rootDir and client typing build failures remain. Build validation ran in an isolated copy; all nine tests also pass in the original checkout. The existing package-lock.json modification is preserved.

## 2026-09-06 — Build repair and project records

- Repaired server compilation boundaries/start path and client type errors; isolated generated Vite config output.
- Added goals.md and ledger.md, linked from README. Use ledger.md for current progress and validation; keep this file as historical context.
- Build repair validated in the checkout: both production builds and all nine tests pass; compiled server and built-client preview respond successfully.

## 2026-09-06 — Waiting room and start

- Added host reservation, public seat selection/occupancy, and an authenticated start endpoint backed by boardgame.io phases and synchronization.
- Blocked premature actions and raw lifecycle bypasses; all eleven tests and both builds pass. Verified create/join/start/private draw/winner in two browser tabs.
- Development mode now works with the updated session permissions. See ledger.md for current progress and remaining work.

## 2026-09-06 — Graphical cards

- Added SVG card faces/backs, reusable card and board components, green felt surfaces, responsive layouts, and winner emphasis. Verified desktop/mobile appearance and hidden-card labels; see ledger.md for validation.

## 2026-09-07 — Phase 1 hosted completion

- Completed the Highest Card vertical slice with independent public-table and replay/privacy coverage.
- Added Railway deployment configuration; user completed a hosted two-player PC + phone game.

## 2026-09-07 — Generic definitions and runtime

- Added a closed, versioned, data-only `GameDefinition` validator and authoritative generic runtime.
- Migrated Highest Card, then added War and Crazy Eights to prove different rule families without arbitrary user code.
- Added generic table-placement metadata for face-up/down cards, ownership, attribution, and sequence; War tie cards now use it.
- Automated privacy coverage includes real SocketIO player/spectator paths.

## 2026-09-07 — Game Creator

- Added guided Game Creator v0 for the three proven rule families with live validation and inert JSON preview.
- Added `custom-card-game` test rooms so validated Creator definitions run through the same authoritative runtime and privacy boundary.
- Repaired test discovery to include root and nested game tests.

## 2026-09-08 — Shelem specification and auction foundation

- Added `docs/shelem-rules.md` covering fixed opposite-seat teams, packet deal + kitty, bidding, trump, trick play, scoring, multi-deal deck continuity, exact pile merge order, and public frozen cumulative-score visibility.
- Added generic auction primitives: four seats, rightward order, rotating dealer after completed deals, 12/12/12 + 4 kitty + 12 deal, 100–165 bids in steps of 5, permanent pass, three-opening-pass same-dealer redeal, declarer, trump, and cut-only later deals.
- Private hands/kitty and live current-deal totals remain absent from player/spectator views.

## 2026-09-08 — Shelem declarer setup

- Added private kitty pickup (12 → 16), declarer-only ordered four-card face-down discard, and transition to declarer-first trick leadership.
- The discard stack keeps server-side identity/order for later scoring/deck reconstruction while public views expose only opaque count/team/placer metadata.
- Builds pass and the suite reached 81 tests.

## 2026-09-08 — Shelem trick play

- Added generic follow-suit/trump trick-taking: declarer must lead trump first, players follow suit when able, trump wins over non-trump, otherwise highest led suit wins, Ace high, and trick winner leads next.
- Twelve ordered tricks are collected into hidden team piles with newest trick on top while preserving internal play order and 52-card conservation.
- Public views expose only active trick cards, winner/history metadata and team trick counts—not collected identities or live deal points.
- State now reaches `ready-scoring`; builds pass and the suite reached 86 tests. Deal scoring, match completion, next-deal scoring integration, and Shelem UI remain future work.

## 2026-09-08 — Finish Shelem end-to-end

Implemented the complete built-in Shelem path: authoritative contract scoring and exact 165-point conservation; ordered merge/cut-only next deals; same-dealer opening-pass redeals; cumulative score/lead match outcomes; fresh-match replay; four-seat boardgame.io/lobby integration; and responsive private-player/public-table UI. Existing privacy transport and authorization are preserved.

Validation: both required production builds pass and all 93 tests pass. Added seven tests covering scoring boundaries/precedence, ordered deck continuity, match outcomes, complete adapter matches, authorization, and a full four-player-plus-spectator SocketIO match with automatic transitions, replay and fresh spectator reconnect/privacy comparisons. No manual browser/device/hosted validation was performed; those checks and fixes they uncover are the remaining Shelem follow-up. See ledger.md for exact evidence. Pre-existing package-lock.json changes were not included.
