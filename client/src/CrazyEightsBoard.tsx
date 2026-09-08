import { useState } from "react";
import type { BoardProps } from "boardgame.io/react";
import type { CrazyEightsGameState } from "@games/crazy-eights-game";
import type { Suit } from "@games/simple-card-game";
import { serverUrl } from "./config";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";
import "./CrazyEightsBoard.css";

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export function CrazyEightsBoard({ G, ctx, moves, matchData, playerID, matchID, credentials, isConnected }: BoardProps<CrazyEightsGameState>) {
  const [wildSuit, setWildSuit] = useState<Suit>("spades");
  if (G.roundStatus === "waiting") return <WaitingRoom serverUrl={serverUrl} matchID={matchID}
    playerID={playerID} credentials={credentials} isConnected={isConnected} gameName="crazy-eights" />;

  const isTable = !playerID;
  const complete = G.roundStatus === "complete";
  const isTurn = !complete && playerID === ctx.currentPlayer;
  const canReplay = complete && playerID === ctx.currentPlayer;
  const hand = playerID ? G.hands[playerID] ?? [] : [];
  const top = G.discardTop;
  const name = (id: string) => matchData?.find(player => String(player.id) === id)?.name ?? `Player ${Number(id) + 1}`;
  const isLegal = (card: typeof hand[number]) => card.rank === "8" || card.suit === G.activeSuit || card.rank === top?.rank;
  const hasLegal = hand.some(isLegal);
  const hasWild = hand.some(card => card.rank === "8");
  const winnerName = G.winner?.type === "player" ? name(G.winner.playerID) : null;
  const status = complete ? G.winner?.type === "tie" ? "No draw cards remain. The game ends tied." :
    winnerName ? `${winnerName} empties their hand and wins` : "Game complete" :
    isTurn ? (hasLegal ? "Your turn — play a matching card or an 8." : "Your turn — no legal card, draw one.") :
      `${name(ctx.currentPlayer)} is playing`;

  return <section className={`board game-board${isTable ? " table" : ""}`}>
    <header className="board-heading">
      <div><p className="eyebrow">{isTable ? "THE SHARED TABLE" : "YOUR SEAT"}</p><h2>{isTable ? "Crazy Eights" : name(playerID!)}</h2></div>
      <span className={`round-badge${complete ? " round-badge--complete" : ""}`}>{complete ? "GAME COMPLETE" : "CRAZY EIGHTS"}</span>
    </header>
    <p className={`status${isTurn ? " status--active" : ""}`} aria-live="polite"><span className="status-dot" />{status}</p>

    <div className={`felt-surface${isTable ? " felt-surface--public" : ""}`}>
      <div className="table-watermark" aria-hidden="true">♠</div>

      <section className="players" aria-label="Public discard and active suit">
        <div className="zone-heading"><span /> <h3>DISCARD</h3> <span /></div>
        <ul className="player-card-grid"><li className="player-slot">
          {top ? <PlayingCard variant="face" card={top} size="large" /> : <PlayingCard variant="empty" size="large" />}
          <span className="player-name">Active suit: <span className="active-suit">{G.activeSuit ?? "—"}</span></span>
          <span className="player-state">Draw pile: {G.deckCount} cards</span>
        </li></ul>
      </section>

      <section className="players" aria-label="Player hand counts">
        <div className="zone-heading"><span /> <h3>HANDS</h3> <span /></div>
        <ul className="player-card-grid">{G.playOrder.map(id => <li key={id} className={`player-slot${ctx.currentPlayer === id && !complete ? " player-slot--active" : ""}`}>
          <PlayingCard variant="back" label={`${name(id)} has ${G.handCounts[id] ?? 0} private cards`} winner={G.winner?.type === "player" && G.winner.playerID === id} />
          <span className="player-name">{name(id)}{id === playerID ? " (you)" : ""}</span>
          <span className="player-state">{G.handCounts[id] ?? 0} cards{ctx.currentPlayer === id && !complete ? " · current turn" : ""}</span>
        </li>)}</ul>
      </section>

      {!isTable && !complete && <section className="players" aria-label="Your private hand">
        <div className="zone-heading"><span /> <h3>YOUR HAND</h3> <span /></div>
        {isTurn && hasWild && <div className="crazy-controls">
          <label>Suit for an 8
            <select value={wildSuit} onChange={event => setWildSuit(event.target.value as Suit)}>
              {suits.map(suit => <option key={suit} value={suit}>{suit}</option>)}
            </select>
          </label>
        </div>}
        <ul className="crazy-hand">{hand.map((card, index) => {
          const legal = isLegal(card);
          return <li key={`${card.suit}-${card.rank}-${index}`}>
            <button type="button" className="card-choice"
              aria-label={`Play ${card.rank} of ${card.suit}`}
              disabled={!isConnected || !isTurn || !legal}
              onClick={() => card.rank === "8" ? moves.playCard(index, wildSuit) : moves.playCard(index)}>
              <PlayingCard variant="face" card={card} />
            </button>
          </li>;
        })}</ul>
        <div className="game-actions">
          <button type="button" onClick={() => moves.drawCard()} disabled={!isConnected || !isTurn || hasLegal}>
            Draw one <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>}

      {!isTable && complete && <div className="game-actions">
        {canReplay ? <button type="button" onClick={() => moves.restartGame()} disabled={!isConnected}>
          Play again <span aria-hidden="true">↻</span>
        </button> : <p role="status">Waiting for {name(ctx.currentPlayer)} to start the next game.</p>}
      </div>}
    </div>
    <footer className="board-footer"><span aria-hidden="true">◇</span> Your hand stays private · Discard top, active suit, and hand counts are public</footer>
  </section>;
}
