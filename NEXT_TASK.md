# Next Task — Shelem trick play

Read `docs/shelem-rules.md` and the existing Shelem auction/declarer-setup runtime first.

Implement the smallest generic/data-only slice from **ready for trick play** through **12 completed tricks, ready for scoring**:
- declarer leads trick 1 and must lead trump;
- thereafter each trick winner leads the next trick;
- four players act in rightward seat order from the leader;
- must follow led suit when possible; if void, any card is legal;
- trump beats non-trump; otherwise highest led-suit card wins; Ace high;
- each played card is public while the trick is active;
- after 4 cards, determine winner authoritatively and move the ordered trick onto that winner team’s hidden collection pile, with each later won trick stacked on top while preserving card/play order for exact future deck reconstruction;
- public/player views may expose trick winner and team trick counts, but must not expose identities from already-collected piles or any computed/live current-deal point totals;
- after 12 tricks, all player hands are empty and state becomes ready for deal scoring; do not yet modify cumulative scores or rotate dealer.

Reject wrong player/phase, cards not owned, and follow-suit violations without mutation. Preserve contract, trump, declarer discard stack, frozen cumulative scores, and 52-card conservation.

Do not implement deal scoring, match end, next-deal pile merge/cut, or Shelem UI yet. No game-id branching or executable user rules.

Add focused validator/runtime/privacy/order/conservation tests, keep all existing games/tests green, update `ledger.md`, commit, and stop.
