// Battleship for appmegle. Fleets are auto-placed locally (so boards stay secret);
// players alternate firing and the defender replies hit/miss/sunk. Caller fires first.
(function () {
    const N = 8, SHIPS = [4, 3, 3, 2], TOTAL = SHIPS.reduce((a, b) => a + b, 0);
    let ctx = null, me = false, turn = 'them', over = false, result = null;
    let myShip = [], myFleet = [], myMarks = [], enemyMarks = [];
    let enemyEl = null, fleetEl = null, statEl = null;

    const blank = () => Array.from({ length: N }, () => Array(N).fill(''));

    const placeFleet = () => {
        myShip = Array.from({ length: N }, () => Array(N).fill(-1)); myFleet = [];
        for (const len of SHIPS) {
            for (;;) {
                const horiz = Math.random() < 0.5;
                const r = Math.floor(Math.random() * (horiz ? N : N - len + 1));
                const c = Math.floor(Math.random() * (horiz ? N - len + 1 : N));
                const cells = []; let clash = false;
                for (let i = 0; i < len; i++) { const rr = horiz ? r : r + i, cc = horiz ? c + i : c; if (myShip[rr][cc] >= 0) { clash = true; break; } cells.push([rr, cc]); }
                if (clash) continue;
                const id = myFleet.length; cells.forEach(([rr, cc]) => myShip[rr][cc] = id);
                myFleet.push({ len, hits: 0 }); break;
            }
        }
    };

    const newGame = () => {
        placeFleet(); myMarks = blank(); enemyMarks = blank();
        turn = me ? 'me' : 'them'; over = false; result = null; render();
    };

    const grid = (el, marks, ships, clickable) => {
        el.innerHTML = '';
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            const cell = document.createElement('div');
            let cls = 'bs-cell';
            if (ships && myShip[r][c] >= 0) cls += ' ship';
            if (marks[r][c] === 'h') cls += ' hit';
            else if (marks[r][c] === 'm') cls += ' miss';
            cell.className = cls;
            if (clickable) cell.addEventListener('click', () => fire(r, c));
            el.appendChild(cell);
        }
    };
    const render = () => {
        grid(enemyEl, enemyMarks, false, true);
        grid(fleetEl, myMarks, true, false);
        statEl.textContent = over ? (result === 'win' ? 'You win! Fleet destroyed.' : 'You lose — your fleet is sunk')
            : (turn === 'me' ? 'Your shot — click enemy waters' : 'Waiting for their shot…');
    };

    const fire = (r, c) => {
        if (over || turn !== 'me' || enemyMarks[r][c]) return;
        enemyMarks[r][c] = '.';            // pending, prevents double-fire
        turn = 'them'; ctx.send({ t: 'fire', r, c }); render();
    };

    window.Appmegle.register({
        id: 'battleship', label: 'Battleship', css: 'apps/battleship.css',
        mount(c) {
            ctx = c; me = ctx.amCaller;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<div class="bs-label">Enemy waters</div><div id="bs-enemy" class="bs-grid"></div>' +
                '<div class="bs-label">Your fleet</div><div id="bs-fleet" class="bs-grid"></div></div>';
            enemyEl = ctx.root.querySelector('#bs-enemy');
            fleetEl = ctx.root.querySelector('#bs-fleet');
            statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => { ctx.send({ t: 'reset' }); newGame(); });
            newGame();
        },
        unmount() { ctx = enemyEl = fleetEl = statEl = null; },
        onData(msg) {
            if (msg.t === 'fire') {                          // they shot at my fleet
                const id = myShip[msg.r][msg.c]; let hit = false, sunk = false, lost = false;
                if (id >= 0) { hit = true; myFleet[id].hits++; sunk = myFleet[id].hits === myFleet[id].len; myMarks[msg.r][msg.c] = 'h'; }
                else myMarks[msg.r][msg.c] = 'm';
                lost = myFleet.reduce((s, sh) => s + sh.hits, 0) === TOTAL;
                if (lost) { over = true; result = 'lose'; }
                turn = 'me'; ctx.send({ t: 'result', r: msg.r, c: msg.c, hit, lost }); render();
            } else if (msg.t === 'result') {                 // outcome of my shot
                enemyMarks[msg.r][msg.c] = msg.hit ? 'h' : 'm';
                if (msg.lost) { over = true; result = 'win'; }
                render();
            } else if (msg.t === 'reset') newGame();
        }
    });
})();
