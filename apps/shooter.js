// Spirit Shooter (2-player co-op, Pocky & Rocky-style) for appmegle. Both players roam a
// shared arena blasting waves of spirits; shots AUTO-AIM the nearest enemy so you only steer
// (and dodge), plus a spin-blast that clears nearby bullets and damages enemies. Shared lives;
// clear the waves and beat the boss to win together. Caller-authoritative: it simulates
// everyone + bullets and broadcasts state; each player sends move input + spin. Caller = blue, answerer = orange.
(function () {
    const W = 620, H = 440, PR = 11, PSPD = 165, FIRECD = 0.26, PBSPD = 380, EBSPD = 165, LIVES = 6, WAVES = 7;
    let ctx = null, auth = false, mi = 0, raf = 0, canvas = null, g = null, statEl = null;
    let players = [], enemies = [], pbul = [], ebul = [], wave = 0, score = 0, lives = LIVES, phase = 'idle', waveT = 0, fx = [], boss = null;
    let held = { up: 0, down: 0, left: 0, right: 0 }, oppDir = { x: 0, y: 0 }, view = null, lastT = 0, lastSend = 0, onKey = null;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mkP = (x, col) => ({ x, y: H - 60, dx: 0, dy: 0, col, fire: 0, inv: 0, spinCd: 0, spinFx: 0, alive: true });
    const nearest = (o, arr) => { let best = null, bd = 1e9; for (const e of arr) { const d = dist(o, e); if (d < bd) { bd = d; best = e; } } return best; };

    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); players = [mkP(W/2-40, '#5db4ff'), mkP(W/2+40, '#ff9d3d')]; enemies = []; pbul = []; ebul = []; fx = []; boss = null; wave = 0; score = 0; lives = LIVES; phase = 'wave'; waveT = 1.2; sync(); };
    const spawnWave = () => {
        wave++; enemies = []; boss = null;
        if (wave > WAVES) { boss = { x: W/2, y: 70, hp: 70, t: 0, fire: 0, dir: 1 }; phase = 'play'; return; }
        const n = 3 + wave*2;
        for (let i = 0; i < n; i++) { const edge = (Math.random()*4)|0, x = edge === 1 ? W-10 : edge === 3 ? 10 : Math.random()*W, y = edge === 2 ? H-10 : edge === 0 ? 10 : Math.random()*(H*0.5); const shooter = Math.random() < 0.35 + wave*0.04; enemies.push({ x, y, type: shooter ? 's' : 'c', hp: shooter ? 3 : 2, fire: Math.random()*2 }); }
        phase = 'play';
    };

    const hitPlayer = (p) => { if (p.inv > 0 || !p.alive) return; lives--; p.inv = 1.6; if (lives <= 0) { phase = 'over'; } };
    const spin = (p) => { if (p.spinCd > 0 || !p.alive) return; p.spinCd = 3.5; p.spinFx = 0.35; fx.push({ x: p.x, y: p.y, r: 0, life: 0.35 }); for (const e of enemies) if (dist(p, e) < 70) e.hp -= 3; if (boss && dist(p, boss) < 80) boss.hp -= 4; ebul = ebul.filter(b => dist(b, p) > 95); };

    const sim = (dt) => {
        const live = players.filter(p => p.alive);
        players.forEach((p, i) => {
            if (!p.alive) return; if (p.inv > 0) p.inv -= dt; if (p.spinCd > 0) p.spinCd -= dt; if (p.spinFx > 0) p.spinFx -= dt;
            const inp = i === 0 ? { x: held.right - held.left, y: held.down - held.up } : oppDir; let dx = inp.x, dy = inp.y; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
            p.x = Math.max(PR, Math.min(W-PR, p.x + dx*PSPD*dt)); p.y = Math.max(PR, Math.min(H-PR, p.y + dy*PSPD*dt));
            p.fire -= dt; const tgt = boss && (!enemies.length || Math.random() < 0.5) ? boss : nearest(p, enemies);
            if (p.fire <= 0 && tgt) { const a = Math.atan2(tgt.y - p.y, tgt.x - p.x); pbul.push({ x: p.x, y: p.y, vx: Math.cos(a)*PBSPD, vy: Math.sin(a)*PBSPD }); p.fire = FIRECD; }
        });
        enemies.forEach(e => { const tp = nearest(e, live) || players[0]; const a = Math.atan2(tp.y - e.y, tp.x - e.x); const sp = e.type === 's' ? 45 : 75; e.x += Math.cos(a)*sp*dt; e.y += Math.sin(a)*sp*dt; if (e.type === 's') { e.fire -= dt; if (e.fire <= 0) { e.fire = 1.6; ebul.push({ x: e.x, y: e.y, vx: Math.cos(a)*EBSPD, vy: Math.sin(a)*EBSPD }); } } });
        if (boss) { boss.t += dt; boss.x = W/2 + Math.sin(boss.t*0.8)*180; boss.fire -= dt; if (boss.fire <= 0) { boss.fire = 1.1; for (let k = 0; k < 10; k++) { const a = k/10*Math.PI*2 + boss.t; ebul.push({ x: boss.x, y: boss.y, vx: Math.cos(a)*150, vy: Math.sin(a)*150 }); } } }
        for (let i = pbul.length-1; i >= 0; i--) { const b = pbul[i]; b.x += b.vx*dt; b.y += b.vy*dt; if (b.x<-10||b.x>W+10||b.y<-10||b.y>H+10) { pbul.splice(i,1); continue; } let hitOne = false; for (const e of enemies) if (dist(b, e) < 13) { e.hp--; hitOne = true; break; } if (!hitOne && boss && dist(b, boss) < 30) { boss.hp--; hitOne = true; } if (hitOne) pbul.splice(i, 1); }
        for (let i = enemies.length-1; i >= 0; i--) { if (enemies[i].hp <= 0) { score += 10; enemies.splice(i, 1); } }
        for (let i = ebul.length-1; i >= 0; i--) { const b = ebul[i]; b.x += b.vx*dt; b.y += b.vy*dt; if (b.x<-10||b.x>W+10||b.y<-10||b.y>H+10) { ebul.splice(i,1); continue; } for (const p of players) if (p.alive && dist(b, p) < PR+4) { hitPlayer(p); ebul.splice(i, 1); break; } }
        enemies.forEach(e => players.forEach(p => { if (p.alive && dist(e, p) < PR+10) hitPlayer(p); }));
        if (boss) { players.forEach(p => { if (p.alive && dist(boss, p) < 30) hitPlayer(p); }); if (boss.hp <= 0) { phase = 'win'; boss = null; } }
        fx = fx.filter(f => { f.life -= dt; f.r += 280*dt; return f.life > 0; });
        if (phase === 'play' && !enemies.length && !boss) { phase = 'wave'; waveT = 1.3; score += 50; }
    };
    const snap = () => ({ p: players.map(p => ({ x: p.x|0, y: p.y|0, c: p.col, i: p.inv > 0, s: p.spinCd > 0, al: p.alive })), e: enemies.map(e => ({ x: e.x|0, y: e.y|0, t: e.type })), pb: pbul.map(b => ({ x: b.x|0, y: b.y|0 })), eb: ebul.map(b => ({ x: b.x|0, y: b.y|0 })), bo: boss ? { x: boss.x|0, y: boss.y|0, hp: boss.hp } : null, fx: fx.map(f => ({ x: f.x|0, y: f.y|0, r: f.r|0 })), wave, score, lives, phase });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,15,40,.4)'; g.fillRect(0, 0, W, H);
        const s = auth ? snap() : view; if (!s) { statEl.textContent = 'Waiting…'; return; }
        s.fx.forEach(f => { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.stroke(); });
        s.pb.forEach(b => { g.fillStyle = '#bff'; g.beginPath(); g.arc(b.x, b.y, 4, 0, 7); g.fill(); });
        s.eb.forEach(b => { g.fillStyle = '#f86'; g.beginPath(); g.arc(b.x, b.y, 5, 0, 7); g.fill(); });
        s.e.forEach(e => { g.fillStyle = e.t === 's' ? '#c45cd0' : '#5cc06a'; g.beginPath(); g.arc(e.x, e.y, 12, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(e.x-5, e.y-3, 3, 3); g.fillRect(e.x+2, e.y-3, 3, 3); });
        if (s.bo) { g.fillStyle = '#a33'; g.beginPath(); g.arc(s.bo.x, s.bo.y, 28, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(s.bo.x-7, s.bo.y-4, 5, 5); g.fillRect(s.bo.x+3, s.bo.y-4, 5, 5); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W/2-100, 10, 200, 8); g.fillStyle = '#e44'; g.fillRect(W/2-100, 10, 200*Math.max(0, s.bo.hp)/70, 8); }
        s.p.forEach(p => { if (!p.al) return; g.globalAlpha = p.i ? 0.5 : 1; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, PR, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(p.x-4, p.y-3, 3, 3); g.fillRect(p.x+1, p.y-3, 3, 3); g.globalAlpha = 1; });
        g.fillStyle = '#fff'; g.font = 'bold 14px system-ui'; g.textAlign = 'left'; g.fillText('Wave ' + s.wave + '  ·  ' + '❤'.repeat(Math.max(0, s.lives)) + '  ·  ' + s.score, 10, H-10);
        if (s.phase === 'wave') { g.textAlign = 'center'; g.font = 'bold 30px system-ui'; g.fillText(s.wave === 0 ? '' : 'Wave ' + s.wave + ' cleared!', W/2, H/2); }
        statEl.textContent = s.phase === 'over' ? 'Game over — wave ' + s.wave + ', score ' + s.score : s.phase === 'win' ? '🏆 You beat the boss! Score ' + s.score : 'Co-op — survive together!';
        if (s.phase === 'over' || s.phase === 'win') { g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H/2-40, W, 80); g.fillStyle = '#fff'; g.font = 'bold 32px system-ui'; g.fillText(s.phase === 'win' ? 'VICTORY!' : 'GAME OVER', W/2, H/2+10); }
    };
    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; if (auth && players.length) { if (phase === 'wave') { waveT -= dt; if (waveT <= 0) spawnWave(); } else if (phase === 'play') sim(dt); if (t - lastSend > 40) { lastSend = t; sync(); } } draw(); raf = requestAnimationFrame(loop); };

    const sendMove = () => { const d = { x: held.right - held.left, y: held.down - held.up }; if (auth) {} else ctx.send({ t: 'mv', x: d.x, y: d.y }); };
    const doSpin = () => { if (auth) { if (players[0]) spin(players[0]); } else ctx.send({ t: 'spin' }); };

    window.Appmegle.register({
        id: 'shooter', label: 'Spirit Shooter', css: 'apps/shooter.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; mi = auth ? 0 : 1; view = null; held = { up: 0, down: 0, left: 0, right: 0 };
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<canvas id="sh-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="sh-pad"><button data-k="up">▲</button><button data-k="left">◀</button><button data-k="spin">✦</button><button data-k="right">▶</button><button data-k="down">▼</button></div></div>';
            canvas = ctx.root.querySelector('#sh-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            onKey = (e) => { const dn = e.type === 'keydown' ? 1 : 0; const m = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[e.code]; if (m) { held[m] = dn; sendMove(); e.preventDefault(); } else if ((e.code === 'Space' || e.code === 'KeyJ') && dn && !e.repeat) { doSpin(); e.preventDefault(); } };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#sh-pad button').forEach(b => { const k = b.dataset.k; if (k === 'spin') b.addEventListener('pointerdown', e => { e.preventDefault(); doSpin(); }); else { b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; sendMove(); }); const up = () => { held[k] = 0; sendMove(); }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); } });
            if (auth) newGame(); else draw();
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; players = []; enemies = []; pbul = []; ebul = []; boss = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) view = msg.v;
            else if (msg.t === 'mv' && auth) oppDir = { x: msg.x, y: msg.y };
            else if (msg.t === 'spin' && auth) { if (players[1]) spin(players[1]); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
