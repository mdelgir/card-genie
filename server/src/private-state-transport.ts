import { SocketIO } from "boardgame.io/server";
import type { State } from "boardgame.io";

/** boardgame.io 0.50.2 filters current state but not syncInfo.initialState. */
export class PrivateStateSocketIO extends SocketIO {
  override init(...args: Parameters<SocketIO["init"]>) {
    super.init(...args);
    const [app, games] = args;
    for (const game of games) {
      app._io!.of(game.name!).use((socket, next) => {
        const emit = socket.emit;
        socket.emit = function (event, ...eventArgs) {
          if (event === "sync") {
            const [matchID, syncInfo] = eventArgs;
            const initial: State | undefined = syncInfo.initialState;
            // Historical state is public-only for every role. Never mutate storage.
            const initialState = initial && {
              ...initial,
              G: game.playerView!({ G: initial.G, ctx: initial.ctx, playerID: null }),
              plugins: {}, // Includes the private random seed / PRNG state.
              _undo: [],
              _redo: [],
              deltalog: undefined,
            };
            return emit.call(this, event, matchID, { ...syncInfo, initialState });
          }
          return emit.call(this, event, ...eventArgs);
        };
        next();
      });
    }
  }
}
