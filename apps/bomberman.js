// Bomberman (2-player versus) for appmegle. Move on a grid, drop bombs that explode in a +
// blast after a fuse, destroying soft blocks (which may drop power-ups: extra bomb / bigger
// blast / speed) and killing players caught in it. Last one standing wins. The caller is
// authoritative (simulates both players, bombs, explosions, blocks) and broadcasts state;
// each player sends its held direction + bomb drops. Caller = blue, answerer = orange.
(function () {
    const GC = 13, GR = 11, CELL = 30, DV = [[0,-1],[1,0],[0,1],[-1,0]], FUSE = 2.4;
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const hardAt = (x, y) => x <= 0 || y <= 0 || x >= GC-1 || y >= GR-1 || (x % 2 === 0 && y % 2 === 0);

    let ctx = null, auth = false, mi = 0, raf = 0, canvas = null, g = null, statEl = null;
    let soft = [], players = [], bombs = [], blasts = [], powerups = [], over = false, winner = null;
    let view = null, lastT = 0, lastSend = 0, onKey = null;

    const mkP = (gx, gy, col) => ({ gx, gy, nx: gx, ny: gy, t: 0, x: gx, y: gy, dir: -1, des: -1, alive: true, bombs: 1, range: 2, spd: 4, count: 0, sb: null, col });
    const genSoft = (seed) => {
        const rnd = mulberry32(seed >>> 0); soft = Array.from({ length: GR }, () => Array(GC).fill(false));
        const clear = new Set(['1,1', '2,1', '1,2', (GC-2)+','+(GR-2), (GC-3)+','+(GR-2), (GC-2)+','+(GR-3)]);
        for (let y = 1; y < GR-1; y++) for (let x = 1; x < GC-1; x++) if (!hardAt(x, y) && !clear.has(x+','+y) && rnd() < 0.72) soft[y][x] = true;
    };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); const seed = (Math.random()*4294967296)>>>0; genSoft(seed); players = [mkP(1, 1, '#5db4ff'), mkP(GC-2, GR-2, '#ff9d3d')]; bombs = []; blasts = []; powerups = []; over = false; winner = null; ctx.send({ t: 'init', seed }); sync(); };

    const bombAt = (x, y) => bombs.find(b => b.x === x && b.y === y);
    const walk = (p, x, y) => !hardAt(x, y) && !soft[y][x] && !(bombAt(x, y) && !(p.sb && p.sb[0] === x && p.sb[1] === y));
    const move = (p, dt) => {
        if (!p.alive) return;
        if (p.dir === -1) { if (p.des !== -1 && walk(p, p.gx+DV[p.des][0], p.gy+DV[p.des][1])) { p.dir = p.des; p.nx = p.gx+DV[p.dir][0]; p.ny = p.gy+DV[p.dir][1]; } else return; }
        p.t += p.spd*dt;
        if (p.t >= 1) {
            p.t = 0; p.gx = p.nx; p.gy = p.ny; p.x = p.gx; p.y = p.gy;
            if (p.sb && (p.gx !== p.sb[0] || p.gy !== p.sb[1])) p.sb = null;
            pickup(p);
            if (p.des !== -1 && walk(p, p.gx+DV[p.des][0], p.gy+DV[p.des][1])) p.dir = p.des;
            if (!walk(p, p.gx+DV[p.dir][0], p.gy+DV[p.dir][1])) { p.dir = -1; return; }
            p.nx = p.gx+DV[p.dir][0]; p.ny = p.gy+DV[p.dir][1];
        } else { p.x = p.gx + DV[p.dir][0]*p.t; p.y = p.gy + DV[p.dir][1]*p.t; }
    };
    const pickup = (p) => { const i = powerups.findIndex(u => u.x === p.gx && u.y === p.gy); if (i < 0) return; const u = powerups.splice(i, 1)[0]; if (u.type === 'bomb') p.bombs++; else if (u.type === 'fire') p.range++; else p.spd = Math.min(8, p.spd + 1.1); };
    const dropBomb = (p) => { if (!p.alive || p.count >= p.bombs || bombAt(p.gx, p.gy)) return; bombs.push({ x: p.gx, y: p.gy, t: FUSE, owner: p, range: p.range }); p.count++; p.sb = [p.gx, p.gy]; };
    const explode = (b) => {
        const cells = [[b.x, b.y]];
        for (const [dx, dy] of DV) for (let r = 1; r <= b.range; r++) { const x = b.x+dx*r, y = b.y+dy*r; if (hardAt(x, y)) break; cells.push([x, y]); if (soft[y][x]) { soft[y][x] = false; if (Math.random() < 0.38) powerups.push({ x, y, type: ['bomb','fire','speed'][(Math.random()*3)|0] }); break; } const ob = bombAt(x, y); if (ob && ob.t > 0.05) ob.t = 0.02; }
        cells.forEach(([x, y]) => blasts.push({ x, y, life: 0.5 }));
        b.owner.count = Math.max(0, b.owner.count - 1);
    };
    const sim = (dt) => {
        players.forEach(p => move(p, dt));
        for (let i = bombs.length-1; i >= 0; i--) { bombs[i].t -= dt; if (bombs[i].t <= 0) { explode(bombs[i]); bombs.splice(i, 1); } }
        for (let i = blasts.length-1; i >= 0; i--) { blasts[i].life -= dt; if (blasts[i].life <= 0) blasts.splice(i, 1); }
        const bset = new Set(blasts.map(b => b.x+','+b.y));
        players.forEach(p => { if (p.alive && bset.has(Math.round(p.x)+','+Math.round(p.y))) p.alive = false; });
        if (!over) { const alive = players.filter(p => p.alive); if (alive.length <= 1) { over = true; winner = alive.length === 1 ? (alive[0] === players[0] ? 'a' : 'b') : 'tie'; } }
    };
    const softBits = () => { let s = ''; for (let y = 0; y < GR; y++) for (let x = 0; x < GC; x++) s += soft[y][x] ? '1' : '0'; return s; };
    const snap = () => ({ p: players.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), a: p.alive, c: p.col })), b: bombs.map(b => ({ x: b.x, y: b.y, t: +b.t.toFixed(2) })), bl: blasts.map(b => ({ x: b.x, y: b.y })), s: softBits(), u: powerups.map(u => ({ x: u.x, y: u.y, t: u.type })), over, winner });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, GC*CELL, GR*CELL);
        for (let y = 0; y < GR; y++) for (let x = 0; x < GC; x++) { if (hardAt(x, y)) { g.fillStyle = 'rgba(60,70,90,.75)'; g.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2); } else { g.fillStyle = 'rgba(30,90,50,.3)'; g.fillRect(x*CELL, y*CELL, CELL, CELL); } }
        const s = auth ? { ...snap(), soft } : view; if (!s) { statEl.textContent = 'Waiting…'; return; }
        const softG = auth ? soft : null;
        for (let y = 0; y < GR; y++) for (let x = 0; x < GC; x++) { const sf = auth ? soft[y][x] : (s.s[y*GC+x] === '1'); if (sf) { g.fillStyle = 'rgba(150,95,55,.85)'; g.fillRect(x*CELL+2, y*CELL+2, CELL-4, CELL-4); } }
        s.u.forEach(u => { g.fillStyle = u.t === 'bomb' ? '#333' : u.t === 'fire' ? '#e85' : '#4cf'; g.beginPath(); g.arc(u.x*CELL+CELL/2, u.y*CELL+CELL/2, CELL*0.3, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillText(u.t === 'bomb' ? '+' : u.t === 'fire' ? '🔥' : '»', u.x*CELL+CELL/2, u.y*CELL+CELL/2+4); });
        s.b.forEach(b => { const k = 1 + 0.12*Math.sin(performance.now()/80); g.fillStyle = '#111'; g.beginPath(); g.arc(b.x*CELL+CELL/2, b.y*CELL+CELL/2, CELL*0.32*k, 0, 7); g.fill(); g.strokeStyle = '#e44'; g.lineWidth = 2; g.beginPath(); g.arc(b.x*CELL+CELL/2, b.y*CELL+CELL/2, CELL*0.32*k, -1.2, 0.2); g.stroke(); });
        s.bl.forEach(b => { g.fillStyle = 'rgba(255,160,40,.85)'; g.fillRect(b.x*CELL+2, b.y*CELL+2, CELL-4, CELL-4); g.fillStyle = 'rgba(255,240,120,.9)'; g.fillRect(b.x*CELL+CELL*0.25, b.y*CELL+CELL*0.25, CELL*0.5, CELL*0.5); });
        s.p.forEach(p => { if (!p.a) return; g.fillStyle = p.c; g.beginPath(); g.roundRect(p.x*CELL+CELL*0.2, p.y*CELL+CELL*0.15, CELL*0.6, CELL*0.7, 6); g.fill(); g.fillStyle = '#fff'; g.fillRect(p.x*CELL+CELL*0.32, p.y*CELL+CELL*0.3, 4, 4); g.fillRect(p.x*CELL+CELL*0.56, p.y*CELL+CELL*0.3, 4, 4); });
        const meRole = mi === 0 ? 'a' : 'b';
        statEl.textContent = s.over ? (s.winner === 'tie' ? 'Draw!' : s.winner === meRole ? '🏆 You win!' : 'You lose') : 'Drop bombs — blow up your opponent!';
    };
    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; if (auth && !over && players.length) { sim(dt); if (t - lastSend > 40) { lastSend = t; sync(); } } draw(); raf = requestAnimationFrame(loop); };
    const setDes = (d) => { if (auth) { if (players[0]) players[0].des = d; } else ctx.send({ t: 'dir', d }); };
    const bomb = () => { if (auth) { if (players[0]) dropBomb(players[0]); } else ctx.send({ t: 'bomb' }); };

    window.Appmegle.register({
        id: 'bomberman', label: 'Bomberman', css: 'apps/bomberman.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; mi = auth ? 0 : 1; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<canvas id="bm-canvas" width="' + (GC*CELL) + '" height="' + (GR*CELL) + '"></canvas>' +
                '<div id="bm-pad"><button data-d="0">▲</button><button data-d="3">◀</button><button data-d="b">💣</button><button data-d="1">▶</button><button data-d="2">▼</button></div></div>';
            canvas = ctx.root.querySelector('#bm-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            onKey = (e) => { const dn = e.type === 'keydown'; const k = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code]; if (k !== undefined) { setDes(dn ? k : -1); e.preventDefault(); } else if ((e.code === 'Space' || e.code === 'KeyJ') && dn && !e.repeat) { bomb(); e.preventDefault(); } };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ctx.root.querySelectorAll('#bm-pad button').forEach(b => { const d = b.dataset.d; if (d === 'b') b.addEventListener('pointerdown', e => { e.preventDefault(); bomb(); }); else { b.addEventListener('pointerdown', e => { e.preventDefault(); setDes(+d); }); const up = () => setDes(-1); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); } });
            if (auth) newGame(); else draw();
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; players = []; bombs = []; blasts = []; powerups = []; },
        onData(msg) {
            if (msg.t === 'init' && !auth) genSoft(msg.seed);
            else if (msg.t === 's' && !auth) view = msg.v;
            else if (msg.t === 'dir' && auth) { if (players[1]) players[1].des = msg.d; }
            else if (msg.t === 'bomb' && auth) { if (players[1]) dropBomb(players[1]); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
