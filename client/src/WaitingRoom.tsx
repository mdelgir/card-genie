import { useEffect, useState } from "react";
import { LobbyClient } from "boardgame.io/client";

type Seat = { id: number; name?: string };

export function useRoomSeats(serverUrl: string, matchID: string) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSeats([]);
    setError(null);
    if (!matchID) return;
    const lobby = new LobbyClient({ server: serverUrl });
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const match = await lobby.getMatch("simple-card-game", matchID);
        if (!cancelled) { setSeats(match.players); setError(null); }
      } catch {
        if (!cancelled) { setSeats([]); setError("Unable to load this room. Check the code and connection."); }
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 1000);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [serverUrl, matchID]);
  return { seats, error };
}

export function WaitingRoom({ serverUrl, matchID, playerID, credentials, isConnected }: {
  serverUrl: string; matchID: string; playerID: string | null;
  credentials?: string; isConnected: boolean;
}) {
  const { seats, error: roomError } = useRoomSeats(serverUrl, matchID);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allSeated = seats.length >= 2 && seats.every(seat => Boolean(seat.name));
  const start = async () => {
    setStarting(true); setError(null);
    try {
      const response = await fetch(`${serverUrl}/rooms/${encodeURIComponent(matchID)}/start`, {
        method: "POST", headers: { Authorization: `Bearer ${credentials ?? ""}` },
      });
      if (!response.ok) throw new Error(await response.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start the game.");
    } finally { setStarting(false); }
  };
  return <section className="board">
    <h2>Waiting room</h2>
    <p>Room code: <strong>{matchID}</strong></p>
    <p>{seats.filter(seat => seat.name).length} of {seats.length || "…"} seats filled</p>
    <ul>{seats.map(seat => <li key={seat.id}>
      Seat {seat.id + 1}{seat.id === 0 ? " (host)" : ""}: {seat.name || "Available"}
    </li>)}</ul>
    {playerID === "0" ? <button type="button" onClick={start}
      disabled={!allSeated || !isConnected || starting}>
      {starting ? "Starting…" : "Start game"}
    </button> : <p>Waiting for the host to start the game.</p>}
    {!allSeated && <p>Every player seat must be filled before starting.</p>}
    {!isConnected && <p>Connecting to the game server…</p>}
    {(error || roomError) && <p className="error" role="alert">{error || roomError}</p>}
  </section>;
}
