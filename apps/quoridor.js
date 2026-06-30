// Quoridor (2-player) for appmegle. Move your pawn toward the far row, or place a wall to slow
// your opponent — but you can never fully wall someone off (a path must always exist). 9x9
// board, 10 walls each. Turn-based move-exchange with local legality + BFS path validation.
// Caller = blue (starts bottom row 8, goal row 0), answerer = orange (starts top row 0, goal row 8).
(function () {
    const N = 9;
    let ctx = null, auth = false, me = 'a', pawns = null, hWall = null, vWall = null, wallsLeft = null, turn = 'a', over = false, winner = null;
    let mode = 'move', canvas = null, g = null, statEl = null, modeBtn = null, CELL = 44, GAP = 10, PAD = 14;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const key = (r, c) => r + ',' + c;
    const fresh = () => { pawns = { a: [8, 4], b: [0, 4] }; hWall = {}; vWall = {}; wallsLeft = { a: 10, b: 10 }; turn = 'a'; over = false; winner = null; mode = 'move'; };
    // movement blocked between (r,c) and (r2,c2)?
    const blocked = (r, c, r2, c2) => {
        if (r2 === r) { const cc = Math.min(c, c2); return !!vWall[key(r, cc)] || (r > 0 && !!vWall[key(r-1, cc)]); }     // horizontal move blocked by vertical wall
        const rr = Math.min(r, r2); return !!hWall[key(rr, c)] || (c > 0 && !!hWall[key(rr, c-1)]);                        // vertical move blocked by horizontal wall
    };
    const neighbors = (r, c) => { const out = []; for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nr = r+dr, nc = c+dc; if (nr>=0&&nr<N&&nc>=0&&nc<N && !blocked(r, c, nr, nc)) out.push([nr, nc]); } return out; };
    const hasPath = (p) => { const [sr, sc] = pawns[p], goal = p === 'a' ? 0 : N-1, seen = new Set([key(sr, sc)]), q = [[sr, sc]]; while (q.length) { const [r, c] = q.shift(); if (r === goal) return true; for (const [nr, nc] of neighbors(r, c)) { const k = key(nr, nc); if (!seen.has(k)) { seen.add(k); q.push([nr, nc]); } } } return false; };
    const legalMoves = (p) => {
        const [r, c] = pawns[p], opp = pawns[other(p)], out = [];
        for (const [nr, nc] of neighbors(r, c)) {
            if (nr === opp[0] && nc === opp[1]) { const jr = nr+(nr-r), jc = nc+(nc-c); if (jr>=0&&jr<N&&jc>=0&&jc<N && !blocked(nr, nc, jr, jc)) out.push([jr, jc]); else { for (const [er, ec] of neighbors(nr, nc)) if (!(er === r && ec === c)) out.push([er, ec]); } }
            else out.push([nr, nc]);
        }
        return out;
    };

    const applyMove = (r, c) => { pawns[turn] = [r, c]; if ((turn === 'a' && r === 0) || (turn === 'b' && r === N-1)) { over = true; winner = turn; } else turn = other(turn); draw(); status(); };
    const applyWall = (o, r, c) => { (o === 'h' ? hWall : vWall)[key(r, c)] = turn; wallsLeft[turn]--; turn = other(turn); draw(); status(); };
    const wallLegal = (o, r, c) => {
        if (r < 0 || r >= N-1 || c < 0 || c >= N-1) return false;
        const W = o === 'h' ? hWall : vWall, X = o === 'h' ? vWall : hWall;
        if (W[key(r, c)] || (o === 'h' ? (W[key(r, c-1)] || W[key(r, c+1)]) : (W[key(r-1, c)] || W[key(r+1, c)]))) return false;   // overlap/extend collision
        if (X[key(r, c)]) return false;                                                                                            // crossing
        (o === 'h' ? hWall : vWall)[key(r, c)] = turn; const ok = hasPath('a') && hasPath('b'); delete (o === 'h' ? hWall : vWall)[key(r, c)];
        return ok;
    };
    const tryMove = (r, c) => { if (over || turn !== me || mode !== 'move') return; if (!legalMoves(me).some(m => m[0] === r && m[1] === c)) return; ctx.send({ t: 'move', r, c }); applyMove(r, c); };
    const tryWall = (o, r, c) => { if (over || turn !== me || mode !== 'wall' || wallsLeft[me] <= 0 || !wallLegal(o, r, c)) return; ctx.send({ t: 'wall', o, r, c }); applyWall(o, r, c); };
    const newGame = (b) => { fresh(); if (b) ctx.send({ t: 'reset' }); draw(); status(); if (modeBtn) modeBtn.textContent = 'Mode: Move'; };

    const cx = (c) => PAD + c*(CELL+GAP), cyf = (r) => PAD + r*(CELL+GAP);
    const draw = () => {
        if (!g) return; const SZ = PAD*2 + N*CELL + (N-1)*GAP; g.clearRect(0, 0, SZ, SZ); g.fillStyle = 'rgba(20,30,55,.35)'; g.fillRect(0, 0, SZ, SZ);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(cx(c), cyf(r), CELL, CELL); }
        if (turn === me && mode === 'move' && !over) { g.fillStyle = 'rgba(120,230,150,.35)'; legalMoves(me).forEach(([r, c]) => g.fillRect(cx(c), cyf(r), CELL, CELL)); }
        for (const k in hWall) { const [r, c] = k.split(',').map(Number); g.fillStyle = hWall[k] === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(cx(c), cyf(r)+CELL+1, CELL*2+GAP, GAP-2); }
        for (const k in vWall) { const [r, c] = k.split(',').map(Number); g.fillStyle = vWall[k] === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(cx(c)+CELL+1, cyf(r), GAP-2, CELL*2+GAP); }
        ['a','b'].forEach(p => { const [r, c] = pawns[p]; g.fillStyle = p === 'a' ? '#5db4ff' : '#ff9d3d'; g.beginPath(); g.arc(cx(c)+CELL/2, cyf(r)+CELL/2, CELL*0.36, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillText(p === me ? 'YOU' : '', cx(c)+CELL/2, cyf(r)+CELL/2+4); });
    };
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === me ? '🏆 You win!' : 'You lose') : (turn === me ? 'Your turn' : 'Their turn') + ' · walls: you ' + wallsLeft[me] + ' them ' + wallsLeft[other(me)]; };
    const onClick = (e) => {
        const r0 = canvas.getBoundingClientRect(), SZ = PAD*2 + N*CELL + (N-1)*GAP, px = (e.clientX-r0.left)/r0.width*SZ, py = (e.clientY-r0.top)/r0.height*SZ;
        const colF = (px-PAD)/(CELL+GAP), rowF = (py-PAD)/(CELL+GAP), c = Math.floor(colF), r = Math.floor(rowF);
        if (c < 0 || r < 0 || c >= N || r >= N) return;
        if (mode === 'move') return tryMove(r, c);
        if (1 - (rowF - r) < 1 - (colF - c)) tryWall('h', r, Math.min(c, N-2));   // closer to bottom edge → horizontal wall
        else tryWall('v', Math.min(r, N-2), c);                                    // closer to right edge → vertical wall
    };
    window.Appmegle.register({
        id: 'quoridor', label: 'Quoridor', css: 'apps/quoridor.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            const SZ = PAD*2 + N*CELL + (N-1)*GAP;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn" id="qd-mode">Mode: Move</button><button class="app-btn nb">New game</button></div><canvas id="qd-canvas" width="' + SZ + '" height="' + SZ + '"></canvas><div class="qd-hint">Move mode: tap a green cell · Wall mode: tap a gap between cells (right/bottom edge = vertical/horizontal)</div></div>';
            canvas = ctx.root.querySelector('#qd-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat'); modeBtn = ctx.root.querySelector('#qd-mode');
            modeBtn.addEventListener('click', () => { mode = mode === 'move' ? 'wall' : 'move'; modeBtn.textContent = 'Mode: ' + (mode === 'move' ? 'Move' : 'Wall'); draw(); });
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            canvas.addEventListener('pointerdown', onClick);
            newGame(false);
        },
        unmount() { ctx = canvas = g = statEl = modeBtn = null; },
        onData(msg) { if (msg.t === 'move') applyMove(msg.r, msg.c); else if (msg.t === 'wall') applyWall(msg.o, msg.r, msg.c); else if (msg.t === 'reset') newGame(false); }
    });
})();
