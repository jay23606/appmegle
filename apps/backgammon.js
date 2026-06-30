// Backgammon (2-player) for appmegle. Full rules: roll two dice (doubles = four moves), move
// toward your home, hit lone blots to the bar (must re-enter first), bear off once all 15 are
// home; first to bear off all 15 wins. Caller-authoritative (it rolls + validates). Caller = A
// (white, moves 23->0, home 0-5), answerer = B (orange, moves 0->23, home 18-23).
(function () {
    const W = 660, H = 460, M = 18, BARW = 30, COLW = (W - 2*M - BARW)/12;
    let ctx = null, auth = false, me = 'a', pts = [], bar = { a: 0, b: 0 }, off = { a: 0, b: 0 }, turn = 'a', dice = [], phase = 'idle', winner = null, sel = null, view = null;
    let canvas = null, g = null, statEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a', sgn = (p) => p === 'a' ? 1 : -1, dir = (p) => p === 'a' ? -1 : 1;
    const fresh = () => { pts = Array(24).fill(0); pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5; pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5; bar = { a: 0, b: 0 }; off = { a: 0, b: 0 }; winner = null; };
    const allHome = (p) => { if (bar[p]) return false; if (p === 'a') { for (let i = 6; i < 24; i++) if (pts[i] > 0) return false; } else { for (let i = 0; i < 18; i++) if (pts[i] < 0) return false; } return true; };
    const destFor = (s, d, p) => {
        if (s === 'bar') { const idx = p === 'a' ? 24 - d : d - 1; const o = pts[idx]; return (p === 'a' ? o >= -1 : o <= 1) ? idx : null; }
        const nd = s + dir(p)*d;
        if (p === 'a' && nd < 0) { if (!allHome('a')) return null; if (nd === -1) return 'off'; for (let k = s+1; k <= 5; k++) if (pts[k] > 0) return null; return 'off'; }
        if (p === 'b' && nd > 23) { if (!allHome('b')) return null; if (nd === 24) return 'off'; for (let k = s-1; k >= 18; k--) if (pts[k] < 0) return null; return 'off'; }
        if (nd >= 0 && nd < 24) { const o = pts[nd]; return (p === 'a' ? o >= -1 : o <= 1) ? nd : null; }
        return null;
    };
    const destsFor = (s, p) => { const m = {}; [...new Set(dice)].forEach(d => { const dd = destFor(s, d, p); if (dd !== null) m[d] = dd; }); return m; };
    const sourcesWithMove = (p) => { if (bar[p] > 0) return Object.keys(destsFor('bar', p)).length ? ['bar'] : []; const out = []; for (let i = 0; i < 24; i++) if (pts[i]*sgn(p) > 0 && Object.keys(destsFor(i, p)).length) out.push(i); return out; };
    const applyMove = (s, d) => {
        const p = turn, dest = destFor(s, d, p); if (dest === null) return; const sn = sgn(p);
        if (s === 'bar') bar[p]--; else pts[s] -= sn;
        if (dest === 'off') off[p]++; else { if (p === 'a' && pts[dest] === -1) { pts[dest] = 0; bar.b++; } if (p === 'b' && pts[dest] === 1) { pts[dest] = 0; bar.a++; } pts[dest] += sn; }
        dice.splice(dice.indexOf(d), 1);
        if (off[p] === 15) { phase = 'over'; winner = p; sync(); return; }
        if (!dice.length || !sourcesWithMove(p).length) endTurn(); else sync();
    };
    const endTurn = () => { turn = other(turn); roll(); };
    const roll = () => { const d1 = 1+((Math.random()*6)|0), d2 = 1+((Math.random()*6)|0); dice = d1 === d2 ? [d1,d1,d1,d1] : [d1,d2]; phase = 'move'; if (!sourcesWithMove(turn).length) { if (phase !== 'over') { turn = other(turn); const e1 = 1+((Math.random()*6)|0), e2 = 1+((Math.random()*6)|0); dice = e1 === e2 ? [e1,e1,e1,e1] : [e1,e2]; } } sync(); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); fresh(); turn = 'a'; roll(); };
    const snap = () => ({ pts: [...pts], bar: { ...bar }, off: { ...off }, turn, dice: [...dice], phase, winner });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); render(); };

    const colX = (c) => M + c*COLW + (c >= 6 ? BARW : 0);
    const ptPos = (i) => i < 12 ? { x: colX(i) + COLW/2, base: H-M, dirY: -1 } : { x: colX(i-12) + COLW/2, base: M, dirY: 1 };
    const draw = () => {
        if (!g) return; const s = auth ? snap() : view; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(70,45,25,.5)'; g.fillRect(0, 0, W, H);
        if (!s) { statEl.textContent = 'Waiting…'; return; }
        for (let i = 0; i < 24; i++) { const pp = ptPos(i); g.fillStyle = i % 2 ? 'rgba(210,180,140,.4)' : 'rgba(120,80,50,.5)'; g.beginPath(); g.moveTo(pp.x - COLW*0.42, pp.base); g.lineTo(pp.x + COLW*0.42, pp.base); g.lineTo(pp.x, pp.base + pp.dirY*(H/2 - 30)); g.closePath(); g.fill(); }
        const myDests = sel != null ? destsFor(sel, me) : {};
        const destSet = new Set(Object.values(myDests));
        for (let i = 0; i < 24; i++) { const pp = ptPos(i), n = Math.abs(s.pts[i]); if (destSet.has(i)) { g.fillStyle = 'rgba(120,230,150,.4)'; g.beginPath(); g.moveTo(pp.x - COLW*0.42, pp.base); g.lineTo(pp.x + COLW*0.42, pp.base); g.lineTo(pp.x, pp.base + pp.dirY*(H/2 - 30)); g.closePath(); g.fill(); }
            for (let k = 0; k < n; k++) { const r = COLW*0.4, y = pp.base + pp.dirY*(r + k*(r*1.7)); g.fillStyle = s.pts[i] > 0 ? '#eee' : '#ff9d3d'; g.beginPath(); g.arc(pp.x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke(); if (k === 4 && n > 5) { g.fillStyle = '#222'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText(n, pp.x, y+4); break; } } }
        // bar
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(M + 6*COLW, M, BARW, H-2*M);
        for (let k = 0; k < s.bar.a; k++) { g.fillStyle = '#eee'; g.beginPath(); g.arc(M + 6*COLW + BARW/2, H/2 - 30 - k*16, COLW*0.34, 0, 7); g.fill(); }
        for (let k = 0; k < s.bar.b; k++) { g.fillStyle = '#ff9d3d'; g.beginPath(); g.arc(M + 6*COLW + BARW/2, H/2 + 30 + k*16, COLW*0.34, 0, 7); g.fill(); }
        // off + dice + bear-off button
        g.fillStyle = '#fff'; g.font = '13px system-ui'; g.textAlign = 'left'; g.fillText('Off — You: ' + s.off[me] + '  Them: ' + s.off[other(me)], 12, 16);
        g.textAlign = 'center'; if (s.dice.length) { g.fillText('🎲 ' + s.dice.join(' '), W/2, H/2 + 4); }
        if (sel != null && destSet.has('off')) { g.fillStyle = '#3a8'; g.fillRect(W-110, H-44, 96, 32); g.fillStyle = '#fff'; g.font = 'bold 14px system-ui'; g.fillText('BEAR OFF ▶', W-62, H-23); }
        if (sel != null) { const pp = sel === 'bar' ? { x: M+6*COLW+BARW/2, base: H/2 } : ptPos(sel); g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.beginPath(); g.arc(pp.x, pp.base + (sel < 12 ? -COLW*0.4 : COLW*0.4), COLW*0.45, 0, 7); g.stroke(); }
    };
    const status = () => { const s = auth ? snap() : view; if (!statEl || !s) return; statEl.textContent = s.phase === 'over' ? (s.winner === me ? '🏆 You win!' : 'You lose') : (s.turn === me ? 'Your roll: ' + s.dice.join(',') : 'Their turn') + ' · off ' + s.off[me] + '/15'; };
    const render = () => { draw(); status(); };
    const doMove = (s, d) => { if (auth) applyMove(s, d); else ctx.send({ t: 'mv', s, d }); };
    const onClick = (e) => {
        if (turn !== me || phase !== 'move') return; const r = canvas.getBoundingClientRect(), x = (e.clientX-r.left)/r.width*W, y = (e.clientY-r.top)/r.height*H;
        if (sel != null && destsFor(sel, me).off !== undefined && x > W-110 && y > H-44) { const d = +Object.keys(destsFor(sel, me)).find(k => destsFor(sel, me)[k] === 'off'); doMove(sel, d); sel = null; render(); return; }
        // which point?
        let col = -1; for (let c = 0; c < 12; c++) { if (x >= colX(c) && x < colX(c) + COLW) { col = c; break; } }
        let idx = col < 0 ? null : (y > H/2 ? col : 12 + col);
        if (x >= M+6*COLW && x < M+6*COLW+BARW) idx = 'bar';
        if (idx === null) { sel = null; render(); return; }
        if (sel == null) { if (bar[me] > 0) { sel = 'bar'; } else if (idx !== 'bar' && pts[idx]*sgn(me) > 0) sel = idx; render(); return; }
        const m = destsFor(sel, me); const d = +Object.keys(m).find(k => m[k] === idx);
        if (d) { doMove(sel, d); sel = null; } else { sel = (idx !== 'bar' && pts[idx]*sgn(me) > 0 && bar[me] === 0) ? idx : null; }
        render();
    };
    window.Appmegle.register({
        id: 'backgammon', label: 'Backgammon', css: 'apps/backgammon.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; sel = null; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="bg-canvas" width="' + W + '" height="' + H + '"></canvas></div>';
            canvas = ctx.root.querySelector('#bg-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            canvas.addEventListener('pointerdown', onClick);
            if (auth) newGame(); else render();
        },
        unmount() { ctx = canvas = g = statEl = null; pts = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) { view = msg.v; pts = msg.v.pts; bar = msg.v.bar; off = msg.v.off; turn = msg.v.turn; dice = msg.v.dice; phase = msg.v.phase; winner = msg.v.winner; render(); }
            else if (msg.t === 'mv' && auth) applyMove(msg.s, msg.d);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
