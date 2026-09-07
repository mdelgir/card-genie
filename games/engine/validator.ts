import type { GameDefinition, ValidationError, ValidationResult } from "./types";

/** Validate unknown data without executing callbacks, getters, or toJSON hooks.
 * Labels are inert text; rule strings are closed enumerations, never source code.
 * Error ordering is deterministic (schema order; sorted unknown/data keys).
 */
export function validateGameDefinition(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const error = (path: string, code: ValidationError["code"], message: string) => {
    errors.push({ path: path || "$", code, message });
  };
  const join = (path: string, key: string) => path ? `${path}.${key}` : key;
  const ancestors = new Set<object>();
  // Definitions are tiny. Bound traversal to reject cycles/deep malformed input.
  let visited = 0;
  const dataOnly = (value: unknown, path: string, depth = 0): boolean => {
    if (++visited > 2000 || depth > 32) {
      error(path, "non-data", "Definition exceeds the supported data size/depth.");
      return false;
    }
    if (value === null || typeof value === "string" || typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))) return true;
    if (typeof value !== "object") {
      error(path, "non-data", "Expected JSON data; functions, undefined, symbols, bigint and non-finite numbers are unsupported.");
      return false;
    }
    if (ancestors.has(value)) {
      error(path, "non-data", "Cyclic definitions are unsupported.");
      return false;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      error(path, "non-data", "Expected a plain data object; arrays and class instances are not part of v0.");
      return false;
    }
    if (Object.getOwnPropertySymbols(value).length) {
      error(path, "non-data", "Symbol properties are unsupported.");
      return false;
    }
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || !descriptor.enumerable) {
        error(join(path, key), "non-data", "Only enumerable data properties are supported; accessors are not allowed.");
        return false;
      }
      if (!dataOnly(descriptor.value, join(path, key), depth + 1)) return false;
    }
    ancestors.delete(value);
    return true;
  };
  try {
    if (!dataOnly(input, "")) return { ok: false, errors };
  } catch {
    // Exotic non-JSON objects (e.g. revoked proxies) may throw on inspection.
    error("", "non-data", "Definition cannot be inspected as plain data.");
    return { ok: false, errors };
  }

  const object = (value: unknown, path: string, keys: string[]): Record<string, unknown> => {
    if (!value || typeof value !== "object") {
      error(path, "invalid-type", "Expected an object.");
      return {};
    }
    for (const key of Object.keys(value).sort()) {
      if (!keys.includes(key)) error(join(path, key), "unknown-field", "Unsupported field.");
    }
    return value as Record<string, unknown>;
  };
  const choice = (value: unknown, path: string, values: readonly unknown[], code: ValidationError["code"] = "invalid-value") => {
    if (!values.includes(value)) error(path, code, `Expected ${values.map(String).join(" or ")}.`);
  };
  const integer = (value: unknown, path: string, min: number, max: number): value is number => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      error(path, "invalid-range", `Expected an integer from ${min} to ${max}.`);
      return false;
    }
    return true;
  };
  const tagged = (value: unknown, path: string, types: string[], fields: string[] = []) => {
    const result = object(value, path, ["type", ...fields]);
    choice(result.type, `${path}.type`, types, "unsupported-rule");
    return result;
  };
  const root = object(input, "", ["schemaVersion", "id", "name", "players", "setup", "visibility", "turn", "roundEnd", "winner"]);
  choice(root.schemaVersion, "schemaVersion", [1], "unsupported-version");
  if (typeof root.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(root.id) || root.id.length > 64) {
    error("id", "invalid-value", "Expected a lowercase kebab-case identifier of 1–64 characters.");
  }
  if (typeof root.name !== "string" || !root.name.trim() || root.name.length > 100) {
    error("name", "invalid-value", "Expected a nonblank display name of at most 100 characters.");
  }
  const players = object(root.players, "players", ["min", "max"]);
  const minValid = integer(players.min, "players.min", 2, 8);
  const maxValid = integer(players.max, "players.max", 2, 8);
  if (minValid && maxValid && (players.min as number) > (players.max as number)) {
    error("players.max", "invalid-range", "Maximum players must be at least minimum players.");
  }
  const setup = object(root.setup, "setup", ["deck", "roundStart"]);
  choice(setup.deck, "setup.deck", ["standard-52"]);
  tagged(setup.roundStart, "setup.roundStart", ["shuffle"]);
  const visibility = object(root.visibility, "visibility", ["deck", "hand", "reveal"]);
  choice(visibility.deck, "visibility.deck", ["server-only"]);
  choice(visibility.hand, "visibility.hand", ["owner-only"]);
  const reveal = tagged(visibility.reveal, "visibility.reveal", ["reveal"], ["when"]);
  choice(reveal.when, "visibility.reveal.when", ["round-end"]);
  const turn = object(root.turn, "turn", ["order", "action", "progression"]);
  choice(turn.order, "turn.order", ["random"]);
  const action = tagged(turn.action, "turn.action", ["draw"], ["count"]);
  const countValid = integer(action.count, "turn.action.count", 1, 52);
  tagged(turn.progression, "turn.progression", ["next-player"]);
  tagged(root.roundEnd, "roundEnd", ["all-players-acted"]);
  const winner = tagged(root.winner, "winner", ["highest-wins", "lowest-wins"], ["comparison", "ace", "ties"]);
  choice(winner.comparison, "winner.comparison", ["compare-rank"]);
  choice(winner.ace, "winner.ace", ["high"]);
  choice(winner.ties, "winner.ties", ["tie"]);
  if (countValid && action.count !== 1 && winner.comparison === "compare-rank") {
    error("turn.action.count", "contradictory-rule", "Rank comparison requires one card per player; multi-card aggregation is undefined in v0.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, definition: input as GameDefinition };
}
