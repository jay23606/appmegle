// Pictionary (2-player) for appmegle. One player draws a secret word on a shared canvas (synced
// stroke-by-stroke over the data channel); the other guesses out loud or by typing. The drawer
// taps "Got it" when guessed. 90s rounds, roles swap, running score. The caller owns the word
// deck and sends it only to the drawer. Caller = Blue, answerer = Orange.
(function () {
    const WORDS = ['cat','house','tree','car','sun','boat','pizza','robot','flower','fish','star','clock','guitar','snake','book','rocket','umbrella','butterfly','snowman','castle','dragon','bicycle','rainbow','cactus','ghost','crown','anchor','ladder','volcano','octopus','lighthouse','windmill','penguin','mushroom','spider','tornado','sailboat','igloo','treasure','mountain'];
    const ROUND = 90;
    let ctx = null, auth = false, me = 'a', drawer = 'a', word = '', vWord = '', phase = 'idle', time = ROUND, scores = { a: 0, b: 0 }, lastSec = -1, seen = new Set();
    let statEl = null, canvas = null, g = null, ctrlEl = null, drawing = false, last = null, raf = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const pickWord = () => { if (seen.size >= WORDS.length) seen.clear(); let w; do { w = WORDS[(Math.random()*WORDS.length)|0]; } while (seen.has(w)); seen.add(w); return w; };
    const newRound = (swap) => { if (!auth) return ctx.send({ t: 'newreq' }); if (swap && phase !== 'idle') drawer = other(drawer); word = pickWord(); time = ROUND; lastSec = -1; phase = 'play'; if (g) g.clearRect(0, 0, 480, 360); ctx.send({ t: 'clear' }); sync(); };
    const got = () => { if (phase !== 'play') return; scores[other(drawer)]++; phase = 'over'; sync(); };
    const sync = () => { ctx.send({ t: 's', drawer, phase, time: Math.ceil(time), sa: scores.a, sb: scores.b, w: drawer === 'b' ? word : '' }); render(); };

    const seg = (x0, y0, x1, y1, send) => { g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); if (send) ctx.send({ t: 'seg', x0, y0, x1, y1 }); };
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width*480, y: (e.clientY-r.top)/r.height*360 }; };

    const render = () => {
        if (!ctrlEl) return; const amDrawer = drawer === me, opp = other(me), w = auth ? (amDrawer ? word : '') : vWord;
        statEl.textContent = (amDrawer ? 'You draw' : 'You guess') + ' · ⏱ ' + Math.ceil(time) + ' · You ' + scores[me] + ' Them ' + scores[opp];
        let h = '';
        if (phase === 'idle') h = '<div class="pc-msg">Waiting for the host…</div>';
        else if (phase === 'over') h = '<div class="pc-msg">Guessed it! Point to ' + (other(drawer) === me ? 'you 🎉' : 'them') + '</div><button class="app-btn" id="pc-next">New round (swap)</button>';
        else if (amDrawer) h = '<div class="pc-word">Draw: <b>' + word + '</b></div><div class="pc-tools"><button class="app-btn" id="pc-clear">Clear</button><button class="app-btn" id="pc-got">✓ They got it</button></div>';
        else h = '<div class="pc-msg">🎨 Guess out loud what they\'re drawing!</div>';
        ctrlEl.innerHTML = h;
        const cl = ctrlEl.querySelector('#pc-clear'), gt = ctrlEl.querySelector('#pc-got'), nx = ctrlEl.querySelector('#pc-next');
        if (cl) cl.addEventListener('click', () => { g.clearRect(0, 0, 480, 360); ctx.send({ t: 'clear' }); });
        if (gt) gt.addEventListener('click', () => { if (auth) got(); else ctx.send({ t: 'got' }); });
        if (nx) nx.addEventListener('click', () => newRound(true));
    };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; time -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(time); if (s !== lastSec) { lastSec = s; sync(); } if (time <= 0) { time = 0; phase = 'over'; sync(); } } else loop._l = t; raf = requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'pictionary', label: 'Pictionary', css: 'apps/pictionary.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; drawer = 'a'; seen = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="pc"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="pc-canvas" width="480" height="360"></canvas><div id="pc-ctrl"></div></div>';
            statEl = ctx.root.querySelector('.stat'); canvas = ctx.root.querySelector('#pc-canvas'); g = canvas.getContext('2d'); ctrlEl = ctx.root.querySelector('#pc-ctrl');
            const down = (e) => { if (drawer !== me || phase !== 'play') return; drawing = true; last = pt(e); e.preventDefault(); };
            const move = (e) => { if (!drawing) return; const p = pt(e); seg(last.x, last.y, p.x, p.y, true); last = p; };
            const up = () => { drawing = false; };
            canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); window.addEventListener('pointerup', up); this._up = up;
            ctx.root.querySelector('.nb').addEventListener('click', () => newRound(false));
            if (auth) newRound(false); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('pointerup', this._up); ctx = statEl = canvas = g = ctrlEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { drawer = msg.drawer; phase = msg.phase; time = msg.time; scores = { a: msg.sa, b: msg.sb }; vWord = msg.w; render(); }
            else if (msg.t === 'seg') seg(msg.x0, msg.y0, msg.x1, msg.y1, false);
            else if (msg.t === 'clear') { if (g) g.clearRect(0, 0, 480, 360); }
            else if (msg.t === 'got' && auth) got();
            else if (msg.t === 'newreq' && auth) newRound(false);
        }
    });
})();
