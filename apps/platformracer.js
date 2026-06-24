// Platform Racer for appmegle. Real-time, but unlike the pong-style games each client
// simulates its OWN avatar locally (so jumps are lag-free) and broadcasts its position;
// the other side renders it as a ghost. Players don't collide — they just race the same
// single-screen course to the flag. The caller arbitrates who finished first.
// Caller = blue, answerer = orange.
(function () {
    const W = 720, H = 440, PW = 22, PH = 28, GRAV = 1900, MOVE = 235, JUMP = -640, SEND = 33;
    // static course (same on both peers): floor + ascending platforms, flag on the top one
    const SOLIDS = [
        { x: 0, y: 420, w: 720, h: 20 },
        { x: 110, y: 360, w: 130, h: 14 },
        { x: 300, y: 300, w: 120, h: 14 },
        { x: 470, y: 250, w: 120, h: 14 },
        { x: 560, y: 185, w: 140, h: 14 },
        { x: 580, y: 125, w: 140, h: 14 }
    ];
    const FLAG = { x: 600, y: 86, w: 110, h: 40 };
    const START = { a: { x: 28, y: 392 }, b: { x: 60, y: 392 } };

    let ctx = null, auth = false, role = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let p = null, opp = { x: 60, y: 392 }, il = 0, ir = 0, jq = false;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null;

    const hit = (a, r) => a.x < r.x + r.w && a.x + PW > r.x && a.y < r.y + r.h && a.y + PH > r.y;

    const sim = (dt) => {
        if (jq && p.onGround) { p.vy = JUMP; p.onGround = false; } jq = false;
        p.vx = (ir - il) * MOVE;
        p.vy = Math.min(900, p.vy + GRAV * dt);
        p.x += p.vx * dt;
        if (p.x < 0) p.x = 0; if (p.x > W - PW) p.x = W - PW;
        for (const r of SOLIDS) if (hit(p, r)) { p.x = p.vx > 0 ? r.x - PW : r.x + r.w; p.vx = 0; }
        p.y += p.vy * dt; p.onGround = false;
        for (const r of SOLIDS) if (hit(p, r)) { if (p.vy > 0) { p.y = r.y - PH; p.onGround = true; } else if (p.vy < 0) p.y = r.y + r.h; p.vy = 0; }
        if (hit(p, FLAG)) onFinish();
    };

    const onFinish = () => {
        if (phase !== 'race') return;
        if (auth) setResult('a');
        else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); }
    };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = (w === role) ? '🏁 You win!' : 'You lose — they got there first'; };

    const beginRace = () => {
        p = { x: START[role].x, y: START[role].y, vx: 0, vy: 0, onGround: true };
        opp = { x: START[role === 'a' ? 'b' : 'a'].x, y: START[role === 'a' ? 'b' : 'a'].y };
        winner = null; phase = 'countdown'; countEnd = performance.now() + 3000;
    };
    const newRace = () => { if (auth) { beginRace(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'rematch' }); };

    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,255,255,.18)'; SOLIDS.forEach(r => g.fillRect(r.x, r.y, r.w, r.h));
        // flag
        g.fillStyle = 'rgba(120,225,120,.5)'; g.fillRect(FLAG.x, FLAG.y, FLAG.w, FLAG.h);
        g.fillStyle = '#7cf'; g.fillRect(FLAG.x + 8, FLAG.y - 30, 4, 70);
        g.fillStyle = '#fd7'; g.beginPath(); g.moveTo(FLAG.x + 12, FLAG.y - 28); g.lineTo(FLAG.x + 40, FLAG.y - 20); g.lineTo(FLAG.x + 12, FLAG.y - 12); g.fill();
        const box = (x, y, col, ghost) => { g.globalAlpha = ghost ? 0.45 : 1; g.fillStyle = col; g.beginPath(); g.roundRect(x, y, PW, PH, 5); g.fill(); g.globalAlpha = 1; };
        const oppCol = role === 'a' ? '#ff9d3d' : '#5db4ff', myCol = role === 'a' ? '#5db4ff' : '#ff9d3d';
        box(opp.x, opp.y, oppCol, true);
        if (p) box(p.x, p.y, myCol, false);
        if (phase === 'countdown') {
            const n = Math.ceil((countEnd - performance.now()) / 1000);
            g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 64px system-ui'; g.textAlign = 'center';
            g.fillText(n > 0 ? n : 'GO!', W / 2, H / 2);
        }
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT) / 1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Race! ▲ jump · ◀ ▶ move'; }
        if (phase === 'race') sim(dt);
        if (p && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: Math.round(p.x), y: Math.round(p.y) }); }
        draw();
        raf = requestAnimationFrame(loop);
    };

    window.Appmegle.register({
        id: 'racer', label: 'Platform Racer', css: 'apps/platformracer.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New race</button></div>' +
                '<canvas id="pr-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="pr-pad"><button data-k="l">◀</button><button data-k="j">▲</button><button data-k="r">▶</button></div></div>';
            canvas = ctx.root.querySelector('#pr-canvas'); g = canvas.getContext('2d');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => {
                const d = e.type === 'keydown';
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') il = d ? 1 : 0;
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') ir = d ? 1 : 0;
                else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') { if (d) jq = true; }
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#pr-pad button').forEach(b => {
                const k = b.dataset.k;
                const set = (v) => { if (k === 'l') il = v; else if (k === 'r') ir = v; else if (v) jq = true; };
                b.addEventListener('pointerdown', e => { e.preventDefault(); set(1); });
                b.addEventListener('pointerup', () => set(0)); b.addEventListener('pointerleave', () => set(0));
            });
            statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host to start…';
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
            if (auth) newRace();
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); ctx = canvas = g = statEl = p = null; },
        onData(msg) {
            if (msg.t === 'p') { opp.x = msg.x; opp.y = msg.y; }
            else if (msg.t === 'start') beginRace();
            else if (msg.t === 'rematch' && auth) newRace();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
        }
    });
})();
