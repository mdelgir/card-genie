# Hosting Card Genie

Deploy two services from the same repository revision:

- **Static frontend:** publish `client/dist` at an HTTPS origin such as `https://cards.example.com`.
- **Node backend:** run one long-lived Node process at an HTTPS origin such as `https://api.cards.example.com`. Forward HTTP requests and WebSocket upgrades to its internal listening port. Keep `/socket.io/`, `/games`, and `/rooms` on this backend, without a URL path prefix.

Use the Node version requirements in README. Keep boardgame.io pinned to 0.50.2. No external boardgame.io service is needed.

## Environment

| Variable | Service / timing | Value |
| --- | --- | --- |
| `NODE_ENV` | Backend runtime | Set to `production` for hosting. |
| `PORT` | Backend runtime | Hosting platform's internal port; defaults to `8000`. Valid range: 1–65535. |
| `ALLOWED_ORIGINS` | Backend runtime | Required in production. Comma-separated exact frontend origins, e.g. `https://cards.example.com,https://preview.example.com`. Include scheme and any non-default port; no paths, wildcards, credentials, query, or fragment. |
| `VITE_SERVER_URL` | Frontend build time | Public backend origin, e.g. `https://api.cards.example.com`. Use HTTPS for an HTTPS frontend. Rebuild the frontend whenever this changes. It is public configuration, not a secret. |

The same allowed-origin list applies to Lobby API, room endpoints, SocketIO polling CORS, and direct WebSocket handshakes. Requests without an Origin header remain possible for health checks and non-browser clients; origin checks are not authentication. Existing player credentials, host-start checks, and private-state filtering remain required.

Do not set boardgame.io's optional `API_SECRET`: this browser client does not send it, and embedding a shared secret in frontend assets would expose it.

## Build and start

Run builds from the repository root. Install development dependencies in the build environment even if the runtime uses `NODE_ENV=production`:

```sh
npm ci --include=dev
npm run build:server
npm test
```

Set the backend runtime variables above in the service environment, then run:

```sh
npm --prefix server start
```

This executes `node dist/server/src/index.js` from the server directory. Ship `server/dist` (including its compiled shared game files) and installed runtime dependencies. The service must support a persistent Node process and WebSocket upgrades; use `/games` for a simple HTTP health check.

For the static service, set `VITE_SERVER_URL` in its build environment, then run:

```sh
npm ci --include=dev
npm run build:client
```

Publish `client/dist`. Query links `/?room=<id>` and `/?table=<id>` work without SPA path rewrite rules. Vite preview is only a local verification tool, not the production frontend server.

Example environment setup for local production checks in PowerShell:

```powershell
$env:NODE_ENV = 'production'
$env:PORT = '9123'
$env:ALLOWED_ORIGINS = 'http://localhost:4174'
npm --prefix server start
```

In a separate PowerShell window:

```powershell
$env:VITE_SERVER_URL = 'http://localhost:9123'
npm run build:client
npm --prefix client run preview -- --port 4174
```

## LAN development

Leave `NODE_ENV` unset or use `development`; omit `ALLOWED_ORIGINS` for permissive development access. An explicit allowlist is enforced in development too. Without `VITE_SERVER_URL`, the frontend uses the browser's hostname and protocol on port 8000, preserving automatic LAN use. Clear temporary build variables and rebuild after a hosted-URL test before serving that build on LAN.

## Deployment limits and acceptance

Run **one backend instance**. Rooms are in memory by default and are lost on restart/redeploy; do not enable horizontal autoscaling for this slice. Browser refresh still loses player credentials, and there is no session recovery or host transfer. Leave optional storage environment variables unset; this task adds no persistence.

After deploying, verify two player browsers plus a standalone public table: create, join, host start, private first draw, synchronized public progress, reveal/winner, authorized replay, and the next private draw. Verify HTTPS, allowed frontend origins, Lobby requests, SocketIO connections/upgrades, and reconnect filtering against the real deployment.

Local configuration and regression tests do not constitute hosted end-to-end validation. Hosting readiness is implemented; a real hosted run remains required.
