// Video Puzzle (2-player race) for appmegle. Your live camera feed is sliced into an NxN
// grid of tiles and scrambled — click/tap two tiles to swap them and reassemble your face.
// The tiles are drawn live from the video each frame, so the pieces move. Each player solves
// their OWN camera (always available), but the caller picks the grid size + a shared scramble
// seed so both start equally jumbled. First to solve wins (caller arbitrates). Caller = player 1.
(function () {
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const SZ = 480;

    let ctx = null, auth = false, role = 'a', raf = 0, canvas = null, g = null, statEl = null, sizeSel = null;
    let N = 4, tileAt = [], sel = -1, over = false, winner = null, oppC = 0, vidL = null, vidR = null;

    const correct = () => tileAt.reduce((n, h, s) => n + (h === s ? 1 : 0), 0);
    const shuffle = (n, seed) => {
        const rnd = mulberry32(seed >>> 0), a = [...Array(n*n).keys()];
        for (let i = a.length-1; i > 0; i--) { const j = (rnd()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; }
        if (a.every((h, s) => h === s)) [a[0], a[1]] = [a[1], a[0]];
        return a;
    };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); const n = sizeSel ? +sizeSel.value : N; const seed = (Math.random()*4294967296)>>>0; start(n, seed); ctx.send({ t: 'new', n, seed }); };
    const start = (n, seed) => { N = n; tileAt = shuffle(n, seed); sel = -1; over = false; winner = null; oppC = 0; status(); };

    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === role ? '🏆 You solved it first!' : 'You lose — they solved it') : 'You ' + correct() + '/' + (N*N) + ' · Them ' + oppC + ' · tap two tiles to swap'; };
    const onSolve = () => { if (over) return; if (auth) setResult('a'); else { statEl.textContent = 'Solved! waiting on the judge…'; ctx.send({ t: 'finish' }); over = true; } };
    const setResult = (w) => { winner = w; over = true; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { over = true; winner = w; status(); };

    const swap = (s1, s2) => { [tileAt[s1], tileAt[s2]] = [tileAt[s2], tileAt[s1]]; ctx.send({ t: 'prog', c: correct() }); if (tileAt.every((h, s) => h === s)) onSolve(); else status(); };
    const pick = (s) => { if (over) return; if (sel === -1) { sel = s; } else if (sel === s) { sel = -1; } else { swap(sel, s); sel = -1; } };

    const srcVideo = () => { if (vidL && vidL.videoWidth) return vidL; if (vidR && vidR.videoWidth) return vidR; return null; };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, SZ, SZ);
        const v = srcVideo(), tile = SZ / N;
        if (!v) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, SZ, SZ); g.fillStyle = '#fff'; g.font = '16px system-ui'; g.textAlign = 'center'; g.fillText('camera starting…', SZ/2, SZ/2); }
        else {
            const vs = Math.min(v.videoWidth, v.videoHeight), ox = (v.videoWidth - vs)/2, oy = (v.videoHeight - vs)/2, ts = vs / N;
            for (let s = 0; s < N*N; s++) {
                const home = tileAt[s], hc = home % N, hr = (home/N)|0, sc = s % N, sr = (s/N)|0;
                try { g.drawImage(v, ox + hc*ts, oy + hr*ts, ts, ts, sc*tile + 1, sr*tile + 1, tile - 2, tile - 2); } catch (e) {}
                if (home === s) { g.strokeStyle = 'rgba(90,255,150,.5)'; g.lineWidth = 2; g.strokeRect(sc*tile + 1, sr*tile + 1, tile - 2, tile - 2); }
            }
            if (sel >= 0) { const sc = sel % N, sr = (sel/N)|0; g.strokeStyle = '#ffd24a'; g.lineWidth = 4; g.strokeRect(sc*tile + 2, sr*tile + 2, tile - 4, tile - 4); }
        }
        raf = requestAnimationFrame(draw);
    };

    window.Appmegle.register({
        id: 'puzzle', label: 'Video Puzzle', css: 'apps/puzzle.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                (auth ? '<select id="pz-size"><option value="3">3×3</option><option value="4" selected>4×4</option><option value="5">5×5</option></select>' : '') +
                '<button class="app-btn nb">New game</button></div><canvas id="pz-canvas" width="' + SZ + '" height="' + SZ + '"></canvas></div>';
            canvas = ctx.root.querySelector('#pz-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat'); sizeSel = ctx.root.querySelector('#pz-size');
            vidL = document.getElementById('local-video'); vidR = document.getElementById('remote-video');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); const cx = ((e.clientX-r.left)/r.width*N)|0, cy = ((e.clientY-r.top)/r.height*N)|0; if (cx>=0&&cx<N&&cy>=0&&cy<N) pick(cy*N + cx); });
            if (auth) newGame(); else { tileAt = [...Array(N*N).keys()]; statEl.textContent = 'Waiting for the host…'; }
            raf = requestAnimationFrame(draw);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = sizeSel = vidL = vidR = null; tileAt = []; },
        onData(msg) {
            if (msg.t === 'new') start(msg.n, msg.seed);
            else if (msg.t === 'prog') { oppC = msg.c; if (!over) status(); }
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
