import { serverUrl } from "./config";
import type { BoardProps } from "boardgame.io/react";
import type { WarGameState } from "@games/war-game";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";
import "./WarBoard.css";

export function WarBoard({ G, ctx, moves, matchData, playerID, matchID, credentials, isConnected }: BoardProps<WarGameState>) {
  if (G.roundStatus === "waiting") return <WaitingRoom serverUrl={serverUrl} matchID={matchID}
    playerID={playerID} credentials={credentials} isConnected={isConnected} gameName="war" />;

  const isTable = !playerID;
  const complete = G.roundStatus === "complete";
  const isTurn = !complete && playerID === ctx.currentPlayer;
  const canReplay = complete && playerID === ctx.currentPlayer;
  const name = (id: string) => matchData?.find(player => String(player.id) === id)?.name ?? `Player ${Number(id) + 1}`;
  const winnerName = G.winner?.type === "player" ? name(G.winner.playerID) : null;
  const battleWinnerName = G.battleResult?.type === "player" ? name(G.battleResult.playerID) : null;
  const status = complete ? G.winner?.type === "tie" ? "The game ends in a tie." : winnerName ? `${winnerName} wins the war` : "Game complete" :
    isTurn ? "Your battle. Reveal the next cards." : `${name(ctx.currentPlayer)} controls the next battle`;
  const sequences = [...new Set(G.tablePlacements.map(placement => placement.sequence))].sort((a, b) => a - b);
  const finalSequence = sequences.at(-1) ?? 0;
  const attributedTo = (placement: WarGameState["tablePlacements"][number]) => placement.placedBy ?? placement.ownerID;

  return <section className={`board game-board${isTable ? " table" : ""}`}>
    <header className="board-heading">
      <div><p className="eyebrow">{isTable ? "THE SHARED TABLE" : "YOUR SEAT"}</p><h2>{isTable ? "War table" : name(playerID!)}</h2></div>
      <span className={`round-badge${complete ? " round-badge--complete" : ""}`}>{complete ? "GAME COMPLETE" : "WAR"}</span>
    </header>
    <p className={`status${isTurn ? " status--active" : ""}`} aria-live="polite"><span className="status-dot" />{status}</p>

    <div className={`felt-surface${isTable ? " felt-surface--public" : ""}`}>
      <div className="table-watermark" aria-hidden="true">♠</div>

      <section className="players" aria-label="Player draw piles">
        <div className="zone-heading"><span /> <h3>DRAW PILES</h3> <span /></div>
        <ul className="player-card-grid">{G.playOrder.map(id => {
          const current = !complete && ctx.currentPlayer === id;
          const finalWinner = G.winner?.type === "player" && G.winner.playerID === id;
          return <li key={id} className={`player-slot${current ? " player-slot--active" : ""}`}>
            <PlayingCard variant="back" label={`${name(id)}'s private War pile`} winner={finalWinner} />
            <span className="player-name">{name(id)}{id === playerID ? " (you)" : ""}</span>
            <span className="player-state">{G.pileCounts[id] ?? 0} cards{current ? " · next battle" : ""}</span>
          </li>;
        })}</ul>
      </section>

      <section className="players" aria-label="Latest battle table placements">
        <div className="zone-heading"><span /> <h3>LATEST BATTLE</h3> <span /></div>
        {G.tablePlacements.length ? <div className="war-battle-grid">{G.playOrder.map(id => {
          const lane = G.tablePlacements.filter(placement => attributedTo(placement) === id);
          return <section className="war-lane" key={id} aria-label={`${name(id)} battle cards`}>
            <h4>{name(id)}{id === playerID ? " (you)" : ""}</h4>
            <div className="war-sequence-strip">{sequences.map(sequence => {
              const step = lane.filter(placement => placement.sequence === sequence);
              const faceDown = step.filter(placement => placement.face === "down");
              const faceUp = step.filter(placement => placement.face === "up" && placement.card);
              if (!step.length) return null;
              return <div className="war-step" key={sequence}>
                <span className="war-step-label">{sequence === 0 ? "Opening reveal" : `War ${sequence}`}</span>
                {faceDown.length > 0 && <div className="war-hidden-pile"
                  aria-label={`${faceDown.length} face-down cards placed by ${name(id)}`}>
                  {faceDown.slice(0, 4).map((_, index) => <span className="war-hidden-card" key={index}
                    style={{ left: `${index * 7}px`, top: `${index * 3}px` }} aria-hidden="true">
                    <PlayingCard variant="back" />
                  </span>)}
                  <span className="war-hidden-count">×{faceDown.length} face-down</span>
                </div>}
                {faceUp.map((placement, index) => placement.card && <div className="war-face-up" key={index}>
                  <PlayingCard variant="face" card={placement.card}
                    winner={sequence === finalSequence && G.battleResult?.type === "player" && G.battleResult.playerID === id} />
                  <span>{sequence === 0 ? "Battle reveal" : "War reveal"}</span>
                </div>)}
              </div>;
            })}</div>
          </section>;
        })}</div> : <p role="status">No cards placed on the battle table yet.</p>}
        {G.tablePlacements.length > 0 && <p className="deck-count">
          {battleWinnerName ? `${battleWinnerName} collected this battle.` : G.battleResult?.type === "tie" ? "Battle ended tied." : "Battle resolved."}
          {` ${G.tablePlacements.length} cards were placed in the battle zone.`}
          {G.potCount ? ` ${G.potCount} cards remain uncollected.` : ""}
        </p>}
      </section>

      {!isTable && <div className="game-actions">
        {!complete ? <button type="button" onClick={() => moves.revealBattle()} disabled={!isConnected || !isTurn}>
          Reveal battle <span aria-hidden="true">↗</span>
        </button> : canReplay ? <button type="button" onClick={() => moves.restartGame()} disabled={!isConnected}>
          Play again <span aria-hidden="true">↻</span>
        </button> : <p role="status">Waiting for {name(ctx.currentPlayer)} to start the next game.</p>}
      </div>}
    </div>
    <footer className="board-footer"><span aria-hidden="true">◇</span> Face-down table cards keep their identities private · placement and attribution remain public</footer>
  </section>;
}
