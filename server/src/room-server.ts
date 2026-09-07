import { randomUUID } from "node:crypto";
import type { Game } from "boardgame.io";
import { Server } from "boardgame.io/server";
import { Master } from "boardgame.io/master";
import { SimpleCardGame } from "../../games/simple-card-game";
import { WarGame } from "../../games/war-game";
import { PrivateStateSocketIO } from "./private-state-transport";
import { readServerConfig, isAllowedOrigin } from "./config";
import type { ServerOptions } from "socket.io";

const registeredGames: Game<any>[] = [SimpleCardGame, WarGame];
const gamesByName = new Map(registeredGames.map(game => [game.name!, game]));
const allowedMoves = new Map<string, Set<string>>([
  [SimpleCardGame.name!, new Set(["drawCard", "restartGame"])],
  [WarGame.name!, new Set(["revealBattle", "restartGame"])],
]);

class RoomTransport extends PrivateStateSocketIO {
  override init(...args: Parameters<PrivateStateSocketIO["init"]>) {
    super.init(...args);
    const [app, games] = args;
    for (const game of games) {
      const moves = allowedMoves.get(game.name!) ?? new Set<string>();
      app._io!.of(game.name!).use((socket, next) => {
        socket.use(([event, action], proceed) => {
          // Start, phase changes, reset, and undo must not bypass the room lifecycle.
          if (event === "update" && (action?.type !== "MAKE_MOVE" ||
              !moves.has(action?.payload?.type))) {
            socket.emit("roomError", "This action is not available. Start through the room endpoint.");
            return;
          }
          proceed();
        });
        next();
      });
    }
  }

  master(server: ReturnType<typeof Server>, matchID: string, game: Game<any>) {
    return new Master(game, server.db, {
      send: () => {},
      // Use boardgame.io's existing per-player filtering and SocketIO broadcast.
      sendAll: payload => this.pubSub.publish(`MATCH-${matchID}`, payload),
    }, server.auth);
  }
}

export function createCardGenieServer(config = readServerConfig()) {
  const { origins } = config;
  const transport = new RoomTransport({ socketOpts: {
    // Override boardgame.io 0.50.2's `cors.origins` with SocketIO's actual option.
    cors: { origin: origins },
    // CORS alone does not restrict direct WebSocket handshakes.
    allowRequest: (request, callback) => callback(null, isAllowedOrigin(request.headers.origin, origins)),
  // The pinned boardgame.io types require full options, but SocketIO supplies defaults.
  } as ServerOptions });
  const server = Server({ games: registeredGames, transport, origins, apiOrigins: origins,
    // Opaque creator credentials cannot be acquired by reclaiming a vacated host seat.
    generateCredentials: ctx => `${/^\/games\/[^/]+\/create$/.test(ctx.path) ? "host" : "player"}_${randomUUID()}`,
  });

  server.app.use(async (ctx, next) => {
    if (!isAllowedOrigin(ctx.headers.origin, origins)) ctx.throw(403, "Origin is not allowed.");
    const create = ctx.path.match(/^\/games\/([^/]+)\/create$/);
    if (ctx.method === "POST" && create && gamesByName.has(create[1])) {
      await next();
      if (ctx.status !== 200) return;
      const { matchID } = ctx.body as { matchID: string };
      const { metadata } = await server.db.fetch(matchID, { metadata: true });
      if (!metadata) ctx.throw(500, "Room creation failed.");
      const playerCredentials = await server.auth.generateCredentials(ctx);
      const hostName = (ctx.request as typeof ctx.request & { body?: { setupData?: { hostName?: unknown } } }).body?.setupData?.hostName;
      metadata.players["0"] = { ...metadata.players["0"],
        name: typeof hostName === "string" && hostName.trim() ? hostName.trim() : "Host",
        credentials: playerCredentials };
      await server.db.setMetadata(matchID, metadata);
      ctx.body = { matchID, playerID: "0", playerCredentials };
      return;
    }
    // Serialize seat mutations with start and game actions to avoid join/leave races.
    const seatMutation = ctx.path.match(/^\/games\/([^/]+)\/([^/]+)\/(join|leave|update)$/);
    if (ctx.method === "POST" && seatMutation && gamesByName.has(seatMutation[1])) {
      await transport.getMatchQueue(seatMutation[2]).add(() => next());
      return;
    }
    await next();
  });

  server.router.post("/rooms/:id/start", async ctx => {
    const matchID = ctx.params.id;
    const credentials = ctx.get("authorization").replace(/^Bearer /, "");
    await transport.getMatchQueue(matchID).add(async () => {
      const { state, metadata } = await server.db.fetch(matchID, { state: true, metadata: true });
      const game = metadata?.gameName ? gamesByName.get(metadata.gameName) : undefined;
      if (!state || !metadata || !game) ctx.throw(404, "Room not found.");
      if (!credentials.startsWith("host_") || !metadata.players["0"]?.credentials ||
          !await server.auth.authenticateCredentials({ playerID: "0", credentials, metadata })) {
        ctx.throw(403, "Only the room creator can start the game.");
      }
      if (state.G.started || state.ctx.phase !== "waiting") ctx.throw(409, "Game already started.");
      const occupied = Object.values(metadata.players).filter(p => p.name && p.credentials).length;
      if (occupied !== state.ctx.numPlayers) ctx.throw(409, "Wait for every player seat to be filled.");
      const result = await transport.master(server, matchID, game).onUpdate({
        type: "MAKE_MOVE", payload: { type: "startGame", args: [], playerID: "0", credentials },
      }, state._stateID, matchID, "0");
      if (result?.error) ctx.throw(409, "Unable to start the game.");
      const updated = await server.db.fetch(matchID, { state: true });
      if (!updated.state?.G.started) ctx.throw(409, "Unable to start the game.");
      ctx.body = { started: true };
    });
  });
  return server;
}
