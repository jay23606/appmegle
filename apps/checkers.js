// Checkers (English draughts) for appmegle. Caller = red (bottom, moves first),
// answerer = black. Each hop is sent as a move; both sides run the same logic, so
// multi-jumps and turn-passing stay in lockstep. Captures are allowed but not forced.
(function () {
    const DIRS = {
        r: [[-1,-1],[-1,1]], b: [[1,-1],[1,1]],
        R: [[-1,-1],[-1,1],[1,-1],[1,1]], B: [[-1,-1],[-1,1],[1,-1],[1,1]]
    };
    let ctx = null, board = [], turn = 'r', me = 'r', sel = null, cont = null, boardEl = null, statEl = null;

    const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
    const own = (p) => p ? (p.toLowerCase() === 'r' ? 'r' : 'b') : '';

    const fresh = () => {
        const g = Array.from({ length: 8 }, () => Array(8).fill(''));
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) {
            if (r < 3) g[r][c] = 'b'; else if (r > 4) g[r][c] = 'r';
        }
        return g;
    };
    const movesFor = (r, c) => {
        const p = board[r][c]; if (!p) return { steps: [], jumps: [] };
        const mine = own(p), steps = [], jumps = [];
        for (const [dr, dc] of DIRS[p]) {
            const r1 = r + dr, c1 = c + dc;
            if (!inb(r1, c1)) continue;
            if (board[r1][c1] === '') steps.push([r1, c1]);
            else if (own(board[r1][c1]) !== mine) {
                const r2 = r + 2 * dr, c2 = c + 2 * dc;
                if (inb(r2, c2) && board[r2][c2] === '') jumps.push([r2, c2]);
            }
        }
        return { steps, jumps };
    };
    const anyMoves = (color) => {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
            if (own(board[r][c]) === color) { const m = movesFor(r, c); if (m.steps.length || m.jumps.length) return true; }
        return false;
    };

    const applyMove = (from, to) => {
        const [fr, fc] = from, [tr, tc] = to, p = board[fr][fc];
        if (!p) return;
        const dr = tr - fr, isJump = Math.abs(dr) === 2;
        board[fr][fc] = '';
        if (isJump) board[fr + dr / 2][fc + (tc - fc) / 2] = '';
        board[tr][tc] = p;
        let kinged = false;
        if (p === 'r' && tr === 0) { board[tr][tc] = 'R'; kinged = true; }
        if (p === 'b' && tr === 7) { board[tr][tc] = 'B'; kinged = true; }
        if (isJump && !kinged && movesFor(tr, tc).jumps.length) cont = [tr, tc];
        else { cont = null; turn = turn === 'r' ? 'b' : 'r'; }
        sel = (cont && turn === me) ? cont : null;
        render();
    };
    const doMove = (from, to) => { ctx.send({ t: 'move', from, to }); applyMove(from, to); };

    const onSq = (r, c) => {
        if (turn !== me) return;
        const p = board[r][c];
        if (cont) {
            const j = movesFor(sel[0], sel[1]).jumps.find(d => d[0] === r && d[1] === c);
            if (j) doMove(sel, [r, c]);
            return;
        }
        if (sel) {
            const m = movesFor(sel[0], sel[1]);
            if ([...m.steps, ...m.jumps].some(d => d[0] === r && d[1] === c)) return doMove(sel, [r, c]);
            sel = (p && own(p) === me) ? [r, c] : null; return render();
        }
        if (p && own(p) === me) { sel = [r, c]; render(); }
    };

    const render = () => {
        boardEl.innerHTML = '';
        const dests = sel ? (cont ? movesFor(sel[0], sel[1]).jumps : [...movesFor(sel[0], sel[1]).steps, ...movesFor(sel[0], sel[1]).jumps]) : [];
        for (let d = 0; d < 8; d++) for (let e = 0; e < 8; e++) {
            const r = me === 'r' ? d : 7 - d, c = me === 'r' ? e : 7 - e;
            const el = document.createElement('div');
            el.className = 'ck-sq ' + ((r + c) % 2 === 1 ? 'dark' : 'light');
            if (sel && sel[0] === r && sel[1] === c) el.classList.add('sel');
            if (dests.some(x => x[0] === r && x[1] === c)) el.classList.add('dest');
            const p = board[r][c];
            if (p) el.innerHTML = '<span class="ck-p ' + own(p) + (p === p.toUpperCase() ? ' king' : '') + '">' + (p === p.toUpperCase() ? '♚' : '') + '</span>';
            el.addEventListener('click', () => onSq(r, c));
            boardEl.appendChild(el);
        }
        if (!anyMoves('r') || !anyMoves('b')) statEl.textContent = (anyMoves(me) ? 'You win!' : 'You lose');
        else statEl.textContent = (turn === me ? 'Your move' : 'Their move') + (cont ? ' · keep jumping!' : '');
    };
    const newGame = () => { board = fresh(); turn = 'r'; sel = cont = null; render(); };

    window.Appmegle.register({
        id: 'checkers', label: 'Checkers', css: 'apps/checkers.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'r' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><div id="ck-board"></div></div>';
            boardEl = ctx.root.querySelector('#ck-board');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => { newGame(); ctx.send({ t: 'reset' }); });
            newGame();
        },
        unmount() { ctx = boardEl = statEl = null; sel = cont = null; },
        onData(msg) { if (msg.t === 'move') applyMove(msg.from, msg.to); else if (msg.t === 'reset') newGame(); }
    });
})();
