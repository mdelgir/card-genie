# Next Task — Shelem foundation

Read `docs/shelem-rules.md` first.

Implement the smallest generic/data-only engine slice needed to reach **end of auction**:
- exactly 4 seats; opposite-seat teams;
- dealer + rightward seat order; dealer rotates only after a completed deal;
- 12/12/12 + 4 face-down kitty + 12 packet deal;
- preserve deck order across deals and support trusted cut-only preparation (no full reshuffle after the first deal);
- auction: 100–165, multiples of 5, strictly increasing, permanent pass, first 3 passes => same dealer redeals, last bidder => declarer;
- declarer chooses trump;
- expose only public auction/dealer/team/kitty-count state; hands/kitty identities stay private;
- include public cumulative team scores frozen for the current deal; do not expose live deal totals.

Do not implement kitty pickup/discard, trick play, deal scoring, match end, or Shelem UI yet. Do not branch on game id or add executable user rules.

Add focused validator/runtime/privacy tests, keep existing games green, update `ledger.md`, commit, and stop.
