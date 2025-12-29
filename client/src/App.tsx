import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import type { Ctx } from "boardgame.io";
import {
  SimpleCardGame,
  SimpleCardGameState,
  type Card,
} from "@games/simple-card-game";

const GameClient = Client({
  game: SimpleCardGame,
  board: Board,
  multiplayer: SocketIO({ server: "http://localhost:8000" }),
});

type BoardProps = {
  G: SimpleCardGameState;
  ctx: Ctx;
  moves: {
    drawCard: () => void;
  };
  playerID?: string;
  isActive: boolean;
};

function formatCard(card: Card | null) {
  if (!card) return "No card";
  const suitLabel = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${card.rank} of ${suitLabel}`;
}

function Board({ G, moves, playerID, isActive }: BoardProps) {
  const isTableView = playerID === undefined;
  const playerCard = playerID ? G.hands[playerID] : null;
  const canDraw = isActive && playerID !== undefined && !playerCard;

  return (
    <div className={isTableView ? "board table" : "board"}>
      <header>
        <h2>{isTableView ? "Table View" : `Player ${playerID}`}</h2>
        <p className="status">
          {G.revealed
            ? G.winner === "tie"
              ? "Result: Tie"
              : `Winner: Player ${G.winner}`
            : "Waiting for players to draw"}
        </p>
      </header>

      <section className="deck">
        <div>Cards remaining: {G.deck.length}</div>
      </section>

      {!isTableView && (
        <section className="hand">
          <h3>Your card</h3>
          <div className="card">{formatCard(playerCard)}</div>
          <button type="button" onClick={() => moves.drawCard()} disabled={!canDraw}>
            Draw card
          </button>
        </section>
      )}

      <section className="players">
        <h3>Players</h3>
        <ul>
          {Object.entries(G.hands).map(([id, card]) => {
            const hasDrawn = Boolean(card);
            return (
              <li key={id}>
                Player {id}: {hasDrawn ? formatCard(card) : "Waiting"}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default function App() {
  // Hello World!
  return (
    <div className="app">
      <main>
        <GameClient playerID="0" />
        <GameClient />
      </main>
    </div>
  );
}
