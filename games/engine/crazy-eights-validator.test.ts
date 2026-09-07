import test from "node:test";
import assert from "node:assert/strict";
import { crazyEightsDefinition } from "../definitions/crazy-eights";
import { highestCardDefinition } from "../definitions/highest-card";
import { warDefinition } from "../definitions/war";
import { createGameRuntime } from "./runtime";
import { validateGameDefinition } from "./validator";

function changed(path: string, value: unknown, remove = false): unknown {
  const input = structuredClone(crazyEightsDefinition);
  const keys = path.split(".");
  let target = input as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  if (remove) delete target[keys.at(-1)!];
  else target[keys.at(-1)!] = value;
  return input;
}
function rejects(input: unknown, path: string) {
  const before = structuredClone(input);
  const result = validateGameDefinition(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some(error => error.path === path), JSON.stringify(result.errors));
  assert.deepEqual(input, before);
}

test("Crazy Eights definition is data-only, round-trips, and is identity independent", () => {
  const original = structuredClone(crazyEightsDefinition);
  const result = validateGameDefinition(original);
  assert.ok(result.ok);
  assert.deepEqual(validateGameDefinition(JSON.parse(JSON.stringify(original))), result);
  assert.ok(validateGameDefinition({ ...original, id: "matching-hand", name: "Matching Hand" }).ok);
  assert.ok(validateGameDefinition(highestCardDefinition).ok);
  assert.ok(validateGameDefinition(warDefinition).ok);
  assert.deepEqual(original, crazyEightsDefinition);
});

test("matching-discard rejects unsupported setup, visibility, turn and outcome combinations", () => {
  for (const [path, value] of [
    ["players.max", 8],
    ["setup.deal.count", 7],
    ["setup.discard.count", 2],
    ["setup.discard.face", "down"],
    ["visibility.hand", "server-only"],
    ["visibility.handCount", "private"],
    ["visibility.discard", "private"],
    ["visibility.reveal.when", "round-end"],
    ["turn.order", "random"],
    ["turn.action.type", "draw"],
    ["turn.progression.type", "next-battle"],
    ["roundEnd.type", "all-players-acted"],
    ["winner.type", "highest-wins"],
  ] as const) rejects(changed(path, value), path.startsWith("players.") ? "players" : path);
});

test("matching-discard requires closed generic legal/wild/fallback semantics", () => {
  for (const [path, value, remove] of [
    ["handPlay.legal.wildRank", "7", false],
    ["handPlay.wild.rank", "9", false],
    ["handPlay.fallback.count", 2, false],
    ["handPlay.fallback.after", "continue-turn", false],
    ["handPlay.fallback.emptyDeck", "pass", false],
    ["setup.discard", undefined, true],
    ["handPlay.legal", undefined, true],
  ] as const) rejects(changed(path, value, remove), path);

  const mixed = structuredClone(crazyEightsDefinition) as unknown as Record<string, unknown>;
  mixed.battle = structuredClone(warDefinition.battle);
  rejects(mixed, "handPlay");

  const extra = changed("handPlay.callback", "doSomething");
  rejects(extra, "handPlay.callback");
});

test("validated matching-discard definition initializes the generic runtime", () => {
  assert.ok(validateGameDefinition(crazyEightsDefinition).ok);
  assert.ok(createGameRuntime(crazyEightsDefinition).ok);
});
