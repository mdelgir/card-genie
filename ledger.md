# Card Genie progress ledger

`goals.md` defines intended outcomes. `LOG.md` preserves older history. This is the compact source of truth for verified state, limitations, and next work. Do not mark manual or hosted behavior verified unless it was actually exercised.

## Current status

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Phase 1 vertical slice | **Complete** | Highest Card create/join/start/private play/public table/replay verified by automated tests, browser/LAN devices, and a complete Railway-hosted PC+phone game. |
| Definition model | **Complete for current v0** | Versioned data-only schema + structured validator; no executable user hooks. Highest Card, War, and Crazy Eights definitions validate. |
| Generic authoritative runtime | **Complete for current games** | Same runtime executes Highest Card, paired War battles, and Crazy Eights matching-hand play; server owns legality, state transitions, outcomes, and views. |
| Shelem | **Implementation-complete; automated-green** | Four-seat built-in, auction/setup/tricks, contract scoring, cut-only redeals, cumulative match outcomes/replay, player/table UI. Both builds and 93 tests pass, including a complete four-player SocketIO match and fresh spectator reconnect. Manual play/visual/device/hosted validation remains. |
| Highest Card | **Verified** | Runtime migration and prior privacy/browser/LAN evidence remain valid. Phase 2 work has not been redeployed to Railway. |
| War | **Automated + manual visual verified** | Rules/runtime/SocketIO privacy pass. User rechecked a tied opening battle after the placement work: opening tie, three visible face-down backs per player, war reveal, correct 30/22 accounting, and no hidden identities shown. |
| Crazy Eights | **Automated + manual game verified; one wild-8 check pending** | User completed a two-player game with public table and verified private hands, legal play/draw behavior, public discard/suit/counts, winner and replay. Automated tests cover wild-8 suit selection; explicit manual selected-suit propagation is still worth checking once. |
| Generic table placements | **Verified** | Definition/runtime distinguish zone, face, rules ownership, placement attribution and sequence. Face-down identities are stripped from player/spectator views. War tie layout was manually rechecked successfully. |
| Game Creator v0 | **Implemented; automated verified** | Guided UI builds only the three proven rule families, validates live, previews/copies inert JSON, and exposes supported player/outcome/table-placement choices. No arbitrary code generation/execution. |
| Creator custom test-play | **Automated verified; manual test pending** | `custom-card-game` runs an attached validated `GameDefinition` through the generic runtime, reuses existing boards, supports player/public-table rooms, and filters authoritative state from SocketIO views. Creator can create a test room from the exact validated definition. |
| Builds / CI | **Verified** | Server/client builds pass. Test discovery was repaired to include root and nested game tests; the expanded suite is green, including Creator builder and custom-room SocketIO privacy coverage. |
| Railway deployment | Phase 1 only | War, Crazy Eights, table placements, Creator and custom test-play have not been deployed or hosted-tested. |

## Next priorities

Shelem implementation is complete. Its remaining validation is manual: four-player play with a public table, phone/tablet layout and controls, then hosted play and any fixes those checks reveal. No Shelem browser, physical-device or Railway validation is claimed in this checkpoint.

1. Manually create a **Draw & Compare** game in Game Creator, use **Create test room**, join with a second player, open the public table, finish/replay, and verify privacy + generated behavior.
2. Preferably repeat once with a Battle or Matching custom game. Explicitly verify one Crazy Eights wild 8 changes the public active suit to the chosen suit.
3. Fix only failures found. If this passes, next coding work is save/load/persistence and sharing for custom definitions.

## Known limitations / backlog

- Player credentials live only in React memory; refresh loses the authenticated player session.
- No host transfer or credential recovery.
- Rooms are in-memory; restart/redeploy loses active rooms. Keep one backend instance until persistence exists.
- Creator definitions are currently attached to test rooms only; there is no persistent custom-game library yet.
- `PrivateStateSocketIO` specifically guards boardgame.io 0.50.2 behavior. Do not casually upgrade the pinned stack; preserve historical-snapshot privacy tests.
- TV/public-table viewport polish is low priority, tracked by issue #1. Guest-seat selection/retry UX also remains backlog.
- War can theoretically cycle indefinitely; no cycle adjudication/turn cap is defined.
- Current Crazy Eights variant ends tied if the draw pile is empty and the active player has no legal play; discard recycling is not yet modeled.
- Dependency installation reports vulnerabilities; do not apply automatic breaking audit upgrades.

## Milestones

### 2026-09-06 — Phase 1 foundation and privacy repair

- Repaired private-state leaks, build boundaries, host-authoritative waiting/start, and lifecycle bypasses.
- Added graphical cards, independent public table, replay rules and SocketIO privacy regressions.
- Physical LAN testing used real phones plus a TV/public table.

### 2026-09-07 — Hosted Phase 1 completion

