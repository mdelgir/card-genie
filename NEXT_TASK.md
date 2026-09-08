# Next Task — Finish Shelem end-to-end

Read `AGENTS.md`, `docs/shelem-rules.md`, `ledger.md`, and the current Shelem auction/declarer/trick runtime. **Do not stop at another partial slice. Finish Shelem as a playable built-in game and leave it automated-tested.**

## Complete authoritative rules/runtime

From current `ready-scoring` state:
- calculate hidden raw deal points exactly: each trick 5; each 5 = 5; each 10/A = 10; declarer discard stack adds one 5-point hand plus its card points; raw total must conserve to 165;
- contract `X`: defenders add raw points; declarer success `+X`; defenders win zero tricks => `+2X`; successful 165 => `+660` and takes precedence; failure `-X`; defenders raw `>=85` => `-2X`;
- never expose live/current-deal raw totals while a deal is in progress;
- reconstruct exact next deck top-first: defenders collection, declarer 4-card discard, declarer-team collection, preserving all internal card/trick order and all 52 cards;
- after a completed non-terminal deal rotate dealer once to the right, apply a trusted server-only cyclic cut (no full reshuffle), deal 12/12/12 + 4 kitty + 12, and publish the newly updated cumulative team scores;
- three opening passes automatically redeal with the same dealer, score-neutral, using cut-only preparation;
- persist cumulative match scores; end match when a team reaches 1165 or leads the other by 1165. If both teams newly satisfy the absolute 1165 threshold after the same deal, higher cumulative score wins; if exactly tied, continue. At match end publish final cumulative scores and winner;
- replay/new match resets scores, dealer/roles and deck lifecycle and uses a fresh trusted full shuffle only for the first deal.

Keep all rules generic/data-only where practical: no arbitrary executable user rules and no game-id branching inside the generic engine.

## Make Shelem a built-in playable game

Add a boardgame.io adapter and register it in server/client/lobby with exactly 4 seats and the existing room start/privacy lifecycle. Wire authoritative moves for bid, pass, trump choice, kitty pickup, 4-card discard, and trick card play. Server lifecycle must perform redeal/scoring/next-deal transitions; clients must never submit scores, deck order, cut points, winners, or hidden pile contents.

Add a usable responsive `ShelemBoard` for player and public-table modes:
- circular 4-seat layout with opposite teammates visually clear;
- always-visible **public cumulative match score table** for the two teams; during a deal it shows only the score as of deal start, never live deal points;
- dealer, declarer, contract/high bid, trump, auction turn/history/pass state;
- private owner hand only; other hands show count/backs only;
- public 4-card kitty as opaque backs/count; declarer pickup/discard controls; discarded stack stays opaque;
- auction controls only for the active eligible bidder; valid bids 100..165 in 5-point steps above current high bid plus Pass;
- trump picker only for declarer;
- exactly-four-card discard selection and confirmation;
- active trick shows all played cards publicly in seat order; illegal cards disabled when follow-suit or first-trick-trump rules require it; server remains authoritative;
- trick winner/team trick counts may be public, but collected pile identities and current-deal point totals remain hidden;
- clear match-winner state and replay control using existing conventions;
- public table URL and join links preserve `game=shelem` and spectators receive no private identities.

Do not add fancy animation; correctness/privacy/readability first.

## Automated completion gate

Add/extend focused tests so Shelem is automated-covered end-to-end, including:
- scoring totals/precedence, exact 85 threshold, Shelem, successful 165, failure cases;
- 52-card conservation and exact end-of-deal stack order -> cut-only next deal -> dealer rotation;
- three-pass same-dealer redeal;
- cumulative score freezing during deal and update only between deals/final match;
- match win by score and by 1165 lead, replay reset;
- adapter move authorization/phase transitions for all Shelem stages;
- real SocketIO privacy for four players + spectator: each player sees only own hand, kitty/discard/collected identities never leak, active trick is public, live deal totals absent, public cumulative score visible;
- regression coverage for reconnect/initial state/history transport as appropriate to the existing privacy guard;
- client/server build integration and existing games remain green.

Run `npm run build:server`, `npm run build:client`, and `npm test`. Fix failures. Update `ledger.md` and `LOG.md` with exact automated evidence and remaining **manual-only** validation. Commit and stop only when Shelem is implementation-complete and the automated suite is green.

Do **not** claim physical/browser/Railway manual validation unless actually performed; after this task the only expected Shelem work should be user manual play/visual validation and fixes found there.