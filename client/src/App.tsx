import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import { LobbyClient } from "boardgame.io/client";
import type { Ctx } from "boardgame.io";
import { useMemo, useState } from "react";
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
    restartGame: () => void;
  };
  matchData?: Array<{ id: number; name?: string }>;
  playerID?: string;
  isActive: boolean;
};

function formatCard(card: Card | null) {
  if (!card) return "No card";
  const suitLabel = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${card.rank} of ${suitLabel}`;
}

function Board({ G, ctx, moves, matchData, playerID }: BoardProps) {
  const isTableView = !playerID;
  const playerCard = playerID ? G.hands[playerID] : null;
  const currentPlayer = ctx.currentPlayer;
  const isPlayerTurn = playerID !== undefined && playerID === currentPlayer && !G.revealed;
  const canDraw = isPlayerTurn && !playerCard;
  const displayName = (id: string) =>
    matchData?.find((player) => String(player.id) === id)?.name ?? `Player ${id}`;

  return (
    <div className={isTableView ? "board table" : "board"}>
      <header>
        <h2>{isTableView ? "Table View" : displayName(playerID ?? "")}</h2>
        <p className="status">
          {G.revealed
            ? G.winner === "tie"
              ? "Result: Tie"
              : `Winner: ${displayName(G.winner)}`
            : isTableView
              ? `Current turn: ${displayName(currentPlayer)}`
              : isPlayerTurn
                ? "Your turn to draw"
                : `Waiting for ${displayName(currentPlayer)}`}
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
          {G.revealed && (
            <button type="button" onClick={() => moves.restartGame()}>
              Play again
            </button>
          )}
        </section>
      )}

      <section className="players">
        <h3>Players</h3>
        <ul>
          {Object.entries(G.hands).map(([id, card]) => {
            const hasDrawn = Boolean(card);
            return (
              <li key={id}>
                {displayName(id)}: {hasDrawn ? formatCard(card) : "Waiting"}
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
  const [playerID, setPlayerID] = useState("0");
  const [playerName, setPlayerName] = useState("Player");
  const [matchID, setMatchID] = useState("room-1");
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerCredentials, setPlayerCredentials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const gameName = SimpleCardGame.name ?? "simple-card-game";
  const lobbyClient = useMemo(
    () => new LobbyClient({ server: "http://localhost:8000" }),
    []
  );

  const createRoom = async () => {
    setError(null);
    try {
      const result = await lobbyClient.createMatch(gameName, {
        numPlayers,
      });
      setMatchID(result.matchID);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room.";
      setError(message);
    }
  };

  const joinRoom = async () => {
    setError(null);
    try {
      const match = await lobbyClient.getMatch(gameName, matchID);
      const maxPlayers = match.players.length;
      const numericID = Number(playerID);

      if (Number.isNaN(numericID) || numericID < 0 || numericID >= maxPlayers) {
        setError(`Player ID must be between 0 and ${maxPlayers - 1}.`);
        return;
      }

      const targetPlayer = match.players[numericID];
      if (targetPlayer?.name) {
        setError(`Player ${numericID} is already taken.`);
        return;
      }

      const result = await lobbyClient.joinMatch(
        gameName,
        matchID,
        {
          playerID,
          playerName,
        }
      );
      setPlayerCredentials(result.playerCredentials);
      setJoined(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room.";
      setError(message);
    }
  };

  return (
    <div className="app">
      <main>
        {!joined && (
          <section className="join">
            <h2>Join a room</h2>
            <label htmlFor="room">
              Room code
              <input
                id="room"
                value={matchID}
                onChange={(event) => setMatchID(event.target.value)}
              />
            </label>
            <label htmlFor="name">
              Player name
              <input
                id="name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </label>
            <label htmlFor="player">
              Player ID
              <input
                id="player"
                value={playerID}
                onChange={(event) => setPlayerID(event.target.value)}
              />
            </label>
            <label htmlFor="numPlayers">
              Number of players
              <input
                id="numPlayers"
                type="number"
                min={2}
                max={8}
                value={numPlayers}
                onChange={(event) => setNumPlayers(Number(event.target.value))}
              />
            </label>
            <div className="join-actions">
              <button type="button" onClick={createRoom} disabled={numPlayers < 2}>
                Create room
              </button>
              <button
                type="button"
                onClick={joinRoom}
                disabled={!playerID || !playerName || !matchID}
              >
                Join game
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        )}

        {joined && (
          <GameClient
            playerID={playerID}
            matchID={matchID}
            credentials={playerCredentials ?? undefined}
          />
        )}
        {joined && <GameClient matchID={matchID} />}
      </main>
    </div>
  );
}
