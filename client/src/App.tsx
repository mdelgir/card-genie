import { serverUrl } from "./config";
import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import { LobbyClient } from "boardgame.io/client";
import { useEffect, useMemo, useState } from "react";
import { SimpleCardGame } from "@games/simple-card-game";
import { ShelemGame } from "@games/shelem-game";
import { ShelemBoard } from "./ShelemBoard";
import { WarGame } from "@games/war-game";
import { CrazyEightsGame } from "@games/crazy-eights-game";
import { CustomCardGame } from "@games/custom-card-game";
import type { GameDefinition } from "@games/engine/types";
import QRCode from "qrcode";
import { GameBoard } from "./GameBoard";
import { WarBoard } from "./WarBoard";
import { CrazyEightsBoard } from "./CrazyEightsBoard";
import { CustomGameBoard } from "./CustomGameBoard";
import { GameCreator } from "./GameCreator";
import { useRoomSeats } from "./WaitingRoom";

const HighestCardClient = Client({ game: SimpleCardGame, board: GameBoard,
  multiplayer: SocketIO({ server: serverUrl }), debug: false });
const ShelemClient = Client({ game: ShelemGame, board: ShelemBoard, multiplayer: SocketIO({ server: serverUrl }), debug: false });
const WarClient = Client({ game: WarGame, board: WarBoard,
  multiplayer: SocketIO({ server: serverUrl }), debug: false });
const CrazyEightsClient = Client({ game: CrazyEightsGame, board: CrazyEightsBoard,
  multiplayer: SocketIO({ server: serverUrl }), debug: false });
const CustomGameClient = Client({ game: CustomCardGame, board: CustomGameBoard,
  multiplayer: SocketIO({ server: serverUrl }), debug: false });

type GameName = "shelem" | "simple-card-game" | "war" | "crazy-eights" | "custom-card-game";
const parseGame = (value: string | null): GameName =>
  value === "shelem" || value === "war" || value === "crazy-eights" || value === "custom-card-game" ? value : "simple-card-game";
const gameLabel = (game: GameName) => game === "shelem" ? "Shelem" : game === "war" ? "War" : game === "crazy-eights" ? "Crazy Eights" :
  game === "custom-card-game" ? "Custom Game" : "Highest Card";

