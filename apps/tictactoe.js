// ===========================================================================
//  Tic-tac-toe app for appmegle.
//
//  Turn-based and deterministic, so both peers just exchange moves and stay in
//  lockstep (same pattern as chess). Caller (player 1) is X and moves first;
//  answerer is O. Marks are outlined so the live video shows through.
// ===========================================================================
(function () {
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

    let ctx = null, cells = Array(9).fill(''), turn = 'X', myMark = 'X', over = false;
    let boardEl = null, statEl = null;

    const winner = () => {
        for (const [a, b, c] of LINES)
            if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) return cells[a];
        return cells.every(Boolean) ? 'draw' : null;
    };

    const render = () => {
        for (let i = 0; i < 9; i++) {
            const el = boardEl.children[i];
            el.textContent = cells[i];
            el.className = 'ttt-cell' + (cells[i] ? ' ' + cells[i].toLowerCase() : '');
        }
        const w = winner();
        if (w === 'draw') statEl.textContent = 'Draw';
        else if (w) statEl.textContent = (w === myMark) ? 'You win!' : 'You lose';
        else statEl.textContent = (turn === myMark) ? ('Your turn (' + myMark + ')') : 'Their turn';
    };

    const apply = (i) => {                       // place current turn's mark in cell i
        if (over || cells[i]) return;
        cells[i] = turn;
        turn = (turn === 'X') ? 'O' : 'X';
        if (winner()) over = true;
        render();
    };

    const clickCell = (i) => {
        if (over || cells[i] || turn !== myMark) return;
        apply(i);
        ctx.send({ t: 'move', i });
    };

    const newGame = () => { cells = Array(9).fill(''); turn = 'X'; over = false; render(); };

    window.Appmegle.register({
        id: 'ttt',
        label: 'Tic-Tac-Toe',
        css: 'apps/tictactoe.css',
        mount(c) {
            ctx = c;
            myMark = ctx.amCaller ? 'X' : 'O';
            ctx.root.innerHTML =
                '<div id="ttt-ui">' +
                  '<div id="ttt-top"><span id="ttt-stat"></span><button id="ttt-new">New game</button></div>' +
                  '<div id="ttt-board"></div>' +
                '</div>';
            boardEl = ctx.root.querySelector('#ttt-board');
            statEl = ctx.root.querySelector('#ttt-stat');
            for (let i = 0; i < 9; i++) {
                const el = document.createElement('div');
                el.className = 'ttt-cell';
                el.addEventListener('click', () => clickCell(i));
                boardEl.appendChild(el);
            }
            ctx.root.querySelector('#ttt-new').addEventListener('click', () => { newGame(); ctx.send({ t: 'reset' }); });
            newGame();
        },
        unmount() { ctx = null; boardEl = null; statEl = null; },
        onData(msg) {
            if (msg.t === 'move') apply(msg.i);
            else if (msg.t === 'reset') newGame();
        }
    });
})();