- Railway frontend: `https://card-genie-web-production.up.railway.app`
- Railway backend: `https://card-genie-production.up.railway.app`
- User completed a two-player hosted Highest Card game with PC + phone. Public-table/replay paths were supported by prior LAN/browser/automated evidence, not separately rerun in that exact Railway game.

### 2026-09-07 — GameDefinition + generic runtime

- Added closed, data-only `GameDefinition`, validator, injected trusted shuffle, authoritative actions/outcomes and allowlisted views.
- Migrated Highest Card to the runtime.
- Added War to stress paired piles/ties and Crazy Eights to stress persistent hands/conditional legality/wild suit/public state.

### 2026-09-07 — Generic table placements

- Added definition-driven table zone, ownership and attribution plus runtime face state and sequence.
- Outbound views preserve public structure but replace face-down card identities with `null`.
- War UI renders opening reveal, stacked hidden tie contributions, and war reveal from generic placement state rather than War-specific guesses.
- User manually rechecked the improved tie layout successfully.

### 2026-09-07 — Crazy Eights manual game

- User completed a two-player local game with a public table. Screenshots confirmed private hands, legal-card gating, fallback draw, public discard/active suit/draw-pile and hand counts, empty-hand winner, and replay authorization.
- Wild-8 chosen-suit behavior remains automated-verified but not explicitly manually confirmed.

### 2026-09-07 — Game Creator v0

- Commit `1750762` added a guided Creator for Draw & Compare, Paired Battle and Matching Discard families.
- Creator output is inert validated `GameDefinition` data with live errors and JSON preview/copy; unsupported rule freedom is intentionally not exposed.
- Crazy Eights wild-suit selector was made contextual so it appears only when a playable 8 is present.

### 2026-09-07 — Creator custom test-play

- Commit `a4b40235` added the static `custom-card-game` boardgame.io adapter so Creator output can be test-played without generating server code.
- Custom rooms validate the attached definition, execute it through the generic runtime, reuse existing boards, preserve host start/replay flow, and expose only filtered runtime views to players/spectators.
- Added real SocketIO coverage proving malformed definitions reject and private custom state stays absent from player/spectator payloads.
- Repaired CI test discovery so both `games/*.test.ts` and nested game tests run; this exposed and fixed a dormant Crazy Eights adapter-test syntax error. The expanded suite and both builds are green.
- Manual Creator-created room validation remains the next gate before persistence/save/share work.

### 2026-09-07 — Shelem auction foundation

- Added a validated data-only ascending-auction definition with opposite-seat teams, rightward seat-array order, initial seat-zero dealer, 12/12/12 + 4-card kitty + dealer's 12 packet dealing, permanent passes, 100–165 bids in strictly increasing multiples of five, and declarer-only trump selection. Generic runtime dispatch uses the auction primitive, never game id.
- Added a separate auction runtime module behind createGameRuntime. First setup uses injected shuffle once. Three opening passes mark redeal-required; trusted nextDeal cuts the exactly reconstructed packet stack and retains the dealer. Cut offsets must be integer cyclic rotations; no later shuffle hook is offered.
- nextDeal can also consume a trusted completed-deal stack and cumulative score snapshot, rotating the dealer exactly one seat right only when roundStatus is complete. Tests simulate this future authoritative completion boundary; this task does not implement trick gathering, scoring, or any player-accessible completion action. Choosing trump stops at ready and does not complete the deal or move the kitty.
- Player views expose only their own hand plus allowlisted public auction/dealer/team/kitty-count metadata and frozen deal-start cumulative scores. Spectators receive no card identities. Kitty, cut points, arbitrary private fields and live deal totals are excluded. Views copy nested data; rejected actions preserve state and do not invoke getters.
- Validation: npm run build:server, npm run build:client, and npm test pass (77 tests). Six new focused tests cover definition round-trip/rejections, packet position/card conservation, same-dealer cyclic redeals, bid/pass/trump legality, trusted completed-stack continuity/dealer rotation, frozen scores and player/spectator privacy. All 71 existing tests remain green.
- No Shelem UI or playable registration, kitty pickup/discard, trick play, scoring or match-end implementation. No Shelem browser/hosted validation claimed. Stopped at the auction foundation; further play remains a separate task.

### 2026-09-08 — Shelem declarer setup

