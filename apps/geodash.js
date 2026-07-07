// Geometry Dash (2-player race) for appmegle. A rhythm auto-runner: your neon cube sprints
// forward on its own, you tap / hold / press SPACE to jump spikes and hop onto blocks, and one
// touch = restart from the very start (true to GD). Both players race the SAME seed-synced
// procedural level at once; a live bar shows both of you; first to the finish flag wins.
// Each client simulates its own cube; the caller picks the seed and arbitrates the win.
// Caller = Blue cube, answerer = Orange cube.
(function () {
    const CW = 560, CH = 320, GY = CH - 46, CS = 26, PX = 110;
    const SPEED = 320, GRAV = 2800, JUMPV = 850, SPW = 26, SPH = 26, LAND = 11, LEVEL_LEN = 6200;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let seed = 1, obs = [], dist = 0, cy = GY - CS, vy = 0, onG = true, jumpHeld = false, rot = 0;
    let phase = 'idle', deaths = 0, respawn = 0, done = false, winner = null, oppD = 0, oppDead = 0, oppFin = false, t0 = 0;
    let lastT = 0, lastSend = 0, flash = 0, trail = [];
    const other = (p) => p === 'a' ? 'b' : 'a';
    const mul = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const build = (sd) => {
        const rnd = mul(sd); obs = []; let x = 560;
        while (x < LEVEL_LEN - 300) {
            const r = rnd();
            if (r < 0.58) { const n = 1 + ((rnd()*2)|0); for (let i = 0; i < n; i++) obs.push({ t: 's', x: x + i*SPW }); x += n*SPW; }
            else { const h = 38 + ((rnd()*54)|0); obs.push({ t: 'b', x, w: 36, h }); x += 36; }
            x += 210 + rnd()*210;
        }
    };
    const respawnNow = () => { dist = 0; cy = GY - CS; vy = 0; onG = true; rot = 0; trail = []; };
    const startRace = (sd) => { seed = sd; build(sd); respawnNow(); deaths = 0; done = false; winner = null; oppD = 0; oppDead = 0; oppFin = false; phase = 'run'; t0 = performance.now(); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); seed = (Math.random()*1e9)|0; ctx.send({ t: 'start', seed }); startRace(seed); };
    const die = () => { deaths++; flash = 1; respawn = 0.45; respawnNow(); phase = 'dead'; };
    const finish = () => { if (done) return; done = true; phase = 'fin'; const ms = performance.now() - t0; if (auth) declare('a', ms); else ctx.send({ t: 'fin', ms }); };
    const declare = (who, ms) => { if (winner) return; winner = who; ctx.send({ t: 'result', w: who }); };

    const step = (dt) => {
        if (phase === 'dead') { respawn -= dt; if (respawn <= 0) phase = 'run'; return; }
        if (phase !== 'run') return;
        if (jumpHeld && onG) { vy = -JUMPV; onG = false; }
        vy += GRAV*dt; cy += vy*dt; dist += SPEED*dt;
        if (!onG) rot += dt * 7.5;
        const cubeL = dist, cubeR = dist + CS, cubeBot = cy + CS;
        // support floor (ground, or a block top we're above)
        let floor = GY;
        for (const o of obs) { if (o.t !== 'b') continue; if (cubeR > o.x && cubeL < o.x + o.w) { const top = GY - o.h; if (cubeBot <= top + LAND && vy >= 0) floor = Math.min(floor, top); } }
        if (cubeBot >= floor) { cy = floor - CS; vy = 0; onG = true; rot = 0; } else onG = false;
        // deaths
        const nb = cy + CS;
        for (const o of obs) {
            if (o.t === 's') { if (cubeR > o.x + 3 && cubeL < o.x + SPW - 3 && nb > GY - SPH + 3) return die(); }
            else { if (cubeR > o.x && cubeL < o.x + o.w) { const top = GY - o.h; if (nb > top + LAND) return die(); } }
        }
        trail.push({ x: PX, y: cy + CS/2, a: 1 }); if (trail.length > 14) trail.shift(); for (const p of trail) p.a -= dt*2.2;
        if (dist >= LEVEL_LEN) finish();
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, CW, CH);
        g.fillStyle = 'rgba(12,10,32,.42)'; g.fillRect(0, 0, CW, CH);
        // moving grid
        g.strokeStyle = 'rgba(120,110,200,.14)'; g.lineWidth = 1; const off = dist % 40;
        for (let x = -off; x < CW; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, GY); g.stroke(); }
        for (let y = GY; y > 0; y -= 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
        // ground
        g.fillStyle = 'rgba(90,80,170,.5)'; g.fillRect(0, GY, CW, CH-GY); g.strokeStyle = '#8f8fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, GY); g.lineTo(CW, GY); g.stroke();
        // obstacles
        for (const o of obs) { const sx = PX + (o.x - dist);
            if (sx < -60 || sx > CW + 20) continue;
            if (o.t === 's') { g.fillStyle = '#ff5a7a'; g.strokeStyle = '#ffd0da'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, GY); g.lineTo(sx + SPW/2, GY - SPH); g.lineTo(sx + SPW, GY); g.closePath(); g.fill(); g.stroke(); }
            else { const top = GY - o.h; g.fillStyle = 'rgba(80,200,255,.8)'; g.fillRect(sx, top, o.w, o.h); g.strokeStyle = '#cfefff'; g.lineWidth = 2; g.strokeRect(sx, top, o.w, o.h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(sx, top, o.w, 4); }
        }
        // finish flag
        const fx = PX + (LEVEL_LEN - dist); if (fx < CW + 40) { g.fillStyle = '#fff'; g.fillRect(fx, GY - 70, 3, 70); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i+j) % 2 ? '#111' : '#fff'; g.fillRect(fx + 3 + j*9, GY - 70 + i*9, 9, 9); } }
        // trail
        for (const p of trail) { if (p.a <= 0) continue; g.globalAlpha = p.a*0.5; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(p.x - 4, p.y - 4, 8, 8); }
        g.globalAlpha = 1;
        // cube
        if (phase !== 'dead') { g.save(); g.translate(PX + CS/2, cy + CS/2); g.rotate(rot);
            g.shadowColor = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.shadowBlur = 14; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(-CS/2, -CS/2, CS, CS);
            g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-CS/2 + 4, -CS/2 + 4, CS - 8, CS - 8); g.fillStyle = me === 'a' ? '#2a6cb0' : '#b35e18'; g.fillRect(-4, -4, 8, 8); g.restore();
        }
        if (flash > 0) { g.fillStyle = 'rgba(255,80,80,' + flash*0.5 + ')'; g.fillRect(0, 0, CW, CH); flash -= 0.05; }
        // progress bar (both racers)
        const pb = (pct, col, y) => { g.fillStyle = col; g.fillRect(10 + Math.min(1, pct)*(CW-40), y, 8, 8); };
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(10, 12, CW-30, 6);
        pb(dist/LEVEL_LEN, me === 'a' ? '#5db4ff' : '#ff9d3d', 11); pb(oppD/LEVEL_LEN, me === 'a' ? '#ff9d3d' : '#5db4ff', 20);
        g.fillStyle = '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'right'; g.fillText('🏁', CW-16, 17);
        if (phase === 'dead') { g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText('crashed! attempt ' + (deaths+1), CW/2, CH/2); }
        if (phase === 'idle') { g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.textAlign = 'center'; g.fillText('tap / space to jump — race to the flag', CW/2, CH/2); }
        if (done || winner) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, CW, CH); g.fillStyle = '#fff'; g.font = 'bold 40px system-ui'; g.textAlign = 'center'; g.fillText(winner ? (winner === me ? '🏆 YOU WIN!' : 'you lose') : '🏁 finished!', CW/2, CH/2); g.font = '15px system-ui'; g.fillText(deaths + ' attempts', CW/2, CH/2 + 30); }
    };
    const status = () => { if (statEl) statEl.textContent = phase === 'idle' ? 'Geometry Dash — race to the flag' : winner ? (winner === me ? '🏆 You win!' : 'You lose') : done ? 'Finished! waiting…' : Math.round(dist/LEVEL_LEN*100) + '% · attempt ' + (deaths+1) + (oppFin ? ' · they finished!' : ' · them ' + Math.round(oppD/LEVEL_LEN*100) + '%'); };
    const loop = (t) => { const dt = Math.min(0.032, (t - lastT)/1000 || 0); lastT = t; step(dt);
        if (phase === 'run' && t - lastSend > 90) { lastSend = t; ctx.send({ t: 'p', d: Math.round(dist), dead: deaths }); }
        draw(); status(); raf = requestAnimationFrame(loop); };
    const jumpDown = (e) => { jumpHeld = true; if (phase === 'idle' && auth) newGame(); if (e && e.preventDefault) e.preventDefault(); };
    const jumpUp = () => { jumpHeld = false; };
    window.Appmegle.register({
        id: 'geodash', label: 'Geometry Dash', css: 'apps/geodash.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; obs = []; trail = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">▶ New race</button></div><canvas id="gd-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="gd-hint">tap the board / hold / SPACE to jump · one touch = restart · race to 🏁</div></div>';
            canvas = ctx.root.querySelector('#gd-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            canvas.addEventListener('pointerdown', jumpDown); window.addEventListener('pointerup', this._pu = jumpUp);
            this._kd = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') jumpDown(e); }; this._ku = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') jumpUp(); };
            window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('pointerup', this._pu); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); ctx = canvas = g = statEl = null; obs = []; },
        onData(msg) {
            if (msg.t === 'start' && !auth) startRace(msg.seed);
            else if (msg.t === 'startreq' && auth) newGame();
            else if (msg.t === 'p') { oppD = msg.d; oppDead = msg.dead; }
            else if (msg.t === 'fin' && auth) { oppFin = true; declare('b', msg.ms); }
            else if (msg.t === 'result') { winner = msg.w; phase = 'fin'; done = true; }
        }
    });
})();
