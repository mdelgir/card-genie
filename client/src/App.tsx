import { serverUrl } from "./config";
import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import { LobbyClient } from "boardgame.io/client";
import { useEffect, useMemo, useState } from "react";
import { SimpleCardGame } from "@games/simple-card-game";
import { WarGame } from "@games/war-game";
import QRCode from "qrcode";
import { GameBoard } from "./GameBoard";
import { WarBoard } from "./WarBoard";
import { useRoomSeats } from "./WaitingRoom";

const HighestCardClient = Client({
  game: SimpleCardGame,
  board: GameBoard,
  multiplayer: SocketIO({ server: serverUrl }),
  debug: false,
});
const WarClient = Client({
  game: WarGame,
  board: WarBoard,
  multiplayer: SocketIO({ server: serverUrl }),
  debug: false,
});

type GameName = "simple-card-game" | "war";
const gameLabel = (game: GameName) => game === "war" ? "War" : "Highest Card";

export default function App() {
  const [tableRoom] = useState(() => new URLSearchParams(window.location.search).get("table"));
  const isTable = tableRoom !== null;
  const [gameName, setGameName] = useState<GameName>(() =>
    new URLSearchParams(window.location.search).get("game") === "war" ? "war" : "simple-card-game");
  const [playerID, setPlayerID] = useState("");
  const [playerName, setPlayerName] = useState("Player");
  const [matchID, setMatchID] = useState(() => tableRoom?.trim() ?? "");
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerCredentials, setPlayerCredentials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const { seats, error: seatsError } = useRoomSeats(serverUrl, joined ? "" : matchID, gameName);
  const [roomQr, setRoomQr] = useState<string | null>(null);
  const lobbyClient = useMemo(() => new LobbyClient({ server: serverUrl }), []);
  const ActiveGameClient = gameName === "war" ? WarClient : HighestCardClient;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room && !isTable) setMatchID(room);
  }, []);

  useEffect(() => {
    if (isTable) return;
    const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`;
    QRCode.toDataURL(roomUrl, { margin: 1, width: 220 })
      .then(setRoomQr)
      .catch(() => setRoomQr(null));
  }, [matchID, isTable, gameName]);

  const createRoom = async () => {
    setError(null);
    try {
      setBusy(true);
      const players = gameName === "war" ? 2 : numPlayers;
      const response = await fetch(`${serverUrl}/games/${gameName}/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numPlayers: players, setupData: { hostName: playerName.trim() } }),
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

      const result = await lobbyClient.joinMatch(gameName, matchID, { playerID, playerName });
      setPlayerCredentials(result.playerCredentials);
      setJoined(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room.";
      setError(message);
    }
  };

  const selectGame = (value: string) => {
    const next: GameName = value === "war" ? "war" : "simple-card-game";
    setGameName(next);
    setPlayerID("");
    if (next === "war") setNumPlayers(2);
  };

  return (
    <div className={`app${isTable ? " app--table" : ""}`}>
      <header className="app-masthead"><div className="wordmark"><span aria-hidden="true">♠</span> Card Genie</div><p>A little luck. A great night.</p></header>
      <main>
        {isTable && <>
          <section className="join room-share"><p>Public {gameLabel(gameName)} table · Room: <strong>{matchID || "Missing room code"}</strong></p><a href="/">Back to rooms</a></section>
          {!matchID || seatsError ? <section className="board"><p className="error" role="alert">{!matchID ? "This table link is missing a room code. Ask the host for the public table link." : seatsError}</p></section> :
            seats.length === 0 ? <p role="status">Loading public table…</p> : <ActiveGameClient matchID={matchID} />}
        </>}
        {!isTable && !joined && (
          <section className="join">
            <h2>Join a room</h2>
            <label htmlFor="game">
              Game
              <select id="game" value={gameName} onChange={(event) => selectGame(event.target.value)}>
                <option value="simple-card-game">Highest Card</option>
                <option value="war">War</option>
              </select>
            </label>
            <label htmlFor="room">
              Room code
              <input id="room" value={matchID} onChange={(event) => setMatchID(event.target.value)} />
            </label>
            <label htmlFor="name">
              Player name
              <input id="name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
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
            {gameName === "war" ? <p>War uses exactly 2 players.</p> : <label htmlFor="numPlayers">
              Number of players
              <input id="numPlayers" type="number" min={2} max={8} value={numPlayers}
                onChange={(event) => setNumPlayers(Number(event.target.value))} />
            </label>}
            <div className="join-actions">
              <button type="button" onClick={createRoom} disabled={busy || !playerName.trim() ||
                (gameName !== "war" && (!Number.isInteger(numPlayers) || numPlayers < 2 || numPlayers > 8))}>
                Create {gameLabel(gameName)} room
              </button>
              <button type="button" onClick={joinRoom}
                disabled={busy || !playerID || !playerName.trim() || !matchID || !seats.some(seat => String(seat.id) === playerID && !seat.name)}>
                Join game
              </button>
            </div>
            {matchID && roomQr && <div className="qr">
              <img src={roomQr} alt={`Room ${matchID} QR`} /><span>Scan to join this {gameLabel(gameName)} room</span>
            </div>}
            {(error || seatsError) && <p className="error">{error || seatsError}</p>}
          </section>
        )}

        {joined && <section className="join room-share"><p>{gameLabel(gameName)} · Room: <strong>{matchID}</strong> — <a href={`/?room=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`}>Join link</a></p>
          <a href={`/?table=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`} target="_blank" rel="noopener noreferrer">Open public table</a>
          {roomQr && <div className="qr"><img src={roomQr} alt="Scan to join this room" /></div>}</section>}
        {joined && <ActiveGameClient playerID={playerID} matchID={matchID} credentials={playerCredentials ?? undefined} />}
      </main>
    </div>
  );
}
