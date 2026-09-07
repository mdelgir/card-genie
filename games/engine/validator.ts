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

  const root = object(input, "", ["schemaVersion", "id", "name", "players", "setup", "visibility", "turn", "roundEnd", "winner", "battle", "handPlay"]);
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

  const paired = Object.prototype.hasOwnProperty.call(root, "battle");
  const matching = Object.prototype.hasOwnProperty.call(root, "handPlay");
  if (paired && matching) error("handPlay", "contradictory-rule", "Battle and persistent-hand play modes cannot be combined in v0.");

  const setupKeys = ["deck", "roundStart",
    ...((paired || matching) ? ["deal"] : []), ...(matching ? ["discard"] : [])];
  const setup = object(root.setup, "setup", setupKeys);
  choice(setup.deck, "setup.deck", ["standard-52"]);
  tagged(setup.roundStart, "setup.roundStart", ["shuffle"]);

  if (paired || matching) {
    const deal = tagged(setup.deal, "setup.deal", ["deal-equal"], ["count", "face", "order"]);
    const countValid = integer(deal.count, "setup.deal.count", 1, 52);
    if (paired && countValid && deal.count !== 26) {
      error("setup.deal.count", "contradictory-rule", "Two battle piles must exhaust the standard deck: 26 cards each.");
    }
    if (matching && countValid && deal.count !== 5) {
      error("setup.deal.count", "unsupported-rule", "Matching-discard v0 deals exactly five cards to each player.");
    }
    choice(deal.face, "setup.deal.face", ["down"]);
    choice(deal.order, "setup.deal.order", ["round-robin"]);
  }

  if (paired) {
    if (players.min !== 2 || players.max !== 2) {
      error("players", "contradictory-rule", "Paired contributions require exactly two players.");
    }
    const battle = tagged(root.battle, "battle", ["compare-contributions"], ["comparison", "direction", "ace", "collect", "ties"]);
    choice(battle.comparison, "battle.comparison", ["compare-rank"]);
    choice(battle.direction, "battle.direction", ["highest-wins"]);
    choice(battle.ace, "battle.ace", ["high"]);
    const collect = tagged(battle.collect, "battle.collect", ["append-pot"], ["order"]);
    choice(collect.order, "battle.collect.order", ["contribution-order"]);
    const ties = tagged(battle.ties, "battle.ties", ["repeat-contribution"], ["faceDown", "faceUp", "insufficient", "bothInsufficient"]);
    if (integer(ties.faceDown, "battle.ties.faceDown", 0, 51) && ties.faceDown !== 3) {
      error("battle.ties.faceDown", "unsupported-rule", "Only three face-down tie contributions are currently specified.");
    }
    if (integer(ties.faceUp, "battle.ties.faceUp", 1, 52) && ties.faceUp !== 1) {
      error("battle.ties.faceUp", "contradictory-rule", "Rank comparison requires exactly one face-up card per seat.");
    }
    choice(ties.insufficient, "battle.ties.insufficient", ["lose"]);
    choice(ties.bothInsufficient, "battle.ties.bothInsufficient", ["tie"]);
  }

  if (matching) {
    if (players.min !== 2 || players.max !== 4) {
      error("players", "unsupported-rule", "Matching-discard v0 supports the configured 2–4 player range.");
    }
    const discard = tagged(setup.discard, "setup.discard", ["seed-discard"], ["count", "face"]);
    if (integer(discard.count, "setup.discard.count", 1, 1)) choice(discard.count, "setup.discard.count", [1]);
    choice(discard.face, "setup.discard.face", ["up"]);
    const handPlay = tagged(root.handPlay, "handPlay", ["matching-discard"], ["legal", "wild", "fallback"]);
    const legal = tagged(handPlay.legal, "handPlay.legal", ["match-suit-or-rank"], ["wildRank"]);
    choice(legal.wildRank, "handPlay.legal.wildRank", ["8"]);
    const wild = tagged(handPlay.wild, "handPlay.wild", ["choose-suit"], ["rank"]);
    choice(wild.rank, "handPlay.wild.rank", ["8"]);
    const fallback = tagged(handPlay.fallback, "handPlay.fallback", ["draw-if-no-legal-play"], ["count", "after"]);
    if (integer(fallback.count, "handPlay.fallback.count", 1, 52) && fallback.count !== 1) {
      error("handPlay.fallback.count", "unsupported-rule", "Matching-discard v0 draws exactly one fallback card.");
    }
    choice(fallback.after, "handPlay.fallback.after", ["end-turn"]);
  }

  const visibility = object(root.visibility, "visibility", ["deck", "hand", "reveal",
    ...(matching ? ["handCount", "discard"] : [])]);
  choice(visibility.deck, "visibility.deck", ["server-only"]);
  choice(visibility.hand, "visibility.hand", [paired ? "server-only" : "owner-only"]);
  if (matching) {
    choice(visibility.handCount, "visibility.handCount", ["public"]);
    choice(visibility.discard, "visibility.discard", ["top-public"]);
  }
  const reveal = tagged(visibility.reveal, "visibility.reveal", ["reveal"], ["when"]);
  choice(reveal.when, "visibility.reveal.when", [paired ? "contribution" : matching ? "discard" : "round-end"]);

  const turn = object(root.turn, "turn", ["order", "action", "progression"]);
  choice(turn.order, "turn.order", [paired || matching ? "seat-order" : "random"]);
  let actionCount: number | undefined;
  if (matching) {
    tagged(turn.action, "turn.action", ["play-or-draw"]);
  } else {
    const action = tagged(turn.action, "turn.action", [paired ? "reveal-top" : "draw"], ["count"]);
    if (integer(action.count, "turn.action.count", 1, 52)) actionCount = action.count;
  }
  tagged(turn.progression, "turn.progression", [paired ? "next-battle" : "next-player"]);
  tagged(root.roundEnd, "roundEnd", [paired ? "all-cards-owned" : matching ? "empty-hand" : "all-players-acted"]);

  const winner = tagged(root.winner, "winner", paired ? ["all-cards-owner"] : matching ? ["first-empty-hand"] : ["highest-wins", "lowest-wins"],
    paired || matching ? [] : ["comparison", "ace", "ties"]);
  if (!paired && !matching) {
    choice(winner.comparison, "winner.comparison", ["compare-rank"]);
    choice(winner.ace, "winner.ace", ["high"]);
    choice(winner.ties, "winner.ties", ["tie"]);
  }
  if (actionCount !== undefined && actionCount !== 1) {
    error("turn.action.count", "contradictory-rule", "Rank comparison requires one card per player; multi-card aggregation is undefined in v0.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, definition: input as GameDefinition };
}
