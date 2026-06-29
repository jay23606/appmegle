// Bubble Bobble (2-player co-op) for appmegle. Two dragons on a platform level; shoot
// bubbles to trap the roaming enemies, then jump into a trapped bubble to pop it and defeat
// the enemy. Clear them all together to win. The caller is authoritative (simulates both
// dragons, enemies, bubbles, collisions); each player sends input. Caller = blue, answerer = orange.
(function () {
    const W = 480, H = 360, GRAV = 1400, MOVE = 150, JUMP = 470, DW = 18, DH = 20, BR = 14, EN = 18;
    const PLAT = [{ x: 0, y: 342, w: W }, { x: 60, y: 260, w: 120 }, { x: 300, y: 260, w: 120 }, { x: 165, y: 180, w: 150 }, { x: 36, y: 110, w: 96 }, { x: 348, y: 110, w: 96 }];
    const WALLL = 8, WALLR = W - 8;

    let ctx = null, auth = false, mi = 0, raf = 0, canvas = null, g = null, statEl = null;
    let drag = [], enemies = [], bubbles = [], over = false, win = false;
    let inL = 0, inR = 0, oppL = 0, oppR = 0, view = null, lastT = 0, lastSend = 0, onKey = null;

    const onPlat = (x, y, w, h, py, pvy) => { for (const p of PLAT) if (pvy >= 0 && py + h <= p.y + 6 && y + h >= p.y && x + w > p.x && x < p.x + p.w) return p; return null; };
    const mkDragon = (x, col) => ({ x, y: 300, vx: 0, vy: 0, onG: false, face: 1, col, stun: 0, spawn: x });
    const mkEnemy = (x, y) => ({ x, y, vx: 55, vy: 0, onG: false, trapped: false });
    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        drag = [mkDragon(80, '#5db4ff'), mkDragon(W-100, '#ff9d3d')];
        enemies = [mkEnemy(100, 230), mkEnemy(350, 230), mkEnemy(220, 150), mkEnemy(70, 80), mkEnemy(390, 80)];
        bubbles = []; over = false; win = false; sync();
    };

    const physics = (o, w, h, dt, walk) => {
        o.vy += GRAV*dt; const py = o.y, pvy = o.vy; o.y += o.vy*dt;
        const p = onPlat(o.x, o.y, w, h, py, pvy); if (p) { o.y = p.y - h; o.vy = 0; o.onG = true; } else o.onG = false;
        o.x += o.vx*dt; if (o.x < WALLL) { o.x = WALLL; if (walk) o.vx = Math.abs(o.vx); } if (o.x + w > WALLR) { o.x = WALLR - w; if (walk) o.vx = -Math.abs(o.vx); }
        if (walk && o.onG) { const ahead = o.x + (o.vx > 0 ? w + 2 : -2), foot = o.y + h + 3; let ground = false; for (const pp of PLAT) if (ahead > pp.x && ahead < pp.x + pp.w && foot > pp.y && foot < pp.y + 12) ground = true; if (!ground) o.vx = -o.vx; }
    };
    const ctrl = (d, l, r, dt) => { if (d.stun > 0) { d.stun -= dt; d.vx = 0; return; } d.vx = (r - l) * MOVE; if (r) d.face = 1; if (l) d.face = -1; physics(d, DW, DH, dt, false); };
    const jump = (i) => { const d = drag[i]; if (d && d.onG && d.stun <= 0) { d.vy = -JUMP; d.onG = false; } };
    const shoot = (i) => { const d = drag[i]; if (!d || d.stun > 0) return; bubbles.push({ x: d.x + (d.face > 0 ? DW : -BR), y: d.y, vx: d.face * 260, age: 0, life: 9, trap: null }); };

    const sim = (dt) => {
        ctrl(drag[0], inL, inR, dt); ctrl(drag[1], oppL, oppR, dt);
        enemies.forEach(e => { if (!e.trapped) physics(e, EN, EN, dt, true); });
        for (const b of bubbles) {
            b.age += dt; b.life -= dt;
            if (b.trap) { b.y -= 70*dt; if (b.y < 20) b.y = 20; b.trap.x = b.x; b.trap.y = b.y; }
            else if (b.age < 0.45) b.x += b.vx*dt; else { b.y -= 55*dt; if (b.y < 20) b.y = 20; }
            if (!b.trap) for (const e of enemies) if (!e.trapped && Math.hypot(b.x+BR-(e.x+EN/2), b.y+BR-(e.y+EN/2)) < BR+EN/2) { b.trap = e; e.trapped = true; b.life = 10; break; }
        }
        // dragon vs bubble (pop) and dragon vs enemy (hit)
        for (let bi = bubbles.length-1; bi >= 0; bi--) { const b = bubbles[bi]; for (const d of drag) if (d.stun <= 0 && Math.hypot(b.x+BR-(d.x+DW/2), b.y+BR-(d.y+DH/2)) < BR+DW/2) {
            if (b.trap) { enemies = enemies.filter(e => e !== b.trap); } bubbles.splice(bi, 1); break; } }
        bubbles = bubbles.filter(b => { if (b.life <= 0) { if (b.trap) b.trap.trapped = false; return false; } return true; });
        for (const e of enemies) if (!e.trapped) for (const d of drag) if (d.stun <= 0 && Math.abs(e.x-d.x) < (DW+EN)/2 - 3 && Math.abs(e.y-d.y) < (DH+EN)/2 - 3) { d.stun = 1.5; d.x = d.spawn; d.y = 300; d.vx = d.vy = 0; }
        if (!enemies.length) { over = true; win = true; }
    };
    const snap = () => ({ d: drag.map(d => ({ x: d.x|0, y: d.y|0, f: d.face, c: d.col, s: d.stun > 0 })), e: enemies.map(e => ({ x: e.x|0, y: e.y|0, t: e.trapped })), b: bubbles.map(b => ({ x: b.x|0, y: b.y|0, t: !!b.trap })), over, win });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(40,40,120,.45)'; PLAT.forEach(p => g.fillRect(p.x, p.y, p.w, 8));
        const s = auth ? snap() : view; if (!s) { statEl.textContent = 'Waiting…'; return; }
        s.e.forEach(e => { g.fillStyle = e.t ? 'rgba(180,120,255,.6)' : '#c655e0'; g.beginPath(); g.arc(e.x+EN/2, e.y+EN/2, EN/2, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(e.x+4, e.y+5, 3, 3); g.fillRect(e.x+EN-7, e.y+5, 3, 3); });
        s.b.forEach(b => { g.strokeStyle = b.t ? 'rgba(255,200,120,.9)' : 'rgba(180,230,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(b.x+BR, b.y+BR, BR, 0, 7); g.stroke(); });
        s.d.forEach(d => { g.fillStyle = d.s ? 'rgba(255,255,255,.4)' : d.c; g.beginPath(); g.roundRect(d.x, d.y, DW, DH, 5); g.fill(); g.fillStyle = '#fff'; g.fillRect(d.x + (d.f>0?DW-7:3), d.y+5, 4, 4); });
        statEl.textContent = s.over ? '🎉 Level clear — you both win!' : 'Enemies left: ' + s.e.length;
    };
    const loop = (t) => {
        const dt = Math.min(0.04, (t - lastT)/1000 || 0); lastT = t;
        if (auth && !over && drag.length) { sim(dt); if (t - lastSend > 33) { lastSend = t; sync(); } }
        draw(); raf = requestAnimationFrame(loop);
    };
    const setMove = (l, r) => { if (auth) { inL = l; inR = r; } else ctx.send({ t: 'mv', l, r }); };
    const act = (a) => { if (auth) (a === 'jump' ? jump(0) : shoot(0)); else ctx.send({ t: 'act', a }); };

    window.Appmegle.register({
        id: 'bubble', label: 'Bubble Bobble', css: 'apps/bubblebobble.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; mi = auth ? 0 : 1; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<canvas id="bb-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="bb-pad"><button data-k="l">◀</button><button data-k="r">▶</button><button data-k="j">⤒ Jump</button><button data-k="s">● Bubble</button></div></div>';
            canvas = ctx.root.querySelector('#bb-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            let L = 0, R = 0;
            onKey = (e) => { const d = e.type === 'keydown'; if (e.code === 'ArrowLeft' || e.code === 'KeyA') { L = d ? 1 : 0; setMove(L, R); } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { R = d ? 1 : 0; setMove(L, R); } else if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && d && !e.repeat) act('jump'); else if ((e.code === 'KeyJ' || e.code === 'ShiftLeft') && d && !e.repeat) act('shoot'); else return; e.preventDefault(); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#bb-pad button').forEach(b => {
                const k = b.dataset.k;
                if (k === 'l' || k === 'r') { b.addEventListener('pointerdown', e => { e.preventDefault(); if (k === 'l') L = 1; else R = 1; setMove(L, R); }); const up = () => { if (k === 'l') L = 0; else R = 0; setMove(L, R); }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); }
                else b.addEventListener('pointerdown', e => { e.preventDefault(); act(k === 'j' ? 'jump' : 'shoot'); });
            });
            if (auth) newGame(); else draw();
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; drag = []; enemies = []; bubbles = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) view = msg.v;
            else if (msg.t === 'mv' && auth) { oppL = msg.l; oppR = msg.r; }
            else if (msg.t === 'act' && auth) (msg.a === 'jump' ? jump(1) : shoot(1));
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
