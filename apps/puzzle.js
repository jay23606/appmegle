// Video Puzzle (2-player, progressively harder) for appmegle. Your partner's live camera is
// sliced into an NxN grid of tiles (drawn live each frame, so the pieces move) and scrambled;
// tap two tiles to swap and reassemble their face. Each ROUND both race the same scramble
// (shared seed from the caller); first to solve wins the round and the NEXT round is one size
// bigger (3x3 -> 4x4 -> ... up to 7x7). First to 5 round-wins takes the match. The caller is
// authoritative for level/seed/score and arbitrates each round. Caller = player 1.
(function () {
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const SZ = 480, WIN_ROUNDS = 5, gridFor = (lvl) => Math.min(2 + lvl, 7);

    let ctx = null, auth = false, role = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let N = 3, tileAt = [], sel = -1, phase = 'wait', level = 1, score = { a: 0, b: 0 }, lastWinner = null, betweenTimer = 0, vidL = null, vidR = null;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const rn = (p) => p === 'a' ? 'Blue' : 'Orange';
    const identity = (n) => [...Array(n*n).keys()];
    const shuffle = (n, seed) => { const rnd = mulberry32(seed >>> 0), a = identity(n); for (let i = a.length-1; i > 0; i--) { const j = (rnd()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } if (a.every((h, s) => h === s)) [a[0], a[1]] = [a[1], a[0]]; return a; };

    const status = () => {
        if (!statEl) return; const opp = other(role);
        if (phase === 'over') statEl.textContent = (lastWinner === role ? '🏆 You win the match!' : 'You lose the match') + ' ' + score[role] + '–' + score[opp];
        else if (phase === 'between') statEl.textContent = rn(lastWinner) + ' won round ' + level + '! · You ' + score[role] + '–' + score[opp] + ' · level ' + (level+1) + ' (' + gridFor(level+1) + '×' + gridFor(level+1) + ') next…';
        else if (phase === 'wait') statEl.textContent = 'Solved! waiting on the judge…';
        else statEl.textContent = 'Round ' + level + ' · ' + N + '×' + N + ' · You ' + score[role] + '–' + score[opp] + ' · ' + correct() + '/' + (N*N) + ' tap two tiles';
    };
    const correct = () => tileAt.reduce((n, h, s) => n + (h === s ? 1 : 0), 0);

    const startRound = () => {                         // caller only
        N = gridFor(level); const seed = (Math.random()*4294967296)>>>0; tileAt = shuffle(N, seed); sel = -1; phase = 'play';
        ctx.send({ t: 'round', n: N, seed, level, score }); status();
    };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); clearTimeout(betweenTimer); level = 1; score = { a: 0, b: 0 }; startRound(); };
    const awardRound = (w) => {                         // caller only
        if (phase !== 'play') return; score[w]++; lastWinner = w; tileAt = identity(N); sel = -1;
        if (score[w] >= WIN_ROUNDS) { phase = 'over'; ctx.send({ t: 'over', winner: w, score }); status(); return; }
        phase = 'between'; ctx.send({ t: 'between', winner: w, score, level }); status();
        betweenTimer = setTimeout(() => { level++; startRound(); }, 1700);
    };
    const onSolve = () => {
        if (phase !== 'play') return;
        if (auth) awardRound('a'); else { phase = 'wait'; tileAt = identity(N); ctx.send({ t: 'solved' }); status(); }
    };
    const swap = (s1, s2) => { [tileAt[s1], tileAt[s2]] = [tileAt[s2], tileAt[s1]]; if (tileAt.every((h, s) => h === s)) onSolve(); else status(); };
    const pick = (s) => { if (phase !== 'play') return; if (sel === -1) sel = s; else if (sel === s) sel = -1; else { swap(sel, s); sel = -1; } };

    const srcVideo = () => { if (vidR && vidR.videoWidth) return vidR; if (vidL && vidL.videoWidth) return vidL; return null; };   // partner's face first, fall back to own
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, SZ, SZ);
        const v = srcVideo(), tile = SZ / N;
        if (!v) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, SZ, SZ); g.fillStyle = '#fff'; g.font = '16px system-ui'; g.textAlign = 'center'; g.fillText('camera starting…', SZ/2, SZ/2); }
        else {
            const vs = Math.min(v.videoWidth, v.videoHeight), ox = (v.videoWidth - vs)/2, oy = (v.videoHeight - vs)/2, ts = vs / N, gap = (phase === 'between' || phase === 'over') ? 0 : 1;
            for (let s = 0; s < N*N; s++) {
                const home = tileAt[s], hc = home % N, hr = (home/N)|0, sc = s % N, sr = (s/N)|0;
                try { g.drawImage(v, ox + hc*ts, oy + hr*ts, ts, ts, sc*tile + gap, sr*tile + gap, tile - 2*gap, tile - 2*gap); } catch (e) {}
                if (gap && home === s) { g.strokeStyle = 'rgba(90,255,150,.5)'; g.lineWidth = 2; g.strokeRect(sc*tile + 1, sr*tile + 1, tile - 2, tile - 2); }
            }
            if (phase === 'play' && sel >= 0) { const sc = sel % N, sr = (sel/N)|0; g.strokeStyle = '#ffd24a'; g.lineWidth = 4; g.strokeRect(sc*tile + 2, sr*tile + 2, tile - 4, tile - 4); }
        }
        raf = requestAnimationFrame(draw);
    };

    window.Appmegle.register({
        id: 'puzzle', label: 'Video Puzzle', css: 'apps/puzzle.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b'; level = 1; score = { a: 0, b: 0 }; phase = 'wait';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="pz-canvas" width="' + SZ + '" height="' + SZ + '"></canvas></div>';
            canvas = ctx.root.querySelector('#pz-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vidL = document.getElementById('local-video'); vidR = document.getElementById('remote-video');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); const cx = ((e.clientX-r.left)/r.width*N)|0, cy = ((e.clientY-r.top)/r.height*N)|0; if (cx>=0&&cx<N&&cy>=0&&cy<N) pick(cy*N + cx); });
            if (auth) newGame(); else { N = 3; tileAt = identity(3); statEl.textContent = 'Waiting for the host…'; }
            raf = requestAnimationFrame(draw);
        },
        unmount() { cancelAnimationFrame(raf); clearTimeout(betweenTimer); ctx = canvas = g = statEl = vidL = vidR = null; tileAt = []; },
        onData(msg) {
            if (msg.t === 'round') { N = msg.n; tileAt = shuffle(msg.n, msg.seed); level = msg.level; score = msg.score; sel = -1; phase = 'play'; status(); }
            else if (msg.t === 'between') { score = msg.score; level = msg.level; lastWinner = msg.winner; tileAt = identity(N); phase = 'between'; status(); }
            else if (msg.t === 'over') { score = msg.score; lastWinner = msg.winner; tileAt = identity(N); phase = 'over'; status(); }
            else if (msg.t === 'solved' && auth) awardRound('b');
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
