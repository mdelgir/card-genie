import { serverUrl } from "./config";
import type { BoardProps } from "boardgame.io/react";
import type { SimpleCardGameState } from "@games/simple-card-game";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";


export function GameBoard({ G, ctx, moves, matchData, playerID, matchID, credentials, isConnected }: BoardProps<SimpleCardGameState>) {
  if (!G.started) return <WaitingRoom serverUrl={serverUrl} matchID={matchID}
    playerID={playerID} credentials={credentials} isConnected={isConnected} />;
  const isTable = !playerID;
  const ownCard = playerID ? G.hands[playerID] : null;
  const isTurn = playerID === ctx.currentPlayer && !G.revealed;
  const name = (id: string) => matchData?.find(player => String(player.id) === id)?.name ?? `Player ${Number(id) + 1}`;
  const status = G.revealed ? G.winner === "tie" ? "An even match. It's a tie." : G.winner !== null ? `${name(G.winner)} wins the round` : "Round complete" :
    isTurn ? "Your turn. Make your draw." : `${name(ctx.currentPlayer)} is up next`;

  return <section className={`board game-board${isTable ? " table" : ""}`}>
    <header className="board-heading">
      <div><p className="eyebrow">{isTable ? "THE SHARED TABLE" : "YOUR SEAT"}</p><h2>{isTable ? "Centre stage" : name(playerID!)}</h2></div>
      <span className={`round-badge${G.revealed ? " round-badge--complete" : ""}`}>{G.revealed ? "REVEALED" : "HIGH CARD"}</span>
    </header>
    <p className={`status${isTurn ? " status--active" : ""}`} aria-live="polite"><span className="status-dot" />{status}</p>

    <div className={`felt-surface${isTable ? " felt-surface--public" : ""}`}>
      <div className="table-watermark" aria-hidden="true">♠</div>
      <section className="deal-area" aria-label={isTable ? "Draw pile" : "Your private hand and draw pile"}>
        <div className="deck-zone">
          <div className="deck-stack"><PlayingCard variant="back" label="Undealt deck, face down" /></div>
          <span className="zone-label">THE DECK</span><span className="deck-count">{G.deckCount} cards remaining</span>
        </div>
        {!isTable && <div className="hand-zone">
          {ownCard ? <PlayingCard variant="face" card={ownCard} size="large" winner={G.revealed && G.winner === playerID} /> :
            <PlayingCard variant="empty" size="large" />}
          <span className="zone-label">YOUR HAND</span><span className="deck-count">{G.revealed ? "Revealed to the table" : "Only visible to you"}</span>
        </div>}
      </section>
      {!isTable && <div className="game-actions">
        {!G.revealed ? <button type="button" onClick={() => moves.drawCard()} disabled={!isConnected || !isTurn || Boolean(ownCard)}>Draw card <span aria-hidden="true">↗</span></button> :
          <button type="button" onClick={() => moves.restartGame()}>Play again <span aria-hidden="true">↻</span></button>}
      </div>}

      <section className="players" aria-label="Public player cards">
        <div className="zone-heading"><span /> <h3>{isTable ? "AROUND THE TABLE" : "ON THE TABLE"}</h3> <span /></div>
        <ul className="player-card-grid">{Object.entries(G.hands).map(([id, card]) => {
          const winning = G.revealed && G.winner === id;
          const current = !G.revealed && ctx.currentPlayer === id;
          return <li key={id} className={`player-slot${current ? " player-slot--active" : ""}`}>
            {G.revealed && card ? <PlayingCard variant="face" card={card} winner={winning} /> :
              G.hasDrawn[id] ? <PlayingCard variant="back" label={`${name(id)}'s card, face down`} /> : <PlayingCard variant="empty" label={`${name(id)} has not drawn yet`} />}
            <span className="player-name">{name(id)}{id === playerID ? " (you)" : ""}</span>
            <span className="player-state">{winning ? "Winner" : G.revealed ? "Revealed" : current ? "Drawing next" : G.hasDrawn[id] ? "Card drawn" : "Waiting"}</span>
          </li>;
        })}</ul>
      </section>
    </div>
    <footer className="board-footer"><span aria-hidden="true">◇</span> {isTable ? "Public cards only · Everyone shares the moment" : "One card each. Highest card wins."}</footer>
  </section>;
}
