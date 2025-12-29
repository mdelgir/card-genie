# Progress Log

## 2025-12-29

- Scaffolded monorepo with `client`, `server`, and `games` folders plus root workspaces.
- Implemented `SimpleCardGame` with a shuffled 52-card deck, per-player hands, winner detection, and masked hands.
- Added server using `boardgame.io` on port 8000 with CORS configured for dev.
- Built React + Vite client with boardgame.io integration, player/table views, and styling.
- Added Lobby-based create/join flow with player names, credentials, and room codes.
- Implemented randomized turn order and turn-based draw flow with status messaging.
- Added “Play again” move to reset the game and reshuffle.
- Added a basic node:test suite for the game logic.
- Updated README with prerequisites and run steps.
- Pinned `boardgame.io` version and added workspace overrides to avoid peer conflicts.
