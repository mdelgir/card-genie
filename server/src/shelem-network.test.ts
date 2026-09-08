import test from "node:test";
import assert from "node:assert/strict";
import { Client, LobbyClient } from "boardgame.io/client";
import { SocketIO } from "boardgame.io/multiplayer";
import { ShelemGame, type ShelemGameState } from "../../games/shelem-game";
import { createCardGenieServer } from "./room-server";
import { legalTrickIndices } from "../../games/engine/trick-runtime";
import { createGameRuntime } from "../../games/engine/runtime";
import { shelemDefinition } from "../../games/definitions/shelem";

test("Shelem four-player SocketIO match covers automatic redeal, all stages, privacy and reconnect", async () => {
  const previousSeed = ShelemGame.seed; ShelemGame.seed = "shelem-socket-completion";
  const server = createCardGenieServer(); const running = await server.run(0);
  const address = running.appServer.address(); assert.ok(address && typeof address === "object");
  const url = `http://localhost:${address.port}`; const lobby = new LobbyClient({ server: url });
  const clients: ReturnType<typeof Client<ShelemGameState>>[] = [];
  const built = createGameRuntime(shelemDefinition); assert.ok(built.ok);
  const wait = async (predicate: () => boolean) => { const until = Date.now()+8000; while (!predicate()) { assert.ok(Date.now()<until, "Socket state timeout"); await new Promise(r=>setTimeout(r,5)); } };
  try {
    assert.ok((await (await fetch(`${url}/games`)).json() as string[]).includes("shelem"));
    const created = await fetch(`${url}/games/shelem/create`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ numPlayers:4 }) });
    assert.equal(created.status,200);
    const { matchID, playerCredentials } = await created.json() as {matchID:string;playerCredentials:string};
    assert.equal((await fetch(`${url}/rooms/${matchID}/start`, {method:"POST",headers:{Authorization:`Bearer ${playerCredentials}`}})).status,409);
    const credentials = [playerCredentials];
    for(let i=1;i<4;i++) credentials.push((await lobby.joinMatch("shelem",matchID,{playerID:String(i),playerName:`Seat ${i+1}`})).playerCredentials);
    for(let i=0;i<5;i++) { const c=Client({game:ShelemGame,matchID,playerID:i<4?String(i):undefined,credentials:i<4?credentials[i]:undefined,multiplayer:SocketIO({server:url}),debug:false}); clients.push(c); c.start(); }
    await wait(()=>clients.every(c=>!!c.getState()));
    assert.equal((await fetch(`${url}/rooms/${matchID}/start`, {method:"POST",headers:{Authorization:`Bearer ${credentials[1]}`}})).status,403);
    assert.equal((await fetch(`${url}/rooms/${matchID}/start`, {method:"POST",headers:{Authorization:`Bearer ${playerCredentials}`}})).status,200);
    await wait(()=>clients.every(c=>c.getState()!.G.started));
    async function syncedMove(fn:()=>void) { const id=clients[0].getState()!._stateID; fn(); await wait(()=>clients.every(c=>c.getState()!._stateID>id)); }
    async function privacy() {
      const stored=await server.db.fetch(matchID,{state:true}); const authoritative=stored.state!.G as ShelemGameState;
      for(const [i,c] of clients.entries()) {
        const state=c.getState()!;
        assert.equal(state.G.round,null);
        assert.deepEqual(state.G.view,built.runtime.playerView(authoritative.round!,i<4?String(i):null));
        assert.deepEqual(state._undo,[]); assert.deepEqual(state._redo,[]);
        assert.equal(c.getInitialState().G.round,null); assert.deepEqual(c.getInitialState().plugins,{});
        assert.equal(JSON.stringify(state.G.view).includes('"collections"'),false);
        assert.equal(JSON.stringify(state.G.view).includes('"liveDealTotals"'),false);
      }
    }
    for(let i=1;i<=3;i++) await syncedMove(()=>clients[i].moves.passBid());
    assert.equal(clients[0].getState()!.G.view!.auction!.dealer,"0");
    assert.deepEqual(clients[0].getState()!.G.view!.auction!.scores,{"0":0,"1":0});
    assert.deepEqual(clients[0].getState()!.G.view!.auction!.history,[]);
    await privacy();
    let actions=0,reconnected=false,completedDeal=false;
    let scores=clients[0].getState()!.G.view!.auction!.scores;
    while(clients[0].getState()!.G.roundStatus!=="complete") {
      assert.ok(actions++<2000);
      const st=clients[0].getState()!, id=Number(st.ctx.currentPlayer), c=clients[id];
      const v=c.getState()!.G.view!,a=v.auction!, hand=v.hands[String(id)];
      const beforePhase=a.phase;
      if(a.phase==="bidding") await syncedMove(()=>a.highBid===null&&id%2===1?c.moves.bid(165):c.moves.passBid());
      else if(a.phase==="choose-trump") {
        const suit=[...hand].sort((x,y)=>hand.filter(k=>k.suit===y.suit).length-hand.filter(k=>k.suit===x.suit).length)[0].suit;
        await syncedMove(()=>c.moves.chooseTrump(suit));
      } else if(a.phase==="take-kitty") await syncedMove(()=>c.moves.takeKitty());
      else if(a.phase==="discard") {
        const indices=hand.map((_,i)=>i).sort((i,j)=>Number(hand[i].suit===a.trump)-Number(hand[j].suit===a.trump)).slice(0,4);
        await syncedMove(()=>c.moves.discardCards(indices));
      } else {
        assert.ok(a.tricks&&a.trump); const legal=legalTrickIndices(hand,a.tricks.active,a.tricks.completed,a.trump); assert.ok(legal.length);
        await syncedMove(()=>c.moves.playCard(legal[0]));
      }
      const after=clients[0].getState()!.G;
      if(after.view!.auction!.phase==="bidding" && beforePhase!=="bidding") {completedDeal=true;scores=after.view!.auction!.scores;}
      else if(after.roundStatus!=="complete") assert.deepEqual(after.view!.auction!.scores,scores);
      await privacy();
      if(!reconnected && after.view!.auction!.tricks?.completed===1) {
        clients[4].stop(); clients[4] = Client({game:ShelemGame,matchID,multiplayer:SocketIO({server:url}),debug:false}); clients[4].start(); await wait(()=>!!clients[4].getState() && clients[4].getState()!._stateID===clients[0].getState()!._stateID);
        await privacy(); reconnected=true;
      }
    }
    assert.ok(reconnected); assert.ok(completedDeal); assert.ok(clients[4].getState()!.G.view!.auction!.matchWinner);
    const actor=Number(clients[0].getState()!.ctx.currentPlayer);
    await syncedMove(()=>clients[actor].moves.restartGame());
    assert.deepEqual(clients[0].getState()!.G.view!.auction!.scores,{"0":0,"1":0});
    assert.equal(clients[0].getState()!.G.view!.auction!.dealer,"0"); await privacy();
  } finally {clients.forEach(c=>c.stop());server.kill(running);ShelemGame.seed=previousSeed;}
});
