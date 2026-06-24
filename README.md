# appmegle

**[Try it live](https://jay23606.github.io/appmegle/)**

A fork of [slumegle](https://github.com/jay23606/slumegle) that turns the random
video chat into a small platform for **in-call mini-apps**. Once you're paired with
a stranger, an **`-- Apps --`** dropdown next to Share lets you launch an app that
runs *over the live video* and is shared with the other person. The first app is
**Chess**; whiteboard, tic-tac-toe, pong, and other simple games are planned.

Still plain JS, no framework, no build step. The host is a single `index.html`; each
app is a self-contained pair of files under `apps/`.

## The app dropdown

- Pick **Chess** (or, later, any other app) from **`-- Apps --`** → it opens for
  **both** peers, rendered over the video.
- Pick **`-- Apps --`** again → it closes for both.
- The dropdown is disabled until you're paired, and resets when you hit Next / your
  partner leaves.

## Chess

The board overlays the call with **outline-only pieces** (transparent fill, stroked
edge — white for White, dark for Black) so you keep seeing the other person through
the board. Powered by [chess.js](https://github.com/jhlywa/chess.js): legal-move
dots, captures, castling, en passant, auto-queen, check / checkmate / stalemate /
draw. The peer who initiated the match plays **White**, the other plays **Black**, and
the board is oriented so your own pieces are at the bottom. Tap a piece to see its
moves, tap a target to move. **New game** resets the position for both players.

## The app contract (how to add an app)

The host exposes a tiny global, `window.Appmegle`. An app file under `apps/` registers
itself:

```js
window.Appmegle.register({
  id: 'chess',           // unique id, also the data-channel tag
  label: 'Chess',        // dropdown text
  css: 'apps/chess.css', // optional stylesheet, injected on register
  mount(ctx)  { /* ctx = { root, send, amCaller }; build UI into ctx.root */ },
  unmount()   { /* tear down; host clears ctx.root for you too */ },
  onData(msg) { /* a message from the peer's instance of this app */ },
});
```

- **`ctx.root`** — the `#app-stage` element over the video to render into.
- **`ctx.send(obj)`** — send a JSON message to the other peer's copy of this app; it
  arrives at their `onData(obj)`. The host tags each message with the app `id` and
  routes incoming ones to the right app, so apps never see each other's traffic.
- **`ctx.amCaller`** — `true` for the peer who initiated the match (use it to assign
  sides, e.g. White/Black or X/O).

Messages ride the **existing PeerJS data channel** (JSON-serialized), the same one
used for chat — no extra connections or servers. App messages are objects; the
host's own open/close control messages use `app: 'host'`.

To add, say, tic-tac-toe: drop `apps/tictactoe.js` (+ optional `apps/tictactoe.css`),
have it call `Appmegle.register(...)`, and add one `<script src="apps/tictactoe.js">`
line at the bottom of `index.html`. No host changes needed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Video chat + the generic `Appmegle` app host and `-- Apps --` dropdown. |
| `apps/chess.js` | Chess app: board, rules (loads chess.js), move sync. Self-contained. |
| `apps/chess.css` | Chess styles, including the outline-piece rendering. |
| `manifest.json` | PWA metadata. |
| `sw.js` | Service worker — install + offline cache (includes the `apps/` files). |
| `icon-*.png` | App icons. |

All files keep their relative layout at the site root (`apps/` stays a subfolder).

## Run it

**HTTPS is required** in practice: browsers block camera/mic on plain `http://`, and
PWA install / service workers only work over HTTPS (or `localhost`). GitHub Pages,
githack, and Netlify all provide HTTPS.

To test locally, open it in **two tabs** or two browsers. One waits, the other
matches it; each tab needs its own camera/mic permission. Once paired, pick **Chess**
from `-- Apps --` in either tab — the match initiator is White.

Coordination uses Firebase Realtime DB namespaced under `appmegle/`
(`appmegle/lobby` + `appmegle/online`), and the matchmaker claims lobby slots inside a
Firebase `transaction()` so two people searching at once can't grab the same stranger.

## Roadmap

- [x] App host + `-- Apps --` dropdown (alphabetical)
- [x] Chess
- [x] Checkers
- [x] Connect Four
- [x] Reversi / Othello
- [x] Tic-tac-toe
- [x] Dots and Boxes
- [x] Battleship
- [x] Hangman
- [x] Rock-Paper-Scissors
- [x] 20 Questions
- [x] Whiteboard (shared drawing over the video)
- [x] Pong (real-time, authoritative-host model)
- [x] Air Hockey
- [x] Tron light-cycles
- [x] Snake (versus)
- [x] Asteroids (co-op)
- [x] Platform Racer (race to the flag; each client simulates its own avatar)
- [x] Pool (simplified UK 8-ball; authoritative ball physics)
- [x] Uno (hidden hands; caller is the authoritative referee)
- [x] Monopoly (full board, rent/houses/jail/cards; v1 has no trading/auctions/mortgaging)
- [x] Duck Hunt (2-player competitive shooting)
- [x] Boxing (2-player, Punch-Out style — punch/block/dodge + stamina)
- [x] Scrabble (private racks; placement/premium/cross-word scoring; words on the honour system — no built-in dictionary)
- [ ] More apps — see ideas below

### Ideas for more apps

Utility apps are the open direction now: watch-together queue, collaborative
scratchpad, icebreaker/question deck, spinner wheel, soundboard, emoji bursts.

Non-game / utility: collaborative text scratchpad, a shared YouTube/“watch
together” queue, emoji-reaction bursts over the video, a shared timer/stopwatch,
a “truth or dare”/icebreaker question deck, a spinning chooser wheel, a soundboard.

Each is the same `Appmegle.register({...})` contract — turn-based ones mirror
`apps/tictactoe.js`; real-time ones mirror `apps/pong.js`.

## Notes / limitations

- **Trust-based, like any P2P game.** Each side validates its own input; a modified
  client could send an illegal move/state. Fine for casual play; a competitive
  version would validate incoming messages against local state before applying.
- Inherits slumegle's notes: one-to-one only, no persistent identity, STUN-only (no
  TURN), and free IP-geolocation tiers are rate-limited.
