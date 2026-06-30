// Gomoku / Five-in-a-row (2-player) for appmegle. Place stones on a 15x15 board; first to get
// five in a row (any direction) wins. Turn-based move-exchange (both clients apply the same
// moves). Caller = black (moves first), answerer = white.
(function () {
    const N = 15, CELL = 26, M = 18, SZ = M*2 + (N-1)*CELL;
    let ctx = null, auth = false, me = 'a', board = [], turn = 'a', over = false, winner = null, lastMove = -1;
    let canvas = null, g = null, statEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const wins = (i, p) => {
        const x = i % N, y = (i/N)|0;
        for (const [dx, dy] of [[1,0],[0,1],[1,1],[1,-1]]) { let c = 1; for (const s of [1,-1]) { let nx = x+dx*s, ny = y+dy*s; while (nx>=0&&nx<N&&ny>=0&&ny<N&&board[ny*N+nx] === p) { c++; nx += dx*s; ny += dy*s; } } if (c >= 5) return true; }
        return false;
    };
    const apply = (i) => { if (over || board[i]) return; board[i] = turn; lastMove = i; if (wins(i, turn)) { over = true; winner = turn; } else if (board.every(c => c)) over = true; turn = other(turn); draw(); status(); };
    const place = (i) => { if (over || turn !== me || board[i]) return; ctx.send({ t: 'move', i }); apply(i); };
    const newGame = (bcast) => { board = Array(N*N).fill(''); turn = 'a'; over = false; winner = null; lastMove = -1; if (bcast) ctx.send({ t: 'reset' }); draw(); status(); };
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner ? (winner === me ? '🏆 You win!' : 'You lose') : 'Draw') : (turn === me ? 'Your move (' + (me === 'a' ? 'black' : 'white') + ')' : 'Their move'); };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, SZ, SZ); g.fillStyle = 'rgba(150,110,60,.4)'; g.fillRect(0, 0, SZ, SZ);
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1;
        for (let k = 0; k < N; k++) { g.beginPath(); g.moveTo(M, M+k*CELL); g.lineTo(SZ-M, M+k*CELL); g.stroke(); g.beginPath(); g.moveTo(M+k*CELL, M); g.lineTo(M+k*CELL, SZ-M); g.stroke(); }
        for (let i = 0; i < N*N; i++) if (board[i]) { const x = M+(i%N)*CELL, y = M+((i/N)|0)*CELL; g.fillStyle = board[i] === 'a' ? '#1a1a1a' : '#f4f4f4'; g.beginPath(); g.arc(x, y, CELL*0.42, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke(); if (i === lastMove) { g.strokeStyle = '#ff5252'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, CELL*0.5, 0, 7); g.stroke(); } }
    };
    window.Appmegle.register({
        id: 'gomoku', label: 'Gomoku', css: 'apps/gomoku.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="gm-canvas" width="' + SZ + '" height="' + SZ + '"></canvas></div>';
            canvas = ctx.root.querySelector('#gm-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); const x = Math.round(((e.clientX-r.left)/r.width*SZ - M)/CELL), y = Math.round(((e.clientY-r.top)/r.height*SZ - M)/CELL); if (x>=0&&x<N&&y>=0&&y<N) place(y*N+x); });
            newGame(false);
        },
        unmount() { ctx = canvas = g = statEl = null; board = []; },
        onData(msg) { if (msg.t === 'move') apply(msg.i); else if (msg.t === 'reset') newGame(false); }
    });
})();
