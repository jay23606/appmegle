// Liar's Dice / Perudo (2-player) for appmegle. Each rolls 5 hidden dice; players alternate
// raising a bid ("there are at least N dice showing face V" across BOTH cups), or call "Liar".
// On a call, all dice reveal: if the bid holds the bidder wins the round, else the caller wins;
// the loser drops a die. Lose all dice and you lose. Bluffing — reading your stranger's face is
// the whole game. Caller is authoritative (owns both hidden cups, validates). Caller = Blue, answerer = Orange.
(function () {
    let ctx = null, auth = false, me = 'a', dice = { a: [], b: [] }, nd = { a: 5, b: 5 }, turn = 'a', bid = null, phase = 'idle', reveal = null, over = false, winner = null, lastWin = '';
    let statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const rollCup = (n) => Array.from({ length: n }, () => 1 + ((Math.random()*6)|0));
    const totalOf = (v) => dice.a.filter(x => x === v || x === 1).length + dice.b.filter(x => x === v || x === 1).length;   // 1s are wild
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); nd = { a: 5, b: 5 }; over = false; winner = null; startRound('a'); };
    const startRound = (first) => { dice = { a: rollCup(nd.a), b: rollCup(nd.b) }; turn = first; bid = null; reveal = null; phase = 'bid'; lastWin = ''; sync(); };
    const raise = (cnt, face) => {
        if (phase !== 'bid') return; if (bid && !(cnt > bid.cnt || (cnt === bid.cnt && face > bid.face))) return;
        bid = { cnt, face, by: turn }; turn = other(turn); sync();
    };
    const callLiar = () => {
        if (phase !== 'bid' || !bid) return; const actual = totalOf(bid.face), holds = actual >= bid.cnt;
        const roundWinner = holds ? bid.by : other(bid.by), loser = other(roundWinner);
        nd[loser]--; reveal = { a: [...dice.a], b: [...dice.b], bid: { ...bid }, actual, caller: turn, winner: roundWinner }; phase = 'reveal';
        if (nd[loser] <= 0) { over = true; winner = roundWinner; } lastWin = roundWinner; sync();
    };
    const nextRound = () => { if (over) return; startRound(lastWin); };
    const sync = () => { ctx.send({ t: 's', dice: { b: dice.b }, nd, turn, bid, phase, reveal, over, winner }); render(); };   // only the answerer's own cup (reveal carries both at showdown)

    const render = () => {
        if (!bodyEl) return; const opp = other(me), amTurn = turn === me && phase === 'bid';
        const myDice = (auth ? dice : dice)[me] || [];
        statEl.textContent = over ? (winner === me ? '🏆 You win the game!' : 'You lose') : 'Your dice: ' + nd[me] + ' · Theirs: ' + nd[opp];
        let h = '<div class="ld-cup"><div class="ld-lbl">Your dice (hidden from them)</div><div class="ld-dice">' + myDice.map(d => '<span class="ld-die">' + '⚀⚁⚂⚃⚄⚅'[d-1] + '</span>').join('') + '</div></div>';
        if (phase === 'reveal' && reveal) {
            h += '<div class="ld-rev">Bid: ' + reveal.bid.cnt + ' × ' + '⚀⚁⚂⚃⚄⚅'[reveal.bid.face-1] + ' · actual (1s wild): <b>' + reveal.actual + '</b></div>';
            h += '<div class="ld-rev">Their dice: ' + (me === 'a' ? reveal.b : reveal.a).map(d => '⚀⚁⚂⚃⚄⚅'[d-1]).join(' ') + '</div>';
            h += '<div class="ld-msg">' + (reveal.winner === me ? 'You win the round! 🎉' : 'You lose the round') + ' — ' + other(reveal.winner) + ' drops a die.</div>';
            h += over ? '' : '<button class="app-btn" id="ld-next">Next round →</button>';
        } else if (over) { /* shown in stat */ }
        else if (bid) { h += '<div class="ld-bid">Current bid: <b>' + bid.cnt + ' × ' + '⚀⚁⚂⚃⚄⚅'[bid.face-1] + '</b> by ' + (bid.by === me ? 'you' : 'them') + '</div>'; }
        else h += '<div class="ld-msg">No bid yet — ' + (amTurn ? 'open the bidding!' : "waiting for their bid") + '</div>';
        if (amTurn) {
            const minCnt = bid ? bid.cnt : 1;
            h += '<div class="ld-controls"><div class="ld-row">Count <select id="ld-c">' + Array.from({ length: nd.a + nd.b }, (_, i) => i+1).filter(n => n >= minCnt).map(n => '<option>' + n + '</option>').join('') + '</select> Face <select id="ld-f">' + [1,2,3,4,5,6].map(f => '<option value="' + f + '">' + '⚀⚁⚂⚃⚄⚅'[f-1] + '</option>').join('') + '</select> <button class="app-btn" id="ld-raise">Bid</button></div>' + (bid ? '<button class="app-btn" id="ld-liar">📢 LIAR!</button>' : '') + '</div>';
        } else if (phase === 'bid') h += '<div class="ld-msg">' + (bid ? 'Their turn to bid or call…' : '') + '</div>';
        bodyEl.innerHTML = h;
        const rb = bodyEl.querySelector('#ld-raise'), lb = bodyEl.querySelector('#ld-liar'), nx = bodyEl.querySelector('#ld-next');
        const doRaise = () => { const c = +bodyEl.querySelector('#ld-c').value, f = +bodyEl.querySelector('#ld-f').value; if (auth) raise(c, f); else ctx.send({ t: 'raise', c, f }); };
        if (rb) rb.addEventListener('click', doRaise);
        if (lb) lb.addEventListener('click', () => { if (auth) callLiar(); else ctx.send({ t: 'liar' }); });
        if (nx) nx.addEventListener('click', () => { if (auth) nextRound(); else ctx.send({ t: 'next' }); });
    };
    window.Appmegle.register({
        id: 'liarsdice', label: "Liar's Dice", css: 'apps/liarsdice.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col" id="ld"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="ld-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ld-body');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else bodyEl.textContent = 'Waiting for the host…';
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { dice = msg.dice; nd = msg.nd; turn = msg.turn; bid = msg.bid; phase = msg.phase; reveal = msg.reveal; over = msg.over; winner = msg.winner; render(); }
            else if (msg.t === 'raise' && auth) raise(msg.c, msg.f);
            else if (msg.t === 'liar' && auth) callLiar();
            else if (msg.t === 'next' && auth) nextRound();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
