// Pool (simplified UK 8-ball) for appmegle. Authoritative caller simulates all ball
// physics; the player whose turn it is aims (slingshot drag) and the shot vector is
// applied by the caller, which rolls the sim and broadcasts ball positions until they
// stop, then resolves the turn. Caller = reds, answerer = yellows; clear your colour
// then pot the black to win. Potting the black early, or with colours left, loses.
(function () {
    const W = 700, H = 380, M = 28, R = 9, PR = 19, MAXSPD = 3400, FRICT = 0.989, SUB = 7, SEND = 33;
    const minX = M + R, maxX = W - M - R, minY = M + R, maxY = H - M - R;
    const POCKETS = [[M, M], [W/2, M], [W-M, M], [M, H-M], [W/2, H-M], [W-M, H-M]];

    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, powerEl = null, powerOut = null, shootBtn = null;
    let balls = [], turn = 'a', phase = 'aim', over = false, result = '';
    let potted = [], scratch = false;                 // accumulated during a shot (caller)
    let aiming = false, dragging = false, aim = { x: W*0.8, y: H/2 }, power = 45, lastT = 0, lastSend = 0;

    const rack = () => {
        const arr = [{ x: W*0.22, y: H/2, vx: 0, vy: 0, on: true, c: 'w' }];
        const cols = []; for (let i = 0; i < 7; i++) { cols.push('r'); cols.push('y'); }
        for (let i = cols.length - 1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [cols[i], cols[j]] = [cols[j], cols[i]]; }
        cols.splice(4, 0, 'k');                        // black near the middle of the pack
        const rx = W*0.6, dx = 2*R*0.87, dy = 2*R; let k = 0;
        for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++)
            arr.push({ x: rx + row*dx, y: H/2 + (i - row/2)*dy, vx: 0, vy: 0, on: true, c: cols[k++] });
        return arr;
    };
    const colorsOn = (c) => balls.filter(b => b.on && b.c === c).length;

    const sub = (dt) => {
        for (const b of balls) {
            if (!b.on) continue;
            b.x += b.vx*dt; b.y += b.vy*dt;
            for (const [px, py] of POCKETS) if (Math.hypot(b.x-px, b.y-py) < PR) { b.on = false; if (b.c === 'w') scratch = true; else potted.push(b.c); break; }
            if (!b.on) continue;
            if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx)*0.9; } if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx)*0.9; }
            if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy)*0.9; } if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy)*0.9; }
        }
        for (let i = 0; i < balls.length; i++) for (let j = i+1; j < balls.length; j++) {
            const a = balls[i], b = balls[j]; if (!a.on || !b.on) continue;
            const dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx, dy);
            if (d > 0 && d < 2*R) {
                const nx = dx/d, ny = dy/d, ov = 2*R-d;
                a.x -= nx*ov/2; a.y -= ny*ov/2; b.x += nx*ov/2; b.y += ny*ov/2;
                const p = (a.vx-b.vx)*nx + (a.vy-b.vy)*ny;
                if (p > 0) { a.vx -= p*nx; a.vy -= p*ny; b.vx += p*nx; b.vy += p*ny; }
            }
        }
    };
    const stopped = () => balls.every(b => !b.on || (Math.abs(b.vx) < 5 && Math.abs(b.vy) < 5));

    const rayToRail = (x, y, dx, dy, inset = M + R) => {
        const tx = dx > 0 ? (W-inset-x)/dx : dx < 0 ? (inset-x)/dx : Infinity;
        const ty = dy > 0 ? (H-inset-y)/dy : dy < 0 ? (inset-y)/dy : Infinity;
        return Math.max(0, Math.min(tx >= 0 ? tx : Infinity, ty >= 0 ? ty : Infinity));
    };
    const guide = (cue, dx, dy) => {
        const rail = rayToRail(cue.x, cue.y, dx, dy); let hit = null, hitT = rail;
        for (let i = 1; i < balls.length; i++) {
            const b = balls[i]; if (!b.on) continue;
            const ox = b.x-cue.x, oy = b.y-cue.y, projection = ox*dx + oy*dy;
            if (projection <= R) continue;
            const side2 = ox*ox + oy*oy - projection*projection, radius = 2*R;
            if (side2 > radius*radius) continue;
            const t = projection - Math.sqrt(Math.max(0, radius*radius-side2));
            if (t > R && t < hitT) { hitT = t; hit = b; }
        }
        if (!hit) return { cueDistance: rail, hit: null };
        const ghost = { x: cue.x + dx*hitT, y: cue.y + dy*hitT };
        const nx0 = hit.x-ghost.x, ny0 = hit.y-ghost.y, nd = Math.hypot(nx0, ny0) || 1;
        const nx = nx0/nd, ny = ny0/nd;
        return { cueDistance: hitT, hit, ghost, objectDx: nx, objectDy: ny, objectDistance: rayToRail(hit.x, hit.y, nx, ny) };
    };
    const shotSpeed = value => 120 + Math.pow(Math.max(1, Math.min(100, value))/100, 1.45) * 3080;

    const resolve = () => {
        const myCol = turn === 'a' ? 'r' : 'y';
        if (colorsOn('k') === 0) {                     // black potted → game ends this turn
            const cleared = colorsOn(myCol) === 0;
            over = true; result = cleared ? turn : (turn === 'a' ? 'b' : 'a');
        } else if (scratch) { respawnCue(); turn = turn === 'a' ? 'b' : 'a'; }
        else { const pottedOwn = potted.filter(c => c === myCol).length; if (!pottedOwn) turn = turn === 'a' ? 'b' : 'a'; }
        balls.forEach(b => { b.vx = b.vy = 0; }); phase = 'aim'; broadcast();
    };
    const respawnCue = () => {
        const cue = balls[0]; cue.on = true; cue.vx = cue.vy = 0; cue.x = W*0.22; cue.y = H/2;
        while (balls.some(b => b !== cue && b.on && Math.hypot(b.x-cue.x, b.y-cue.y) < 2*R)) cue.y += 2*R;
    };

    const broadcast = () => ctx.send({ t: 's', b: balls.map(o => [Math.round(o.x), Math.round(o.y), o.on?1:0, o.c]), turn, phase, over, result });

    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(80,45,25,.42)'; g.fillRect(0, 0, W, H);                                   // rail (translucent)
        g.fillStyle = 'rgba(28,95,52,.42)'; g.fillRect(M-6, M-6, W-2*(M-6), H-2*(M-6));               // felt (translucent)
        g.fillStyle = 'rgba(0,0,0,.55)'; POCKETS.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, PR-2, 0, 7); g.fill(); });
        const fill = { w: '#fff', r: '#e23b3b', y: '#ecc233', k: '#111' };
        for (const b of balls) if (b.on) { g.fillStyle = fill[b.c]; g.beginPath(); g.arc(b.x, b.y, R, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.stroke(); }
        if (aiming && canAim() && balls[0].on) {
            const cue = balls[0], dx = aim.x-cue.x, dy = aim.y-cue.y, d = Math.hypot(dx, dy) || 1;
            const sdx = dx/d, sdy = dy/d, pdx = -sdx, pdy = -sdy, powerRatio = power/100;
            const path = guide(cue, sdx, sdy);
            // Thin, long guides: white is the cue-ball centre path; gold is the
            // first object ball's projected path. The ghost ring shows impact.
            g.lineWidth = 1.25; g.setLineDash([8, 6]);
            g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(cue.x + sdx*R, cue.y + sdy*R); g.lineTo(cue.x + sdx*path.cueDistance, cue.y + sdy*path.cueDistance); g.stroke();
            if (path.hit) {
                g.strokeStyle = 'rgba(255,213,92,.95)'; g.beginPath(); g.moveTo(path.hit.x + path.objectDx*R, path.hit.y + path.objectDy*R); g.lineTo(path.hit.x + path.objectDx*path.objectDistance, path.hit.y + path.objectDy*path.objectDistance); g.stroke();
                g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,255,255,.58)'; g.beginPath(); g.arc(path.ghost.x, path.ghost.y, R, 0, Math.PI*2); g.stroke();
            }
            g.setLineDash([]);
            // cue stick behind the ball, drawn back proportional to power
            const pull = 7 + powerRatio*55, tx = cue.x + pdx*(R + pull), ty = cue.y + pdy*(R + pull), bx = tx + pdx*180, by = ty + pdy*180;
            g.lineCap = 'round';
            g.lineWidth = 7; g.strokeStyle = '#7a5a32'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(bx, by); g.stroke();             // shaft
            g.lineWidth = 7; g.strokeStyle = '#d8b878'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + pdx*44, ty + pdy*44); g.stroke();   // pale wood near tip
            g.lineWidth = 9; g.strokeStyle = 'rgb(' + ((90 + 170*powerRatio)|0) + ',' + ((205 - 165*powerRatio)|0) + ',90)'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + pdx*9, ty + pdy*9); g.stroke();   // tip, green→red by power
            g.lineCap = 'butt';
        }
        const myCol = me === 'a' ? 'r' : 'y';
        if (over) statEl.textContent = result === me ? '🎱 You win!' : 'You lose';
        else statEl.textContent = 'You: ' + (7 - colorsOn(myCol)) + '/7 ' + (myCol === 'r' ? 'red' : 'yellow') + ' · ' + (turn === me ? (phase === 'aim' ? 'your shot — point at the target, set power, then shoot' : 'rolling…') : 'their shot');
        if (shootBtn) shootBtn.disabled = !canAim() || !aiming;
    };

    const shoot = (vx, vy) => {
        if (auth) { balls[0].vx = vx; balls[0].vy = vy; potted = []; scratch = false; phase = 'roll'; }
        else { phase = 'roll'; ctx.send({ t: 'shot', vx, vy }); }
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (auth && phase === 'roll') {
            for (let s = 0; s < SUB; s++) sub(dt/SUB);
            for (const b of balls) { b.vx *= FRICT; b.vy *= FRICT; const sp = Math.hypot(b.vx, b.vy); if (sp > MAXSPD) { b.vx *= MAXSPD/sp; b.vy *= MAXSPD/sp; } }
            if (t - lastSend > SEND) { lastSend = t; broadcast(); }
            if (stopped()) resolve();
        }
        draw(); raf = requestAnimationFrame(loop);
    };

    const canAim = () => phase === 'aim' && turn === me && !over && balls[0] && balls[0].on;
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width*W, y: (e.clientY-r.top)/r.height*H }; };
    const newGame = () => { if (auth) { balls = rack(); turn = 'a'; phase = 'aim'; over = false; result = ''; potted = []; scratch = false; broadcast(); } else ctx.send({ t: 'newreq' }); };

    window.Appmegle.register({
        id: 'pool', label: 'Pool', css: 'apps/pool.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><canvas id="pl-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div class="pl-shot"><label>Power <input class="pl-power" type="range" min="1" max="100" step="1" value="45"><output>45%</output></label><button class="app-btn pl-shoot" disabled>Shoot</button></div></div>';
            canvas = ctx.root.querySelector('#pl-canvas'); g = canvas.getContext('2d');
            statEl = ctx.root.querySelector('.stat');
            powerEl = ctx.root.querySelector('.pl-power'); powerOut = ctx.root.querySelector('.pl-shot output'); shootBtn = ctx.root.querySelector('.pl-shoot');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            powerEl.addEventListener('input', () => { power = Number(powerEl.value); powerOut.textContent = power + '%'; });
            canvas.addEventListener('pointerdown', (e) => { if (!canAim()) return; aiming = dragging = true; aim = pt(e); canvas.setPointerCapture?.(e.pointerId); });
            canvas.addEventListener('pointermove', (e) => { if (dragging) aim = pt(e); });
            canvas.addEventListener('pointerup', (e) => { if (dragging) { aim = pt(e); dragging = false; canvas.releasePointerCapture?.(e.pointerId); } });
            canvas.addEventListener('pointercancel', () => { dragging = false; });
            shootBtn.addEventListener('click', () => {
                if (!canAim() || !aiming) return;
                const dx = aim.x-balls[0].x, dy = aim.y-balls[0].y, d = Math.hypot(dx, dy); if (d < 3) return;
                const speed = shotSpeed(power); aiming = false; shoot(dx/d*speed, dy/d*speed);
            });
            balls = auth ? rack() : []; if (auth) newGame();
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = powerEl = powerOut = shootBtn = null; balls = []; aiming = dragging = false; },
        onData(msg) {
            if (msg.t === 's' && !auth) { balls = msg.b.map(([x, y, on, c]) => ({ x, y, on: !!on, c })); turn = msg.turn; phase = msg.phase; over = msg.over; result = msg.result; }
            else if (msg.t === 'shot' && auth) { if (phase === 'aim' && turn === 'b') { balls[0].vx = msg.vx; balls[0].vy = msg.vy; potted = []; scratch = false; phase = 'roll'; } }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
