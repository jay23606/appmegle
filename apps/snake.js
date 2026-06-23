// Snake (versus) for appmegle. Real-time grid, authoritative caller broadcasts full
// state each tick. Caller = green snake (left), answerer = purple (right). Eat food to
// grow; crashing into a wall, yourself, or the other snake ends it.
(function () {
    const GW = 28, GH = 20, CELL = 16, TICK = 120;
    const DV = [[0,-1],[1,0],[0,1],[-1,0]];
    let ctx = null, auth = false, canvas = null, g = null, timer = 0, statEl = null;
    let A = null, B = null, food = [0,0], sa = 0, sb = 0, over = false, winner = '';
    let bodyA = [], bodyB = [], onKey = null;

    const randEmpty = () => {
        for (;;) {
            const p = [Math.floor(Math.random()*GW), Math.floor(Math.random()*GH)];
            if (!A.b.concat(B.b).some(c => c[0] === p[0] && c[1] === p[1])) return p;
        }
    };
    const reset = () => {
        const y = Math.floor(GH/2);
        A = { b: [[6,y],[5,y],[4,y],[3,y]], dir: 1 };
        B = { b: [[GW-7,y],[GW-6,y],[GW-5,y],[GW-4,y]], dir: 3 };
        sa = sb = 0; over = false; winner = ''; food = randEmpty();
        bodyA = A.b; bodyB = B.b; render();
    };
    const cell = (x, y, col) => { g.fillStyle = col; g.fillRect(x*CELL, y*CELL, CELL-1, CELL-1); };
    const status = () => {
        const my = auth ? sa : sb, op = auth ? sb : sa;
        if (over) statEl.textContent = winner === 'draw' ? 'Draw!' : ((winner === (auth ? 'a' : 'b')) ? 'You win! ' : 'You lose ') + my + '–' + op;
        else statEl.textContent = 'You ' + my + ' – ' + op + ' (' + (auth ? 'green' : 'purple') + ')';
    };
    const render = () => {
        g.clearRect(0, 0, canvas.width, canvas.height);
        cell(food[0], food[1], '#ff5d5d');
        bodyA.forEach((c, i) => cell(c[0], c[1], i ? '#3c8' : '#9f9'));
        bodyB.forEach((c, i) => cell(c[0], c[1], i ? '#83c' : '#c9f'));
        status();
    };

    const tick = () => {
        if (over) return;
        const nha = [A.b[0][0]+DV[A.dir][0], A.b[0][1]+DV[A.dir][1]];
        const nhb = [B.b[0][0]+DV[B.dir][0], B.b[0][1]+DV[B.dir][1]];
        const ateA = nha[0] === food[0] && nha[1] === food[1];
        const ateB = nhb[0] === food[0] && nhb[1] === food[1];
        A.b.unshift(nha); if (ateA) sa++; else A.b.pop();
        B.b.unshift(nhb); if (ateB) sb++; else B.b.pop();
        if (ateA || ateB) food = randEmpty();
        const oob = (p) => p[0] < 0 || p[0] >= GW || p[1] < 0 || p[1] >= GH;
        const has = (p, arr, from) => arr.slice(from).some(c => c[0] === p[0] && c[1] === p[1]);
        let da = oob(nha) || has(nha, A.b, 1) || has(nha, B.b, 0);
        let db = oob(nhb) || has(nhb, B.b, 1) || has(nhb, A.b, 0);
        if (nha[0] === nhb[0] && nha[1] === nhb[1]) da = db = true;
        if (da || db) { over = true; winner = da && db ? (sa === sb ? 'draw' : sa > sb ? 'a' : 'b') : da ? 'b' : 'a'; }
        bodyA = A.b; bodyB = B.b; render();
        ctx.send({ t: 's', a: A.b, b: B.b, food, sa, sb, over, winner });
    };

    const setDir = (d) => {
        if (auth) { if (Math.abs(d - A.dir) !== 2) A.dir = d; }
        else ctx.send({ t: 'd', dir: d });
    };
    const newGame = (broadcast) => {
        reset();
        if (auth) { clearInterval(timer); timer = setInterval(tick, TICK); }
        if (broadcast) ctx.send({ t: 'reset' });
    };

    window.Appmegle.register({
        id: 'snake', label: 'Snake', css: 'apps/snake.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<canvas id="sn-canvas" width="' + (GW*CELL) + '" height="' + (GH*CELL) + '"></canvas>' +
                '<div id="sn-pad"><button data-d="0">▲</button><button data-d="3">◀</button><button data-d="1">▶</button><button data-d="2">▼</button></div></div>';
            canvas = ctx.root.querySelector('#sn-canvas'); g = canvas.getContext('2d');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            ctx.root.querySelectorAll('#sn-pad button').forEach(b => b.addEventListener('click', () => setDir(+b.dataset.d)));
            onKey = (e) => { const k = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code]; if (k !== undefined) { e.preventDefault(); setDir(k); } };
            window.addEventListener('keydown', onKey);
            newGame(false);
        },
        unmount() { clearInterval(timer); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { bodyA = msg.a; bodyB = msg.b; food = msg.food; sa = msg.sa; sb = msg.sb; over = msg.over; winner = msg.winner; render(); }
            else if (msg.t === 'd' && auth) { if (Math.abs(msg.dir - B.dir) !== 2) B.dir = msg.dir; }
            else if (msg.t === 'reset') newGame(false);
        }
    });
})();
