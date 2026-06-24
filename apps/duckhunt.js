// Duck Hunt (2-player competitive) for appmegle. Authoritative caller spawns and flies
// the flock and arbitrates shots; both players shoot the SAME ducks with their own
// crosshair and limited ammo per wave. Most ducks bagged across the waves wins.
// Caller = blue crosshair, answerer = orange.
(function () {
    const W = 640, H = 420, HITR = 24, DUCKS = 5, AMMO = 6, WAVES = 5, SEND = 33;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let ducks = [], scores = { a: 0, b: 0 }, ammo = { a: AMMO, b: AMMO }, wave = 0, phase = 'play', waveT = 0;
    let aimPos = { a: { x: W/2, y: H/2 }, b: { x: W/2, y: H/2 } }, over = false, winner = null;
    let lastT = 0, lastSend = 0, aimLocal = { x: W/2, y: H/2 }, view = null, lastAimSend = 0;

    const spawn = () => Array.from({ length: DUCKS }, () => {
        const x = 40 + Math.random()*(W-80);
        return { x, y: H - 6, vx: (Math.random()*2-1)*120, vy: -(70 + Math.random()*70), alive: true, falling: false, gone: false };
    });
    const startWave = () => { wave++; ducks = spawn(); ammo = { a: AMMO, b: AMMO }; phase = 'play'; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); scores = { a: 0, b: 0 }; wave = 0; over = false; winner = null; startWave(); sync(); };

    const tick = (dt) => {
        if (phase === 'play') {
            for (const d of ducks) {
                if (d.gone) continue;
                if (d.falling) { d.y += 280*dt; if (d.y > H + 30) d.gone = true; continue; }
                d.x += d.vx*dt; d.y += d.vy*dt;
                if (d.x < 20 || d.x > W - 20) d.vx *= -1;
                if (d.y < -20) { d.alive = false; d.gone = true; }     // escaped
            }
            const active = ducks.some(d => d.alive && !d.gone && !d.falling);
            if (!active || (ammo.a <= 0 && ammo.b <= 0)) { phase = 'between'; waveT = 1.4; }
        } else if (phase === 'between') {
            waveT -= dt;
            if (waveT <= 0) {
                if (wave >= WAVES) { over = true; winner = scores.a === scores.b ? 'tie' : (scores.a > scores.b ? 'a' : 'b'); phase = 'over'; }
                else startWave();
            }
        }
    };
    const applyShoot = (p, x, y) => {
        if (over || phase !== 'play' || ammo[p] <= 0) return;
        ammo[p]--;
        let best = -1, bd = HITR;
        ducks.forEach((d, i) => { if (d.alive && !d.gone && !d.falling) { const dd = Math.hypot(x - d.x, y - d.y); if (dd < bd) { bd = dd; best = i; } } });
        if (best >= 0) { ducks[best].alive = false; ducks[best].falling = true; scores[p]++; }
        sync();
    };

    const snap = () => ({ ducks: ducks.map(d => ({ x: Math.round(d.x), y: Math.round(d.y), a: d.alive, f: d.falling, go: d.gone })), scores, ammo, wave, phase, over, winner, aimA: aimPos.a });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: snap() }); };

    const duckShape = (d) => {
        g.save(); g.translate(d.x, d.y); if (d.f) g.rotate(Math.PI);
        g.fillStyle = d.f ? '#caa37a' : '#7ad14a';
        g.beginPath(); g.ellipse(0, 0, 16, 11, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(13, -7, 7, 0, 7); g.fill();
        g.fillStyle = '#f5a623'; g.beginPath(); g.moveTo(19, -8); g.lineTo(27, -6); g.lineTo(19, -4); g.fill();
        g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(-3, 0, 8, 5, d.vx > 0 ? -0.4 : 0.4, 0, 7); g.fill();
        g.restore();
    };
    const cross = (p, col, big) => { g.strokeStyle = col; g.lineWidth = big ? 3 : 2; const r = big ? 14 : 11; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.moveTo(p.x - r - 4, p.y); g.lineTo(p.x + r + 4, p.y); g.moveTo(p.x, p.y - r - 4); g.lineTo(p.x, p.y + r + 4); g.stroke(); };
    const render = () => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(60,120,60,.35)'; g.fillRect(0, H - 40, W, 40);            // grass
        const v = auth ? view : view; if (!v) { statEl.textContent = 'Waiting…'; return; }
        v.ducks.forEach(d => { if (!d.go) duckShape(d); });
        const oppAim = auth ? aimPos.b : v.aimA;
        cross(oppAim, auth ? '#ff9d3d' : '#5db4ff', false);
        cross(aimLocal, auth ? '#5db4ff' : '#ff9d3d', true);
        const myAmmo = v.ammo[me], myScore = v.scores[me], opScore = v.scores[me === 'a' ? 'b' : 'a'];
        g.fillStyle = '#fff'; g.font = 'bold 16px system-ui'; g.textAlign = 'left';
        g.fillText('You ' + myScore + '  –  ' + opScore + ' Them   ·   Wave ' + v.wave + '/' + WAVES + '   ·   ' + '🟡'.repeat(Math.max(0, myAmmo)), 10, 24);
        if (v.phase === 'between') { g.textAlign = 'center'; g.font = 'bold 26px system-ui'; g.fillText('Wave ' + v.wave + ' done', W/2, H/2); }
        if (v.over) { g.textAlign = 'center'; g.font = 'bold 30px system-ui'; g.fillText(v.winner === 'tie' ? 'Tie!' : (v.winner === me ? 'You win! 🏆' : 'You lose'), W/2, H/2); }
        statEl.textContent = v.over ? 'Game over' : 'Wave ' + v.wave + '/' + WAVES + ' — click ducks!';
    };

    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (auth) { tick(dt); if (t - lastSend > SEND) { lastSend = t; view = snap(); ctx.send({ t: 's', v: view }); } }
        render(); raf = requestAnimationFrame(loop);
    };

    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left)/r.width*W, y: (e.clientY - r.top)/r.height*H }; };
    const doShoot = (x, y) => { if (auth) applyShoot('a', x, y); else ctx.send({ t: 'shot', x, y }); };

    window.Appmegle.register({
        id: 'duckhunt', label: 'Duck Hunt', css: 'apps/duckhunt.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><canvas id="dh-canvas" width="' + W + '" height="' + H + '"></canvas></div>';
            canvas = ctx.root.querySelector('#dh-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            canvas.addEventListener('pointermove', (e) => {
                aimLocal = pt(e); const now = performance.now();
                if (auth) aimPos.a = aimLocal;
                else if (now - lastAimSend > SEND) { lastAimSend = now; ctx.send({ t: 'aim', x: aimLocal.x, y: aimLocal.y }); }
            });
            canvas.addEventListener('pointerdown', (e) => { const p = pt(e); aimLocal = p; doShoot(p.x, p.y); });
            if (auth) newGame(); else render();
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = null; view = null; },
        onData(msg) {
            if (!auth) { if (msg.t === 's') { view = msg.v; } return; }
            if (msg.t === 'shot') applyShoot('b', msg.x, msg.y);
            else if (msg.t === 'aim') aimPos.b = { x: msg.x, y: msg.y };
            else if (msg.t === 'newreq') newGame();
        }
    });
})();
