# Next Task — Shelem manual-test fixes

Manual Shelem testing found two concrete UI issues. Keep the authoritative rules/privacy intact and fix these without changing server card order.

## 1. Hand ordering and layout

For each player's private hand:
- default display order groups cards by suit, with ranks ordered consistently within each suit (Ace high);
- add a simple **Sort hand** control that restores the canonical suit-grouped order after manual changes;
- add a layout toggle between the current **spread** layout and a **stacked/cascaded** layout where cards overlap but each card's rank/suit corner remains readable;
- allow the player to reorder cards manually by drag/reorder; it must work on desktop and touch/pointer devices;
- sorting, stacking, and manual order are client-only presentation state. Never mutate the authoritative hand order just to render it;
- because game moves use authoritative card indices, map every displayed card back to its current server-hand index before play/discard actions. Reconcile manual order safely when kitty cards are added or cards leave the hand;
- keep discard selection correct after any sort/manual reorder and preserve all existing privacy guarantees.

Prefer no new dependency unless clearly necessary. Layout/sort preference may be remembered locally, but do not persist private card identities.

## 2. Right-of-dealer visual/auction consistency

Shelem bidding must begin with the player immediately to the dealer's **right**. The runtime already advances from dealer to `seat + 1`; make the board's circular seat layout visually agree with that convention. With seat 0 at the bottom, seat 1 should appear on seat 0's right and seat 3 on its left (opposite teams remain 0+2 and 1+3).

Verify after the fix:
- the visually right-hand neighbor of the dealer is the first bidder on every deal;
- bidding continues rightward among active players;
- dealer rotation and trick play remain consistent with the same visible direction;
- three opening passes still redeal with the same dealer.

Add focused tests for display-order/index mapping if practical, keep existing runtime/privacy tests green, run `npm run build:client`, `npm run build:server`, and `npm test`, update `ledger.md`/`LOG.md`, commit, and stop. Do not claim the manual gate complete until the user rechecks the UI.