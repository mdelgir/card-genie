# Next Task — Shelem deal scoring + next-deal continuity

Read `docs/shelem-rules.md` and the current Shelem trick runtime first.

Implement the smallest generic/data-only slice from **ready-scoring** to a finalized completed deal that can feed the existing trusted `nextDeal` path:
- compute raw team points server-side from hidden collections: each played trick = 5; each 5 = 5; each 10/A = 10; declarer’s initial 4-card discard also counts as one 5-point hand plus its card points; total raw points must conserve to 165;
- let `X` be the contract. Defenders always add their raw points to cumulative score. Declarer team: success => `+X`; defenders won zero tricks => `+2X`; successful 165 => `+660` (takes precedence); failure => `-X`; defenders raw `>=85` => `-2X`;
- keep the current deal’s frozen public scoreboard unchanged while scoring/finalizing; do not expose raw/live deal totals. The new cumulative totals become public only when the next deal starts;
- build the exact completed top-first deck: defenders’ trick collection, then declarer 4-card discard stack, then declarer-team trick collection; preserve every existing internal order and all 52 cards;
- mark the deal complete and produce only trusted/server-side completed-deal data for `nextDeal`;
- verify `nextDeal` rotates dealer once, applies cut-only preparation, and starts the next packet deal with the newly updated public cumulative scores. Three-opening-pass redeals must remain same-dealer and score-neutral.

Do not implement match-win detection, Shelem UI/boardgame.io registration, or deployment yet. No player action may directly supply scores/completed deck, no game-id branching, no executable rules.

Add focused scoring/precedence/85-threshold/deck-order/privacy/conservation/next-deal tests, keep all existing games green, update `ledger.md`, commit, and stop.
