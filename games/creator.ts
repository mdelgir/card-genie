import type { GameDefinition, TablePlacementDefinition } from "./engine/types";
import { highestCardDefinition } from "./definitions/highest-card";
import { warDefinition } from "./definitions/war";
import { crazyEightsDefinition } from "./definitions/crazy-eights";

export type CreatorFamily = "draw-compare" | "paired-battle" | "matching-discard";
export type RankWinner = "highest-wins" | "lowest-wins";

export interface CreatorDraft {
  family: CreatorFamily;
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  rankWinner: RankWinner;
  tableZone: string;
  tableOwnership: TablePlacementDefinition["ownership"];
  tableAttribution: TablePlacementDefinition["attribution"];
}

export function defaultCreatorDraft(family: CreatorFamily = "draw-compare"): CreatorDraft {
  if (family === "paired-battle") {
    return {
      family, id: "my-war-game", name: "My War Game", minPlayers: 2, maxPlayers: 2,
      rankWinner: "highest-wins", tableZone: "battle", tableOwnership: "neutral", tableAttribution: "placer",
    };
  }
  if (family === "matching-discard") {
    return {
      family, id: "my-matching-game", name: "My Matching Game", minPlayers: 2, maxPlayers: 4,
      rankWinner: "highest-wins", tableZone: "discard", tableOwnership: "neutral", tableAttribution: "placer",
    };
  }
  return {
    family, id: "my-high-card-game", name: "My High Card Game", minPlayers: 2, maxPlayers: 8,
    rankWinner: "highest-wins", tableZone: "battle", tableOwnership: "neutral", tableAttribution: "placer",
  };
}

export function buildCreatorDefinition(draft: CreatorDraft): GameDefinition {
  if (draft.family === "paired-battle") {
    const definition = structuredClone(warDefinition) as GameDefinition;
    definition.id = draft.id;
    definition.name = draft.name;
    definition.players = { min: 2, max: 2 };
    if (definition.battle) {
      definition.battle.table = {
        zone: draft.tableZone,
        ownership: draft.tableOwnership,
        attribution: draft.tableAttribution,
      };
    }
    return definition;
  }

  if (draft.family === "matching-discard") {
    const definition = structuredClone(crazyEightsDefinition) as GameDefinition;
    definition.id = draft.id;
    definition.name = draft.name;
    definition.players = { min: 2, max: 4 };
    return definition;
  }

  const definition = structuredClone(highestCardDefinition) as GameDefinition;
  definition.id = draft.id;
  definition.name = draft.name;
  definition.players = { min: draft.minPlayers, max: draft.maxPlayers };
  definition.winner = {
    type: draft.rankWinner,
    comparison: "compare-rank",
    ace: "high",
    ties: "tie",
  };
  return definition;
}