export default function App() {
  const [tableRoom] = useState(() => new URLSearchParams(window.location.search).get("table"));
  const isTable = tableRoom !== null;
  const [creatorOpen, setCreatorOpen] = useState(() => !isTable && new URLSearchParams(window.location.search).get("creator") === "1");
  const [gameName, setGameName] = useState<GameName>(() => parseGame(new URLSearchParams(window.location.search).get("game")));
  const [playerID, setPlayerID] = useState("");
  const [playerName, setPlayerName] = useState("Player");
  const [matchID, setMatchID] = useState(() => tableRoom?.trim() ?? "");
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerCredentials, setPlayerCredentials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const { seats, error: seatsError } = useRoomSeats(serverUrl, joined || creatorOpen ? "" : matchID, gameName);
  const [roomQr, setRoomQr] = useState<string | null>(null);
  const lobbyClient = useMemo(() => new LobbyClient({ server: serverUrl }), []);
  const ActiveGameClient = gameName === "shelem" ? ShelemClient : gameName === "war" ? WarClient : gameName === "crazy-eights" ? CrazyEightsClient :
    gameName === "custom-card-game" ? CustomGameClient : HighestCardClient;
  const maxPlayers = gameName === "crazy-eights" ? 4 : 8;

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room && !isTable) setMatchID(room);
  }, []);

  useEffect(() => {
    if (isTable) return;
    const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`;
    QRCode.toDataURL(roomUrl, { margin: 1, width: 220 }).then(setRoomQr).catch(() => setRoomQr(null));
  }, [matchID, isTable, gameName]);

  const createRoom = async () => {
    if (gameName === "custom-card-game") {
      setError("Create custom rooms from the Game Creator so the validated definition can be attached.");
      return;
    }
    setError(null);
    try {
      setBusy(true);
      const players = gameName === "shelem" ? 4 : gameName === "war" ? 2 : numPlayers;
      const response = await fetch(`${serverUrl}/games/${gameName}/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numPlayers: players, setupData: { hostName: playerName.trim() } }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setMatchID(result.matchID); setPlayerID(result.playerID);
      setPlayerCredentials(result.playerCredentials); setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
    } finally { setBusy(false); }
  };

  const startCustomTest = async (definition: GameDefinition, players: number) => {
    const response = await fetch(`${serverUrl}/games/custom-card-game/create`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numPlayers: players, setupData: { hostName: playerName.trim() || "Host", definition } }),
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    setGameName("custom-card-game"); setNumPlayers(players); setMatchID(result.matchID); setPlayerID(result.playerID);
    setPlayerCredentials(result.playerCredentials); setError(null); setCreatorOpen(false); setJoined(true);
  };

  const joinRoom = async () => {
    setError(null);
    try {
      setBusy(true);
      const match = await lobbyClient.getMatch(gameName, matchID);
      const numericID = Number(playerID);
      if (!Number.isInteger(numericID) || numericID < 0 || numericID >= match.players.length) {
        setError(`Player ID must be between 0 and ${match.players.length - 1}.`); return;
      }
      if (match.players[numericID]?.name) { setError(`Player ${numericID} is already taken.`); return; }
      const result = await lobbyClient.joinMatch(gameName, matchID, { playerID, playerName });
      setPlayerCredentials(result.playerCredentials); setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
    } finally { setBusy(false); }
  };

  const selectGame = (value: string) => {
    const next = parseGame(value);
    setGameName(next); setPlayerID("");
    if (next === "shelem") setNumPlayers(4);
    else if (next === "war") setNumPlayers(2);
    else if (next === "crazy-eights" && numPlayers > 4) setNumPlayers(4);
  };
  const playerCountValid = gameName === "war" || gameName === "custom-card-game" ||
    (Number.isInteger(numPlayers) && numPlayers >= 2 && numPlayers <= maxPlayers);

  return <div className={`app${isTable ? " app--table" : ""}`}>
    <header className="app-masthead"><div className="wordmark"><span aria-hidden="true">♠</span> Card Genie</div><p>A little luck. A great night.</p></header>
    <main>
      {isTable && <>
        <section className="join room-share"><p>Public {gameLabel(gameName)} table · Room: <strong>{matchID || "Missing room code"}</strong></p><a href="/">Back to rooms</a></section>
        {!matchID || seatsError ? <section className="board"><p className="error" role="alert">{!matchID ? "This table link is missing a room code. Ask the host for the public table link." : seatsError}</p></section> :
          seats.length === 0 ? <p role="status">Loading public table…</p> : <ActiveGameClient matchID={matchID} />}
      </>}

      {!isTable && !joined && creatorOpen && <GameCreator onClose={() => setCreatorOpen(false)} onTest={startCustomTest} />}

      {!isTable && !joined && !creatorOpen && <section className="join">
        <h2>Join a room</h2>
        <label htmlFor="game">Game
          <select id="game" value={gameName} onChange={event => selectGame(event.target.value)}>
            <option value="simple-card-game">Highest Card</option>
            <option value="shelem">Shelem</option>
            <option value="war">War</option>
            <option value="crazy-eights">Crazy Eights</option>
            <option value="custom-card-game">Custom Game</option>
          </select>
        </label>
        {gameName === "custom-card-game" && <p>Custom rooms are created in the Game Creator. Select Custom Game here when joining an existing custom room.</p>}
        <label htmlFor="room">Room code
          <input id="room" value={matchID} onChange={event => setMatchID(event.target.value)} />
        </label>
        <label htmlFor="name">Player name
          <input id="name" value={playerName} onChange={event => setPlayerName(event.target.value)} />
        </label>
        <label htmlFor="player">Player seat
          <select id="player" value={playerID} onChange={event => setPlayerID(event.target.value)}>
            <option value="">Choose an available seat</option>
            {seats.map(seat => <option key={seat.id} value={String(seat.id)} disabled={Boolean(seat.name)}>
              Seat {seat.id + 1}: {seat.name || "Available"}
            </option>)}
          </select>
        </label>
        {gameName === "shelem" ? <p>Shelem uses exactly 4 players.</p> : gameName === "war" ? <p>War uses exactly 2 players.</p> : gameName !== "custom-card-game" && <label htmlFor="numPlayers">Number of players
          <input id="numPlayers" type="number" min={2} max={maxPlayers} value={numPlayers}
            onChange={event => setNumPlayers(Number(event.target.value))} />
        </label>}
        <div className="join-actions">
          {gameName !== "custom-card-game" && <button type="button" onClick={createRoom} disabled={busy || !playerName.trim() || !playerCountValid}>
            Create {gameLabel(gameName)} room
          </button>}
          <button type="button" onClick={joinRoom}
            disabled={busy || !playerID || !playerName.trim() || !matchID || !seats.some(seat => String(seat.id) === playerID && !seat.name)}>
            Join game
          </button>
        </div>
        {matchID && roomQr && <div className="qr"><img src={roomQr} alt={`Room ${matchID} QR`} /><span>Scan to join this {gameLabel(gameName)} room</span></div>}
        {(error || seatsError) && <p className="error">{error || seatsError}</p>}
        <div className="join-actions">
          <button type="button" className="button-quiet" onClick={() => setCreatorOpen(true)}>Open Game Creator</button>
        </div>
      </section>}

      {joined && <section className="join room-share"><p>{gameLabel(gameName)} · Room: <strong>{matchID}</strong> — <a href={`/?room=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`}>Join link</a></p>
        <a href={`/?table=${encodeURIComponent(matchID)}&game=${encodeURIComponent(gameName)}`} target="_blank" rel="noopener noreferrer">Open public table</a>
        {roomQr && <div className="qr"><img src={roomQr} alt="Scan to join this room" /></div>}</section>}
      {joined && <ActiveGameClient playerID={playerID} matchID={matchID} credentials={playerCredentials ?? undefined} />}
    </main>
  </div>;
}
