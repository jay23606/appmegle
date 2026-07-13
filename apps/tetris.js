// Tetris (2-player versus) for appmegle. Each client runs its OWN board locally (lag-free
// controls); clearing lines sends garbage rows to the opponent, and topping out loses.
// Players exchange garbage + a compact board-view feed so you can watch each other's
// stack; the caller arbitrates the KO (first to top out loses). Caller = player 1.
(function () {
    const COLS = 10, ROWS = 20, GARB = [0, 0, 1, 2, 4];
    const P = {
        I: { n: 4, c: [[0,1],[1,1],[2,1],[3,1]] }, O: { n: 2, c: [[0,0],[1,0],[0,1],[1,1]] },
        T: { n: 3, c: [[1,0],[0,1],[1,1],[2,1]] }, S: { n: 3, c: [[1,0],[2,0],[0,1],[1,1]] },
        Z: { n: 3, c: [[0,0],[1,0],[1,1],[2,1]] }, J: { n: 3, c: [[0,0],[0,1],[1,1],[2,1]] },
        L: { n: 3, c: [[2,0],[0,1],[1,1],[2,1]] }
    };
    const COL = { I: '#36c6e0', O: '#e0cc36', T: '#b04ce0', S: '#4ce06a', Z: '#e05050', J: '#4a6ae0', L: '#e0922a', G: '#888' };
    const rot = (c, n, t) => { let r = c; for (let i = 0; i < t; i++) r = r.map(([x, y]) => [n - 1 - y, x]); return r; };

    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let board, piece, nextT, bag, lines, pendG, dropT, over, result, phase;
    let oppS = null, oppLn = 0, soft = 0, lastT = 0, lastBV = 0, onKey = null, onBoardDown = null, onBoardUp = null, boardTouch = null;

    const refill = () => { bag = ['I','O','T','S','Z','J','L']; for (let i = bag.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [bag[i], bag[j]] = [bag[j], bag[i]]; } };
    const draw7 = () => { if (!bag || !bag.length) refill(); return bag.pop(); };
    const cells = (p) => rot(P[p.type].c, P[p.type].n, p.r).map(([x, y]) => [x + p.x, y + p.y]);
    const hit = (p) => cells(p).some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]));
    const spawn = () => { const t = nextT; nextT = draw7(); piece = { type: t, x: ((COLS - P[t].n)/2)|0, y: 0, r: 0 }; if (hit(piece)) topOut(); };

    const newGame = (broadcast) => {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        bag = null; lines = 0; pendG = 0; dropT = 0; over = false; result = null; phase = 'play';
        nextT = draw7(); spawn();
        if (broadcast) ctx.send({ t: 'restart' });
    };
    const clearLines = () => {
        let n = 0;
        for (let y = ROWS - 1; y >= 0; y--) if (board[y].every(c => c)) { board.splice(y, 1); board.unshift(Array(COLS).fill(null)); n++; y++; }
        if (n) { lines += n; if (GARB[n]) ctx.send({ t: 'g', n: GARB[n] }); }
    };
    const addGarbage = (n) => { const hole = (Math.random()*COLS)|0; for (let i = 0; i < n; i++) { board.shift(); const row = Array(COLS).fill('G'); row[hole] = null; board.push(row); } };
    const lock = () => {
        cells(piece).forEach(([x, y]) => { if (y >= 0) board[y][x] = piece.type; });
        clearLines();
        if (pendG > 0) { addGarbage(pendG); pendG = 0; }
        piece = null; spawn(); sendBV();
    };
    const topOut = () => { phase = 'over'; piece = null; if (auth) setResult('b'); else { statEl.textContent = 'Topped out — waiting…'; ctx.send({ t: 'dead' }); } };
    const setResult = (w) => { result = w; over = true; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { over = true; phase = 'over'; result = w; statEl.textContent = w === me ? '🏆 You win — opponent topped out!' : 'You lose — you topped out'; };

    const move = (dx) => { if (!piece) return; piece.x += dx; if (hit(piece)) piece.x -= dx; };
    const rotate = () => { if (!piece) return; const r0 = piece.r; piece.r = (piece.r + 1) % 4; for (const k of [0, -1, 1, -2, 2]) { piece.x += k; if (!hit(piece)) return; piece.x -= k; } piece.r = r0; };
    const stepDown = () => { if (!piece) return false; piece.y++; if (hit(piece)) { piece.y--; lock(); return false; } return true; };
    const hardDrop = () => { if (!piece) return; while (stepDown()) {} };

    const sendBV = () => { if (!board) return; let s = ''; const pc = piece ? cells(piece) : []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const onP = pc.some(([px, py]) => px === x && py === y); s += onP ? piece.type : (board[y][x] || '.'); } ctx.send({ t: 'bv', s, ln: lines }); };

    const drawBoard = (ox, oy, cell, getCell, w, h) => {
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ox, oy, w * cell, h * cell);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = getCell(x, y); if (c && c !== '.') { g.fillStyle = COL[c] || '#aaa'; g.fillRect(ox + x*cell + 1, oy + y*cell + 1, cell - 2, cell - 2); } }
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.strokeRect(ox, oy, w * cell, h * cell);
    };
    const render = () => {
        g.clearRect(0, 0, canvas.width, canvas.height);
        const pc = piece ? cells(piece) : [];
        drawBoard(12, 30, 22, (x, y) => { if (pc.some(([px, py]) => px === x && py === y)) return piece.type; return board ? board[y][x] : null; }, COLS, ROWS);
        drawBoard(264, 30, 11, (x, y) => oppS ? (oppS[y*COLS + x] === '.' ? null : oppS[y*COLS + x]) : null, COLS, ROWS);
        g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.textAlign = 'left';
        g.fillText('You · lines ' + (lines || 0), 12, 22); g.fillText('Them · ' + oppLn, 264, 22);
        g.fillText('Next', 130, 70); if (nextT) rot(P[nextT].c, P[nextT].n, 0).forEach(([x, y]) => { g.fillStyle = COL[nextT]; g.fillRect(132 + x*12, 78 + y*12, 11, 11); });
        if (pendG > 0) { g.fillStyle = '#e05050'; g.fillRect(2, 30, 8, 22*ROWS * (Math.min(pendG, ROWS)/ROWS)); }
        if (over) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(12, 30, 220, 440); g.fillStyle = '#fff'; g.font = 'bold 22px system-ui'; g.textAlign = 'center'; g.fillText(result === me ? 'YOU WIN' : 'YOU LOSE', 122, 250); }
    };

    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'play') {
            const grav = Math.max(0.07, 0.8 - lines*0.018);
            dropT -= dt * (soft ? 9 : 1);
            if (dropT <= 0) { dropT = grav; stepDown(); }
            if (t - lastBV > 120) { lastBV = t; sendBV(); }
        }
        render(); raf = requestAnimationFrame(loop);
    };

    window.Appmegle.register({
        id: 'tetris', label: 'Tetris', css: 'apps/tetris.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; oppS = null; oppLn = 0;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<canvas id="tt-canvas" width="400" height="500"></canvas>' +
                '<div id="tt-pad"><button data-k="l">◀</button><button data-k="rot">⟳</button><button data-k="r">▶</button><button data-k="d">▼</button><button data-k="hd">⤓</button></div></div>';
            canvas = ctx.root.querySelector('#tt-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            onKey = (e) => {
                const d = e.type === 'keydown';
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (d) move(-1); }
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (d) move(1); }
                else if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (d && !e.repeat) rotate(); }
                else if (e.code === 'ArrowDown' || e.code === 'KeyS') soft = d ? 1 : 0;
                else if (e.code === 'Space') { if (d && !e.repeat) hardDrop(); }
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            onBoardDown = (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                boardTouch = { x: e.clientX, y: e.clientY };
                canvas.setPointerCapture?.(e.pointerId);
            };
            onBoardUp = (e) => {
                if (!boardTouch || !piece || phase !== 'play') return;
                const r = canvas.getBoundingClientRect(), dx = e.clientX - boardTouch.x, dy = e.clientY - boardTouch.y;
                boardTouch = null; canvas.releasePointerCapture?.(e.pointerId);
                if (dy > Math.max(28, r.height * 0.08)) return hardDrop();
                const x = (e.clientX - r.left) * canvas.width / r.width;
                if (x < 12 || x > 232) return; // only the local board, not the opponent preview
                const lane = (x - 12) / 220;
                if (lane < 0.34) move(-1);
                else if (lane > 0.66) move(1);
                else rotate();
            };
            canvas.addEventListener('pointerdown', onBoardDown);
            canvas.addEventListener('pointerup', onBoardUp);
            ctx.root.querySelectorAll('#tt-pad button').forEach(b => {
                const k = b.dataset.k;
                if (k === 'd') { b.addEventListener('pointerdown', e => { e.preventDefault(); soft = 1; }); b.addEventListener('pointerup', () => soft = 0); b.addEventListener('pointerleave', () => soft = 0); }
                else b.addEventListener('pointerdown', e => { e.preventDefault(); if (k === 'l') move(-1); else if (k === 'r') move(1); else if (k === 'rot') rotate(); else if (k === 'hd') hardDrop(); });
            });
            newGame(false);
            statEl.textContent = 'Tap left / centre / right to move or rotate · swipe down to drop';
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); canvas?.removeEventListener('pointerdown', onBoardDown); canvas?.removeEventListener('pointerup', onBoardUp); ctx = canvas = g = statEl = board = piece = null; },
        onData(msg) {
            if (msg.t === 'bv') { oppS = msg.s; oppLn = msg.ln; }
            else if (msg.t === 'g') pendG += msg.n;
            else if (msg.t === 'dead' && auth) { if (!over) setResult('a'); }
            else if (msg.t === 'result') finish(msg.w);
            else if (msg.t === 'restart') newGame(false);
        }
    });
})();
