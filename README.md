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
- [x] Icebreakers (shared, endlessly-generated get-to-know-you questions; tap to advance)
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
- [x] Kart Racer (top-down 3-lap race; boost pads + banana drops)
- [x] Tetris (2-player versus; clear lines to send garbage, top out to lose)
- [x] Dirtbike Racer (Excitebike-style; ramps, lean-to-land, turbo/overheat)
- [x] Ball Roller (3D! three.js translucent ball maze race; tilt on mobile, keys/drag on laptop)
- [x] 3D Tic-Tac-Toe (4x4x4 Qubic — glass cube, drag to rotate, tap to place)
- [x] Stack (3D one-tap block tower race)
- [x] Mini Golf (3D, turn-based putt physics)
- [x] Tunnel Flyer (3D, fly through rings, seed-synced tunnel)
- [x] Marble Sumo (3D, bump your opponent off the platform)
- [x] Helix Descent (3D, rotate the tower to drop through the gaps)
- [x] Pac-Man (2-player dot race; shared maze + ghosts, procedural braided maze)
- [x] Bubble Bobble (2-player co-op; trap enemies in bubbles and pop them)
- [x] Video Puzzle (race to reassemble your partner's live face; progressively harder rounds, first to 5 wins)
- [x] Compatibility Quiz (answer simultaneously, score how often you match)
- [x] Trivia (buzz-in head-to-head; live questions from the OpenTDB API)
- [x] Bomberman (2-player versus; bombs, soft blocks, power-ups)
- [x] Tank Duel (turn-based artillery; aim/power, wind, destructible terrain)
- [x] Fruit Ninja (motion-controlled — slice flying fruit by waving your hand at the camera)
- [x] Webcam Volleyball (motion-controlled — bump the ball between both players' camera feeds)
- [x] Heads Up! (word hidden from the guesser, shown over their forehead to the clue-giver; live-voice clues)
- [x] Spirit Shooter (2-player co-op top-down shooter, Pocky & Rocky-style; auto-aim, spin-blast, boss)
- [x] Story Builder (take turns adding a line to a shared story)
- [x] Two Truths & a Lie (write three, spot the lie)
- [x] Truth or Dare (dares on camera, truths out loud)
- [x] Couple's Quiz (guess what your partner will pick)
- [x] Taboo (clue a word without saying the banned ones; partner buzzes)
- [x] Gomoku (five-in-a-row on a 15x15 board)
- [x] Mancala (Kalah — sow, capture, extra turns)
- [x] Categories (Scattergories — letter + categories, matching answers cancel)
- [x] Codenames Duet (co-op; secret keys, one-word clues, find the agents)
- [x] Quoridor (race your pawn while dropping walls; path always guaranteed)
- [x] Backgammon (full rules: dice, doubles, bar, hitting, bearing off)
- [x] Scream Meter (mic — yell loudest to win)
- [x] Hold the Note (mic — sustain one note the longest)
- [x] Reaction Duel (motion — first to flinch on GO wins; false-start loses)
- [x] Red Light Green Light (motion — move on green, freeze on red)
- [x] Mirror Match (motion — co-op sync meter, mirror your partner)
- [x] Liar's Dice (Perudo — hidden dice, bidding, calling bluffs)
- [x] Make Me Laugh (30s to crack your partner; they tap if they laugh)
- [x] Scavenger Hunt (race to show a real object matching the prompt)
- [x] Watch Together (synced YouTube — host controls, both watch in lockstep)
- [x] Pictionary (draw a secret word on a shared canvas; partner guesses; timed, roles swap)
- [x] Spaceteam (frantic co-op; shout commands for your partner's control panel before the timer)
- [x] Hole in the Wall (background-subtraction silhouette — contort to fit the sliding gap)
- [x] AR Sticker Slap (motion — swipe your hand to slap emoji stickers over your camera; race to 10)
- [x] Co-op Platformer (shared level; take turns on pressure plates to open the gate, reach the goal together)
- [x] **All 25 of the app-idea batch shipped** ✅
- [x] Mind Meld (telepathy — converge on the same word round by round)
- [x] Split or Steal (negotiate face to face, then secretly choose — Golden Balls)
- [x] Wavelength (psychic sees a secret dial position, says one clue; 7 co-op rounds)
- [x] Alibi (60s to sync your story out loud, then separate typed interrogation)
- [x] Séance (two-hand Ouija — planchette moves by averaged control + noise)
- [ ] Second wave — 15 remaining: Read My Lips, I Spy Your Room, Hum That Tune, What's That Sound, Portrait Duel, Face Doodle, Exquisite Corpse, Fireworks Finale, Shadow Theater, High-Five Replay, Siren Flight, Theremin Duet, Bomb Squad, Two-Key Escape Room, Egg Buddy

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
