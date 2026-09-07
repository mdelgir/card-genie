import test from "node:test";
import assert from "node:assert/strict";
import { warDefinition } from "../definitions/war";
import { highestCardDefinition } from "../definitions/highest-card";
import { validateGameDefinition } from "./validator";

function changed(path: string, value: unknown, remove = false): unknown {
  const input = structuredClone(warDefinition);
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
  assert.ok(!result.ok);
  assert.ok(result.errors.some(error => error.path === path && error.message.length > 0), JSON.stringify(result));
  assert.deepEqual(validateGameDefinition(input), result);
  assert.deepEqual(input, before);
}

test("War schema is data-only, round-trips, and does not depend on game identity", () => {
  const original = structuredClone(warDefinition);
  const result = validateGameDefinition(original);
  assert.ok(result.ok);
  assert.deepEqual(validateGameDefinition(JSON.parse(JSON.stringify(original))), result);
  assert.deepEqual(original, warDefinition);
  assert.ok(validateGameDefinition({ ...original, id: "paired-ranks", name: "Paired Ranks" }).ok);
  assert.ok(validateGameDefinition(highestCardDefinition).ok);
  assert.deepEqual(original.setup.deal, { type: "deal-equal", count: 26, face: "down", order: "round-robin" });
  assert.deepEqual(original.battle.ties, {
    type: "repeat-contribution", faceDown: 3, faceUp: 1, insufficient: "lose", bothInsufficient: "tie",
  });
});

test("paired rules reject contradictory setup, visibility, progression and outcomes", () => {
  const cases: [string, unknown, string?][] = [
    ["players.max", 3, "players"], ["setup.deal.count", 25], ["setup.deal.count", 27],
    ["setup.deal.count", 1.5], ["setup.deal.count", "26"],
    ["setup.deal.face", "up"], ["setup.deal.order", "random"],
    ["visibility.hand", "owner-only"], ["visibility.reveal.when", "round-end"],
    ["turn.order", "random"], ["turn.action.type", "draw"], ["turn.action.count", 2],
    ["turn.progression.type", "next-player"], ["roundEnd.type", "all-players-acted"],
    ["winner.type", "highest-wins"], ["battle.comparison", "compare-suit"],
    ["battle.direction", "lowest-wins"], ["battle.ace", "low"],
    ["battle.collect.type", "shuffle-pot"], ["battle.collect.order", "winner-first"],
    ["battle.ties.type", "single-contribution"], ["battle.ties.faceDown", -1],
    ["battle.ties.faceDown", 2], ["battle.ties.faceDown", 3.5],
    ["battle.ties.faceUp", 0], ["battle.ties.faceUp", 2],
    ["battle.ties.insufficient", "contribute-remaining"], ["battle.ties.bothInsufficient", "first-seat-wins"],
  ];
  for (const [path, value, errorPath] of cases) rejects(changed(path, value), errorPath ?? path);
});

test("paired rules require complete closed objects and cannot mix with draw rules", () => {
  for (const path of ["setup.deal", "battle.collect", "battle.ties"]) {
    rejects(changed(path, null), path);
    rejects(changed(path, undefined, true), path);
  }
  for (const path of ["setup.deal.count", "setup.deal.face", "setup.deal.order", "battle.comparison",
    "battle.direction", "battle.ace", "battle.collect.order", "battle.ties.faceDown",
    "battle.ties.faceUp", "battle.ties.insufficient", "battle.ties.bothInsufficient"]) {
    rejects(changed(path, undefined, true), path);
  }
  rejects(changed("battle", undefined, true), "turn.action.type");
  rejects({ ...warDefinition, gameType: "war" }, "gameType");
  rejects(changed("battle.collect.callback", "return winner"), "battle.collect.callback");
  rejects(changed("winner.comparison", "compare-rank"), "winner.comparison");
  rejects({ ...highestCardDefinition, battle: warDefinition.battle }, "setup.deal");
  rejects({ ...highestCardDefinition, setup: warDefinition.setup }, "setup.deal");
});

test("new rule objects reject executable data without invoking it", () => {
  let invoked = false;
  const input = structuredClone(warDefinition);
  Object.defineProperty(input.battle.ties, "faceDown", {
    enumerable: true, get() { invoked = true; return 3; },
  });
  const result = validateGameDefinition(input);
  assert.ok(!result.ok);
  assert.ok(result.errors.some(error => error.path === "battle.ties.faceDown" && error.code === "non-data"));
  assert.equal(invoked, false);
  assert.equal(validateGameDefinition(changed("battle.collect.callback", () => { invoked = true; })).ok, false);
  assert.equal(invoked, false);
});
