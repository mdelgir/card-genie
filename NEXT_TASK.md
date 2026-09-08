# Next Task — Recheck Shelem hand UX

The observed hand/seat issues have been fixed in the client. No new coding unless the recheck finds a problem.

Verify in the current 4-player Shelem room (or a fresh one):
- initial private hand is grouped by suit with Ace-high rank order inside each suit;
- **Sort by suit** restores that canonical order after manual rearrangement;
- **Spread / Stacked** toggles work, and stacked cards overlap while leaving rank/suit corners readable;
- cards can be manually reordered by dragging on desktop and touch/pointer input;
- after sorting/reordering, discard selection and trick play still act on the intended card (display order is client-only and maps back to authoritative hand indices);
- kitty pickup adds all four cards without breaking the displayed order, and played/discarded cards disappear cleanly;
- with seat 0 at the bottom, seat 1 is visually on seat 0's right, seat 3 on the left, and the visually right-hand neighbor of the dealer is the first bidder;
- bidding continues in that same visible rightward direction and opposite teams remain 0+2 / 1+3.

Also continue the existing privacy/scoring manual gate. Do not claim browser/device/hosted validation complete until the user actually exercises it.
