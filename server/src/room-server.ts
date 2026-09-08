import { randomUUID } from "node:crypto";
import type { Game } from "boardgame.io";
import { Server } from "boardgame.io/server";
import { Master } from "boardgame.io/master";
import { SimpleCardGame } from "../../games/simple-card-game";
import { WarGame } from "../../games/war-game";
import { CrazyEightsGame } from "../../games/crazy-eights-game";
import { CustomCardGame } from "../../games/custom-card-game";
import { validateGameDefinition } from "../../games/engine/validator";
import { PrivateStateSocketIO } from "./private-state-transport";
import { readServerConfig, isAllowedOrigin } from "./config";
import type { ServerOptions } from "socket.io";

const registeredGames: Game<any>[] = [SimpleCardGame, WarGame, CrazyEightsGame, CustomCardGame];
const gamesByName = new Map(registeredGames.map(game => [game.name!, game]));
const allowedMoves = new Map<string, Set<string>>([
  [SimpleCardGame.name!, new Set(["drawCard", "restartGame"])],
  [WarGame.name!, new Set(["revealBattle", "restartGame"])],
  [CrazyEightsGame.name!, new Set(["playCard", "drawCard", "restartGame"])],
  [CustomCardGame.name!, new Set(["playCard", "drawCard", "revealBattle", "restartGame"])],
]);

class RoomTransport extends PrivateStateSocketIO {
  override init(...args: Parameters<PrivateStateSocketIO["init"]>) {
    super.init(...args);
    const [app, games] = args;
    for (const game of games) {
      const moves = allowedMoves.get(game.name!) ?? new Set<string>();
      app._io!.of(game.name!).use((socket, next) => {
        socket.use(([event, action], proceed) => {
          if (event === "update" && (action?.type !== "MAKE_MOVE" || !moves.has(action?.payload?.type))) {
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
      sendAll: payload => this.pubSub.publish(`MATCH-${matchID}`, payload),
    }, server.auth);
  }
}

export function createCardGenieServer(config = readServerConfig()) {
  const { origins } = config;
  const transport = new RoomTransport({ socketOpts: {
    cors: { origin: origins },
    allowRequest: (request, callback) => callback(null, isAllowedOrigin(request.headers.origin, origins)),
  } as ServerOptions });
  const server = Server({ games: registeredGames, transport, origins, apiOrigins: origins,
    generateCredentials: ctx => `${/^\/games\/[^/]+\/create$/.test(ctx.path) ? "host" : "player"}_${randomUUID()}`,
  });

  server.app.use(async (ctx, next) => {
    if (!isAllowedOrigin(ctx.headers.origin, origins)) ctx.throw(403, "Origin is not allowed.");
    const create = ctx.path.match(/^\/games\/([^/]+)\/create$/);
    if (ctx.method === "POST" && create && gamesByName.has(create[1])) {
      if (create[1] === CustomCardGame.name) {
        const body = (ctx.request as typeof ctx.request & {
          body?: { numPlayers?: unknown; setupData?: { definition?: unknown; hostName?: unknown } };
        }).body;
        const validation = validateGameDefinition(body?.setupData?.definition);
        if (!validation.ok) {
          ctx.throw(400, `Invalid custom game definition: ${JSON.stringify(validation.errors)}`);
          return;
        }
        const numPlayers = body?.numPlayers;
        if (!Number.isInteger(numPlayers) || (numPlayers as number) < validation.definition.players.min ||
            (numPlayers as number) > validation.definition.players.max) {
          ctx.throw(400, `Custom game requires ${validation.definition.players.min}–${validation.definition.players.max} players.`);
          return;
        }
      }
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
      if (!state || !metadata || !game) {
        ctx.throw(404, "Room not found.");
        return;
      }
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
