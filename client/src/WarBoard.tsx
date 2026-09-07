import { serverUrl } from "./config";
import type { BoardProps } from "boardgame.io/react";
import type { WarGameState } from "@games/war-game";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";

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

      <section className="players" aria-label="Latest face-up battle cards">
        <div className="zone-heading"><span /> <h3>LATEST BATTLE</h3> <span /></div>
        {G.contributions.length ? <ul className="player-card-grid">{G.contributions.map((entry, index) => {
          const battleWinner = G.battleResult?.type === "player" && G.battleResult.playerID === entry.playerID;
          return <li key={`${entry.playerID}-${index}`} className="player-slot">
            <PlayingCard variant="face" card={entry.card} winner={battleWinner} />
            <span className="player-name">{name(entry.playerID)}</span>
            <span className="player-state">{index >= 2 ? "War reveal" : "Battle reveal"}</span>
          </li>;
        })}</ul> : <p role="status">No cards revealed yet.</p>}
        {G.contributions.length > 0 && <p className="deck-count">
          {battleWinnerName ? `${battleWinnerName} collected this battle.` : G.battleResult?.type === "tie" ? "Battle ended tied." : "Battle resolved."}
          {G.potCount ? ` ${G.potCount} cards remain in the pot.` : ""}
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
    <footer className="board-footer"><span aria-hidden="true">◇</span> Pile identities stay private · Only face-up battle cards are public</footer>
  </section>;
}
