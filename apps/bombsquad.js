// Bomb Squad (2-player co-op) for appmegle. Keep-Talking-style: the DEFUSER sees a ticking bomb
// with three modules (wires, button, keypad); the EXPERT sees only the defusal manual. Neither
// can act alone — describe, listen, and cut the right wire. 3 minutes, 3 strikes. The caller
// generates the bomb and runs the clock; the defuser's client validates actions locally with
// the same rule functions the manual describes. Defuser alternates each game.
(function () {
    const WCOL = ['red', 'blue', 'yellow', 'black', 'white'];
    const BCOL = ['red', 'blue', 'yellow', 'white'], BWORD = ['PRESS', 'HOLD', 'ABORT'];
    const COLS = [['Ω','✦','¶','Ψ','☆','©'], ['ƛ','ϗ','Ѭ','☆','¿','ж']];
    const STRIP = { blue: 4, yellow: 5, white: 1, red: 3 };
    const TIME = 180;
    let ctx = null, auth = false, me = 'a', defuser = 'b', spec = null, solved = [false, false, false], strikes = 0, left = TIME, lastSec = -1, phase = 'idle', outcome = null, statEl = null, bodyEl = null, raf = 0;
    let padSel = [], holdT = 0, strip = null;
    const correctWire = (ws) => {
        const idx = (c) => ws.map((w, i) => w === c ? i : -1).filter(i => i >= 0);
        if (ws.length === 3) { const r = idx('red'); return r.length ? r[r.length-1] : 1; }
        if (ws.length === 4) { const b = idx('blue'), y = idx('yellow'); return b.length === 1 ? b[0] : (y.length ? y[0] : ws.length-1); }
        const r = idx('red'); if (ws[ws.length-1] === 'black') return 2; return r.length > 1 ? r[0] : 3;
    };
    const mustHold = (b) => b.word === 'ABORT' || b.color === 'blue';
    const padOrder = (p) => COLS[p.col].filter(s => p.syms.includes(s));
    const genSpec = () => {
        const n = 3 + ((Math.random()*3)|0), wires = Array.from({ length: n }, () => WCOL[(Math.random()*WCOL.length)|0]);
        const btn = { color: BCOL[(Math.random()*BCOL.length)|0], word: BWORD[(Math.random()*BWORD.length)|0] };
        const col = (Math.random()*2)|0, syms = [...COLS[col]].sort(() => Math.random()-0.5).slice(0, 4);
        return { wires, btn, pad: { col, syms: [...syms].sort(() => Math.random()-0.5) } };
    };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); defuser = defuser === 'a' ? 'b' : 'a'; spec = genSpec(); solved = [false, false, false]; strikes = 0; left = TIME; lastSec = -1; phase = 'play'; outcome = null; padSel = []; strip = null; ctx.send({ t: 'spec', spec, defuser }); render(); };
    const strike = () => { strikes++; ctx.send({ t: 'strike', n: strikes }); if (strikes >= 3) end('boom'); else render(); };
    const solve = (i) => { solved[i] = true; ctx.send({ t: 'solve', i }); if (solved.every(Boolean)) end('defused'); else render(); };
    const end = (o) => { phase = 'over'; outcome = o; ctx.send({ t: 'end', o }); render(); };
    const render = () => {
        if (!bodyEl) return; const amDef = defuser === me;
        statEl.textContent = phase === 'over' ? (outcome === 'defused' ? '🎉 BOMB DEFUSED' : '💥 BOOM') : phase === 'play' ? '⏱ ' + Math.max(0, Math.ceil(left)) + 's · ✖ ' + strikes + '/3 · ' + solved.filter(Boolean).length + '/3 modules' : 'Bomb Squad';
        let h = '';
        if (phase === 'idle') h = '<div class="bs-msg">Waiting for the host…</div>';
        else if (phase === 'over') h = '<div class="bs-big">' + (outcome === 'defused' ? '🎉 DEFUSED!' : '💥 KABOOM') + '</div>' + (auth ? '<button class="app-btn" id="bs-new">New bomb (swap roles)</button>' : '');
        else if (amDef) {
            h = '<div class="bs-role">🧨 You\'re the DEFUSER — describe what you see!</div><div class="bs-mods">';
            h += '<div class="bs-mod' + (solved[0] ? ' bs-done' : '') + '"><div class="bs-mt">WIRES</div>' + spec.wires.map((w, i) => '<div class="bs-wire" data-i="' + i + '" style="background:' + w + ';color:' + (w === 'white' || w === 'yellow' ? '#333' : '#fff') + '">' + (i+1) + '</div>').join('') + '</div>';
            h += '<div class="bs-mod' + (solved[1] ? ' bs-done' : '') + '"><div class="bs-mt">BUTTON</div><button class="bs-btn" style="background:' + spec.btn.color + ';color:' + (spec.btn.color === 'white' || spec.btn.color === 'yellow' ? '#333' : '#fff') + '">' + spec.btn.word + '</button><div class="bs-stripbox"></div></div>';
            h += '<div class="bs-mod' + (solved[2] ? ' bs-done' : '') + '"><div class="bs-mt">KEYPAD</div><div class="bs-pad">' + spec.pad.syms.map(s => '<button class="bs-key' + (padSel.includes(s) ? ' bs-lit' : '') + '" data-s="' + s + '">' + s + '</button>').join('') + '</div></div>';
            h += '</div>';
        } else {
            h = '<div class="bs-role">📖 You\'re the EXPERT — read the manual out loud!</div><div class="bs-man">' +
                '<b>WIRES</b> · 3 wires: any red → cut the LAST red; no red → cut the 2nd.<br>4 wires: exactly one blue → cut it; else any yellow → cut the FIRST yellow; else cut the LAST wire.<br>5 wires: last wire black → cut the 3rd; else more than one red → cut the FIRST red; else cut the 4th.<hr>' +
                '<b>BUTTON</b> · Says ABORT, or is blue → HOLD it. Anything else → tap it once.<br>While held a strip lights: blue → release when the timer\'s seconds digit ends in 4 · yellow → 5 · white → 1 · red → 3.<hr>' +
                '<b>KEYPAD</b> · Find the column containing ALL FOUR symbols; press them in column order (top → bottom).<br>Column 1: ' + COLS[0].join('  ') + '<br>Column 2: ' + COLS[1].join('  ') + '</div>';
        }
        bodyEl.innerHTML = h;
        const nw = bodyEl.querySelector('#bs-new'); if (nw) nw.addEventListener('click', newGame);
        if (amDef && phase === 'play') {
            bodyEl.querySelectorAll('.bs-wire').forEach(w => w.addEventListener('click', () => { if (solved[0]) return; +w.dataset.i === correctWire(spec.wires) ? solve(0) : strike(); }));
            const bb = bodyEl.querySelector('.bs-btn'), sb = bodyEl.querySelector('.bs-stripbox');
            if (bb && !solved[1]) {
                bb.addEventListener('pointerdown', (e) => { bb.setPointerCapture(e.pointerId); holdT = performance.now(); if (mustHold(spec.btn)) { strip = BCOL[(Math.random()*BCOL.length)|0]; sb.innerHTML = '<div class="bs-strip" style="background:' + strip + '"></div><div class="bs-ms">strip is lit — release on the right second!</div>'; } });
                bb.addEventListener('pointerup', () => { const held = performance.now() - holdT; sb.innerHTML = '';
                    if (mustHold(spec.btn)) { const digit = STRIP[strip]; const s = Math.max(0, Math.ceil(left)) % 10; strip = null; (held > 400 && s === digit) ? solve(1) : strike(); }
                    else { held < 400 ? solve(1) : strike(); } });
            }
            bodyEl.querySelectorAll('.bs-key').forEach(k => k.addEventListener('click', () => { if (solved[2]) return; const s = k.dataset.s, order = padOrder(spec.pad);
                if (s === order[padSel.length]) { padSel.push(s); padSel.length === 4 ? solve(2) : render(); } else { padSel = []; strike(); } }));
        }
    };
    const status = () => { if (statEl) statEl.textContent = phase === 'over' ? (outcome === 'defused' ? '🎉 BOMB DEFUSED' : '💥 BOOM') : '⏱ ' + Math.max(0, Math.ceil(left)) + 's · ✖ ' + strikes + '/3 · ' + solved.filter(Boolean).length + '/3 modules'; };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; ctx.send({ t: 'tick', s }); status(); } if (left <= 0) end('boom'); } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'bombsquad', label: 'Bomb Squad', css: 'apps/bombsquad.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; defuser = 'b';
            ctx.root.innerHTML = '<div class="app-col" id="bs"><div class="app-bar"><span class="stat"></span>' + (auth ? '<button class="app-btn nb">New bomb</button>' : '') + '</div><div id="bs-body"></div><div class="bs-hint">one sees the bomb, one sees the manual — talk fast</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#bs-body');
            const nb = ctx.root.querySelector('.nb'); if (nb) nb.addEventListener('click', newGame);
            if (auth) newGame(); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'spec') { spec = msg.spec; defuser = msg.defuser; solved = [false, false, false]; strikes = 0; left = TIME; phase = 'play'; outcome = null; padSel = []; strip = null; render(); }
            else if (msg.t === 'tick') { left = msg.s; if (phase === 'play') status(); }
            else if (msg.t === 'strike') { strikes = msg.n; render(); }
            else if (msg.t === 'solve') { solved[msg.i] = true; render(); }
            else if (msg.t === 'end') { phase = 'over'; outcome = msg.o; render(); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
