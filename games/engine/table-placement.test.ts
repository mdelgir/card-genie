import test from "node:test";
import assert from "node:assert/strict";
import { warDefinition } from "../definitions/war";
import { createGameRuntime } from "./runtime";
import { validateGameDefinition } from "./validator";

const warTieShuffle = (indices: number[]) => {
  if (indices.length !== 52) return indices;
  const prefix = [11, 24, 0, 1, 2, 3, 4, 5, 8, 12];
  return [...prefix, ...indices.filter(index => !prefix.includes(index))];
};

test("battle definition validates explicit table zone, ownership and attribution", () => {
  assert.ok(validateGameDefinition(warDefinition).ok);
  const playerOwned = structuredClone(warDefinition);
  playerOwned.battle.table = { zone: "challenge-area", ownership: "placer", attribution: "none" };
  assert.ok(validateGameDefinition(playerOwned).ok);

  const badZone = structuredClone(warDefinition) as unknown as { battle: { table: { zone: string } } };
  badZone.battle.table.zone = "Bad Zone";
  const result = validateGameDefinition(badZone);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some(error => error.path === "battle.table.zone"));
});

test("War tie records face-up/down table placements without leaking hidden identities", () => {
  const created = createGameRuntime(warDefinition);
  assert.ok(created.ok);
  if (!created.ok) return;
  const started = created.runtime.startRound(["0", "1"], warTieShuffle);
  assert.ok(started.ok);
  if (!started.ok) return;

  const resolved = created.runtime.applyAction(started.state, "0", { type: "reveal-top" });
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  const placements = resolved.state.battle?.placements ?? [];
  assert.equal(placements.length, 10);
  assert.equal(placements.filter(item => item.sequence === 0 && item.face === "up").length, 2);
  assert.equal(placements.filter(item => item.sequence === 1 && item.face === "down").length, 6);
  assert.equal(placements.filter(item => item.sequence === 1 && item.face === "up").length, 2);
  assert.ok(placements.every(item => item.zone === "battle" && item.ownerID === null && item.placedBy !== null));
  assert.ok(placements.every(item => item.card !== null));

  const publicView = created.runtime.playerView(resolved.state, null);
  const publicPlacements = publicView.tablePlacements ?? [];
  assert.equal(publicPlacements.length, placements.length);
  assert.ok(publicPlacements.filter(item => item.face === "down").every(item => item.card === null));
  assert.ok(publicPlacements.filter(item => item.face === "up").every(item => item.card !== null));
  assert.deepEqual(publicPlacements.map(item => ({
    zone: item.zone, sequence: item.sequence, face: item.face, ownerID: item.ownerID, placedBy: item.placedBy,
  })), placements.map(item => ({
    zone: item.zone, sequence: item.sequence, face: item.face, ownerID: item.ownerID, placedBy: item.placedBy,
  })));
});

test("placement ownership and attribution are definition-driven, not War-specific", () => {
  const definition = structuredClone(warDefinition);
  definition.id = "owned-battle";
  definition.name = "Owned Battle";
  definition.battle.table = { zone: "challenge-area", ownership: "placer", attribution: "none" };
  const created = createGameRuntime(definition);
  assert.ok(created.ok);
  if (!created.ok) return;
  const started = created.runtime.startRound(["alpha", "beta"], warTieShuffle);
  assert.ok(started.ok);
  if (!started.ok) return;
  const resolved = created.runtime.applyAction(started.state, "alpha", { type: "reveal-top" });
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  const placements = resolved.state.battle?.placements ?? [];
  assert.ok(placements.length > 0);
  assert.ok(placements.every(item => item.zone === "challenge-area" && item.placedBy === null));
  assert.deepEqual(new Set(placements.map(item => item.ownerID)), new Set(["alpha", "beta"]));
});
