// AR Sticker Slap (2-player) for appmegle. Emoji stickers pop up over your mirrored camera feed;
// physically swipe your hand across them (frame-differenced motion) to slap them away. Same
// synced stickers appear for both players — first to slap each one scores it. Race to 10.
// Caller spawns/arbitrates; each client detects its own hand motion. Caller = Blue, answerer = Orange.
(function () {
    const CW = 400, CH = 300, GW = 40, GH = 30, DIFF = 26, HIT = 0.14, WIN = 10, EMO = ['⭐','💥','🎯','🍎','👾','🔥','💎','🏀','🐸','🎈','🍕','👽'];
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null, vid = null, prev = null;
    let stickers = [], scores = { a: 0, b: 0 }, phase = 'idle', over = false, winner = null, sid = 0, spawnAt = 0, lastT = 0, lastSend = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const drawMirror = (dst, w, h, src) => { dst.save(); dst.translate(w, 0); dst.scale(-1, 1); const s = Math.max(w/src.videoWidth, h/src.videoHeight), dw = src.videoWidth*s, dh = src.videoHeight*s; dst.drawImage(src, (w-dw)/2, (h-dh)/2, dw, dh); dst.restore(); };
    const motionGrid = () => { const grid = new Float32Array(GW*GH); if (!vid || !vid.videoWidth) return grid; mg.clearRect(0, 0, GW, GH); drawMirror(mg, GW, GH, vid); const cur = mg.getImageData(0, 0, GW, GH).data; const first = !prev; if (first) prev = new Float32Array(GW*GH); for (let i = 0, p = 0; i < GW*GH; i++, p += 4) { const gr = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gr - prev[i]) > DIFF) grid[i] = 1; prev[i] = gr; } return grid; };
    const hitTest = (grid, s) => { const cx = (s.x*GW)|0, cy = (s.y*GH)|0, r = 4; let hit = 0, tot = 0; for (let y = cy-r; y <= cy+r; y++) for (let x = cx-r; x <= cx+r; x++) if (x >= 0 && x < GW && y >= 0 && y < GH) { tot++; if (grid[y*GW+x]) hit++; } return tot && hit/tot > HIT; };

    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); scores = { a: 0, b: 0 }; over = false; winner = null; stickers = []; sid = 0; spawnAt = performance.now() + 400; phase = 'play'; sync(); };
    const spawn = () => { stickers.push({ id: sid++, x: 0.12 + Math.random()*0.76, y: 0.16 + Math.random()*0.66, e: EMO[(Math.random()*EMO.length)|0], born: performance.now() }); sync(); };
    const claim = (p, id) => { const i = stickers.findIndex(s => s.id === id); if (i < 0) return; stickers.splice(i, 1); scores[p]++; if (scores[p] >= WIN) { over = true; winner = p; phase = 'done'; } sync(); };
    const sync = () => { ctx.send({ t: 's', st: stickers, sa: scores.a, sb: scores.b, over, winner, phase }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, CW, CH); if (vid && vid.videoWidth) drawMirror(g, CW, CH, vid); else { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, CW, CH); }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const s of stickers) { const age = (performance.now() - s.born)/1000, sc = 0.6 + Math.min(0.4, age*1.2); g.font = Math.round(34*sc) + 'px system-ui'; g.fillText(s.e, s.x*CW, s.y*CH); }
        g.fillStyle = '#fff'; g.font = 'bold 16px system-ui'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('You ' + scores[me], 10, 22); g.textAlign = 'right'; g.fillText('Them ' + scores[other(me)], CW-10, 22);
        if (over) { g.textAlign = 'center'; g.font = 'bold 34px system-ui'; g.fillStyle = '#fff'; g.fillText(winner === me ? '🏆 YOU WIN' : 'YOU LOSE', CW/2, CH/2); }
    };
    const status = () => { if (statEl) statEl.textContent = over ? (winner === me ? '🏆 You win!' : 'You lose') : phase === 'play' ? 'Slap the stickers! ' + scores[me] + '–' + scores[other(me)] : 'Tap Start'; };
    const loop = (t) => {
        lastT = t;
        if (phase === 'play' && !over) {
            const grid = motionGrid();
            for (const s of stickers) if (hitTest(grid, s)) { if (auth) claim('a', s.id); else ctx.send({ t: 'claim', id: s.id }); break; }
            if (auth) { if (performance.now() >= spawnAt && stickers.length < 4) { spawn(); spawnAt = performance.now() + 900 + Math.random()*900; } const now = performance.now(); const before = stickers.length; stickers = stickers.filter(s => now - s.born < 3200); if (stickers.length !== before) sync(); }
        }
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'arslap', label: 'AR Sticker Slap', css: 'apps/arslap.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; prev = null; stickers = []; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start</button></div><canvas id="as-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="as-hint">needs camera · swipe your hand across the stickers to slap them</div></div>';
            canvas = ctx.root.querySelector('#as-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = GW; mc.height = GH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = mc = mg = vid = prev = null; stickers = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) { stickers = msg.st; scores = { a: msg.sa, b: msg.sb }; over = msg.over; winner = msg.winner; phase = msg.phase; }
            else if (msg.t === 'claim' && auth) claim('b', msg.id);
            else if (msg.t === 'startreq' && auth) newGame();
        }
    });
})();
