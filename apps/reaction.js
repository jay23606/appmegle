// Reaction Duel (2-player) for appmegle. Both stay still and watch; after a random delay the
// screen flashes "GO!" — first to move (detected by frame-differencing your camera) wins the
// round. Move BEFORE the GO and you false-start. The shared, synchronized cue only works
// because you're both watching live. Caller picks the GO time; each detects its own motion.
// Caller = Blue, answerer = Orange.
(function () {
    const MW = 64, MH = 48, MTH = 26, GO_THRESH = 0.05;
    let ctx = null, auth = false, me = 'a', raf = 0, wrap = null, statEl = null, mc = null, mg = null, vid = null, prev = null;
    let phase = 'idle', goAt = 0, fired = false, scores = { a: 0, b: 0 }, over = false, winner = null, reason = '', baseT = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const motion = () => { if (!vid || !vid.videoWidth) return 0; const s = Math.max(MW/vid.videoWidth, MH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s; mg.drawImage(vid, (MW-dw)/2, (MH-dh)/2, dw, dh); const cur = mg.getImageData(0, 0, MW, MH).data; const first = !prev; if (first) prev = new Float32Array(MW*MH); let n = 0; for (let i = 0, p = 0; i < MW*MH; i++, p += 4) { const gray = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gray - prev[i]) > MTH) n++; prev[i] = gray; } return n/(MW*MH); };

    const startRound = () => { phase = 'wait'; fired = false; over = false; winner = null; reason = ''; baseT = performance.now(); prev = null; if (auth) { goAt = performance.now() + 1500 + Math.random()*3500; ctx.send({ t: 'go', at: goAt - performance.now() }); } };
    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); scores = { a: 0, b: 0 }; startRound(); };
    const fire = (early) => {
        if (fired || over) return; fired = true;
        if (early) { winner = other(me); reason = 'false start'; over = true; if (auth) commit(winner, 'false start'); else ctx.send({ t: 'fire', early: true }); }
        else { winner = me; reason = 'fastest'; over = true; if (auth) commit(me, 'fastest'); else ctx.send({ t: 'fire', early: false }); }
    };
    const commit = (w, r) => { if (over && winner && winner !== w && reason) return; over = true; winner = w; reason = r; scores[w]++; ctx.send({ t: 'result', winner: w, reason: r, scores }); };

    const draw = () => {
        const c = wrap; if (!c) return;
        c.style.background = phase === 'go' && !over ? 'rgba(40,200,80,.55)' : over ? 'rgba(0,0,0,.5)' : 'rgba(120,30,30,.45)';
        let big = phase === 'idle' ? 'Tap Start' : phase === 'wait' ? 'WAIT…' : phase === 'go' ? 'GO! 🥊' : '';
        if (over) big = winner === me ? '🏆 You win' : 'You lose';
        c.querySelector('.rd-big').textContent = big;
        c.querySelector('.rd-sub').textContent = over ? (winner === me ? '(' + reason + ')' : '(' + reason + ')') : phase === 'wait' ? "don't move until GO" : phase === 'go' ? 'MOVE NOW!' : '';
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[other(me)] + ' Them';
    };
    const loop = (t) => {
        const m = motion();
        if (phase === 'wait' && !over) { if (m > GO_THRESH && t - baseT > 400) fire(true); if (performance.now() >= goAt) { phase = 'go'; baseT = t; } }
        else if (phase === 'go' && !over) { if (m > GO_THRESH) fire(false); }
        draw(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'reaction', label: 'Reaction Duel', css: 'apps/reaction.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; prev = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start</button></div><div id="rd-box"><div class="rd-big"></div><div class="rd-sub"></div></div></div>';
            wrap = ctx.root.querySelector('#rd-box'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            baseT = performance.now(); raf = requestAnimationFrame(loop); draw();
        },
        unmount() { cancelAnimationFrame(raf); ctx = wrap = statEl = mc = mg = vid = prev = null; },
        onData(msg) {
            if (msg.t === 'go' && !auth) { goAt = performance.now() + msg.at; phase = 'wait'; fired = false; over = false; winner = null; baseT = performance.now(); }
            else if (msg.t === 'startreq' && auth) { scores = { a: 0, b: 0 }; startRound(); }
            else if (msg.t === 'fire' && auth) { commit(msg.early ? 'a' : 'b', msg.early ? 'false start' : 'fastest'); }
            else if (msg.t === 'result') { over = true; winner = msg.winner; reason = msg.reason; scores = msg.scores; draw(); }
        }
    });
})();
