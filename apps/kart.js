// Kart Racer (Mario-Kart-ish, 2-player) for appmegle. Like the platform racer, each
// client simulates its OWN kart locally (lag-free steering) and broadcasts position for
// the opponent ghost; the caller arbitrates who finishes the 3 laps first. Top-down
// closed-loop track, auto-accelerate, steer + brake, boost pads, and droppable bananas
// (broadcast; each client self-applies a spin-out when its kart hits one).
// Caller = blue kart, answerer = orange.
(function () {
    const W = 720, H = 440, ROAD = 70, LAPS = 3, SEND = 33;
    const MAXR = 250, MAXG = 115, MAXB = 360, ACC = 340, BRK = 380, DRAG = 60, TURN = 3.0;
    // closed-loop centreline
    const TR = [[140,110],[360,86],[582,120],[642,225],[560,332],[362,356],[182,344],[88,240],[140,110]];
    const START = TR[0], CHK = [560,332], PADS = [[582,120],[362,356]];

    let ctx = null, auth = false, role = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let k = null, opp = { x: START[0], y: START[1], a: 0, lap: 0 }, bananas = [];
    let il = 0, ir = 0, brake = 0, itemCd = 0;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null;

    const d2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
    const distSeg = (px, py, ax, ay, bx, by) => {
        const dx = bx - ax, dy = by - ay, l2 = dx*dx + dy*dy;
        let t = l2 ? ((px-ax)*dx + (py-ay)*dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
        return d2(px, py, ax + t*dx, ay + t*dy);
    };
    const onRoad = (x, y) => { let m = 1e9; for (let i = 0; i < TR.length-1; i++) m = Math.min(m, distSeg(x, y, TR[i][0], TR[i][1], TR[i+1][0], TR[i+1][1])); return m < ROAD/2; };

    const begin = () => {
        const a0 = Math.atan2(TR[1][1]-START[1], TR[1][0]-START[0]);
        const off = role === 'a' ? -16 : 16, nx = Math.cos(a0 + Math.PI/2)*off, ny = Math.sin(a0 + Math.PI/2)*off;
        k = { x: START[0] + nx, y: START[1] + ny, a: a0, sp: 0, lap: 0, armed: false, spin: 0, boost: 0 };
        opp = { x: START[0], y: START[1], a: a0, lap: 0 }; bananas = []; winner = null;
        phase = 'countdown'; countEnd = performance.now() + 3000;
    };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'rematch' }); };

    const sim = (dt) => {
        if (k.spin > 0) { k.spin -= dt; k.a += 9*dt; k.sp *= 0.92; }
        else {
            k.sp += (brake ? -BRK : ACC) * dt;
            const max = k.boost > 0 ? MAXB : (onRoad(k.x, k.y) ? MAXR : MAXG);
            if (k.boost > 0) k.boost -= dt;
            k.sp -= DRAG*dt; if (k.sp > max) k.sp = max; if (k.sp < -90) k.sp = -90;
            k.a += (ir - il) * TURN * (k.sp/MAXR) * dt;
        }
        k.x += Math.cos(k.a)*k.sp*dt; k.y += Math.sin(k.a)*k.sp*dt;
        k.x = Math.max(8, Math.min(W-8, k.x)); k.y = Math.max(8, Math.min(H-8, k.y));
        // boost pads
        for (const [px, py] of PADS) if (d2(k.x, k.y, px, py) < 22) k.boost = 0.8;
        // bananas
        const now = performance.now();
        bananas = bananas.filter(b => now - b.born < 8000);
        if (k.spin <= 0) for (const b of bananas) if (now - b.born > 600 && d2(k.x, k.y, b.x, b.y) < 18) { k.spin = 1.0; k.sp *= 0.3; b.born = 0; break; }
        // lap timing
        if (!k.armed && d2(k.x, k.y, CHK[0], CHK[1]) < 55) k.armed = true;
        if (k.armed && d2(k.x, k.y, START[0], START[1]) < 55) { k.armed = false; k.lap++; if (k.lap >= LAPS) onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they finished first'; };
    const dropBanana = () => { if (phase !== 'race' || itemCd > 0) return; itemCd = 1.2; const bx = k.x - Math.cos(k.a)*22, by = k.y - Math.sin(k.a)*22, b = { x: bx, y: by, born: performance.now() }; bananas.push(b); ctx.send({ t: 'banana', x: bx, y: by }); };

    const kart = (x, y, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.roundRect(-13, -8, 26, 16, 4); g.fill(); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(2, -6, 6, 12); g.restore(); };
    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(40,110,50,.35)'; g.fillRect(0, 0, W, H);                      // grass
        g.strokeStyle = 'rgba(60,60,70,.78)'; g.lineWidth = ROAD; g.lineJoin = g.lineCap = 'round';
        g.beginPath(); g.moveTo(TR[0][0], TR[0][1]); for (let i = 1; i < TR.length; i++) g.lineTo(TR[i][0], TR[i][1]); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.stroke(); g.setLineDash([]);
        // start line + boost pads
        g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#222'; g.fillRect(START[0]-30 + i*10, START[1]-6, 10, 12); }
        g.fillStyle = 'rgba(255,220,80,.6)'; PADS.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); });
        g.font = '16px system-ui'; g.textAlign = 'center'; bananas.forEach(b => g.fillText('🍌', b.x, b.y + 6));
        kart(opp.x, opp.y, opp.a, role === 'a' ? '#ff9d3d' : '#5db4ff');
        if (k) kart(k.x, k.y, k.a, role === 'a' ? '#5db4ff' : '#ff9d3d');
        g.fillStyle = '#fff'; g.font = 'bold 16px system-ui'; g.textAlign = 'left';
        g.fillText('Lap ' + Math.min((k ? k.lap : 0) + 1, LAPS) + '/' + LAPS, 12, 24);
        if (phase === 'countdown') { const n = Math.ceil((countEnd - performance.now())/1000); g.textAlign = 'center'; g.font = 'bold 60px system-ui'; g.fillText(n > 0 ? n : 'GO!', W/2, H/2); }
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (itemCd > 0) itemCd -= dt;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Race! steer ◀▶ · brake ▼ · 🍌 drop'; }
        if (phase === 'race' && k) sim(dt);
        if (k && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: Math.round(k.x), y: Math.round(k.y), a: +k.a.toFixed(2), lap: k.lap }); }
        draw(); raf = requestAnimationFrame(loop);
    };

    window.Appmegle.register({
        id: 'kart', label: 'Kart Racer', css: 'apps/kart.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New race</button></div>' +
                '<canvas id="kt-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="kt-pad"><button data-k="l">◀</button><button data-k="b">▼ Brake</button><button data-k="i">🍌</button><button data-k="r">▶</button></div></div>';
            canvas = ctx.root.querySelector('#kt-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => {
                const d = e.type === 'keydown';
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') il = d ? 1 : 0;
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') ir = d ? 1 : 0;
                else if (e.code === 'ArrowDown' || e.code === 'KeyS') brake = d ? 1 : 0;
                else if (e.code === 'Space') { if (d && !e.repeat) dropBanana(); }
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#kt-pad button').forEach(b => {
                const key = b.dataset.k;
                const set = (v) => { if (key === 'l') il = v; else if (key === 'r') ir = v; else if (key === 'b') brake = v; else if (v) dropBanana(); };
                b.addEventListener('pointerdown', e => { e.preventDefault(); set(1); });
                b.addEventListener('pointerup', () => set(0)); b.addEventListener('pointerleave', () => set(0));
            });
            statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host…';
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
            if (auth) newRace();
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); ctx = canvas = g = statEl = k = null; },
        onData(msg) {
            if (msg.t === 'p') { opp = { x: msg.x, y: msg.y, a: msg.a, lap: msg.lap }; }
            else if (msg.t === 'banana') bananas.push({ x: msg.x, y: msg.y, born: performance.now() });
            else if (msg.t === 'start') begin();
            else if (msg.t === 'rematch' && auth) newRace();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
        }
    });
})();
