// Fruit Ninja (2-player, motion-controlled) for appmegle. Fruit flies across YOUR camera;
// swipe your hand through it to slice — detected by frame-differencing the live video (no
// libraries). The caller spawns a shared sequence so both see the same fruit; slicing is
// local (your own hand), and the higher score after a 60s round wins. Avoid the bombs.
// Caller = Blue, answerer = Orange.
(function () {
    const CW = 640, CH = 480, MW = 80, MH = 60, G = 950, MTH = 22, ROUND = 60;
    const COLORS = ['#e2453b', '#f0a030', '#ffd23a', '#4cc24c', '#9b59d0', '#3aa8e0'];
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null;
    let vid = null, prev = null, trail = [], fruits = [], score = 0, oppScore = 0, timeLeft = ROUND, over = false, result = null, lastT = 0, secT = 0, spawnT = 0, nextId = 1;

    const coverDraw = (c, v, w, h) => { const s = Math.max(w/v.videoWidth, h/v.videoHeight), dw = v.videoWidth*s, dh = v.videoHeight*s; c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(v, (w-dw)/2, (h-dh)/2, dw, dh); c.restore(); };
    const motion = () => {                               // returns {grid, cx, cy} of moving pixels (mirrored)
        if (!vid || !vid.videoWidth) return null;
        coverDraw(mg, vid, MW, MH); const cur = mg.getImageData(0, 0, MW, MH).data, grid = new Uint8Array(MW*MH);
        const first = !prev; if (first) prev = new Float32Array(MW*MH);
        let sx = 0, sy = 0, n = 0;
        for (let i = 0, p = 0; i < MW*MH; i++, p += 4) { const gray = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gray - prev[i]) > MTH) { grid[i] = 1; sx += i % MW; sy += (i/MW)|0; n++; } prev[i] = gray; }
        return { grid, cx: n > 6 ? sx/n : -1, cy: n > 6 ? sy/n : -1, n };
    };
    const slicedBy = (grid, fx, fy) => { const mx = (fx/CW*MW)|0, my = (fy/CH*MH)|0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = mx+dx, y = my+dy; if (x>=0&&x<MW&&y>=0&&y<MH&&grid[y*MW+x]) return true; } return false; };

    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); score = 0; oppScore = 0; timeLeft = ROUND; over = false; result = null; fruits = []; nextId = 1; ctx.send({ t: 'start' }); status(); };
    const startLocal = () => { score = 0; timeLeft = ROUND; over = false; result = null; fruits = []; };
    const spawn = () => { const id = nextId++, x = 70 + Math.random()*(CW-140), vx = (CW/2 - x)*0.5 + (Math.random()*120-60), vy = -(820 + Math.random()*260), bomb = Math.random() < 0.13, k = (Math.random()*COLORS.length)|0; const f = { id, x, vx, vy, bomb, k }; ctx.send({ t: 'spawn', f }); addFruit(f); };
    const addFruit = (f) => { fruits.push({ ...f, t0: performance.now(), sliced: false, splash: 0 }); };

    const status = () => { if (!statEl) return; statEl.textContent = over ? (result === 'tie' ? 'Tie ' : result === me ? '🏆 You win ' : 'You lose ') + score + '–' + oppScore : '⏱ ' + Math.ceil(timeLeft) + 's · You ' + score + ' · Them ' + oppScore; };
    const draw = () => {
        if (!g) return;
        if (vid && vid.videoWidth) coverDraw(g, vid, CW, CH); else { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, CW, CH); }
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, CW, CH);
        const now = performance.now();
        for (const f of fruits) {
            const t = (now - f.t0)/1000, x = f.x + f.vx*t, y = CH + 30 + f.vy*t + 0.5*G*t*t;
            f._x = x; f._y = y;
            if (f.sliced) { f.splash += 0.05; g.globalAlpha = Math.max(0, 1 - f.splash); g.fillStyle = f.bomb ? '#333' : COLORS[f.k]; g.beginPath(); g.arc(x, y, 28 + f.splash*40, 0, 7); g.fill(); g.globalAlpha = 1; continue; }
            if (f.bomb) { g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); g.fillStyle = '#e44'; g.font = 'bold 22px system-ui'; g.textAlign = 'center'; g.fillText('💣', x, y+8); }
            else { g.fillStyle = COLORS[f.k]; g.beginPath(); g.arc(x, y, 28, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x-8, y-8, 8, 0, 7); g.fill(); }
        }
        // blade trail
        if (trail.length > 1) { g.strokeStyle = me === 'a' ? 'rgba(120,200,255,.9)' : 'rgba(255,180,90,.9)'; g.lineCap = 'round'; for (let i = 1; i < trail.length; i++) { g.lineWidth = i; g.beginPath(); g.moveTo(trail[i-1][0], trail[i-1][1]); g.lineTo(trail[i][0], trail[i][1]); g.stroke(); } }
        status();
    };
    const tick = (dt) => {
        if (over) return;
        const mo = motion();
        if (mo && mo.cx >= 0) { trail.push([mo.cx/MW*CW, mo.cy/MH*CH]); if (trail.length > 10) trail.shift(); } else if (trail.length) trail.shift();
        const now = performance.now();
        for (const f of fruits) {
            if (f.sliced) continue;
            const t = (now - f.t0)/1000, x = f.x + f.vx*t, y = CH + 30 + f.vy*t + 0.5*G*t*t;
            if (mo && mo.cx >= 0 && y > -40 && y < CH+40 && slicedBy(mo.grid, x, y)) { f.sliced = true; if (f.bomb) { score = Math.max(0, score - 3); } else score++; ctx.send({ t: 'score', s: score }); }
        }
        fruits = fruits.filter(f => { const t = (now - f.t0)/1000; return f.splash < 1 && t < 4; });
        if (auth) { spawnT -= dt; if (spawnT <= 0) { spawnT = 0.55 + Math.random()*0.5; spawn(); if (Math.random() < 0.35) spawn(); } secT += dt; if (secT >= 1) { secT -= 1; timeLeft--; ctx.send({ t: 'time', s: timeLeft }); if (timeLeft <= 0) endGame(); } }
    };
    const endGame = () => { over = true; result = score === oppScore ? 'tie' : score > oppScore ? 'a' : 'b'; ctx.send({ t: 'end', a: score, b: oppScore }); status(); };

    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; tick(dt); draw(); raf = requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'fruitninja', label: 'Fruit Ninja (cam)', css: 'apps/fruitninja.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; prev = null; trail = []; fruits = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New round</button></div><canvas id="fn-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="fn-hint">swipe your hand to slice — avoid 💣</div></div>';
            canvas = ctx.root.querySelector('#fn-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video');
            mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) { startLocal(); spawnT = 1; } else statEl.textContent = 'Waiting for the host…';
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = vid = mc = mg = prev = null; fruits = []; trail = []; },
        onData(msg) {
            if (msg.t === 'start') { startLocal(); if (auth) spawnT = 1; }
            else if (msg.t === 'spawn' && !auth) addFruit(msg.f);
            else if (msg.t === 'score') { oppScore = msg.s; status(); }
            else if (msg.t === 'time' && !auth) { timeLeft = msg.s; status(); }
            else if (msg.t === 'end') { over = true; score = me === 'a' ? msg.a : msg.b; oppScore = me === 'a' ? msg.b : msg.a; result = msg.a === msg.b ? 'tie' : msg.a > msg.b ? 'a' : 'b'; status(); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
