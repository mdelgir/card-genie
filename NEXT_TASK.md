# Next Task — Shelem rule-model expansion

Use `docs/shelem-rules.md` as the concrete specification.

Add the smallest reusable data-only primitives needed for Shelem, starting with: fixed opposite-seat teams, rotating dealer/right-of seat order, ordered packet deal + face-down kitty, preserved deck order with cut-only preparation, auction/pass/declarer/trump state, and public cumulative team-score snapshots that remain frozen during a deal. Do not expose live current-deal totals in player/spectator views. Do not add arbitrary executable hooks or Shelem-ID branching.

Keep Creator manual test-play validation as a pending gate; do not mark it complete without user exercise.
