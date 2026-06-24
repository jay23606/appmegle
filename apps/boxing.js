// Boxing (2-player, Punch-Out style) for appmegle. Authoritative caller simulates both
// fighters and resolves hits; each player sends inputs (punch / block-hold / dodge L/R).
// Punches have a windup so the defender can react: dodge in time = whiff + counter buff,
// block = chip damage, otherwise full hit + stun. Stamina gates punching. KO to win.
// Caller = blue (left), answerer = orange (right).
(function () {
    const W = 560, H = 360, WIND = 0.18, REC = 0.28, DODGE = 0.34, IFRAME = 0.20, STUN = 0.45;
    const PCOST = 18, BASE = 12, CHIP = 4, CMULT = 1.6, REGEN = 24, BDRAIN = 14;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let F = null, over = false, winner = null, view = null, lastT = 0, lastSend = 0, onKey = null;

    const mk = () => ({ hp: 100, stam: 100, st: 'idle', t: 0, dir: 1, blockHeld: false, counter: 0, ct: 0 });
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); F = { a: mk(), b: mk() }; over = false; winner = null; sync(); };
    const other = (p) => p === 'a' ? 'b' : 'a';

    const applyInput = (p, a) => {
        const f = F[p]; if (over || f.st === 'stun') return;
        if (a === 'punch') { if ((f.st === 'idle' || f.st === 'block') && f.stam >= PCOST) { f.st = 'wind'; f.t = WIND; f.stam -= PCOST; } }
        else if (a === 'blockon') { f.blockHeld = true; if (f.st === 'idle') f.st = 'block'; }
        else if (a === 'blockoff') { f.blockHeld = false; if (f.st === 'block') f.st = 'idle'; }
        else if (a === 'dodgeL' || a === 'dodgeR') { if (f.st === 'idle' || f.st === 'block') { f.st = 'dodge'; f.t = DODGE; f.dir = a === 'dodgeL' ? -1 : 1; } }
    };
    const resolveHit = (att) => {
        const d = other(att), def = F[d];
        if (def.st === 'dodge' && def.t > DODGE - IFRAME) { def.counter = 1; def.ct = 1.0; }     // whiffed → defender gets counter
        else if (def.st === 'block') { def.hp -= CHIP; def.stam = Math.max(0, def.stam - 3); }
        else { def.hp -= BASE * (F[att].counter ? CMULT : 1); def.st = 'stun'; def.t = STUN; }
        F[att].counter = 0;
        if (def.hp <= 0) { def.hp = 0; over = true; winner = att; }
    };
    const endState = (p) => { const f = F[p]; f.st = f.blockHeld ? 'block' : 'idle'; };
    const sim = (dt) => {
        for (const p of ['a', 'b']) {
            const f = F[p];
            if (f.ct > 0) { f.ct -= dt; if (f.ct <= 0) f.counter = 0; }
            if (['wind', 'recover', 'dodge', 'stun'].includes(f.st)) {
                f.t -= dt;
                if (f.t <= 0) { if (f.st === 'wind') { resolveHit(p); f.st = 'recover'; f.t = REC; } else endState(p); }
            }
            if (f.st === 'block') f.stam = Math.max(0, f.stam - BDRAIN * dt);
            else if (f.st === 'idle') f.stam = Math.min(100, f.stam + REGEN * dt);
        }
    };

    const snap = () => ({ a: { ...F.a }, b: { ...F.b }, over, winner });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); };

    const bar = (x, y, w, frac, col) => { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, w, 10); g.fillStyle = col; g.fillRect(x, y, w * Math.max(0, frac), 10); };
    const boxer = (cx, face, col, f) => {
        const lean = f.st === 'dodge' ? f.dir * 26 : 0, x = cx + lean, punching = f.st === 'wind' || f.st === 'recover', guard = f.st === 'block';
        g.save(); g.translate(x, 300); if (f.st === 'stun') g.rotate(0.2 * face);
        g.fillStyle = col; g.beginPath(); g.roundRect(-22, -92, 44, 82, 12); g.fill();
        g.fillStyle = '#f0c39a'; g.beginPath(); g.arc(0, -106, 16, 0, 7); g.fill();
        g.fillStyle = col;
        const lx = face * (punching ? 46 : guard ? 12 : 20), ly = punching ? -74 : guard ? -98 : -72;
        g.beginPath(); g.arc(lx, ly, 12, 0, 7); g.fill();
        g.beginPath(); g.arc(-face * (guard ? 10 : 14), guard ? -98 : -86, 11, 0, 7); g.fill();
        g.restore();
        if (f.st === 'stun') { g.fillStyle = '#ff0'; g.font = '16px system-ui'; g.textAlign = 'center'; g.fillText('✦', x - 14, 178); g.fillText('✦', x + 14, 184); }
    };
    const render = () => {
        const v = view; if (!v) { statEl.textContent = 'Waiting…'; return; }
        g.clearRect(0, 0, W, H);
        g.fillStyle = 'rgba(120,80,40,.35)'; g.fillRect(0, 300, W, 60);
        const myF = v[me], opF = v[me === 'a' ? 'b' : 'a'];
        boxer(160, 1, '#5db4ff', v.a);
        boxer(400, -1, '#ff9d3d', v.b);
        // bars: left = caller(a), right = answerer(b)
        bar(16, 16, 240, v.a.hp / 100, '#5db4ff'); bar(16, 30, 240, v.a.stam / 100, '#9fd3ef');
        bar(W - 256, 16, 240, v.b.hp / 100, '#ff9d3d'); bar(W - 256, 30, 240, v.b.stam / 100, '#ffd7a8');
        g.fillStyle = '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'left';
        g.fillText('Blue', 16, 54); g.textAlign = 'right'; g.fillText('Orange', W - 16, 54);
        if (v.over) { g.textAlign = 'center'; g.font = 'bold 32px system-ui'; g.fillStyle = '#fff'; g.fillText(v.winner === me ? 'KO! You win 🥊' : 'KO! You lose', W / 2, 150); }
        statEl.textContent = v.over ? 'Game over' : 'You are ' + (me === 'a' ? 'Blue (left)' : 'Orange (right)');
    };

    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
        if (auth && !over) { sim(dt); if (t - lastSend > 33) { lastSend = t; view = snap(); ctx.send({ t: 's', v: view }); } else view = snap(); }
        render(); raf = requestAnimationFrame(loop);
    };
    const act = (a) => { if (auth) applyInput('a', a); else ctx.send({ t: 'in', a }); };

    window.Appmegle.register({
        id: 'boxing', label: 'Boxing', css: 'apps/boxing.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<canvas id="bx-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                '<div id="bx-pad"><button data-a="dodgeL">⟵ Dodge</button><button data-a="block">🛡 Block</button><button data-a="punch">🥊 Punch</button><button data-a="dodgeR">Dodge ⟶</button></div></div>';
            canvas = ctx.root.querySelector('#bx-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            onKey = (e) => {
                const down = e.type === 'keydown';
                if (e.code === 'Space' || e.code === 'KeyJ') { if (down && !e.repeat) act('punch'); }
                else if (e.code === 'KeyK' || e.code === 'ShiftLeft') { act(down ? 'blockon' : 'blockoff'); }
                else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (down && !e.repeat) act('dodgeL'); }
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (down && !e.repeat) act('dodgeR'); }
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#bx-pad button').forEach(b => {
                const a = b.dataset.a;
                if (a === 'block') { b.addEventListener('pointerdown', e => { e.preventDefault(); act('blockon'); }); b.addEventListener('pointerup', () => act('blockoff')); b.addEventListener('pointerleave', () => act('blockoff')); }
                else b.addEventListener('pointerdown', e => { e.preventDefault(); act(a); });
            });
            if (auth) newGame(); else render();
            lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); ctx = canvas = g = statEl = null; view = null; },
        onData(msg) {
            if (!auth) { if (msg.t === 's') { view = msg.v; } return; }
            if (msg.t === 'in') applyInput('b', msg.a);
            else if (msg.t === 'newreq') newGame();
        }
    });
})();
