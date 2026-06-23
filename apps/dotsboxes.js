// Dots and Boxes for appmegle. Turn-based. Completing a box scores and grants another turn.
// Caller = player A, answerer = player B.
(function () {
    const R = 5, C = 5;                 // boxes
    let ctx = null, h = [], v = [], box = [], turn = 'a', me = 'a', boardEl = null, statEl = null;

    const fresh = () => {
        h = Array.from({ length: R + 1 }, () => Array(C).fill(false));   // horizontal edges
        v = Array.from({ length: R }, () => Array(C + 1).fill(false));   // vertical edges
        box = Array.from({ length: R }, () => Array(C).fill(''));
        turn = 'a';
    };
    const boxDone = (r, c) => h[r][c] && h[r + 1][c] && v[r][c] && v[r][c + 1];

    const counts = () => {
        let a = 0, bb = 0; box.forEach(row => row.forEach(o => { if (o === 'a') a++; else if (o === 'b') bb++; }));
        return [a, bb];
    };
    const filled = () => h.flat().every(Boolean) && v.flat().every(Boolean);

    const render = () => {
        boardEl.innerHTML = '';
        for (let i = 0; i <= 2 * R; i++) for (let j = 0; j <= 2 * C; j++) {
            const el = document.createElement('div');
            if (i % 2 === 0 && j % 2 === 0) el.className = 'dab-dot';
            else if (i % 2 === 0) { const r = i / 2, c = (j - 1) / 2; el.className = 'dab-h' + (h[r][c] ? ' on' : ''); el.addEventListener('click', () => edge('h', r, c, true)); }
            else if (j % 2 === 0) { const r = (i - 1) / 2, c = j / 2; el.className = 'dab-v' + (v[r][c] ? ' on' : ''); el.addEventListener('click', () => edge('v', r, c, true)); }
            else { const r = (i - 1) / 2, c = (j - 1) / 2; el.className = 'dab-box' + (box[r][c] ? ' ' + box[r][c] : ''); el.textContent = box[r][c] ? (box[r][c] === me ? 'You' : '·') : ''; }
            boardEl.appendChild(el);
        }
        const [a, bb] = counts(), mine = me === 'a' ? a : bb, opp = me === 'a' ? bb : a;
        if (filled()) statEl.textContent = (mine > opp ? 'You win ' : mine < opp ? 'You lose ' : 'Tie ') + mine + '–' + opp;
        else statEl.textContent = 'You ' + mine + ' – ' + opp + ' · ' + (turn === me ? 'your turn' : 'their turn');
    };

    const apply = (kind, r, c) => {
        const arr = kind === 'h' ? h : v;
        if (arr[r][c]) return;
        arr[r][c] = true;
        let scored = false;
        const adj = kind === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
        for (const [br, bc] of adj)
            if (br >= 0 && br < R && bc >= 0 && bc < C && boxDone(br, bc) && !box[br][bc]) { box[br][bc] = turn; scored = true; }
        if (!scored) turn = turn === 'a' ? 'b' : 'a';   // no box → turn passes
        render();
    };
    const edge = (kind, r, c, local) => {
        const arr = kind === 'h' ? h : v;
        if (arr[r][c]) return;
        if (local && turn !== me) return;
        if (local) ctx.send({ t: 'edge', kind, r, c });
        apply(kind, r, c);
    };
    const newGame = () => { fresh(); render(); };

    window.Appmegle.register({
        id: 'dotsboxes', label: 'Dots and Boxes', css: 'apps/dotsboxes.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><div id="dab-board" style="grid-template-columns:repeat(' + (2 * C + 1) + ',auto)"></div></div>';
            boardEl = ctx.root.querySelector('#dab-board');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => { newGame(); ctx.send({ t: 'reset' }); });
            newGame();
        },
        unmount() { ctx = boardEl = statEl = null; },
        onData(msg) { if (msg.t === 'edge') edge(msg.kind, msg.r, msg.c, false); else if (msg.t === 'reset') newGame(); }
    });
})();
