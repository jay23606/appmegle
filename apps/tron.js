// Tron light-cycles for appmegle. Real-time grid game, authoritative caller. Caller =
// cyan (starts left, heading right), answerer = orange (starts right, heading left).
// The caller ticks the sim and broadcasts both heads; both sides paint trails from that.
(function () {
    const GW = 51, GH = 33, CELL = 8, TICK = 85;
    const DV = [[0,-1],[1,0],[0,1],[-1,0]];   // up,right,down,left
    let ctx = null, auth = false, canvas = null, g = null, timer = 0;
    let A = null, B = null, occ = null, over = false, winner = '';
    let statEl = null;

    const reset = () => {
        A = { x: 5, y: (GH-1)/2, dir: 1 };
        B = { x: GW-6, y: (GH-1)/2, dir: 3 };
        occ = Array.from({ length: GW }, () => Array(GH).fill(false));
        over = false; winner = '';
        g.clearRect(0, 0, canvas.width, canvas.height);
        occ[A.x][A.y] = occ[B.x][B.y] = true;
        paint(A.x, A.y, '#2ff'); paint(B.x, B.y, '#f93');
        status();
    };
    const paint = (x, y, col) => { g.fillStyle = col; g.fillRect(x*CELL, y*CELL, CELL-1, CELL-1); };
    const status = () => {
        const meCol = auth ? 'cyan' : 'orange';
        if (over) statEl.textContent = winner === 'draw' ? 'Draw — head-on!' : ((winner === (auth ? 'a' : 'b')) ? 'You win!' : 'You crashed');
        else statEl.textContent = 'You are ' + meCol + ' — arrows / WASD / tap edges';
    };

    const tick = () => {
        if (over) return;
        const na = { x: A.x + DV[A.dir][0], y: A.y + DV[A.dir][1] };
        const nb = { x: B.x + DV[B.dir][0], y: B.y + DV[B.dir][1] };
        const bad = (p) => p.x < 0 || p.x >= GW || p.y < 0 || p.y >= GH || occ[p.x][p.y];
        let ac = bad(na), bc = bad(nb);
        if (na.x === nb.x && na.y === nb.y) ac = bc = true;
        if (ac || bc) { over = true; winner = ac && bc ? 'draw' : ac ? 'b' : 'a'; }
        else {
            occ[na.x][na.y] = occ[nb.x][nb.y] = true; A.x = na.x; A.y = na.y; B.x = nb.x; B.y = nb.y;
            paint(A.x, A.y, '#2ff'); paint(B.x, B.y, '#f93');
        }
        ctx.send({ t: 's', ax: A.x, ay: A.y, bx: B.x, by: B.y, over, winner });
        status();
    };

    const setDir = (d) => {
        if (auth) { if (Math.abs(d - A.dir) !== 2) A.dir = d; }
        else ctx.send({ t: 'd', dir: d });
    };
    let onKey = null;
    const newGame = (broadcast) => {
        reset();
        if (auth) { clearInterval(timer); timer = setInterval(tick, TICK); }
        if (broadcast) ctx.send({ t: 'reset' });
    };

    window.Appmegle.register({
        id: 'tron', label: 'Tron', css: 'apps/tron.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<canvas id="tr-canvas" width="' + (GW*CELL) + '" height="' + (GH*CELL) + '"></canvas>' +
                '<div id="tr-pad"><button data-d="0">▲</button><button data-d="3">◀</button><button data-d="1">▶</button><button data-d="2">▼</button></div></div>';
            canvas = ctx.root.querySelector('#tr-canvas'); g = canvas.getContext('2d');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            ctx.root.querySelectorAll('#tr-pad button').forEach(b => b.addEventListener('click', () => setDir(+b.dataset.d)));
            onKey = (e) => {
                const k = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code];
                if (k !== undefined) { e.preventDefault(); setDir(k); }
            };
            window.addEventListener('keydown', onKey);
            newGame(false);
        },
        unmount() { clearInterval(timer); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) {
                paint(msg.ax, msg.ay, '#2ff'); paint(msg.bx, msg.by, '#f93');
                over = msg.over; winner = msg.winner; status();
            } else if (msg.t === 'd' && auth) { if (Math.abs(msg.dir - B.dir) !== 2) B.dir = msg.dir; }
            else if (msg.t === 'reset') newGame(false);
        }
    });
})();
