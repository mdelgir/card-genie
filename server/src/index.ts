import { Server } from "boardgame.io/server";
import { SimpleCardGame } from "../../games/simple-card-game";

const server = Server({
  games: [SimpleCardGame],
});

server.run(8000);
