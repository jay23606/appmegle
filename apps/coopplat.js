// Co-op Platformer (2-player) for appmegle. One shared level, two avatars — a gate blocks the
// corridor and only opens while someone stands on a pressure plate. There's a plate on each
// side, so you must take turns holding one while the other crosses. Reach the goal TOGETHER to
// win. Each client runs its own avatar's physics and broadcasts its position; gate/plate/goal
// logic is deterministic from both positions. Caller = Blue avatar, answerer = Orange avatar.
(function () {
    const W = 640, H = 360, GY = 330, AW = 20, AH = 28, GATEX = 300, GATEW = 18, GRAV = 1400, MOVE = 190, JUMP = 470;
    const plate1 = { x: 110, w: 55 }, plate2 = { x: 470, w: 55 }, goal = { x: 560, w: 70 };
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let mx = 40, my = GY-AH, mvx = 0, mvy = 0, onG = true, px = 80, py = GY-AH, phase = 'idle', won = false, lastT = 0, lastSend = 0;
    const keys = { left: false, right: false, jump: false };
    const startX = () => (me === 'a' ? 40 : 80);
    const reset = () => { mx = startX(); my = GY-AH; mvx = 0; mvy = 0; won = false; phase = 'play'; };
    const newGame = () => { reset(); ctx.send({ t: 'reset' }); };
    const overlap = (ax, aw, bx, bw) => ax < bx+bw && ax+aw > bx;
    const onPlate = (pl) => (overlap(mx, AW, pl.x, pl.w) && my+AH >= GY-2) || (overlap(px, AW, pl.x, pl.w) && py+AH >= GY-2);
    const gateOpen = () => onPlate(plate1) || onPlate(plate2);
    const bothOnGoal = () => overlap(mx, AW, goal.x, goal.w) && overlap(px, AW, goal.x, goal.w) && my+AH >= GY-2 && py+AH >= GY-2;

    const step = (dt) => {
        if (phase !== 'play') return;
        mvx = (keys.left ? -MOVE : 0) + (keys.right ? MOVE : 0);
        if (keys.jump && onG) { mvy = -JUMP; onG = false; }
        mvy += GRAV*dt; let nx = mx + mvx*dt, ny = my + mvy*dt;
        if (ny+AH >= GY) { ny = GY-AH; mvy = 0; onG = true; }   // ground
        // gate collision (closed)
        if (!gateOpen() && overlap(nx, AW, GATEX, GATEW) && ny+AH > 210) { nx = (mx + AW/2 < GATEX + GATEW/2) ? GATEX - AW : GATEX + GATEW; }
        nx = Math.max(0, Math.min(W-AW, nx));
        mx = nx; my = ny;
        if (bothOnGoal()) { won = true; phase = 'won'; }
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(120,140,180,.6)'; g.fillRect(0, GY, W, H-GY);   // ground
        const open = gateOpen(); g.fillStyle = open ? 'rgba(90,220,120,.35)' : 'rgba(200,80,80,.75)'; g.fillRect(GATEX, 150, GATEW, GY-150);   // gate
        const pl = (p, on) => { g.fillStyle = on ? '#ffd24a' : 'rgba(255,210,74,.4)'; g.fillRect(p.x, GY-6, p.w, 6); };
        pl(plate1, onPlate(plate1)); pl(plate2, onPlate(plate2));
        g.fillStyle = 'rgba(90,220,120,.5)'; g.fillRect(goal.x, GY-40, goal.w, 40); g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText('GOAL', goal.x+goal.w/2, GY-46);
        g.fillStyle = me === 'a' ? '#ff9d3d' : '#5db4ff'; g.fillRect(px, py, AW, AH);   // partner
        g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(mx, my, AW, AH); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(mx, my, AW, AH);   // me
        if (won) { g.fillStyle = '#fff'; g.font = 'bold 40px system-ui'; g.textAlign = 'center'; g.fillText('🤝 YOU BOTH WIN!', W/2, H/2); }
        else if (phase === 'play') { g.fillStyle = '#fff'; g.font = '13px system-ui'; g.textAlign = 'center'; g.fillText('take turns on the plates — reach the goal together', W/2, 24); }
    };
    const status = () => { if (statEl) statEl.textContent = phase === 'won' ? '🤝 You both reached the goal!' : phase === 'play' ? (gateOpen() ? 'gate OPEN — cross now!' : 'gate closed — get on a plate') : 'Tap Start'; };
    const loop = (t) => { const dt = Math.min(0.04, (t - lastT)/1000 || 0); lastT = t; step(dt); if (t - lastSend > 50) { lastSend = t; ctx.send({ t: 'pos', x: Math.round(mx), y: Math.round(my) }); } draw(); status(); raf = requestAnimationFrame(loop); };

    const bindKey = (e, down) => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') keys.left = down; else if (k === 'arrowright' || k === 'd') keys.right = down; else if (k === 'arrowup' || k === 'w' || k === ' ') keys.jump = down; else return; e.preventDefault(); };
    window.Appmegle.register({
        id: 'coopplat', label: 'Co-op Platformer', css: 'apps/coopplat.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; mx = startX(); my = GY-AH; px = me === 'a' ? 80 : 40; py = GY-AH;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start / Restart</button></div><canvas id="cp-canvas" width="' + W + '" height="' + H + '"></canvas><div id="cp-pad"><button class="cp-b" data-k="left">◀</button><button class="cp-b" data-k="jump">▲</button><button class="cp-b" data-k="right">▶</button></div><div class="cp-hint">arrows / WASD, or the buttons</div></div>';
            canvas = ctx.root.querySelector('#cp-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            this._kd = (e) => bindKey(e, true); this._ku = (e) => bindKey(e, false);
            window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
            ctx.root.querySelectorAll('.cp-b').forEach(b => { const k = b.dataset.k; const set = (v) => (e) => { keys[k] = v; e.preventDefault(); }; b.addEventListener('pointerdown', set(true)); b.addEventListener('pointerup', set(false)); b.addEventListener('pointerleave', set(false)); });
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); ctx = canvas = g = statEl = null; },
        onData(msg) {
            if (msg.t === 'pos') { px = msg.x; py = msg.y; }
            else if (msg.t === 'reset') { reset(); }
        }
    });
})();
