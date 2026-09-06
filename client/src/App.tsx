import { serverUrl } from "./config";
import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import { LobbyClient } from "boardgame.io/client";
import { useEffect, useMemo, useState } from "react";
import { SimpleCardGame } from "@games/simple-card-game";
import QRCode from "qrcode";
import { GameBoard } from "./GameBoard";
import { useRoomSeats } from "./WaitingRoom";


const GameClient = Client({
  game: SimpleCardGame,
  board: GameBoard,
  multiplayer: SocketIO({ server: serverUrl }),
});

export default function App() {
  const [playerID, setPlayerID] = useState("");
  const [playerName, setPlayerName] = useState("Player");
  const [matchID, setMatchID] = useState("");
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerCredentials, setPlayerCredentials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const { seats, error: seatsError } = useRoomSeats(serverUrl, joined ? "" : matchID);
  const [roomQr, setRoomQr] = useState<string | null>(null);
  const gameName = SimpleCardGame.name ?? "simple-card-game";
  const lobbyClient = useMemo(() => new LobbyClient({ server: serverUrl }), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setMatchID(room);
    }
  }, []);

  useEffect(() => {
    const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(matchID)}`;
    QRCode.toDataURL(roomUrl, { margin: 1, width: 220 })
      .then(setRoomQr)
      .catch(() => setRoomQr(null));
  }, [matchID]);

  const createRoom = async () => {
    setError(null);
    try {
      setBusy(true);
      const response = await fetch(`${serverUrl}/games/${gameName}/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numPlayers, setupData: { hostName: playerName.trim() } }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setMatchID(result.matchID);
      setPlayerID(result.playerID);
      setPlayerCredentials(result.playerCredentials);
      setJoined(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room.";
      setError(message);
    } finally { setBusy(false); }
  };

  const joinRoom = async () => {
    setError(null);
    try {
      setBusy(true);
      const match = await lobbyClient.getMatch(gameName, matchID);
      const maxPlayers = match.players.length;
      const numericID = Number(playerID);

      if (!Number.isInteger(numericID) || numericID < 0 || numericID >= maxPlayers) {
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
      <header className="app-masthead"><div className="wordmark"><span aria-hidden="true">♠</span> Card Genie</div><p>A little luck. A great night.</p></header>
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
              Player seat
              <select id="player" value={playerID} onChange={(event) => setPlayerID(event.target.value)}>
                <option value="">Choose an available seat</option>
                {seats.map(seat => <option key={seat.id} value={String(seat.id)} disabled={Boolean(seat.name)}>
                  Seat {seat.id + 1}: {seat.name || "Available"}
                </option>)}
              </select>
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
              <button type="button" onClick={createRoom} disabled={busy || !playerName.trim() || !Number.isInteger(numPlayers) || numPlayers < 2 || numPlayers > 8}>
                Create room
              </button>
              <button
                type="button"
                onClick={joinRoom}
                disabled={busy || !playerID || !playerName.trim() || !matchID || !seats.some(seat => String(seat.id) === playerID && !seat.name)}
              >
                Join game
              </button>
            </div>
            {matchID && roomQr && (
              <div className="qr">
                <img src={roomQr} alt={`Room ${matchID} QR`} />
                <span>Scan to join this room</span>
              </div>
            )}
            {(error || seatsError) && <p className="error">{error || seatsError}</p>}
          </section>
        )}

        {joined && <section className="join room-share"><p>Room: <strong>{matchID}</strong> — <a href={`/?room=${encodeURIComponent(matchID)}`}>Join link</a></p>
          {roomQr && <div className="qr"><img src={roomQr} alt="Scan to join this room" /></div>}</section>}
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
