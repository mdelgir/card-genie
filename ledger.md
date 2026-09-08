# Card Genie progress ledger

`goals.md` defines intended outcomes. `LOG.md` preserves older history. This file is the compact source of truth for current verified state, limitations, and next work. Do not mark manual or hosted behavior verified unless it was actually exercised.

## Current status

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Phase 1 vertical slice | **Complete** | Highest Card create/join/start/private play/public table/replay verified by automated tests, browser/LAN devices, and a complete Railway-hosted PC+phone game. |
| Definition model | **Complete for current v0** | Versioned data-only schema + structured validator; no executable user hooks. Highest Card, War, and Crazy Eights definitions validate. |
| Generic authoritative runtime | **Complete for current games** | Same runtime executes Highest Card, paired War battles, and Crazy Eights matching-hand play. Server owns legality, state transitions, outcomes, and views. |
| Highest Card | **Verified** | Migrated to runtime; prior local browser, LAN, transport/privacy, and hosted Phase 1 evidence remains valid. Phase 2 migration itself has not been redeployed to Railway. |
| War rules/runtime | **Automated verified** | 26/26 deal, battles, repeated ties, insufficient-card outcomes, card conservation, replay, and privacy covered by tests. |
| War playable app | **Automated verified; manual visual recheck pending** | Adapter/server registration/room selection/UI/public-table/SocketIO path exist. User manually exercised a tied opening battle and exposed the missing face-down-table visualization. New generic placement UI is CI-tested but has not yet been manually rechecked. |
| Crazy Eights | **Automated verified; manual game pending** | 2–4 players, 5-card hands, public discard/active suit/counts, match suit/rank, wild 8 suit choice, fallback draw, empty-hand win, adapter/UI/SocketIO privacy all covered. No full user-reported device game yet. |
| Generic table placements | **Automated verified; manual visual recheck pending** | Definition/runtime distinguish zone, face, rules ownership, placement attribution, and sequence. Face-down identities are removed from player/spectator views while public structure remains. War renders tied-war hidden cards from this generic state. |
| Builds / CI | **Verified** | PR #2 builds server/client and passes 39/39 tests, including table-placement privacy, War SocketIO, Crazy Eights SocketIO, and existing regressions. |
| Railway deployment | Phase 1 only | Current War/Crazy Eights/table-placement work is not deployed or hosted-tested. |

## Next priorities

1. User manually rechecks War on two players + public table, especially an opening tie: face-up tie → three visible card backs per player → face-up war reveal, with correct counts and no hidden identities.
2. User manually completes a Crazy Eights game on two players + public table and checks private hands/public discard/active suit/counts/wild-8 behavior.
3. Fix only issues found by those checks; then begin Phase 2D Game Creator using the proven definitions/runtime, including table-zone/placement options.

## Known limitations / backlog

- Player credentials live only in React memory; refresh loses the authenticated player session.
- No host transfer or credential recovery.
- Rooms are in-memory; restart/redeploy loses active rooms. Keep a single backend instance until persistence exists.
- `PrivateStateSocketIO` is specifically guarding boardgame.io 0.50.2 behavior. Do not casually upgrade the pinned multiplayer stack; preserve historical-snapshot privacy tests.
- TV/public-table viewport polish is low priority, tracked by issue #1.
- Guest-seat selection/retry UX remains backlog.
- Dependency installation reports vulnerabilities; do not apply automatic breaking audit upgrades.
- War can theoretically cycle indefinitely, matching the chosen rules; no cycle adjudication/turn cap is defined.
- Current Crazy Eights variant ends tied if the draw pile is empty and the active player has no legal play; discard recycling is not yet modeled.

## Milestones

### 2026-09-06 — Phase 1 foundation and privacy repair

- Repaired private-state leaks, build boundaries, host-authoritative waiting/start, and lifecycle bypasses.
- Added graphical 52-card presentation, independent `/?table=<matchID>` spectator table, replay rules, and SocketIO privacy regressions.
- Physical LAN testing used real phones plus a TV/public table and exercised create/join/start/draw/reveal/replay.

### 2026-09-07 — Hosted Phase 1 completion

- Railway frontend: `https://card-genie-web-production.up.railway.app`
- Railway backend: `https://card-genie-production.up.railway.app`
- Added production `PORT`/origin configuration and Railway start/preview fixes.
- User completed a two-player hosted Highest Card game with PC + phone. Public-table/replay paths were not separately rerun in that exact hosted game; they had prior LAN/browser/automated coverage.

### 2026-09-07 — GameDefinition v0 and generic runtime

- Added versioned, closed, data-only `GameDefinition` schema and deterministic structured validator.
- Added generic runtime with injected trusted shuffle, authoritative actions/outcomes, and allowlisted views.
- Migrated live Highest Card onto the runtime while preserving boardgame.io/session/transport boundaries.

### 2026-09-07 — War proves paired battles

- Added generic paired-battle vocabulary and `warDefinition`: equal 26-card piles, one-card reveals, rank comparison, whole-pot append, repeated 3-down/1-up ties, insufficient-card loss, and all-card ownership completion.
- Runtime executes War without branching on game ID; pile/pot identities remain private.
- Added thin boardgame.io War adapter, server registration, game selector, War board, replay, public-table support, and SocketIO privacy coverage.
- User manually exercised a first reveal that tied K/K and resolved to a 10/A war. Counts were correct (21/31), but the screenshot revealed that the six face-down war cards were not represented visually.

### 2026-09-07 — Crazy Eights proves persistent hands

- Added generic matching-discard vocabulary and `crazyEightsDefinition` for 2–4 players with five private cards each.
- Runtime supports matching active suit/rank, wild 8 suit selection, fallback-only one-card draw, public discard/active suit/hand counts, and first-empty-hand victory.
- Added adapter, server registration, lobby selection, playable board, public table, and SocketIO privacy regression.
- Automated builds/tests pass; full manual device-game validation remains outstanding.

### 2026-09-07 — Generic table placement model

- Added definition-driven `battle.table` policy with logical zone, current rules ownership, and placement attribution. Runtime placements additionally carry face state and contribution sequence.
- Authoritative state retains card identity. Every outbound view replaces face-down placement identity with `null` while preserving only public zone/face/ownership/attribution/sequence metadata.
- War now describes its battle area as neutral ownership with placer attribution; this allows a card to stop belonging to a player while still showing who contributed it.
- War UI renders placement sequences rather than guessing from War rules: opening face-up reveal, stacked face-down backs with count, then each subsequent face-up war reveal. Repeated wars remain representable.
- Tests prove the same placement machinery with a renamed non-War definition using player-owned, unattributed table cards, avoiding game-name branching.
- PR #2 CI: server build, client build, and 39/39 tests pass, including real SocketIO privacy checks. Manual visual validation of the new layout remains pending.
