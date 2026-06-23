// Air Hockey for appmegle. Real-time, authoritative caller. Caller = bottom mallet
// (also simulates the puck), answerer = top mallet. Each side moves its mallet with
// the pointer within its half; the caller resolves puck physics and scoring.
(function () {
    const W = 360, H = 560, PR = 12, MR = 26, GOAL = 150, WIN = 7, SEND = 33, MAXV = 720;
    let ctx = null, auth = false, raf = 0, canvas = null, g = null, lastT = 0, lastSend = 0, onMove = null;
    let puck = { x: W/2, y: H/2, vx: 0, vy: 0 }, sb = 0, st = 0;
    let bm = { x: W/2, y: H-80, vx: 0, vy: 0, t: 0 }, tm = { x: W/2, y: 80, vx: 0, vy: 0, t: 0 };

    const serve = (dir) => { puck.x = W/2; puck.y = H/2; puck.vx = (Math.random()*120-60); puck.vy = dir*220; };

    const bounceMallet = (m) => {
        const dx = puck.x - m.x, dy = puck.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (d < PR + MR) {
            const nx = dx/d, ny = dy/d;
            puck.x = m.x + nx*(PR+MR); puck.y = m.y + ny*(PR+MR);
            const vn = puck.vx*nx + puck.vy*ny;
            if (vn < 0) { puck.vx -= 2*vn*nx; puck.vy -= 2*vn*ny; }
            puck.vx += m.vx*0.5; puck.vy += m.vy*0.5;
        }
    };
    const step = (dt) => {
        puck.x += puck.vx*dt; puck.y += puck.vy*dt;
        puck.vx *= (1 - 0.4*dt); puck.vy *= (1 - 0.4*dt);
        const sp = Math.hypot(puck.vx, puck.vy); if (sp > MAXV) { puck.vx *= MAXV/sp; puck.vy *= MAXV/sp; }
        if (puck.x < PR) { puck.x = PR; puck.vx = Math.abs(puck.vx); }
        if (puck.x > W-PR) { puck.x = W-PR; puck.vx = -Math.abs(puck.vx); }
        const inGoal = puck.x > (W-GOAL)/2 && puck.x < (W+GOAL)/2;
        if (puck.y < PR) { if (inGoal) { sb++; serve(1); } else { puck.y = PR; puck.vy = Math.abs(puck.vy); } }
        if (puck.y > H-PR) { if (inGoal) { st++; serve(-1); } else { puck.y = H-PR; puck.vy = -Math.abs(puck.vy); } }
        bounceMallet(bm); bounceMallet(tm);
    };

    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, H/2); g.lineTo(W, H/2); g.stroke();
        g.beginPath(); g.arc(W/2, H/2, 46, 0, 7); g.stroke();
        g.fillStyle = 'rgba(120,220,160,.5)';
        g.fillRect((W-GOAL)/2, 0, GOAL, 6); g.fillRect((W-GOAL)/2, H-6, GOAL, 6);
        const mal = (m, col) => { g.fillStyle = col; g.beginPath(); g.arc(m.x, m.y, MR, 0, 7); g.fill(); };
        mal(tm, '#ff9d3d'); mal(bm, '#5db4ff');
        g.fillStyle = '#fff'; g.beginPath(); g.arc(puck.x, puck.y, PR, 0, 7); g.fill();
        const mine = auth ? sb : st, opp = auth ? st : sb;
        g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillText(opp, W/2, 40); g.fillText(mine, W/2, H-18);
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (auth) {
            if (sb < WIN && st < WIN) step(dt);
            if (t - lastSend > SEND) { lastSend = t; ctx.send({ t: 's', x: puck.x, y: puck.y, sb, st, mx: bm.x, my: bm.y }); }
        }
        draw();
        raf = requestAnimationFrame(loop);
    };

    const moveMine = (e) => {
        const r = canvas.getBoundingClientRect();
        const m = auth ? bm : tm, now = performance.now(), dt = Math.max(0.001, (now - m.t)/1000);
        const nx = Math.max(MR, Math.min(W-MR, (e.clientX - r.left)/r.width * W));
        let ny = (e.clientY - r.top)/r.height * H;
        ny = auth ? Math.max(H/2 + MR, Math.min(H-MR, ny)) : Math.max(MR, Math.min(H/2 - MR, ny));
        m.vx = (nx - m.x)/dt; m.vy = (ny - m.y)/dt; m.x = nx; m.y = ny; m.t = now;
        if (now - lastSend > SEND || !auth) { if (!auth) { lastSend = now; ctx.send({ t: 'm', x: nx, y: ny }); } }
    };

    window.Appmegle.register({
        id: 'airhockey', label: 'Air Hockey', css: 'apps/airhockey.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; sb = st = 0;
            bm = { x: W/2, y: H-80, vx: 0, vy: 0, t: performance.now() };
            tm = { x: W/2, y: 80, vx: 0, vy: 0, t: performance.now() };
            ctx.root.innerHTML = '<div class="app-col"><canvas id="ah-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div class="ah-hint">' + (auth ? 'Bottom mallet' : 'Top mallet') + ' — move your pointer in your half</div></div>';
            canvas = ctx.root.querySelector('#ah-canvas'); g = canvas.getContext('2d');
            onMove = moveMine; canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onMove);
            if (auth) serve(Math.random() < 0.5 ? 1 : -1);
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (canvas && onMove) { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onMove); } ctx = canvas = g = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { puck.x = msg.x; puck.y = msg.y; sb = msg.sb; st = msg.st; bm.x = msg.mx; bm.y = msg.my; }
            else if (msg.t === 'm' && auth) { const now = performance.now(), dt = Math.max(0.001, (now - tm.t)/1000); tm.vx = (msg.x - tm.x)/dt; tm.vy = (msg.y - tm.y)/dt; tm.x = msg.x; tm.y = msg.y; tm.t = now; }
        }
    });
})();
