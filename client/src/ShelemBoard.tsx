import { useEffect, useState } from "react";
import type { BoardProps } from "boardgame.io/react";
import type { ShelemGameState } from "@games/shelem-game";
import { legalTrickIndices } from "@games/engine/trick-runtime";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";
import { serverUrl } from "./config";
import "./ShelemBoard.css";

export function ShelemBoard({ G, ctx, moves, playerID, matchID, credentials, matchData, isConnected }: BoardProps<ShelemGameState>) {
  const [selected, setSelected] = useState<number[]>([]);
  const v = G.view, a = v?.auction;
  useEffect(() => setSelected([]), [a?.phase, a?.dealer, G.roundStatus]);
  const name = (id: string) => matchData?.find(p => String(p.id) === id)?.name ?? `Seat ${Number(id) + 1}`;
  const teamName = (team: string) => `${name(team === "0" ? "0" : "1")} + ${name(team === "0" ? "2" : "3")}`;
  const scores = a?.scores ?? { "0": 0, "1": 0 };
  const scoreTable = <table className="shelem-scores" aria-label="Cumulative match scores"><caption>Match scores · frozen during each deal</caption><thead><tr><th>Team</th><th>Score</th></tr></thead><tbody>{["0", "1"].map(team => <tr key={team}><th>{teamName(team)}</th><td>{scores[team as "0" | "1"]}</td></tr>)}</tbody></table>;
  if (G.roundStatus === "waiting") return <section className="shelem-board">{scoreTable}<WaitingRoom serverUrl={serverUrl} matchID={matchID} playerID={playerID} credentials={credentials} isConnected={isConnected} gameName="shelem" /></section>;
  if (!v || !a) return <p role="status">Loading Shelem…</p>;
  const complete = G.roundStatus === "complete";
  const mine = Boolean(playerID && ctx.currentPlayer === playerID && isConnected && !complete);
  const hand = playerID ? v.hands[playerID] ?? [] : [];
  const isPlay = a.phase === "ready" || a.phase === "trick-play";
  const legal = a.trump && a.tricks ? legalTrickIndices(hand, a.tricks.active, a.tricks.completed, a.trump) : [];
  const phases: Record<string, string> = { bidding: "Auction", "choose-trump": "Choose trump", "take-kitty": "Take kitty", discard: "Choose four discards", ready: "Lead the first trick with trump", "trick-play": "Trick play", "ready-scoring": "Finalizing deal", "redeal-required": "Redealing" };
  return <section className="board shelem-board">
    <header className="board-heading"><h2>{playerID ? `${name(playerID)} · Shelem` : "Shelem public table"}</h2><span>{complete ? "Match complete" : phases[a.phase]}</span></header>
    {scoreTable}
    <p role="status" aria-live="polite">{complete ? `${teamName(a.matchWinner!)} wins the match` : `${name(ctx.currentPlayer)} to act`}</p>
    <p>Dealer: {name(a.dealer)} · Declarer: {a.declarer ? name(a.declarer) : "Undecided"} · Contract / high bid: {a.highBid ?? "—"} · Trump: {a.trump ?? "—"}</p>
    <div className="shelem-circle" aria-label="Four seats with opposite teammates">
      {["0", "1", "2", "3"].map(id => <section key={id} className={`shelem-seat shelem-seat-${id}${ctx.currentPlayer === id && !complete ? " shelem-active" : ""}`}>
        <strong>{name(id)}{id === playerID ? " (you)" : ""}</strong><small>Team {Number(a.teams[id]) + 1}{a.passed.includes(id) && a.phase === "bidding" ? " · Passed" : ""}</small>
        <PlayingCard variant="back" size="small" label={`${name(id)} private hand`} />
        <span>{v.handCounts?.[id] ?? 12} cards</span>
      </section>)}
      <div className="shelem-center"><strong>Public table</strong><div className="shelem-trick" aria-label="Active trick">{a.tricks?.active.map(c => <div key={c.playerID}><PlayingCard variant="face" size="small" card={c.card} /><small>{name(c.playerID)}</small></div>)}</div>
        <p>{a.tricks?.completed ?? 0} / 12 tricks · Team 1: {a.tricks?.teamCounts["0"] ?? 0} · Team 2: {a.tricks?.teamCounts["1"] ?? 0}</p>
        {a.tricks?.lastWinner && <p>Last trick: {name(a.tricks.lastWinner)}</p>}
        <div className="shelem-opaque"><span>Kitty: {a.kittyCount}</span>{a.kittyCount > 0 && <PlayingCard variant="back" size="small" label={`${a.kittyCount} hidden kitty cards`} />}
        {a.discardStack && <div><PlayingCard variant="back" size="small" label="Four hidden declarer discards" /><small>{a.discardStack.count} face-down · Team {Number(a.discardStack.teamID) + 1} · {name(a.discardStack.placedBy)}</small></div>}</div>
      </div>
    </div>
    <details className="shelem-auction" open={a.phase === "bidding"}><summary>Auction history</summary><ol>{a.history.map((h, i) => <li key={i}>{name(h.playerID)}: {h.bid ?? "Pass"}</li>)}</ol></details>
    {mine && a.phase === "bidding" && <div className="shelem-controls" aria-label="Bid controls">{Array.from({ length: 14 }, (_, i) => 100 + i * 5).filter(n => n > (a.highBid ?? 0)).map(n => <button key={n} onClick={() => moves.bid(n)}>Bid {n}</button>)}<button onClick={() => moves.passBid()}>Pass</button></div>}
    {mine && playerID === a.declarer && a.phase === "choose-trump" && <div className="shelem-controls">{["spades", "hearts", "diamonds", "clubs"].map(s => <button key={s} onClick={() => moves.chooseTrump(s)}>Trump: {s}</button>)}</div>}
    {mine && a.phase === "take-kitty" && <button onClick={() => moves.takeKitty()}>Take four-card kitty</button>}
    {playerID && <section aria-label="Your private hand"><h3>Your hand · private</h3><div className="shelem-hand">{hand.map((c, i) => <button key={`${c.suit}-${c.rank}`} aria-pressed={a.phase === "discard" ? selected.includes(i) : undefined} aria-label={`${c.rank} of ${c.suit}`} disabled={!mine || !(a.phase === "discard" ? selected.includes(i) || selected.length < 4 : isPlay && legal.includes(i))} onClick={() => a.phase === "discard" ? setSelected(s => s.includes(i) ? s.filter(n => n !== i) : [...s, i]) : moves.playCard(i)}><PlayingCard variant="face" card={c} size="small" /></button>)}</div>
      {mine && a.phase === "discard" && <button disabled={selected.length !== 4} onClick={() => moves.discardCards(selected)}>Discard selected ({selected.length}/4)</button>}
      {mine && isPlay && legal.length === 0 && <p>No legal trump lead is available under the current rules.</p>}
    </section>}
    {complete && playerID === ctx.currentPlayer && <button disabled={!isConnected} onClick={() => moves.restartGame()}>New match</button>}
    {complete && playerID && playerID !== ctx.currentPlayer && <p>Waiting for {name(ctx.currentPlayer)} to start a new match.</p>}
  </section>;
}
