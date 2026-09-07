import test from "node:test";
import assert from "node:assert/strict";
import { highestCardDefinition } from "../definitions/highest-card";
import { validateGameDefinition } from "./validator";
import type { ValidationError } from "./types";

const fixture = () => structuredClone(highestCardDefinition);
function expectError(input: unknown, path: string, code: ValidationError["code"]) {
  const result = validateGameDefinition(input);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected invalid definition");
  assert.ok(result.errors.some(error => error.path === path && error.code === code), JSON.stringify(result));
  assert.ok(result.errors.every(error => error.message.length > 0 && error.path.length > 0));
}

test("Highest Card reference validates unchanged and survives JSON round-trip", () => {
  const original = fixture();
  const result = validateGameDefinition(original);
  assert.equal(result.ok, true);
  assert.deepEqual(original, highestCardDefinition);
  const parsed: unknown = JSON.parse(JSON.stringify(original));
  assert.deepEqual(validateGameDefinition(parsed), result);
});

test("schema version, identity, required objects and closed fields are validated", () => {
  for (const schemaVersion of [undefined, 0, 2, "1"]) {
    const input: Record<string, unknown> = { ...fixture(), schemaVersion };
    if (schemaVersion === undefined) delete input.schemaVersion;
    expectError(input, "schemaVersion", "unsupported-version");
  }
  for (const id of ["", "Bad ID", 1, "a".repeat(65)]) {
    expectError({ ...fixture(), id }, "id", "invalid-value");
  }
  for (const name of ["", "   ", false, "n".repeat(101)]) {
    expectError({ ...fixture(), name }, "name", "invalid-value");
  }
  expectError({ ...fixture(), setup: null }, "setup", "invalid-type");
  expectError({ ...fixture(), source: "() => import('rules')" }, "source", "unknown-field");
  expectError({ ...fixture(), winner: { ...fixture().winner, callback: "eval('rules')" } }, "winner.callback", "unknown-field");
});

test("player ranges and draw counts reject malformed values", () => {
  for (const min of [0, -1, 1, 9, 2.5, "2", null]) {
    expectError({ ...fixture(), players: { min, max: 8 } }, "players.min", "invalid-range");
  }
  for (const max of [0, 9, 3.5, "8", null]) {
    expectError({ ...fixture(), players: { min: 2, max } }, "players.max", "invalid-range");
  }
  expectError({ ...fixture(), players: { min: 4, max: 2 } }, "players.max", "invalid-range");
  for (const count of [0, -1, 1.5, 53, "1", null]) {
    expectError({ ...fixture(), turn: { ...fixture().turn, action: { type: "draw", count } } }, "turn.action.count", "invalid-range");
  }
});

test("unknown primitives and contradictory rank rules are rejected", () => {
  const input = fixture();
  expectError({ ...input, turn: { ...input.turn, action: { type: "play-card", count: 1 } } }, "turn.action.type", "unsupported-rule");
  expectError({ ...input, setup: { ...input.setup, roundStart: { type: "deal" } } }, "setup.roundStart.type", "unsupported-rule");
  expectError({ ...input, roundEnd: { type: "custom-expression" } }, "roundEnd.type", "unsupported-rule");
  expectError({ ...input, winner: { ...input.winner, type: "score-points" } }, "winner.type", "unsupported-rule");
  input.turn.action.count = 2;
  expectError(input, "turn.action.count", "contradictory-rule");
  const lowest = fixture();
  lowest.winner.type = "lowest-wins";
  assert.equal(validateGameDefinition(lowest).ok, true);
  expectError({ ...lowest, visibility: { ...lowest.visibility, hand: "public" } }, "visibility.hand", "invalid-value");
  expectError({ ...lowest, winner: { ...lowest.winner, ties: "suit-order" } }, "winner.ties", "invalid-value");
});

test("non-JSON and executable values fail without invoking accessors or hooks", () => {
  for (const value of [() => 1, undefined, Symbol("rule"), BigInt(1), NaN, Infinity, new Date(), []]) {
    expectError({ ...fixture(), extra: value }, "extra", "non-data");
  }
  let invoked = false;
  const accessor = fixture();
  Object.defineProperty(accessor, "name", { enumerable: true, get: () => { invoked = true; throw new Error("executed"); } });
  expectError(accessor, "name", "non-data");
  expectError({ ...fixture(), toJSON: () => { invoked = true; return fixture(); } }, "toJSON", "non-data");
  assert.equal(invoked, false);
  const cycle: Record<string, unknown> = { ...fixture() };
  cycle.extra = cycle;
  expectError(cycle, "extra", "non-data");
});

test("malformed input returns deterministic structured errors without mutation", () => {
  for (const input of [null, false, "code", 42, {}, { players: {} }, { turn: { action: {} } }]) {
    const before = structuredClone(input);
    const result = validateGameDefinition(input);
    assert.equal(result.ok, false);
    assert.deepEqual(validateGameDefinition(input), result);
    assert.deepEqual(input, before);
  }
  const input = { ...fixture(), players: { min: 5, max: 2 }, winner: { type: "unknown" } };
  expectError(input, "players.max", "invalid-range");
  expectError(input, "winner.type", "unsupported-rule");
});
