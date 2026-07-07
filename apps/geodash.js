// Geometry Dash (2-player race) for appmegle. A rhythm auto-runner: your neon cube sprints
// forward on its own, you tap / hold / press SPACE to jump spikes, hop onto blocks, leap gaps
// and bounce off jump-pads; one touch = restart from the very start (true to GD). The level is
// built from difficulty-scaled pattern chunks (warm-up singles → clusters → staircases →
// gauntlets → pad-launches over pits) so it gets progressively more interesting, exactly like
// the real thing. Both players race the SAME seed-synced level; a live bar shows both; first to
// the flag wins. Each client simulates its own cube; the caller seeds + arbitrates the win.
// Caller = Blue cube, answerer = Orange cube.
(function () {
    const CW = 560, CH = 320, GY = CH - 46, CS = 26, PX = 110;
    const SPEED = 320, GRAV = 2800, JUMPV = 850, PADV = 1180, SPW = 26, SPH = 26, PADW = 30, LAND = 11, LEVEL_LEN = 7600;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let seed = 1, obs = [], pads = [], pits = [], dist = 0, cy = GY - CS, vy = 0, onG = true, jumpHeld = false, rot = 0;
    let phase = 'idle', deaths = 0, respawn = 0, done = false, winner = null, oppD = 0, oppDead = 0, oppFin = false, t0 = 0;
    let lastT = 0, lastSend = 0, flash = 0, trail = [];
    const mul = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    const build = (sd) => {
        const rnd = mul(sd); obs = []; pads = []; pits = []; let x = 560;
        const spike = (sx) => obs.push({ t: 's', x: sx });
        const block = (sx, h) => obs.push({ t: 'b', x: sx, w: 36, h });
        const stairs = (up, top) => { let h = 42; for (let i = 0; i < up; i++) { block(x, h); x += 34; h += 22; } for (let i = 0; i < top; i++) { h -= 26; block(x, Math.max(40, h)); x += 34; } };
        const gauntlet = (n, gap) => { for (let i = 0; i < n; i++) { spike(x); x += gap; } };
        const padPit = (w) => { pads.push({ x }); const g0 = 66; pits.push({ x: x + g0, w }); x += g0 + w; };
        while (x < LEVEL_LEN - 360) {
            const d = x / LEVEL_LEN, r = rnd();
            if (d < 0.16) { if (r < 0.6) { spike(x); x += SPW; } else { block(x, 40); x += 36; } }
            else if (d < 0.34) { if (r < 0.42) { spike(x); spike(x + SPW); x += 2*SPW; } else if (r < 0.72) { block(x, 44 + ((rnd()*22)|0)); x += 36; } else { const w = 78 + ((rnd()*28)|0); pits.push({ x, w }); x += w; } }
            else if (d < 0.58) { if (r < 0.3) { const n = 2 + ((rnd()*2)|0); for (let i = 0; i < n; i++) spike(x + i*SPW); x += n*SPW; } else if (r < 0.56) stairs(2 + ((rnd()*2)|0), 1) ; else if (r < 0.8) { const w = 92 + ((rnd()*26)|0); pits.push({ x, w }); x += w; } else gauntlet(3 + ((rnd()*2)|0), 200); }
            else if (d < 0.8) { if (r < 0.3) padPit(150 + ((rnd()*30)|0)); else if (r < 0.52) { for (let i = 0; i < 3; i++) spike(x + i*SPW); x += 3*SPW; } else if (r < 0.74) stairs(3 + ((rnd()*2)|0), 2); else gauntlet(4 + ((rnd()*2)|0), 186); }
            else { if (r < 0.32) padPit(150 + ((rnd()*30)|0)); else if (r < 0.56) { for (let i = 0; i < 3; i++) spike(x + i*SPW); x += 3*SPW; } else if (r < 0.8) gauntlet(5, 182); else stairs(4, 2); }
            x += Math.max(150, 262 - d*112);
        }
    };
    const inPit = (wx) => { for (const p of pits) if (wx > p.x && wx < p.x + p.w) return true; return false; };
    const respawnNow = () => { dist = 0; cy = GY - CS; vy = 0; onG = true; rot = 0; trail = []; };
    const startRace = (sd) => { seed = sd; build(sd); respawnNow(); deaths = 0; done = false; winner = null; oppD = 0; oppDead = 0; oppFin = false; phase = 'run'; t0 = performance.now(); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); seed = (Math.random()*1e9)|0; ctx.send({ t: 'start', seed }); startRace(seed); };
    const die = () => { deaths++; flash = 1; respawn = 0.45; respawnNow(); phase = 'dead'; };
    const finish = () => { if (done) return; done = true; phase = 'fin'; const ms = performance.now() - t0; if (auth) declare('a'); else ctx.send({ t: 'fin', ms }); };
    const declare = (who) => { if (winner) return; winner = who; ctx.send({ t: 'result', w: who }); };

    const step = (dt) => {
        if (phase === 'dead') { respawn -= dt; if (respawn <= 0) phase = 'run'; return; }
        if (phase !== 'run') return;
        if (jumpHeld && onG) { vy = -JUMPV; onG = false; }
        vy += GRAV*dt; cy += vy*dt; dist += SPEED*dt;
        if (!onG) rot += dt * 7.5;
        const cubeL = dist, cubeR = dist + CS, cubeBot = cy + CS, cxc = dist + CS/2;
        let floor = inPit(cxc) ? Infinity : GY;
        for (const o of obs) { if (o.t !== 'b') continue; if (cubeR > o.x && cubeL < o.x + o.w) { const top = GY - o.h; if (cubeBot <= top + LAND && vy >= 0) floor = Math.min(floor, top); } }
        if (floor !== Infinity && cubeBot >= floor) { cy = floor - CS; vy = 0; onG = true; rot = 0; } else onG = false;
        if (onG) for (const pd of pads) { if (cubeR > pd.x && cubeL < pd.x + PADW && cy + CS >= GY - 4) { vy = -PADV; onG = false; break; } }
        if (cy > CH + 30) return die();
        const nb = cy + CS;
        for (const o of obs) {
            if (o.t === 's') { if (cubeR > o.x + 3 && cubeL < o.x + SPW - 3 && nb > GY - SPH + 3) return die(); }
            else { if (cubeR > o.x && cubeL < o.x + o.w) { const top = GY - o.h; if (nb > top + LAND) return die(); } }
        }
        trail.push({ x: PX, y: cy + CS/2, a: 1 }); if (trail.length > 14) trail.shift(); for (const p of trail) p.a -= dt*2.2;
        if (dist >= LEVEL_LEN) finish();
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, CW, CH); g.fillStyle = 'rgba(12,10,32,.42)'; g.fillRect(0, 0, CW, CH);
        g.strokeStyle = 'rgba(120,110,200,.14)'; g.lineWidth = 1; const off = dist % 40;
        for (let x = -off; x < CW; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, GY); g.stroke(); }
        for (let y = GY; y > 0; y -= 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
        // ground, with gaps at pits
        const cuts = pits.map(p => ({ a: PX + (p.x - dist), b: PX + (p.x + p.w - dist) })).filter(c => c.b > 0 && c.a < CW).sort((x, y) => x.a - y.a);
        g.fillStyle = 'rgba(90,80,170,.5)'; let cx = 0;
        for (const c of cuts) { const a = Math.max(0, c.a); if (a > cx) g.fillRect(cx, GY, a - cx, CH-GY); cx = Math.max(cx, Math.min(CW, c.b)); }
        if (cx < CW) g.fillRect(cx, GY, CW-cx, CH-GY);
        g.strokeStyle = '#8f8fff'; g.lineWidth = 2; cx = 0;
        for (const c of cuts) { const a = Math.max(0, c.a); if (a > cx) { g.beginPath(); g.moveTo(cx, GY); g.lineTo(a, GY); g.stroke(); } cx = Math.max(cx, Math.min(CW, c.b)); }
        if (cx < CW) { g.beginPath(); g.moveTo(cx, GY); g.lineTo(CW, GY); g.stroke(); }
        // jump pads
        for (const pd of pads) { const sx = PX + (pd.x - dist); if (sx < -30 || sx > CW) continue; g.fillStyle = '#ffb43a'; g.beginPath(); g.moveTo(sx - 3, GY); g.lineTo(sx + PADW/2, GY - 17); g.lineTo(sx + PADW + 3, GY); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
        // obstacles
        for (const o of obs) { const sx = PX + (o.x - dist); if (sx < -60 || sx > CW + 20) continue;
            if (o.t === 's') { g.fillStyle = '#ff5a7a'; g.strokeStyle = '#ffd0da'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, GY); g.lineTo(sx + SPW/2, GY - SPH); g.lineTo(sx + SPW, GY); g.closePath(); g.fill(); g.stroke(); }
            else { const top = GY - o.h; g.fillStyle = 'rgba(80,200,255,.8)'; g.fillRect(sx, top, o.w, o.h); g.strokeStyle = '#cfefff'; g.lineWidth = 2; g.strokeRect(sx, top, o.w, o.h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(sx, top, o.w, 4); }
        }
        const fx = PX + (LEVEL_LEN - dist); if (fx < CW + 40) { g.fillStyle = '#fff'; g.fillRect(fx, GY - 70, 3, 70); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i+j) % 2 ? '#111' : '#fff'; g.fillRect(fx + 3 + j*9, GY - 70 + i*9, 9, 9); } }
        for (const p of trail) { if (p.a <= 0) continue; g.globalAlpha = p.a*0.5; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(p.x - 4, p.y - 4, 8, 8); }
        g.globalAlpha = 1;
        if (phase !== 'dead') { g.save(); g.translate(PX + CS/2, cy + CS/2); g.rotate(rot);
            g.shadowColor = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.shadowBlur = 14; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(-CS/2, -CS/2, CS, CS);
            g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-CS/2 + 4, -CS/2 + 4, CS - 8, CS - 8); g.fillStyle = me === 'a' ? '#2a6cb0' : '#b35e18'; g.fillRect(-4, -4, 8, 8); g.restore();
        }
        if (flash > 0) { g.fillStyle = 'rgba(255,80,80,' + flash*0.5 + ')'; g.fillRect(0, 0, CW, CH); flash -= 0.05; }
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
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; obs = []; pads = []; pits = []; trail = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">▶ New race</button></div><canvas id="gd-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="gd-hint">tap the board / hold / SPACE to jump · orange pads bounce you · one touch = restart · race to 🏁</div></div>';
            canvas = ctx.root.querySelector('#gd-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            canvas.addEventListener('pointerdown', jumpDown); window.addEventListener('pointerup', this._pu = jumpUp);
            this._kd = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') jumpDown(e); }; this._ku = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') jumpUp(); };
            window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('pointerup', this._pu); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); ctx = canvas = g = statEl = null; obs = []; pads = []; pits = []; },
        onData(msg) {
            if (msg.t === 'start' && !auth) startRace(msg.seed);
            else if (msg.t === 'startreq' && auth) newGame();
            else if (msg.t === 'p') { oppD = msg.d; oppDead = msg.dead; }
            else if (msg.t === 'fin' && auth) { oppFin = true; declare('b'); }
            else if (msg.t === 'result') { winner = msg.w; phase = 'fin'; done = true; }
        }
    });
})();
