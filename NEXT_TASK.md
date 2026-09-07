# Next Task — Crazy Eights schema

Extend the data-only definition/validator just enough for a deterministic Crazy Eights variant. No runtime/UI yet.

Use generic primitives only. Variant: 2–4 players, 5 cards each, one public discard starter; on turn play one card matching active suit or rank, any 8 is wild and chooses the active suit; draw exactly one only when no legal play, then end turn; first empty hand wins. Owner sees own hand; everyone sees hand counts, discard top, and active suit.

Preserve Highest Card + War definitions/runtime. Add `definitions/crazy-eights.ts` and focused validation/JSON-round-trip tests. No game-name branching, callbacks, expressions, dependencies, or unrelated work.

Run builds/tests, update ledger, commit, stop. Next: generic runtime support for this definition.