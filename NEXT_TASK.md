# Next Task — Shelem manual validation

No new coding unless a failure appears.

Run one real 4-player Shelem game with a separate public table. Verify:
- create/join/start with exactly 4 seats and correct opposite teams;
- auction/pass flow, including one three-opening-pass same-dealer redeal if convenient;
- declarer trump choice, private kitty pickup, exactly-4 private discard;
- first lead must be trump, follow-suit legality, trump winner, next leader;
- public table shows active trick but never private hands, kitty/discard identities, collected cards, or live deal points;
- cumulative score table stays frozen during a deal, updates only after the deal, dealer rotates right, next deal uses the continued/cut deck lifecycle;
- complete at least one deal and verify scoring looks correct; if practical, continue to match end and replay/reset.

Check phone + desktop/table layout. Fix only observed failures, then update `ledger.md`/`LOG.md`. Do not claim Railway validation unless actually deployed and exercised.
