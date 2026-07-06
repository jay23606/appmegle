// Hole in the Wall (2-player) for appmegle. A wall with a cut-out slides toward you; strike a
// pose so your body fits through the hole. We capture your empty background first, then your
// silhouette = pixels that differ from it; when the wall arrives we score the fraction of your
// body OUTSIDE the hole — too much and you "hit" the wall. Both race the same seeded wall
// sequence; survive the most walls. Each client scores its own body; caller arbitrates + seeds.
// Caller = Blue, answerer = Orange.
(function () {
    const GW = 48, GH = 36, DIFF = 34, MISS = 0.14;    // MISS = allowed body-outside fraction
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null, vid = null;
    let bg = null, seed = 1, wallX = 0, holes = [], wallIdx = 0, phase = 'idle', mine = 0, opp = 0, over = false, winner = null, lastT = 0, lastSend = 0, speed = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const mul = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let rnd = mul(1);
    const nextHole = () => { const w = 0.28 + rnd()*0.24, x = rnd()*(1 - w); return { x, w }; };   // normalized hole in x (full height gap band varies)

    const grab = () => { if (!vid || !vid.videoWidth) return null; const s = Math.max(GW/vid.videoWidth, GH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s; mg.drawImage(vid, (GW-dw)/2, (GH-dh)/2, dw, dh); return mg.getImageData(0, 0, GW, GH).data; };
    const captureBG = () => { const d = grab(); if (!d) return; bg = new Float32Array(GW*GH); for (let i = 0, p = 0; i < GW*GH; i++, p += 4) bg[i] = (d[p]+d[p+1]+d[p+2])/3; statEl.textContent = 'Background set — press Start'; };
    const bodyMask = () => { const d = grab(); const m = new Uint8Array(GW*GH); if (!d || !bg) return m; for (let i = 0, p = 0; i < GW*GH; i++, p += 4) { const gr = (d[p]+d[p+1]+d[p+2])/3; if (Math.abs(gr - bg[i]) > DIFF) m[i] = 1; } return m; };
    const outsideFrac = (hole) => { const m = bodyMask(); let body = 0, out = 0; const x0 = hole.x*GW, x1 = (hole.x+hole.w)*GW; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (m[y*GW+x]) { body++; if (x < x0 || x > x1) out++; } return body < 20 ? 1 : out/body; };

    const newGame = () => { if (!bg) { statEl.textContent = 'Set your background first!'; return; } if (!auth) return ctx.send({ t: 'startreq' }); seed = (Math.random()*1e9)|0; startGame(seed); ctx.send({ t: 'start', seed }); };
    const startGame = (sd) => { rnd = mul(sd); mine = 0; opp = 0; over = false; winner = null; wallIdx = 0; holes = [nextHole()]; wallX = 1; speed = 0.28; phase = 'play'; };
    const wallHit = () => {  // wall reached the player: score current hole
        const frac = outsideFrac(holes[wallIdx]); if (frac <= MISS) mine++; else { if (auth) finish('b'); else ctx.send({ t: 'fail' }); if (!auth) { phase = 'done'; return; } }
        wallIdx++; holes.push(nextHole()); wallX = 1; speed += 0.015;
        if (mine >= 12 && !over) { if (auth) finish('a'); else ctx.send({ t: 'win' }); }
    };
    const finish = (w) => { if (over) return; over = true; winner = w; phase = 'done'; ctx.send({ t: 'result', w }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, 400, 300);
        if (phase === 'play' && holes[wallIdx]) { const h = holes[wallIdx], hx = h.x*400, hw = h.w*400, op = 0.15 + (1-wallX)*0.6;   // wall opacity grows as it closes in
            g.fillStyle = 'rgba(120,90,200,' + op + ')'; g.fillRect(0, 0, hx, 300); g.fillRect(hx+hw, 0, 400-(hx+hw), 300);   // panels either side of the slot
            g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.strokeRect(hx, 0, hw, 300);
            g.fillStyle = '#fff'; g.font = 'bold 16px system-ui'; g.textAlign = 'center'; g.fillText('fit through the gap!', 200, 288);
        }
        g.fillStyle = '#fff'; g.font = 'bold 15px system-ui'; g.textAlign = 'left'; g.fillText('You: ' + mine, 12, 20); g.textAlign = 'right'; g.fillText('Them: ' + opp, 388, 20);
    };
    const status = () => { if (statEl) statEl.textContent = over ? (winner === me ? '🏆 You win!' : 'You lose') : phase === 'play' ? 'Cleared ' + mine + ' walls' : phase === 'idle' ? 'Set background, then Start' : ''; };
    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'play' && !over) { wallX -= speed*dt; if (wallX <= 0) { wallX = 0; wallHit(); } if (t - lastSend > 150) { lastSend = t; ctx.send({ t: 'p', v: mine }); } }
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'holewall', label: 'Hole in the Wall', css: 'apps/holewall.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; bg = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn" id="hw-bg">Set background</button><button class="app-btn nb">Start</button></div><canvas id="hw-canvas" width="400" height="300"></canvas><div class="hw-hint">step OUT of frame, tap "Set background", step back in, then Start</div></div>';
            canvas = ctx.root.querySelector('#hw-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = GW; mc.height = GH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('#hw-bg').addEventListener('click', captureBG);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = mc = mg = vid = bg = null; },
        onData(msg) {
            if (msg.t === 'start' && !auth) startGame(msg.seed);
            else if (msg.t === 'startreq' && auth) { seed = (Math.random()*1e9)|0; startGame(seed); ctx.send({ t: 'start', seed }); }
            else if (msg.t === 'p') opp = msg.v;
            else if (msg.t === 'fail' && auth) finish('a');
            else if (msg.t === 'win' && auth) finish('b');
            else if (msg.t === 'result') { over = true; winner = msg.w; phase = 'done'; }
        }
    });
})();
