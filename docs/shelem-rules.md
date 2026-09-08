# Shelem rules specification

This document captures the concrete Shelem variant currently being targeted by Card Genie. It is intentionally written as game semantics first; generic engine vocabulary should be added only where this game proves it is needed.

## Players, seats and teams

- Exactly 4 players sit in a circle.
- Opposite seats are teammates: seats `0 + 2` versus seats `1 + 3`.
- Teammates may not communicate private hand information.
- Dealer rotates one seat to the right after each completed deal.

## Deck continuity and preparation

Shelem intentionally does **not** fully reshuffle the deck between deals.

At the end of play, cards are gathered while preserving their physical stack order. Each won trick is placed on top of that team's existing collection pile without reordering the four cards inside the trick. This means the relative order of cards and trick stacks remains part of the next deal's deck state.

At deal end, the piles are merged in this exact order:

1. The declarer's four-card face-down discard pile is placed on top of the declarer's team trick pile.
2. The defenders' complete trick pile is then placed on top of that declarer pile.

So, viewed from the top of the final 52-card stack downward, the order is:

```text
Defenders' collected trick pile
Declarer's 4-card face-down discard pile
Declarer's team's collected trick pile
```

Each component preserves its own internal physical order. The resulting 52-card stack becomes the starting deck order for the next deal.

The next deal is prepared only by cutting that pile rather than randomizing all 52 cards. A simple cut is a cyclic rotation of the existing deck order, so one or several ordinary cuts preserve the same adjacency structure. This is desirable: the previous deal tends to leave suit clusters in the deck, so a 12-card packet often has a dominant suit. Players commonly use that shape when deciding whether to bid or pass, but **having or lacking a dominant suit is not itself a rule** and must never be enforced by the engine.

The authoritative server therefore needs a trusted deck-preparation primitive that can preserve order across deals and apply a random cut without revealing the cut point or deck identities.

## Deal

Starting immediately to the dealer's right and continuing to the right:

1. Deal 12 cards to the player on the dealer's right.
2. Deal 12 cards to the next player (the dealer's teammate).
3. Deal 12 cards to the next player.
4. Place the next 4 cards face down in a neutral center/kitty zone.
5. Deal the final 12 cards to the dealer.

Each player's 12-card hand is private. The four center cards are public only as an opaque face-down count until the declarer takes them.

## Auction

- The player immediately to the dealer's right acts first.
- Minimum bid is 100.
- Maximum bid is 165.
- Every bid must be a multiple of 5 and must be strictly greater than the current high bid.
- A player may pass instead of bidding.
- Once a player passes, they are permanently out of that auction.
- If the first three players all pass before the dealer acts, there is no contract: the same dealer deals again.
- Otherwise bidding continues in seat order among players who have not passed until only one bidder remains.
- The remaining highest bidder becomes the declarer and the winning bid is the contract value `X`.

## Declarer setup

After winning the auction, the declarer:

1. Chooses the trump (ruling) suit.
2. Takes the four face-down center cards into their private hand, temporarily holding 16 cards.
3. Chooses any 4 cards and places them face down into the declarer's team collection area before trick play starts.

Those four discarded cards form one scoring hand worth 5 base points in addition to any card points contained in them. Their identities remain hidden during play.

## Trick play

- Ace is high. Rank order is `A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2`.
- The declarer leads the first trick and **must lead a trump card**.
- Thereafter, the winner of each trick leads the next trick.
- A player who has at least one card of the led suit must follow the led suit.
- A player who has no card of the led suit may play either a trump card or any card from another suit.
- Any trump beats any non-trump.
- If multiple trump cards are played, the highest trump wins.
- If no trump is played, the highest card of the led suit wins.
- An off-suit, non-trump discard can never win the trick.

The winning team's trick is collected as an ordered four-card stack, preserving play order. Each later won trick is placed on top of that team's existing pile, again without reordering the four cards. This ordered collection is authoritative game state because it determines the next deal's deck order.

## Points within a deal

Total available points are exactly **165**.

### Card points

- Each 5 is worth 5 points: `4 × 5 = 20`.
- Each 10 is worth 10 points: `4 × 10 = 40`.
- Each Ace is worth 10 points: `4 × 10 = 40`.
- All other cards are worth 0.

Total card points: **100**.

### Hand / trick points

- Each of the 12 played tricks is worth 5 points: `12 × 5 = 60`.
- The declarer's initial four-card face-down discard pile counts as one additional hand worth 5 points.

Total hand/trick points: **65**.

Grand total: `100 + 65 = 165`.

## Deal scoring

Let `X` be the winning auction contract.

- If the declarer's team makes at least `X`, it normally scores exactly `X` rather than its raw point total.
- The defending team scores the raw points it actually collected.
- If the defenders win **no played trick**, the declarer's team made a **Shelem** and scores `2 × X`.
- A successful **165** contract is special and scores `4 × 165 = 660` for the declarer's team.
- If the declarer's team fails to make `X`, it scores `-X`.
- If the defending team scores **85 or more**, the declarer's failure penalty is `-2 × X` instead.

The special successful-165 score takes precedence over the ordinary `2 × X` Shelem score.

## Match scoring and win condition

Scores persist across deals.

A team wins the match when either:

- its cumulative score reaches at least **1165**, or
- its lead over the opposing team reaches at least **1165**.

## Generic engine capabilities Shelem should prove

Shelem should be implemented by extending the validated data-only rules model, not by adding arbitrary executable user code. It is the concrete game that should drive the following reusable primitives:

- fixed teams derived from seat positions,
- circular seat relationships (`right-of`, opposite teammate),
- rotating dealer across deals,
- ordered packet dealing plus a face-down center kitty,
- deck order continuity across deals,
- trusted cut-only deck preparation instead of a full shuffle,
- auction/bidding with pass elimination, ranges and increments,
- redeal condition after three opening passes,
- declarer role and trump selection,
- take-kitty then discard-N face-down,
- trick-taking with follow-suit and trump legality,
- trick winner becomes next leader,
- ordered trick collection and persistent pile ordering,
- deterministic end-of-deal pile stacking,
- team-owned scoring piles with hidden card identities,
- card-value + per-trick + initial-discard scoring,
- contract scoring with threshold and special multipliers,
- cumulative multi-deal match scoring and win conditions.

## Deterministic pile merge

Exact cross-deal deck reproduction is now specified. At deal end, after each team's trick pile has preserved all trick/card order:

- declarer's four-card discard stack goes on top of the declarer's team pile;
- defenders' entire pile goes on top of that;
- the resulting 52-card pile is cut, not fully shuffled, before the next deal.

This final merge order is part of the rules/runtime state and must be reproduced deterministically by the server.
