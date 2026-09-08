# Next Task — Shelem declarer setup

Read `docs/shelem-rules.md` and the existing Shelem auction foundation first.

Implement the smallest generic/data-only slice from **trump chosen** to **ready for trick play**:
- declarer takes the 4-card kitty into their private hand (12 -> 16); kitty identities stay private;
- declarer must choose exactly 4 owned cards to place face down into their team collection pile, preserving deterministic order for later deck reconstruction;
- expose that discard only as a public opaque 4-card face-down stack/count with declarer/team attribution; never expose identities;
- after discard, declarer has 12 cards, contract/trump remain public, and state becomes ready for trick play with declarer as first leader;
- reject wrong-player, wrong-phase, duplicate/invalid-card, or wrong-count actions without mutation;
- keep public cumulative team scores frozen at deal start and do not expose current-deal totals.

Do not implement trick play, trick scoring, deal scoring, match end, or Shelem UI yet. No game-id branching or executable user rules.

Add focused validator/runtime/privacy tests, keep all existing games/tests green, update `ledger.md`, commit, and stop.
