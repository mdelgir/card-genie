import test from "node:test";
import assert from "node:assert/strict";
import { buildCreatorDefinition, defaultCreatorDraft } from "./creator";
import { validateGameDefinition } from "./engine/validator";

for (const family of ["draw-compare", "paired-battle", "matching-discard"] as const) {
  test(`creator builds a valid ${family} definition that survives JSON round-trip`, () => {
    const definition = buildCreatorDefinition(defaultCreatorDraft(family));
    const result = validateGameDefinition(definition);
    assert.ok(result.ok, JSON.stringify(result));
    const roundTrip = validateGameDefinition(JSON.parse(JSON.stringify(definition)));
    assert.ok(roundTrip.ok, JSON.stringify(roundTrip));
  });
}

test("draw-compare creator applies player range and winner direction", () => {
  const draft = defaultCreatorDraft("draw-compare");
  Object.assign(draft, { id: "low-card", name: "Low Card", minPlayers: 3, maxPlayers: 6, rankWinner: "lowest-wins" });
  const definition = buildCreatorDefinition(draft);
  assert.deepEqual(definition.players, { min: 3, max: 6 });
  assert.equal(definition.winner.type, "lowest-wins");
  assert.ok(validateGameDefinition(definition).ok);
});

test("paired-battle creator applies generic table placement semantics", () => {
  const draft = defaultCreatorDraft("paired-battle");
  Object.assign(draft, { tableZone: "center-pot", tableOwnership: "placer", tableAttribution: "none" });
  const definition = buildCreatorDefinition(draft);
  assert.deepEqual(definition.battle?.table, { zone: "center-pot", ownership: "placer", attribution: "none" });
  assert.ok(validateGameDefinition(definition).ok);
});

test("creator output is still rejected by the authoritative validator when user data is invalid", () => {
  const draft = defaultCreatorDraft("draw-compare");
  draft.id = "Not valid";
  draft.minPlayers = 9;
  const result = validateGameDefinition(buildCreatorDefinition(draft));
  assert.ok(!result.ok);
  assert.ok(result.errors.some(error => error.path === "id"));
  assert.ok(result.errors.some(error => error.path === "players.min"));
});
