# Next Task — Manual LAN Validation

This is the next Phase 1 validation task. It is intentionally a **manual real-device check**, not an Astra coding task unless the test exposes a bug.

`ledger.md` remains the source of truth. Do not mark LAN validation complete until the full flow has been exercised on physical devices.

## Objective

Verify Card Genie on the intended in-person setup:

```text
Windows development PC
  ├─ game server on :8000
  ├─ Vite client on :5173, exposed to LAN
  ├─ Phone 1: player
  ├─ Phone 2: player
  └─ Tablet / TV / third phone: standalone public table
```

All devices must be on the same local network.

## Before testing

Pull the latest repository state:

```powershell
cd C:\Users\mdelg\Documents\card-genie
git pull --ff-only
```

Optional but recommended sanity check:

```powershell
npm run build:server
npm run build:client
npm test
```

GitHub CI also runs these checks independently.

## 1. Find the PC's LAN IP

In PowerShell:

```powershell
ipconfig
```

Find the active Wi-Fi or Ethernet adapter's **IPv4 Address**. It will usually look like:

```text
192.168.1.25
```

Use the real value from your PC below as `<PC-IP>`.

Do not use `localhost` or `127.0.0.1` from the phones/table device.

## 2. Start the server

In one PowerShell window:

```powershell
cd C:\Users\mdelg\Documents\card-genie
npm run dev:server
```

The game server uses port 8000.

## 3. Start the client exposed to the LAN

In a second PowerShell window:

```powershell
cd C:\Users\mdelg\Documents\card-genie
npm --prefix client run dev:host
```

Vite should expose the client on port 5173.

The client derives the game-server URL from the browser hostname, so a phone opening:

```text
http://<PC-IP>:5173/
```

should talk to:

```text
http://<PC-IP>:8000
```

without a separate configuration change.

## 4. Confirm basic LAN reachability

From Phone 1, while on the same Wi-Fi, open:

```text
http://<PC-IP>:5173/
```

Expected result: the Card Genie room screen loads.

If the page does not load:

- confirm the phone and PC are on the same network,
- confirm Vite was started with `dev:host`,
- make sure the network is not a guest/client-isolated Wi-Fi,
- allow Node.js through Windows Firewall on **Private networks** if Windows prompts,
- verify the PC's IPv4 address has not changed.

If the page loads but room creation/game synchronization fails, check whether Windows Firewall is blocking port 8000 / the Node server.

## 5. Run the complete physical-device flow

Use at least three physical browser contexts if available.

### Device A — Host/player

Open:

```text
http://<PC-IP>:5173/
```

Create a 2-player room.

Confirm:

- the creator occupies the host seat,
- a room code is shown,
- the normal player join link / QR is available,
- an **Open public table** link is available.

### Device B — Guest/player

Join using the room QR/link or:

```text
http://<PC-IP>:5173/?room=<matchID>
```

Choose the remaining seat and join.

Confirm the host now sees all player seats filled and can start.

### Device C — Public table

Open the public-table link or:

```text
http://<PC-IP>:5173/?table=<matchID>
```

Confirm:

- no player name/seat is requested,
- the table does not occupy a player seat,
- no player controls appear,
- the waiting room/public state is visible before start.

## 6. Start and verify privacy/synchronization

Start the game from the host device.

For the first legal player draw, verify all of the following before the second player draws:

- the drawing player sees their own card face up,
- the other player does **not** see that rank/suit,
- the public table does **not** see that rank/suit,
- the public table shows only that the player has drawn / a face-down card,
- deck count and turn state update on all devices.

Then complete the second draw.

Confirm:

- all devices transition to round complete,
- both cards become public only after completion,
- the same winner/tie appears everywhere,
- the public table remains view-only.

## 7. Verify replay on physical devices

The final-draw/current player should be the only player allowed to start the next round.

Confirm:

- that player sees an actionable **Play again** button,
- the other player sees a waiting message instead of an actionable replay control,
- the table has no replay control,
- replay clears the old cards and winner,
- deck count returns to 52,
- the next round has a valid first player,
- the first legal draw of the new round again remains private to its owner and face-down/public on the table.

## 8. Basic mobile/table usability check

On the phones and table device, also note:

- any horizontal scrolling,
- clipped cards/buttons/text,
- controls too small to tap,
- unreadable text,
- table layout that looks poor on a tablet/TV-sized screen,
- reconnect or synchronization delays that are noticeable in normal use.

Do not redesign anything pre-emptively. Record concrete problems only.

## Pass criteria

LAN validation passes when all of these are true on physical devices:

1. At least two player devices can reach the PC-hosted client.
2. A separate physical device can open the standalone public table.
3. Room creation/join/start work over LAN.
4. The public table consumes no seat.
5. Private first-draw card data is visible only to its owner.
6. Public draw progress synchronizes in real time.
7. Reveal/winner/tie synchronize correctly.
8. Replay authorization is correct.
9. Replay starts a clean new round.
10. The next-round first draw still preserves privacy and synchronization.
11. The UI is usable on the tested phones/table device.

## If something fails

Do **not** broadly refactor the project.

Record:

- which device/browser failed,
- the exact URL used,
- what step failed,
- any browser/server console error,
- whether the client page loaded,
- whether port 5173 worked but port 8000 appeared blocked,
- whether the issue reproduces on the PC browser itself.

Then use Astra for the smallest fix targeted at that concrete failure.

## After a successful test

Update `ledger.md` to mark physical LAN validation as verified and record the actual devices/browsers used.

Do not begin Phase 2 yet. The remaining Phase 1 acceptance item after LAN validation is the equivalent hosted end-to-end test.
