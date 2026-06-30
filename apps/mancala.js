// Mancala / Kalah (2-player) for appmegle. Sow seeds counterclockwise; land your last seed in
// your store for an extra turn; land in an empty pit on your side to capture the opposite pit.
// Most seeds when one side empties wins. Turn-based move-exchange (both apply the same move).
// Caller = bottom (pits 0-5, store 6), answerer = top (pits 7-12, store 13).
(function () {
    let ctx = null, auth = false, me = 'a', board = [], turn = 'a', over = false, winner = null, statEl = null, boardEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const pitsOf = (p) => p === 'a' ? [0,1,2,3,4,5] : [7,8,9,10,11,12];
    const storeOf = (p) => p === 'a' ? 6 : 13, oppStoreOf = (p) => p === 'a' ? 13 : 6;
    const sideEmpty = (p) => pitsOf(p).every(i => board[i] === 0);
    const fresh = () => { board = [4,4,4,4,4,4,0, 4,4,4,4,4,4,0]; turn = 'a'; over = false; winner = null; };
    const apply = (pit) => {
        if (over || board[pit] === 0 || !pitsOf(turn).includes(pit)) return;
        const p = turn; let seeds = board[pit], i = pit; board[pit] = 0;
        while (seeds > 0) { i = (i + 1) % 14; if (i === oppStoreOf(p)) continue; board[i]++; seeds--; }
        let extra = false;
        if (i === storeOf(p)) extra = true;
        else if (pitsOf(p).includes(i) && board[i] === 1) { const opp = 12 - i; if (board[opp] > 0) { board[storeOf(p)] += board[opp] + 1; board[i] = 0; board[opp] = 0; } }
        if (sideEmpty('a') || sideEmpty('b')) { ['a','b'].forEach(q => { pitsOf(q).forEach(x => { board[storeOf(q)] += board[x]; board[x] = 0; }); }); over = true; winner = board[6] === board[13] ? 'tie' : board[6] > board[13] ? 'a' : 'b'; }
        else if (!extra) turn = other(p);
        render();
    };
    const play = (pit) => { if (over || turn !== me || !pitsOf(me).includes(pit) || board[pit] === 0) return; ctx.send({ t: 'move', pit }); apply(pit); };
    const newGame = (b) => { fresh(); if (b) ctx.send({ t: 'reset' }); render(); };

    const render = () => {
        if (!boardEl) return; const opp = other(me);
        statEl.textContent = over ? (winner === 'tie' ? 'Tie!' : winner === me ? '🏆 You win ' : 'You lose ') + board[storeOf(me)] + '–' + board[storeOf(opp)] : (turn === me ? 'Your turn' : 'Their turn') + ' · You ' + board[storeOf(me)] + ' Them ' + board[storeOf(opp)];
        const topPits = me === 'a' ? [12,11,10,9,8,7] : [5,4,3,2,1,0];
        const botPits = pitsOf(me);
        const pit = (i, clickable) => '<div class="mn-pit' + (clickable ? ' on' : '') + '" data-i="' + i + '"><span>' + board[i] + '</span></div>';
        boardEl.innerHTML =
            '<div class="mn-store">' + board[storeOf(opp)] + '<small>them</small></div>' +
            '<div class="mn-mid">' +
              '<div class="mn-row">' + topPits.map(i => pit(i, false)).join('') + '</div>' +
              '<div class="mn-row">' + botPits.map(i => pit(i, turn === me && !over && board[i] > 0)).join('') + '</div>' +
            '</div>' +
            '<div class="mn-store you">' + board[storeOf(me)] + '<small>you</small></div>';
        boardEl.querySelectorAll('.mn-pit.on').forEach(el => el.addEventListener('click', () => play(+el.dataset.i)));
    };
    window.Appmegle.register({
        id: 'mancala', label: 'Mancala', css: 'apps/mancala.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="mn-board"></div></div>';
            statEl = ctx.root.querySelector('.stat'); boardEl = ctx.root.querySelector('#mn-board');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            newGame(false);
        },
        unmount() { ctx = statEl = boardEl = null; board = []; },
        onData(msg) { if (msg.t === 'move') apply(msg.pit); else if (msg.t === 'reset') newGame(false); }
    });
})();
