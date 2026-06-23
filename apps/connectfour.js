// Connect Four for appmegle. Turn-based, move-exchange sync. Caller = red, answerer = yellow.
(function () {
    const COLS = 7, ROWS = 6;
    let ctx = null, grid = [], turn = 'r', me = 'r', over = false, boardEl = null, statEl = null;

    const fresh = () => Array.from({ length: ROWS }, () => Array(COLS).fill(''));

    const winnerColor = () => {
        const dirs = [[0,1],[1,0],[1,1],[1,-1]];
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const v = grid[r][c]; if (!v) continue;
            for (const [dr, dc] of dirs) {
                let n = 1;
                while (n < 4) { const rr = r + dr*n, cc = c + dc*n; if (rr<0||rr>=ROWS||cc<0||cc>=COLS||grid[rr][cc]!==v) break; n++; }
                if (n === 4) return v;
            }
        }
        return grid[0].every(Boolean) ? 'draw' : null;
    };

    const render = () => {
        boardEl.innerHTML = '';
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'c4-cell' + (grid[r][c] ? ' ' + grid[r][c] : '');
            cell.addEventListener('click', () => drop(c, true));
            boardEl.appendChild(cell);
        }
        const w = winnerColor();
        statEl.textContent = w === 'draw' ? 'Draw'
            : w ? (w === me ? 'You win!' : 'You lose')
            : (turn === me ? 'Your turn' : 'Their turn');
    };

    const apply = (c) => {
        if (over) return;
        for (let r = ROWS - 1; r >= 0; r--) if (!grid[r][c]) { grid[r][c] = turn; break; }
        if (winnerColor()) over = true;
        turn = turn === 'r' ? 'y' : 'r';
        render();
    };

    const drop = (c, local) => {
        if (local && (over || turn !== me || grid[0][c])) return;
        if (!local && (over || grid[0][c])) return;
        if (local) ctx.send({ t: 'drop', c });
        apply(c);
    };

    const newGame = () => { grid = fresh(); turn = 'r'; over = false; render(); };

    window.Appmegle.register({
        id: 'connect4', label: 'Connect Four', css: 'apps/connectfour.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'r' : 'y';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><div id="c4-board"></div></div>';
            boardEl = ctx.root.querySelector('#c4-board');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => { newGame(); ctx.send({ t: 'reset' }); });
            newGame();
        },
        unmount() { ctx = boardEl = statEl = null; },
        onData(msg) { if (msg.t === 'drop') drop(msg.c, false); else if (msg.t === 'reset') newGame(); }
    });
})();
