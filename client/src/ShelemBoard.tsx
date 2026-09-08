import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BoardProps } from "boardgame.io/react";
import type { ShelemGameState } from "@games/shelem-game";
import type { Card } from "@games/engine/cards";
import { legalTrickIndices } from "@games/engine/trick-runtime";
import { WaitingRoom } from "./WaitingRoom";
import { PlayingCard } from "./components/PlayingCard";
import { serverUrl } from "./config";
import "./ShelemBoard.css";

const suitOrder: Card["suit"][] = ["spades", "hearts", "diamonds", "clubs"];
const rankOrder: Card["rank"][] = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const cardKey = (card: Card) => `${card.suit}:${card.rank}`;
const sameOrder = (left: string[], right: string[]) => left.length === right.length && left.every((key, i) => key === right[i]);
const sortedCardKeys = (hand: Card[]) => [...hand]
  .sort((a, b) => suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit) || rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))
  .map(cardKey);

type DragState = { key: string; pointerId: number; startX: number; startY: number; moved: boolean };

export function ShelemBoard({ G, ctx, moves, playerID, matchID, credentials, matchData, isConnected }: BoardProps<ShelemGameState>) {
  const [selected, setSelected] = useState<number[]>([]);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [handOrderMode, setHandOrderMode] = useState<"sorted" | "manual">("sorted");
  const [handLayout, setHandLayout] = useState<"spread" | "stacked">("spread");
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const v = G.view, a = v?.auction;
  const hand = playerID ? v?.hands[playerID] ?? [] : [];
  const handSignature = hand.map(cardKey).join("|");

  useEffect(() => setSelected([]), [a?.phase, a?.dealer, G.roundStatus]);
  useEffect(() => {
    const keys = hand.map(cardKey);
    setHandOrder(previous => {
      const next = handOrderMode === "sorted" ? sortedCardKeys(hand) : [
        ...previous.filter(key => keys.includes(key)),
        ...keys.filter(key => !previous.includes(key)),
      ];
      return sameOrder(previous, next) ? previous : next;
    });
  }, [handSignature, handOrderMode]);

  const displayedHand = useMemo(() => handOrder.flatMap(key => {
    const serverIndex = hand.findIndex(card => cardKey(card) === key);
    return serverIndex < 0 ? [] : [{ key, serverIndex, card: hand[serverIndex] }];
  }), [hand, handOrder]);

  const moveDraggedCard = (dragged: string, target: string) => {
    if (dragged === target) return;
    setHandOrder(previous => {
      const from = previous.indexOf(dragged), to = previous.indexOf(target);
      if (from < 0 || to < 0 || from === to) return previous;
      const next = [...previous];
      next.splice(from, 1);
      next.splice(to, 0, dragged);
      return next;
    });
  };
  const beginDrag = (key: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { key, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingKey(key);
  };
  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
    drag.moved = true;
    setHandOrderMode("manual");
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-hand-key]")?.dataset.handKey;
    if (target) moveDraggedCard(drag.key, target);
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickRef.current = drag.key;
      window.setTimeout(() => { if (suppressClickRef.current === drag.key) suppressClickRef.current = null; }, 0);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDraggingKey(null);
  };

  const name = (id: string) => matchData?.find(p => String(p.id) === id)?.name ?? `Seat ${Number(id) + 1}`;
  const teamName = (team: string) => `${name(team === "0" ? "0" : "1")} + ${name(team === "0" ? "2" : "3")}`;
  const scores = a?.scores ?? { "0": 0, "1": 0 };
  const scoreTable = <table className="shelem-scores" aria-label="Cumulative match scores"><caption>Match scores · frozen during each deal</caption><thead><tr><th>Team</th><th>Score</th></tr></thead><tbody>{["0", "1"].map(team => <tr key={team}><th>{teamName(team)}</th><td>{scores[team as "0" | "1"]}</td></tr>)}</tbody></table>;
  if (G.roundStatus === "waiting") return <section className="shelem-board">{scoreTable}<WaitingRoom serverUrl={serverUrl} matchID={matchID} playerID={playerID} credentials={credentials} isConnected={isConnected} gameName="shelem" /></section>;
  if (!v || !a) return <p role="status">Loading Shelem…</p>;
  const complete = G.roundStatus === "complete";
  const mine = Boolean(playerID && ctx.currentPlayer === playerID && isConnected && !complete);
  const isPlay = a.phase === "ready" || a.phase === "trick-play";
  const legal = a.trump && a.tricks ? legalTrickIndices(hand, a.tricks.active, a.tricks.completed, a.trump) : [];
  const dealerIndex = v.playOrder.indexOf(a.dealer);
  const firstBidder = dealerIndex >= 0 ? v.playOrder[(dealerIndex + 1) % v.playOrder.length] : null;
  const phases: Record<string, string> = { bidding: "Auction", "choose-trump": "Choose trump", "take-kitty": "Take kitty", discard: "Choose four discards", ready: "Lead the first trick with trump", "trick-play": "Trick play", "ready-scoring": "Finalizing deal", "redeal-required": "Redealing" };
  return <section className="board shelem-board">
    <header className="board-heading"><h2>{playerID ? `${name(playerID)} · Shelem` : "Shelem public table"}</h2><span>{complete ? "Match complete" : phases[a.phase]}</span></header>
    {scoreTable}
    <p role="status" aria-live="polite">{complete ? `${teamName(a.matchWinner!)} wins the match` : `${name(ctx.currentPlayer)} to act`}</p>
    <p>Dealer: {name(a.dealer)} · Declarer: {a.declarer ? name(a.declarer) : "Undecided"} · Contract / high bid: {a.highBid ?? "—"} · Trump: {a.trump ?? "—"}{a.phase === "bidding" && firstBidder ? ` · First bidder (dealer's right): ${name(firstBidder)}` : ""}</p>
    <div className="shelem-circle" aria-label="Four seats with opposite teammates; seat order proceeds to each player's right">
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
    {playerID && <section aria-label="Your private hand"><div className="shelem-hand-heading"><h3>Your hand · private</h3><div className="shelem-hand-toolbar" role="group" aria-label="Hand display options">
      <button type="button" onClick={() => setHandOrderMode("sorted")} disabled={handOrderMode === "sorted"}>Sort by suit</button>
      <button type="button" aria-pressed={handLayout === "spread"} onClick={() => setHandLayout("spread")}>Spread</button>
      <button type="button" aria-pressed={handLayout === "stacked"} onClick={() => setHandLayout("stacked")}>Stacked</button>
      <small>{handOrderMode === "sorted" ? "Grouped by suit · Ace high" : "Manual order"} · Drag cards to rearrange</small>
    </div></div><div className={`shelem-hand shelem-hand--${handLayout}`}>{displayedHand.map(({ key, serverIndex, card }, position) => {
      const selectable = a.phase === "discard" ? selected.includes(serverIndex) || selected.length < 4 : isPlay && legal.includes(serverIndex);
      const actionDisabled = !mine || !selectable;
      return <div key={key} data-hand-key={key} className={`shelem-hand-card${draggingKey === key ? " shelem-hand-card--dragging" : ""}`}
        style={{ zIndex: draggingKey === key ? 100 : position + 1 }} onPointerDown={event => beginDrag(key, event)} onPointerMove={continueDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <button aria-pressed={a.phase === "discard" ? selected.includes(serverIndex) : undefined} aria-disabled={actionDisabled} aria-label={`${card.rank} of ${card.suit}`}
          onClick={() => {
            if (suppressClickRef.current === key) { suppressClickRef.current = null; return; }
            if (actionDisabled) return;
            if (a.phase === "discard") setSelected(current => current.includes(serverIndex) ? current.filter(n => n !== serverIndex) : [...current, serverIndex]);
            else moves.playCard(serverIndex);
          }}><PlayingCard variant="face" card={card} size="small" /></button>
      </div>;
    })}</div>
      {mine && a.phase === "discard" && <button disabled={selected.length !== 4} onClick={() => moves.discardCards(selected)}>Discard selected ({selected.length}/4)</button>}
      {mine && isPlay && legal.length === 0 && <p>No legal trump lead is available under the current rules.</p>}
    </section>}
    {complete && playerID === ctx.currentPlayer && <button disabled={!isConnected} onClick={() => moves.restartGame()}>New match</button>}
    {complete && playerID && playerID !== ctx.currentPlayer && <p>Waiting for {name(ctx.currentPlayer)} to start a new match.</p>}
  </section>;
}
