// Fireworks Finale (2-player) for appmegle. The goodbye app: you each design four shells
// (color, burst shape, position), then hit LAUNCH and the identical show — with sound — plays
// over both video feeds in sync, ending in a joint finale volley. Shell lists are exchanged up
// front; every burst uses a per-shell seeded PRNG so both sides render the exact same sparks.
// Caller triggers the synchronized start.
(function () {
    const COLORS = ['#ff5a5a', '#ffd24a', '#7be08a', '#5db4ff', '#d78cff', '#ffffff'];
    const SHAPES = ['burst', 'ring', 'willow', 'crackle'];
    const W = 720, H = 440, SHOW = 13;
    let ctx = null, auth = false, me = 'a', mine = [], theirs = null, ready = false, phase = 'design', t0 = 0, parts = [], boomQ = [], statEl = null, bodyEl = null, canvas = null, g = null, raf = 0, actx = null, lastT = 0;
    const mul = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const defShells = (side) => [0, 1, 2, 3].map(i => ({ c: (Math.random()*COLORS.length)|0, s: (Math.random()*SHAPES.length)|0, x: 15 + ((Math.random()*70)|0), t: (side === 'a' ? 1.5 : 2.75) + i*2.5 }));
    const boom = (big) => { if (!actx) return; const n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate*0.4, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2.2); n.buffer = buf; const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 900 : 500; const gn = actx.createGain(); gn.gain.value = big ? 0.5 : 0.3; n.connect(f); f.connect(gn); gn.connect(actx.destination); n.start(); };
    const explode = (sh, idx) => {
        const rnd = mul(idx*7919 + 42), col = COLORS[sh.c], shape = SHAPES[sh.s], cx = sh.x/100*W, cy = 60 + rnd()*120;
        const N = shape === 'burst' ? 70 : shape === 'ring' ? 56 : shape === 'willow' ? 46 : 40;
        for (let i = 0; i < N; i++) {
            const a = shape === 'ring' ? i/N*2*Math.PI : rnd()*2*Math.PI;
            const sp = shape === 'ring' ? 120 : shape === 'willow' ? 55 + rnd()*45 : 60 + rnd()*110;
            parts.push({ x: cx, y: cy, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, col, life: shape === 'willow' ? 2.4 : 1.4, age: 0, grav: shape === 'willow' ? 130 : 80, ck: shape === 'crackle' && rnd() < 0.5, rnd });
        }
        boom(true);
    };
    const startShow = () => { phase = 'show'; t0 = performance.now(); parts = []; boomQ = []; const all = [...mine, ...(theirs || [])]; all.forEach((sh, i) => boomQ.push({ at: sh.t, sh, idx: i }));
        const frnd = mul(1234); for (let i = 0; i < 6; i++) boomQ.push({ at: 11 + frnd()*1.4, sh: { c: (frnd()*COLORS.length)|0, s: (frnd()*SHAPES.length)|0, x: 10 + frnd()*80 }, idx: 100+i });
        build(); };
    const step = (dt, el) => {
        for (const q of boomQ) if (!q.done && el >= q.at) { q.done = true; explode(q.sh, q.idx); }
        for (const p of parts) { p.age += dt; p.vy += p.grav*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.985;
            if (p.ck && !p.did && p.age > p.life*0.55) { p.did = true; for (let k = 0; k < 4; k++) parts.push({ x: p.x, y: p.y, vx: (p.rnd()*2-1)*70, vy: (p.rnd()*2-1)*70, col: '#fff', life: 0.4, age: 0, grav: 60 }); boom(false); } }
        parts = parts.filter(p => p.age < p.life);
    };
    const draw = (el) => {
        g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        for (const p of parts) { const f = 1 - p.age/p.life; g.globalAlpha = f; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 2.5 + f*1.5, 0, 7); g.fill(); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (el < 0) { g.fillStyle = '#fff'; g.font = 'bold 70px system-ui'; g.textAlign = 'center'; g.fillText(Math.ceil(-el), W/2, H/2); }
        if (el > SHOW && phase === 'show') { phase = 'after'; build(); }
    };
    const build = () => {
        if (!bodyEl) return;
        statEl.textContent = phase === 'design' ? '🎆 Design your 4 shells' : phase === 'show' ? '🎇 Enjoy the show' : 'That was yours & theirs, together';
        if (phase === 'design') {
            bodyEl.innerHTML = mine.map((sh, i) => '<div class="fw-slot"><button class="fw-c" data-i="' + i + '" style="background:' + COLORS[sh.c] + '"></button><button class="fw-s" data-i="' + i + '">' + SHAPES[sh.s] + '</button><input class="fw-x" data-i="' + i + '" type="range" min="5" max="95" value="' + sh.x + '"><span class="fw-t">@' + sh.t.toFixed(1) + 's</span></div>').join('') +
                '<button class="app-btn" id="fw-ready"' + (ready ? ' disabled' : '') + '>' + (ready ? (theirs ? '' : 'waiting for their shells…') : '✓ Shells ready') + '</button>' + (auth && ready && theirs ? '<button class="app-btn" id="fw-launch">🚀 LAUNCH THE SHOW</button>' : '');
            bodyEl.querySelectorAll('.fw-c').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.i; mine[i].c = (mine[i].c+1) % COLORS.length; build(); }));
            bodyEl.querySelectorAll('.fw-s').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.i; mine[i].s = (mine[i].s+1) % SHAPES.length; build(); }));
            bodyEl.querySelectorAll('.fw-x').forEach(r => r.addEventListener('input', () => { mine[+r.dataset.i].x = +r.value; }));
            const rd = bodyEl.querySelector('#fw-ready'); if (rd && !ready) rd.addEventListener('click', () => { ready = true; if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); ctx.send({ t: 'shells', arr: mine }); build(); });
            const ln = bodyEl.querySelector('#fw-launch'); if (ln) ln.addEventListener('click', () => { ctx.send({ t: 'go' }); t0 = performance.now() + 3000; phase = 'count'; build(); });
        } else if (phase === 'after') bodyEl.innerHTML = '<button class="app-btn" id="fw-again">Design another show</button>';
        else bodyEl.innerHTML = '';
        const ag = bodyEl.querySelector('#fw-again'); if (ag) ag.addEventListener('click', () => { ctx.send({ t: 'reset' }); resetAll(); });
    };
    const resetAll = () => { mine = defShells(me); theirs = null; ready = false; phase = 'design'; parts = []; build(); };
    const loop = (t) => { const dt = Math.min(0.04, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'count' && performance.now() >= t0) { startShow(); t0 = performance.now(); }
        if (phase === 'count') { g.clearRect(0, 0, W, H); draw((performance.now()-t0)/1000); }
        if (phase === 'show') { const el = (performance.now()-t0)/1000; step(dt, el); draw(el); }
        raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'fireworks', label: 'Fireworks Finale', css: 'apps/fireworks.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="fw"><div class="app-bar"><span class="stat"></span></div><canvas id="fw-canvas" width="' + W + '" height="' + H + '"></canvas><div id="fw-body"></div><div class="fw-hint">design together, launch together — the same show plays on both screens</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#fw-body'); canvas = ctx.root.querySelector('#fw-canvas'); g = canvas.getContext('2d');
            resetAll(); lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (actx) { try { actx.close(); } catch (e) {} } ctx = statEl = bodyEl = canvas = g = actx = null; },
        onData(msg) {
            if (msg.t === 'shells') { theirs = msg.arr; build(); }
            else if (msg.t === 'go') { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); t0 = performance.now() + 3000; phase = 'count'; build(); }
            else if (msg.t === 'reset') resetAll();
        }
    });
})();
