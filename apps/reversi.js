// Reversi / Othello for appmegle. Turn-based. Caller = black (moves first), answerer = white.
(function () {
    const N = 8, DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    let ctx = null, b = [], turn = 'b', me = 'b', boardEl = null, statEl = null;

    const fresh = () => {
        const g = Array.from({ length: N }, () => Array(N).fill(''));
        g[3][3] = g[4][4] = 'w'; g[3][4] = g[4][3] = 'b';
        return g;
    };
    const opp = (c) => c === 'b' ? 'w' : 'b';

    const flips = (r, c, color) => {              // squares that would flip if color plays (r,c)
        if (b[r][c]) return [];
        const out = [];
        for (const [dr, dc] of DIRS) {
            const line = []; let rr = r + dr, cc = c + dc;
            while (rr>=0 && rr<N && cc>=0 && cc<N && b[rr][cc] === opp(color)) { line.push([rr, cc]); rr += dr; cc += dc; }
            if (line.length && rr>=0 && rr<N && cc>=0 && cc<N && b[rr][cc] === color) out.push(...line);
        }
        return out;
    };
    const legal = (color) => {
        const m = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (flips(r, c, color).length) m.push([r, c]);
        return m;
    };
    const count = (color) => b.flat().filter(x => x === color).length;

    const render = () => {
        const mine = turn === me, moves = legal(turn);
        boardEl.innerHTML = '';
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            const el = document.createElement('div');
            el.className = 'rv-sq';
            if (b[r][c]) el.innerHTML = '<span class="rv-d ' + b[r][c] + '"></span>';
            else if (mine && flips(r, c, turn).length) el.classList.add('hint');
            el.addEventListener('click', () => play(r, c, true));
            boardEl.appendChild(el);
        }
        const bC = count('b'), wC = count('w'), myC = me === 'b' ? bC : wC, opC = me === 'b' ? wC : bC;
        const bMoves = legal('b').length, wMoves = legal('w').length;
        if (!bMoves && !wMoves) statEl.textContent = (myC > opC ? 'You win ' : myC < opC ? 'You lose ' : 'Tie ') + myC + '–' + opC;
        else statEl.textContent = 'You ' + myC + ' – ' + opC + ' · ' + (turn === me ? 'your move' : 'their move');
    };

    const apply = (r, c) => {
        const f = flips(r, c, turn);
        if (!f.length) return;
        b[r][c] = turn; f.forEach(([rr, cc]) => b[rr][cc] = turn);
        const next = opp(turn);
        turn = legal(next).length ? next : (legal(turn).length ? turn : next);  // skip a player with no move
        render();
    };
    const play = (r, c, local) => {
        if (local && (turn !== me || !flips(r, c, turn).length)) return;
        if (local) ctx.send({ t: 'move', r, c });
        apply(r, c);
    };
    const newGame = () => { b = fresh(); turn = 'b'; render(); };

    window.Appmegle.register({
        id: 'reversi', label: 'Reversi', css: 'apps/reversi.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'b' : 'w';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><div id="rv-board"></div></div>';
            boardEl = ctx.root.querySelector('#rv-board');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => { newGame(); ctx.send({ t: 'reset' }); });
            newGame();
        },
        unmount() { ctx = boardEl = statEl = null; },
        onData(msg) { if (msg.t === 'move') play(msg.r, msg.c, false); else if (msg.t === 'reset') newGame(); }
    });
})();
