import type { BoardProps } from "boardgame.io/react";
import type { CustomCardGameState } from "@games/custom-card-game";
import type { SimpleCardGameState } from "@games/simple-card-game";
import type { WarGameState } from "@games/war-game";
import type { CrazyEightsGameState } from "@games/crazy-eights-game";
import { WaitingRoom } from "./WaitingRoom";
import { GameBoard } from "./GameBoard";
import { WarBoard } from "./WarBoard";
import { CrazyEightsBoard } from "./CrazyEightsBoard";
import { serverUrl } from "./config";
import "./CustomGameBoard.css";

const wireWinner = (winner: NonNullable<CustomCardGameState["view"]>["winner"]): string | "tie" | null =>
  winner === null ? null : winner.type === "tie" ? "tie" : winner.playerID;

export function CustomGameBoard(props: BoardProps<CustomCardGameState>) {
  const { G, playerID, matchID, credentials, isConnected } = props;
  if (G.roundStatus === "waiting" || !G.started) {
    return <>
      <div className="custom-game-banner"><span>Custom game</span><strong>{G.definition.name}</strong></div>
      <WaitingRoom serverUrl={serverUrl} matchID={matchID} playerID={playerID}
        credentials={credentials} isConnected={isConnected} gameName="custom-card-game" />
    </>;
  }
  const view = G.view;
  if (!view) return <section className="board"><p role="status">Loading custom game state…</p></section>;

  let board;
  if (G.definition.battle) {
    const mapped: WarGameState = {
      deck: [],
      piles: Object.fromEntries(view.playOrder.map(id => [id, []])),
      pot: [],
      contributions: view.contributions ?? [],
      tablePlacements: view.tablePlacements ?? [],
      started: G.started,
      roundStatus: G.roundStatus,
      playOrder: [...view.playOrder],
      pileCounts: { ...(view.pileCounts ?? {}) },
      potCount: view.potCount ?? 0,
      battleResult: view.battleResult ?? null,
      winner: view.winner,
    };
    board = <WarBoard {...({ ...props, G: mapped } as unknown as BoardProps<WarGameState>)} />;
  } else if (G.definition.handPlay) {
    const mapped: CrazyEightsGameState = {
      deck: [], deckCount: view.deckCount,
      hands: Object.fromEntries(Object.entries(view.hands).map(([id, cards]) => [id, [...cards]])),
      discard: [], discardTop: view.discardTop ?? null, activeSuit: view.activeSuit ?? null,
      started: G.started, roundStatus: G.roundStatus, playOrder: [...view.playOrder],
      handCounts: { ...(view.handCounts ?? {}) }, winner: view.winner,
    };
    board = <CrazyEightsBoard {...({ ...props, G: mapped } as unknown as BoardProps<CrazyEightsGameState>)} />;
  } else {
    const mapped: SimpleCardGameState = {
      deck: [], started: G.started, roundStatus: G.roundStatus, deckCount: view.deckCount,
      hasDrawn: { ...view.hasActed },
      hands: Object.fromEntries(Object.entries(view.hands).map(([id, cards]) => [id, cards[0] ?? null])),
      winner: wireWinner(view.winner), revealed: view.revealed, playOrder: [...view.playOrder],
    };
    board = <GameBoard {...({ ...props, G: mapped } as unknown as BoardProps<SimpleCardGameState>)} />;
  }

  return <>
    <div className="custom-game-banner"><span>Custom game</span><strong>{G.definition.name}</strong></div>
    {board}
  </>;
}
