// Wavelength (2-player co-op) for appmegle. One of you (the psychic) secretly sees a target
// spot on a spectrum ("freezing ↔ scorching") and says ONE clue out loud over the call; the
// other turns the dial to where they think the target is and locks in. Closer = more points
// (4/3/2 bands). 7 rounds, roles alternate, final "how in-sync are you" rating. The caller owns
// the deck and sends the target only to the psychic. Caller = Blue, answerer = Orange.
(function () {
    const SPECS = [['freezing','scorching'],['hero','villain'],['underrated','overrated'],['cheap','expensive'],['terrifying','adorable'],['disgusting','delicious'],['useless','essential'],['low-tech','high-tech'],['normal','weird'],['quiet','loud'],['round','pointy'],['smells awful','smells amazing'],['sad song','happy song'],['casual','fancy'],['ancient','futuristic'],['tiny','enormous'],['boring','thrilling'],['bad habit','good habit'],['dry','wet'],['forgettable','iconic'],['soft','hard'],['guilty pleasure','proud pleasure']];
    const ROUNDS = 7, CW = 440, CH = 260, CX = 220, CY = 235, R = 190;
    let ctx = null, auth = false, me = 'a', deck = [], phase = 'idle', roundN = 0, psychic = 'a', spec = null, target = null, dial = 50, guess = null, pts = 0, total = 0, statEl = null, canvas = null, g = null, ctrlEl = null, dragging = false;
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); deck = shuffle([...SPECS]); roundN = 0; total = 0; psychic = 'b'; nextRound(); };
    const nextRound = () => { roundN++; psychic = psychic === 'a' ? 'b' : 'a'; spec = deck[(roundN-1) % deck.length]; target = 8 + ((Math.random()*84)|0); dial = 50; guess = null; phase = 'clue'; ctx.send({ t: 'round', n: roundN, spec, psychic, tg: psychic === 'b' ? target : null }); render(); };
    const lockGuess = (v) => { if (auth) { guess = v; const d = Math.abs(target - v); pts = d <= 5 ? 4 : d <= 12 ? 3 : d <= 25 ? 2 : 0; total += pts; phase = 'reveal'; ctx.send({ t: 'res', tg: target, gs: v, pts, total }); render(); } else ctx.send({ t: 'guess', v }); };
    const a4v = (v) => Math.PI + v/100*Math.PI;
    const band = (c, lo, hi, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(CX, CY, R-14, a4v(Math.max(0, c+lo)), a4v(Math.min(100, c+hi))); g.stroke(); };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, CW, CH);
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 26; g.beginPath(); g.arc(CX, CY, R-14, Math.PI, 2*Math.PI); g.stroke();
        const showT = (phase === 'clue' && psychic === me && target !== null) || phase === 'reveal';
        if (showT && target !== null) { band(target, -25, 25, 'rgba(120,160,255,.5)', 26); band(target, -12, 12, 'rgba(90,220,140,.7)', 26); band(target, -5, 5, '#ffd24a', 26); }
        const v = phase === 'reveal' && guess !== null ? guess : dial;
        const a = a4v(v); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + Math.cos(a)*(R-2), CY + Math.sin(a)*(R-2)); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(CX, CY, 8, 0, 7); g.fill();
        if (spec) { g.fillStyle = '#fff'; g.font = 'bold 14px system-ui'; g.textAlign = 'left'; g.fillText('◀ ' + spec[0], 8, CH-6); g.textAlign = 'right'; g.fillText(spec[1] + ' ▶', CW-8, CH-6); }
    };
    const render = () => {
        if (!ctrlEl) return; draw();
        statEl.textContent = phase === 'idle' ? 'Wavelength' : 'Round ' + roundN + '/' + ROUNDS + ' · score ' + total;
        let h = '';
        if (phase === 'idle') h = '<div class="wl-msg">Waiting for the host…</div>';
        else if (phase === 'clue') h = psychic === me
            ? '<div class="wl-msg">🔮 You\'re the psychic — <b>say ONE clue out loud</b> that points at the gold band.</div>'
            : '<div class="wl-msg">🎧 Listen to their clue, drag the dial, then lock in.</div><button class="app-btn" id="wl-lock">Lock in</button>';
        else if (phase === 'reveal') {
            h = '<div class="wl-msg">' + (pts === 4 ? '🎯 Bullseye! +4' : pts === 3 ? '💚 So close! +3' : pts === 2 ? '👍 In range +2' : '💨 Missed it') + '</div>';
            h += roundN >= ROUNDS ? '<div class="wl-final">' + total + '/' + ROUNDS*4 + ' — ' + (total >= 22 ? '🧠 same brain' : total >= 16 ? '📡 tuned in' : total >= 9 ? '🙂 getting there' : '📻 static') + '</div><button class="app-btn" id="wl-new">Play again</button>' : '<button class="app-btn" id="wl-next">Next round</button>';
        }
        ctrlEl.innerHTML = h;
        const lk = ctrlEl.querySelector('#wl-lock'), nx = ctrlEl.querySelector('#wl-next'), nw = ctrlEl.querySelector('#wl-new');
        if (lk) lk.addEventListener('click', () => lockGuess(Math.round(dial)));
        if (nx) nx.addEventListener('click', () => { if (auth) nextRound(); else ctx.send({ t: 'nextreq' }); });
        if (nw) nw.addEventListener('click', newGame);
    };
    const setDial = (e) => { const r = canvas.getBoundingClientRect(), px = (e.clientX-r.left)/r.width*CW, py = (e.clientY-r.top)/r.height*CH; let a = Math.atan2(py-CY, px-CX); if (a > 0) a = a > Math.PI/2 ? Math.PI : 0; else a += 2*Math.PI; dial = Math.max(0, Math.min(100, (a-Math.PI)/Math.PI*100)); draw(); };
    window.Appmegle.register({
        id: 'wavelength', label: 'Wavelength', css: 'apps/wavelength.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col" id="wl"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="wl-canvas" width="' + CW + '" height="' + CH + '"></canvas><div id="wl-ctrl"></div></div>';
            statEl = ctx.root.querySelector('.stat'); canvas = ctx.root.querySelector('#wl-canvas'); g = canvas.getContext('2d'); ctrlEl = ctx.root.querySelector('#wl-ctrl');
            canvas.addEventListener('pointerdown', (e) => { if (phase === 'clue' && psychic !== me) { dragging = true; setDial(e); } });
            canvas.addEventListener('pointermove', (e) => { if (dragging) setDial(e); });
            window.addEventListener('pointerup', this._up = () => { dragging = false; });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else render();
        },
        unmount() { window.removeEventListener('pointerup', this._up); ctx = statEl = canvas = g = ctrlEl = null; },
        onData(msg) {
            if (msg.t === 'round' && !auth) { roundN = msg.n; spec = msg.spec; psychic = msg.psychic; target = msg.tg; dial = 50; guess = null; phase = 'clue'; render(); }
            else if (msg.t === 'res' && !auth) { target = msg.tg; guess = msg.gs; pts = msg.pts; total = msg.total; phase = 'reveal'; render(); }
            else if (msg.t === 'guess' && auth) lockGuess(msg.v);
            else if (msg.t === 'nextreq' && auth) nextRound();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
