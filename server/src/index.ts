import { Server } from "boardgame.io/server";
import { SimpleCardGame } from "../../games/simple-card-game";

const devOrigins = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Dev-only: allow all origins so phones on LAN can connect.
  callback(null, true);
};

const server = Server({
  games: [SimpleCardGame],
  origins: devOrigins,
  apiOrigins: devOrigins,
});

server.run(8000);
