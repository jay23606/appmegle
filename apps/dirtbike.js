// Dirtbike Racer (Excitebike-style, 2-player) for appmegle. Side-scrolling motocross over
// a deterministic bumpy track with ramps. Each client simulates its OWN bike locally
// (lag-free), broadcasts position for the opponent ghost, and the caller arbitrates who
// finishes first. Signature mechanic: launch off a ramp and tilt your lean so you land at
// the ground's angle — a bad landing crashes you. Auto-throttle + turbo (overheats).
// Caller = blue, answerer = orange.
(function () {
    const W = 720, H = 360, LEN = 4400, BASE = 250, SEND = 33;
    const MAXS = 260, TURBOS = 380, ACC = 320, GRAV = 1000;
    const RAMPS = [780, 1640, 2500, 3200, 3900];                 // crest x-positions
    const ground = (x) => {
        let y = BASE - Math.sin(x*0.0042)*18 - Math.sin(x*0.011)*9;
        for (const rx of RAMPS) { const d = x - (rx - 95); if (d > 0 && d < 95) y -= (d/95)*72; }   // ramp up; sharp drop past crest
        return y;
    };
    const gAng = (x) => Math.atan2(ground(x+6) - ground(x-6), 12);

    let ctx = null, auth = false, role = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let bk = null, opp = { x: 60, y: BASE, a: 0 }, turbo = 0, lb = 0, lf = 0;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, lastUp = 0, onKey = null;

    const begin = () => {
        bk = { x: 60, y: ground(60), vx: 0, vy: 0, air: false, a: 0, crash: 0, temp: 0, fin: false };
        opp = { x: 60, y: ground(60), a: 0 }; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000;
    };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'rematch' }); };

    const sim = (dt) => {
        if (bk.crash > 0) { bk.crash -= dt; bk.vx *= 0.9; bk.y = ground(bk.x); bk.a = Math.sin(performance.now()/40)*0.4; bk.x += bk.vx*dt; return; }
        const target = (turbo && bk.temp < 1) ? TURBOS : MAXS;
        bk.vx += (bk.vx < target ? ACC : -90) * dt;
        if (turbo && bk.temp < 1) bk.temp = Math.min(1, bk.temp + 0.42*dt); else bk.temp = Math.max(0, bk.temp - 0.3*dt);
        if (bk.temp >= 1) bk.vx *= 0.985;
        if (bk.vx < 0) bk.vx = 0;
        bk.x += bk.vx*dt;
        if (!bk.air) {
            const gy = ground(bk.x);
            if (gy - bk.y > 22 && lastUp < -2.5 && bk.vx > 120) { bk.air = true; bk.vy = -Math.min(540, bk.vx*1.05); }
            else { bk.y = gy; bk.a = gAng(bk.x); lastUp = ground(bk.x) - ground(bk.x - 6); }
        }
        if (bk.air) {
            bk.vy += GRAV*dt; bk.y += bk.vy*dt;
            bk.a += (lb ? -2.4 : lf ? 2.4 : 0) * dt;
            const gy = ground(bk.x);
            if (bk.y >= gy) { bk.y = gy; bk.air = false; const ga = gAng(bk.x); if (Math.abs(bk.a - ga) > 0.55) { bk.crash = 1.2; bk.vx *= 0.25; } bk.a = ga; bk.vy = 0; lastUp = 0; }
        }
        if (bk.x >= LEN - 40 && !bk.fin) { bk.fin = true; onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they finished first'; };

    const bike = (sx, sy, a, col, ghost) => {
        g.save(); g.translate(sx, sy); g.rotate(a); g.globalAlpha = ghost ? 0.5 : 1;
        g.strokeStyle = '#222'; g.lineWidth = 3;
        g.beginPath(); g.arc(-11, 0, 7, 0, 7); g.moveTo(18, 0); g.arc(11, 0, 7, 0, 7); g.stroke();      // wheels
        g.fillStyle = col; g.beginPath(); g.roundRect(-12, -10, 24, 8, 3); g.fill();                      // body
        g.fillStyle = '#f0c39a'; g.beginPath(); g.arc(2, -16, 5, 0, 7); g.fill();                          // rider head
        g.globalAlpha = 1; g.restore();
    };
    const draw = () => {
        g.clearRect(0, 0, W, H);
        const camX = Math.max(0, Math.min(LEN - W, (bk ? bk.x : 0) - 180));
        // terrain
        g.fillStyle = 'rgba(110,70,40,.4)'; g.beginPath(); g.moveTo(0, H);
        for (let sx = 0; sx <= W; sx += 6) g.lineTo(sx, ground(camX + sx)); g.lineTo(W, H); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath();
        for (let sx = 0; sx <= W; sx += 6) (sx ? g.lineTo : g.moveTo).call(g, sx, ground(camX + sx)); g.stroke();
        // finish
        const fx = LEN - 40 - camX; if (fx > -20 && fx < W + 20) { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#222'; g.fillRect(fx, ground(LEN-40) - 120 + i*15, 14, 15); } }
        // bikes
        if (opp.x >= camX - 40 && opp.x <= camX + W + 40) bike(opp.x - camX, opp.y, opp.a, role === 'a' ? '#ff9d3d' : '#5db4ff', true);
        if (bk) bike(bk.x - camX, bk.y, bk.a, role === 'a' ? '#5db4ff' : '#ff9d3d', false);
        // HUD: progress + temp
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(10, 10, 240, 8);
        g.fillStyle = role === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(10, 10, 240 * (bk ? bk.x/LEN : 0), 4);
        g.fillStyle = role === 'a' ? '#ff9d3d' : '#5db4ff'; g.fillRect(10, 14, 240 * (opp.x/LEN), 4);
        if (bk) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W-130, 10, 120, 10); g.fillStyle = bk.temp >= 1 ? '#e05050' : '#f2b21b'; g.fillRect(W-130, 10, 120*bk.temp, 10); g.fillStyle = '#fff'; g.font = '11px system-ui'; g.textAlign = 'right'; g.fillText('TURBO', W-12, 32); }
        if (phase === 'countdown') { const n = Math.ceil((countEnd - performance.now())/1000); g.fillStyle = '#fff'; g.font = 'bold 60px system-ui'; g.textAlign = 'center'; g.fillText(n > 0 ? n : 'GO!', W/2, H/2); }
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Race! turbo 🔥 · lean ⤴⤵ to land flat'; }
        if (phase === 'race' && bk) sim(dt);
        if (bk && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: Math.round(bk.x), y: Math.round(bk.y), a: +bk.a.toFixed(2) }); }
        draw(); raf = requestAnimationFrame(loop);
    };

    window.Appmegle.register({
        id: 'dirtbike', label: 'Dirtbike Racer', css: 'apps/dirtbike.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New race</button></div>' +
                '<canvas id="db-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="db-pad"><button data-k="lb">⤴ Lean back</button><button data-k="t">🔥 Turbo</button><button data-k="lf">Lean fwd ⤵</button></div></div>';
            canvas = ctx.root.querySelector('#db-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => {
                const d = e.type === 'keydown';
                if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') turbo = d ? 1 : 0;
                else if (e.code === 'ArrowLeft' || e.code === 'KeyA') lb = d ? 1 : 0;
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') lf = d ? 1 : 0;
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#db-pad button').forEach(b => {
                const k = b.dataset.k, set = (v) => { if (k === 't') turbo = v; else if (k === 'lb') lb = v; else lf = v; };
                b.addEventListener('pointerdown', e => { e.preventDefault(); set(1); });
                b.addEventListener('pointerup', () => set(0)); b.addEventListener('pointerleave', () => set(0));
            });
            statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host…';
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
            if (auth) newRace();
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); ctx = canvas = g = statEl = bk = null; },
        onData(msg) {
            if (msg.t === 'p') opp = { x: msg.x, y: msg.y, a: msg.a };
            else if (msg.t === 'start') begin();
            else if (msg.t === 'rematch' && auth) newRace();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
        }
    });
})();