- Added optional validated data-only declarer setup primitives for kitty pickup, four owned-card discards to the declarer's team face down, submitted stack order, and declarer-first leadership. Legacy auction-only definitions retain their previous stopping point; Shelem enables the new stages.
- Trump selection now leads to take-kitty, then discard, then ready. Pickup privately appends the four kitty cards in order (12 to 16). Discard uses four distinct current-hand indices, stores cards top-to-bottom in submitted order, preserves remaining hand order, and leaves 12 cards with the declarer as first leader. The initial discard stack is kept separately with team/player attribution for future deterministic collection merging.
- Views expose the discard only as count/face/team/placer metadata, including to the declarer and teammate. Kitty identities and discarded identities never appear in these views. Public contract/trump and frozen cumulative team scores persist; live deal totals remain absent. No scoring or completion transition is introduced.
- Validation: npm run build:server, npm run build:client, and npm test pass (81 tests). Four new tests cover schema rejection/legacy compatibility, ordered pickup/discard and 52-card conservation, wrong-player/phase/count/duplicate/invalid-index rejection without mutation, accessor non-invocation, all-viewer privacy and view-copy isolation. Updated the existing auction test for the new post-trump phase; all existing game/network/privacy regressions pass.
- No trick play, scoring, match end, Shelem UI, or hosted/browser validation added. Existing package-lock.json changes were excluded from this commit. Stopped at ready for trick play.

### 2026-09-08 — Shelem trick play

- Added optional validated follow-suit/trump trick primitives requiring declarer setup: first lead trump, Ace-high rank comparison, winner leads next, newest trick on top of its team's collection, and twelve tricks. Shelem enables these rules; no game-id dispatch or executable hooks.
- Added a small trick runtime module. Authenticated current players play owned-card indices in rightward order; follow-suit is mandatory when possible, while void players may play any card. The highest trump wins, otherwise the highest led-suit card wins. Passing in the auction no longer prevents later trick participation.
- Four-card tricks are collected atomically in play order onto the winner team's hidden top-first pile. Subsequent won tricks prepend without reversing their internal order. Views copy only active public cards, leader/last winner/completed count and team trick counts; collected identities and computed point totals are absent.
- After twelve tricks the phase is ready-scoring, all hands are empty, and cumulative scores, contract, trump, dealer and the separate declarer discard stack remain unchanged. No completion/scoring/rotation/next-deal merge is triggered.
- Verification: npm run build:server, npm run build:client, and npm test pass (86 tests). Five new tests cover closed schema/dependencies, first-lead/follow-suit and ownership authorization, trump/led-suit/Ace outcomes, every play of a complete twelve-trick deal with exact collection ordering and 52-card conservation, plus player/spectator privacy and view isolation. Existing tests remain green; the legacy auction fixture explicitly omits both later capabilities.
- No scoring, match end, Shelem UI or deployment validation added. Existing package-lock.json changes remain excluded. Stopped at ready for scoring.

### 2026-09-08 — Shelem implementation complete

- Added validated contract-team scoring primitives: card values (5/10/A), trick/discard hand points, 165 conservation, ordinary contract success, zero-defender-trick multiplier, successful-165 precedence (660), failure and the exact 85-point double penalty. Finalization derives scores solely from authoritative piles; raw totals never enter outbound views.
- Automatic trusted lifecycle transitions reconstruct defenders' collection + declarer discard + declarer-team collection, preserve every internal order, cut cyclically using server randomness, rotate dealer once and deal the next packets with updated cumulative scores. Three opening passes automatically cut/redeal score-neutrally with the same dealer. Match end handles 1165 score/lead, higher simultaneous qualifying score and exact ties continuing. Terminal scores/winner are public; new match uses a fresh first-deal shuffle and resets all roles/scores.
- Added the four-seat Shelem boardgame.io adapter and server/client/lobby registration. Existing creator-only start and PrivateStateSocketIO protections remain in use. Moves accept only bid/suit/card selections; clients have no scoring, deck, cut or winner controls. Discard move arguments are redacted in logs. Adapter turns follow the runtime through auction, setup, tricks, automatic transitions and current-player-only replay.
- Added responsive player/public-table ShelemBoard: opposite-team circular seating, cumulative scoreboard, dealer/declarer/contract/trump, auction history/pass/bid controls, private hand, kitty/discard backs/counts, four-card selection, active trick, shared legal-card gating, public trick counts and match/replay state. Room/table links retain game=shelem. Shared card rendering is reused; no elaborate animation added.
- Final validation: npm run build:server and npm run build:client pass; npm test passes all 93 tests (86 previous plus 7 new). Scoring fixtures cover success/failure/85 threshold/sweep/165 precedence, total conservation, exact stack-cut-dealer progression, score freezing, score/lead/simultaneous match outcomes and replay. Seeded adapter simulation completes a full match and rejects unauthorized replay. Real SocketIO tests run four authenticated players plus spectator through opening-pass redeal, every game stage, multiple deals, match completion and replay. Every synchronized outbound view is compared against the authoritative role-filtered projection; history/initial snapshots/undo state are checked; a fresh spectator reconnect verifies historical privacy. Existing game/privacy/network regressions remain green.
- README now describes Shelem entry and play. No browser visual, physical LAN/device or Railway Shelem validation was performed in this task. Remaining Shelem work is user manual play/visual/hosted validation and fixes found there. Existing package-lock.json modifications remain outside this commit. No unrelated roadmap work was started.
