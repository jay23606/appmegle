// Asteroids (co-op) for appmegle. Real-time, authoritative caller simulates ships,
// rocks and bullets and broadcasts state ~30x/sec; each side sends only its ship input.
// Two pilots share score and lives; clear a wave to spawn a bigger one.
(function () {
    const W = 640, H = 420, SR = 10, ROT = 3.6, THR = 200, BSPD = 380, BLIFE = 1.1, SEND = 33;
    let ctx = null, auth = false, raf = 0, canvas = null, g = null, lastT = 0, lastSend = 0, onKey = null;
    let ships = [], rocks = [], bullets = [], score = 0, lives = 5, wave = 0, over = false;
    let vShips = [], vRocks = [], vBullets = [], myCtl = { l: 0, r: 0, th: 0 }, sentCtl = '';

    const wrap = (o) => { if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H; };
    const mkShip = () => ({ x: W/2 + (Math.random()*80-40), y: H/2, a: -Math.PI/2, vx: 0, vy: 0, alive: true, inv: 2, ctl: { l:0, r:0, th:0 } });
    const spawnWave = () => {
        wave++; rocks = [];
        for (let i = 0; i < 2 + wave; i++) {
            const edge = Math.random() < 0.5;
            rocks.push({ x: edge ? 0 : Math.random()*W, y: edge ? Math.random()*H : 0, vx: (Math.random()*2-1)*60, vy: (Math.random()*2-1)*60, size: 3, r: 42 });
        }
    };
    const reset = () => { ships = [mkShip(), mkShip()]; bullets = []; score = 0; lives = 5; wave = 0; over = false; spawnWave(); };

    const fire = (k) => {
        const s = ships[k]; if (!s || !s.alive) return;
        bullets.push({ x: s.x + Math.cos(s.a)*12, y: s.y + Math.sin(s.a)*12, vx: s.vx + Math.cos(s.a)*BSPD, vy: s.vy + Math.sin(s.a)*BSPD, life: BLIFE });
    };
    const hitRock = (i) => {
        const a = rocks[i]; rocks.splice(i, 1); score += (4 - a.size) * 20;
        if (a.size > 1) for (let k = 0; k < 2; k++)
            rocks.push({ x: a.x, y: a.y, vx: (Math.random()*2-1)*110, vy: (Math.random()*2-1)*110, size: a.size-1, r: (a.size-1)*14 });
    };
    const killShip = (k) => {
        ships[k].alive = false; lives--;
        if (lives <= 0) over = true;
        else setTimeout(() => { if (ships[k]) { Object.assign(ships[k], mkShip(), { ctl: ships[k].ctl }); } }, 700);
    };

    const sim = (dt) => {
        ships.forEach((s) => {
            if (!s.alive) return;
            if (s.inv > 0) s.inv -= dt;
            s.a += (s.ctl.r - s.ctl.l) * ROT * dt;
            if (s.ctl.th) { s.vx += Math.cos(s.a)*THR*dt; s.vy += Math.sin(s.a)*THR*dt; }
            s.vx *= (1 - 0.4*dt); s.vy *= (1 - 0.4*dt);
            s.x += s.vx*dt; s.y += s.vy*dt; wrap(s);
        });
        rocks.forEach((a) => { a.x += a.vx*dt; a.y += a.vy*dt; wrap(a); });
        for (let i = bullets.length-1; i >= 0; i--) {
            const b = bullets[i]; b.x += b.vx*dt; b.y += b.vy*dt; wrap(b); b.life -= dt;
            if (b.life <= 0) { bullets.splice(i, 1); continue; }
            for (let j = rocks.length-1; j >= 0; j--) if (Math.hypot(b.x-rocks[j].x, b.y-rocks[j].y) < rocks[j].r) { hitRock(j); bullets.splice(i, 1); break; }
        }
        ships.forEach((s, k) => { if (s.alive && s.inv <= 0)
            for (const a of rocks) if (Math.hypot(s.x-a.x, s.y-a.y) < a.r + SR) { killShip(k); break; }
        });
        if (!rocks.length) spawnWave();
    };

    const tri = (s) => {
        if (s.inv > 0 && Math.floor(s.inv*10) % 2) return;
        g.save(); g.translate(s.x, s.y); g.rotate(s.a);
        g.strokeStyle = s.col; g.lineWidth = 2; g.beginPath();
        g.moveTo(14, 0); g.lineTo(-10, -8); g.lineTo(-6, 0); g.lineTo(-10, 8); g.closePath(); g.stroke();
        g.restore();
    };
    const render = () => {
        g.clearRect(0, 0, W, H);
        g.strokeStyle = 'rgba(200,210,255,.7)'; g.lineWidth = 2;
        vRocks.forEach((a) => { g.beginPath(); g.arc(a.x, a.y, a.r, 0, 7); g.stroke(); });
        g.fillStyle = '#fff'; vBullets.forEach((b) => { g.beginPath(); g.arc(b.x, b.y, 2.5, 0, 7); g.fill(); });
        vShips.forEach((s, k) => { s.col = k === 0 ? '#5db4ff' : '#ff9d3d'; if (s.alive) tri(s); });
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 18px system-ui'; g.textAlign = 'left';
        g.fillText('Score ' + score + '   Lives ' + Math.max(0, lives) + '   Wave ' + wave, 12, 24);
        if (over) { g.textAlign = 'center'; g.font = 'bold 30px system-ui'; g.fillText('Game over — Score ' + score, W/2, H/2); }
    };

    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (auth) {
            if (!over) sim(dt);
            vShips = ships.map(s => ({ x: s.x, y: s.y, a: s.a, alive: s.alive, inv: s.inv }));
            vRocks = rocks; vBullets = bullets;
            if (t - lastSend > SEND) { lastSend = t; ctx.send({ t: 's', sh: vShips, rk: rocks.map(a => ({ x: a.x, y: a.y, r: a.r })), bl: bullets.map(b => ({ x: b.x, y: b.y })), sc: score, lv: lives, wv: wave, ov: over }); }
        }
        render();
        raf = requestAnimationFrame(loop);
    };

    const applyCtl = () => { if (auth) ships[0].ctl = { ...myCtl }; else { const k = JSON.stringify(myCtl); if (k !== sentCtl) { sentCtl = k; ctx.send({ t: 'in', ...myCtl }); } } };
    const doFire = () => { if (auth) fire(0); else ctx.send({ t: 'f' }); };
    const newGame = (broadcast) => { if (auth) reset(); if (broadcast) ctx.send({ t: 'reset' }); };

    window.Appmegle.register({
        id: 'asteroids', label: 'Asteroids', css: 'apps/asteroids.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; myCtl = { l: 0, r: 0, th: 0 }; sentCtl = '';
            ctx.root.innerHTML = '<div class="app-col"><canvas id="as-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="as-pad"><button data-k="l">⟲</button><button data-k="th">🚀</button><button data-k="r">⟳</button><button data-k="f">•</button></div>' +
                '<div class="as-hint">arrows to rotate/thrust, space to fire (you are ' + (auth ? 'blue' : 'orange') + ')</div></div>';
            canvas = ctx.root.querySelector('#as-canvas'); g = canvas.getContext('2d');
            if (auth) reset();
            onKey = (e) => {
                const down = e.type === 'keydown';
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') { myCtl.l = down ? 1 : 0; }
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') { myCtl.r = down ? 1 : 0; }
                else if (e.code === 'ArrowUp' || e.code === 'KeyW') { myCtl.th = down ? 1 : 0; }
                else if (e.code === 'Space') { if (down) doFire(); e.preventDefault(); return applyCtl(); }
                else return;
                e.preventDefault(); applyCtl();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#as-pad button').forEach(b => {
                const k = b.dataset.k;
                const set = (v) => { if (k === 'f') { if (v) doFire(); } else { myCtl[k] = v; applyCtl(); } };
                b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(1); });
                b.addEventListener('pointerup', () => set(0)); b.addEventListener('pointerleave', () => set(0));
            });
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); ctx = canvas = g = null; ships = rocks = bullets = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) { vShips = msg.sh; vRocks = msg.rk; vBullets = msg.bl; score = msg.sc; lives = msg.lv; wave = msg.wv; over = msg.ov; }
            else if (msg.t === 'in' && auth) { ships[1].ctl = { l: msg.l, r: msg.r, th: msg.th }; }
            else if (msg.t === 'f' && auth) fire(1);
            else if (msg.t === 'reset') newGame(false);
        }
    });
})();
