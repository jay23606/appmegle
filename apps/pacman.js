// Pac-Man (2-player dot race) for appmegle. Both players munch the SAME maze; ghosts hunt
// you both. The caller is authoritative (it owns ghosts, dots and collisions and broadcasts
// state); each player sends its desired direction. Eat a power pellet to turn ghosts edible.
// Get the most dots when the maze is cleared. A fresh procedural (braided, loopy) maze each
// game. Caller = blue Pac, answerer = orange.
(function () {
    const CELL = 22, MC = 9, MR = 7, GW = 2*MC+1, GH = 2*MR+1, SPD = 5.5, GSPD = 4.8, FRIGHT = 6, SEND = 33;
    const DV = [[0,-1],[1,0],[0,1],[-1,0]];
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let grid = [], dots = new Set(), pellets = new Set(), wallAt = null;
    let pacs = { a: null, b: null }, ghosts = [], score = { a: 0, b: 0 }, fright = 0, over = false, winner = null;
    let desired = -1, oppDir = -1, lastT = 0, lastSend = 0, view = null, onKey = null;

    const genMaze = (seed) => {
        const rnd = mulberry32(seed >>> 0), wall = Array.from({ length: GH }, () => Array(GW).fill(true));
        const vis = Array.from({ length: MR }, () => Array(MC).fill(false)), st = [[0, 0]]; vis[0][0] = true; wall[1][1] = false;
        while (st.length) {
            const [ci, cj] = st[st.length-1], nb = [];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di, dj]) => { const ni = ci+di, nj = cj+dj; if (ni>=0&&ni<MC&&nj>=0&&nj<MR&&!vis[nj][ni]) nb.push([ni, nj, di, dj]); });
            if (!nb.length) { st.pop(); continue; }
            const [ni, nj, di, dj] = nb[(rnd()*nb.length)|0]; vis[nj][ni] = true; wall[2*cj+1+dj][2*ci+1+di] = false; wall[2*nj+1][2*ni+1] = false; st.push([ni, nj]);
        }
        for (let cj = 0; cj < MR; cj++) for (let ci = 0; ci < MC; ci++) {                       // braid: open dead-ends
            const cx = 2*ci+1, cy = 2*cj+1; let o = 0; const cand = [];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di, dj]) => { const wx = cx+di, wy = cy+dj; if (wx>0&&wx<GW-1&&wy>0&&wy<GH-1) { wall[wy][wx] ? cand.push([wx, wy]) : o++; } });
            if (o <= 1 && cand.length) { const [wx, wy] = cand[(rnd()*cand.length)|0]; wall[wy][wx] = false; }
        }
        const rows = wall.map(r => r.map(w => w ? '#' : '.').join('').split(''));
        [[1,1],[GW-2,1],[1,GH-2],[GW-2,GH-2]].forEach(([x, y]) => { if (rows[y][x] === '.') rows[y][x] = 'o'; });
        return rows.map(r => r.join(''));
    };
    const parse = (G) => {
        grid = G; dots = new Set(); pellets = new Set();
        wallAt = (x, y) => x < 0 || x >= GW || y < 0 || y >= GH || grid[y][x] === '#';
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (grid[y][x] === '.') dots.add(x+','+y); else if (grid[y][x] === 'o') pellets.add(x+','+y); }
    };
    const mkPac = (gx, gy) => ({ gx, gy, nx: gx, ny: gy, t: 0, dir: -1, des: -1, x: gx, y: gy, stun: 0, spawn: [gx, gy] });
    const mkGhost = (gx, gy, col) => ({ gx, gy, nx: gx, ny: gy, t: 0, dir: 1, x: gx, y: gy, col, spawn: [gx, gy] });
    const clearSpawn = (x, y) => { dots.delete(x+','+y); pellets.delete(x+','+y); };

    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        const seed = (Math.random()*4294967296)>>>0; const G = genMaze(seed); parse(G);
        pacs.a = mkPac(1, 1); pacs.b = mkPac(GW-2, GH-2); clearSpawn(1, 1); clearSpawn(GW-2, GH-2);
        const cx = GW>>1 | 1, cy = GH>>1 | 1;
        ghosts = [mkGhost(cx, cy, '#ff5050'), mkGhost(cx, cy-2 < 1 ? cy : cy-2, '#ffb8ff'), mkGhost(cx, cy, '#5ff')];
        ghosts.forEach(g2 => clearSpawn(g2.gx, g2.gy));
        score = { a: 0, b: 0 }; fright = 0; over = false; winner = null;
        ctx.send({ t: 'maze', grid: G.join('|') }); sync();
    };

    const openDirs = (gx, gy, notRev) => { const out = []; for (let d = 0; d < 4; d++) { if (notRev !== -1 && d === (notRev+2)%4) continue; if (!wallAt(gx+DV[d][0], gy+DV[d][1])) out.push(d); } return out; };
    const moveEnt = (e, spd, dt, isPac) => {
        if (isPac && e.stun > 0) { e.stun -= dt; return; }
        if (e.dir === -1) { if (isPac && e.des !== -1 && !wallAt(e.gx+DV[e.des][0], e.gy+DV[e.des][1])) { e.dir = e.des; e.nx = e.gx+DV[e.dir][0]; e.ny = e.gy+DV[e.dir][1]; } else return; }
        e.t += spd*dt;
        if (e.t >= 1) {
            e.t = 0; e.gx = e.nx; e.gy = e.ny; e.x = e.gx; e.y = e.gy;
            if (isPac) { eat(e); if (e.des !== -1 && !wallAt(e.gx+DV[e.des][0], e.gy+DV[e.des][1])) e.dir = e.des; if (wallAt(e.gx+DV[e.dir][0], e.gy+DV[e.dir][1])) { e.dir = -1; return; } }
            else chooseGhost(e);
            e.nx = e.gx+DV[e.dir][0]; e.ny = e.gy+DV[e.dir][1];
        } else { e.x = e.gx + DV[e.dir][0]*e.t; e.y = e.gy + DV[e.dir][1]*e.t; }
    };
    const chooseGhost = (gh) => {
        const opts = openDirs(gh.gx, gh.gy, gh.dir); if (!opts.length) { gh.dir = (gh.dir+2)%4; return; }
        if (fright > 0 || Math.random() < 0.25) { gh.dir = opts[(Math.random()*opts.length)|0]; return; }
        const tp = [pacs.a, pacs.b].reduce((p, c) => Math.hypot(c.gx-gh.gx, c.gy-gh.gy) < Math.hypot(p.gx-gh.gx, p.gy-gh.gy) ? c : p);
        let best = opts[0], bd = 1e9; for (const d of opts) { const nx = gh.gx+DV[d][0], ny = gh.gy+DV[d][1], dd = Math.hypot(nx-tp.gx, ny-tp.gy); if (dd < bd) { bd = dd; best = d; } } gh.dir = best;
    };
    const eat = (pac) => {
        const k = pac.gx+','+pac.gy, who = pac === pacs.a ? 'a' : 'b';
        if (dots.has(k)) { dots.delete(k); score[who] += 10; ctx.send({ t: 'eat', x: pac.gx, y: pac.gy }); }
        else if (pellets.has(k)) { pellets.delete(k); score[who] += 50; fright = FRIGHT; ctx.send({ t: 'eat', x: pac.gx, y: pac.gy }); }
        if (!dots.size && !pellets.size) { over = true; winner = score.a === score.b ? 'tie' : score.a > score.b ? 'a' : 'b'; }
    };
    const collisions = () => {
        for (const gh of ghosts) for (const who of ['a', 'b']) { const p = pacs[who]; if (Math.hypot(p.x-gh.x, p.y-gh.y) < 0.6) {
            if (fright > 0) { score[who] += 200; gh.gx = gh.spawn[0]; gh.gy = gh.spawn[1]; gh.nx = gh.gx; gh.ny = gh.gy; gh.x = gh.gx; gh.y = gh.gy; gh.t = 0; }
            else if (p.stun <= 0) { p.stun = 1.5; p.gx = p.spawn[0]; p.gy = p.spawn[1]; p.nx = p.gx; p.ny = p.gy; p.x = p.gx; p.y = p.gy; p.t = 0; p.dir = -1; }
        } }
    };
    const snap = () => ({ pa: { x: pacs.a.x, y: pacs.a.y, st: pacs.a.stun > 0, d: pacs.a.dir }, pb: { x: pacs.b.x, y: pacs.b.y, st: pacs.b.stun > 0, d: pacs.b.dir }, gh: ghosts.map(g2 => ({ x: g2.x, y: g2.y, c: g2.col, d: g2.dir })), s: score, f: fright, over, winner });
    const sync = () => { view = snap(); ctx.send({ t: 's', v: view }); };

    const DIRANG = [-Math.PI/2, 0, Math.PI/2, Math.PI], DV2 = [[0,-1],[1,0],[0,1],[-1,0]];
    let rp = null;
    const lerpTo = (s) => {                              // smooth the ~30Hz state on the non-authoritative side
        if (!rp) rp = { pa: { x: s.pa.x, y: s.pa.y }, pb: { x: s.pb.x, y: s.pb.y }, gh: s.gh.map(o => ({ x: o.x, y: o.y })) };
        const ease = (o, t) => { const dx = t.x - o.x, dy = t.y - o.y; if (Math.hypot(dx, dy) > 2.2) { o.x = t.x; o.y = t.y; } else { o.x += dx*0.35; o.y += dy*0.35; } };
        ease(rp.pa, s.pa); ease(rp.pb, s.pb); s.gh.forEach((o, i) => { if (!rp.gh[i]) rp.gh[i] = { x: o.x, y: o.y }; ease(rp.gh[i], o); });
        return { pa: { x: rp.pa.x, y: rp.pa.y, st: s.pa.st, d: s.pa.d }, pb: { x: rp.pb.x, y: rp.pb.y, st: s.pb.st, d: s.pb.d }, gh: s.gh.map((o, i) => ({ x: rp.gh[i].x, y: rp.gh[i].y, c: o.c, d: o.d })), s: s.s, f: s.f, over: s.over, winner: s.winner };
    };
    const pac = (p, col) => {
        const cx = p.x*CELL+CELL/2, cy = p.y*CELL+CELL/2, r = CELL*0.42;
        if (p.st) { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); return; }
        const ang = DIRANG[p.d >= 0 ? p.d : 1], m = 0.06 + 0.30*(0.5 + 0.5*Math.sin(performance.now()/90));   // chomp
        g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, ang + m, ang + Math.PI*2 - m); g.closePath(); g.fill();
        g.fillStyle = '#10202e'; const ea = ang - 1.45; g.beginPath(); g.arc(cx + Math.cos(ea)*r*0.42, cy + Math.sin(ea)*r*0.42, r*0.14, 0, 7); g.fill();
    };
    const ghost = (gh, fr) => {
        const cx = gh.x*CELL+CELL/2, cy = gh.y*CELL+CELL/2, r = CELL*0.4;
        g.fillStyle = fr ? '#3344ff' : gh.c; g.beginPath(); g.arc(cx, cy, r, Math.PI, 2*Math.PI);
        g.lineTo(cx + r, cy + r*0.8); g.lineTo(cx + r*0.5, cy + r*0.45); g.lineTo(cx, cy + r*0.8); g.lineTo(cx - r*0.5, cy + r*0.45); g.lineTo(cx - r, cy + r*0.8); g.closePath(); g.fill();
        const dv = DV2[gh.d >= 0 ? gh.d : 1];
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - r*0.34, cy - r*0.12, r*0.3, 0, 7); g.arc(cx + r*0.34, cy - r*0.12, r*0.3, 0, 7); g.fill();
        g.fillStyle = fr ? '#fff' : '#1133cc'; g.beginPath(); g.arc(cx - r*0.34 + dv[0]*r*0.15, cy - r*0.12 + dv[1]*r*0.15, r*0.14, 0, 7); g.arc(cx + r*0.34 + dv[0]*r*0.15, cy - r*0.12 + dv[1]*r*0.15, r*0.14, 0, 7); g.fill();
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, canvas.width, canvas.height);
        if (grid.length) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
            if (grid[y][x] === '#') { g.fillStyle = 'rgba(40,60,160,.5)'; g.fillRect(x*CELL, y*CELL, CELL, CELL); }
        }
        g.fillStyle = '#ffd'; dots.forEach(k => { const [x, y] = k.split(',').map(Number); g.beginPath(); g.arc(x*CELL+CELL/2, y*CELL+CELL/2, 2, 0, 7); g.fill(); });
        g.fillStyle = '#ffd'; pellets.forEach(k => { const [x, y] = k.split(',').map(Number); g.beginPath(); g.arc(x*CELL+CELL/2, y*CELL+CELL/2, 5, 0, 7); g.fill(); });
        const s = auth ? snap() : (view ? lerpTo(view) : null); if (!s) { statEl.textContent = 'Waiting…'; return; }
        s.gh.forEach(gh => ghost(gh, s.f > 0)); pac(s.pa, '#5db4ff'); pac(s.pb, '#ff9d3d');
        statEl.textContent = s.over ? (s.winner === 'tie' ? 'Tie ' : s.winner === me ? '🏆 You win ' : 'You lose ') + s.s[me] + '–' + s.s[me==='a'?'b':'a'] : 'You ' + s.s[me] + ' · Them ' + s.s[me==='a'?'b':'a'] + (s.f > 0 ? ' · ghosts edible!' : '');
    };
    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (auth && !over && pacs.a) {
            pacs.a.des = desired; pacs.b.des = oppDir;
            moveEnt(pacs.a, SPD, dt, true); moveEnt(pacs.b, SPD, dt, true); ghosts.forEach(gh => moveEnt(gh, GSPD, dt, false));
            if (fright > 0) fright -= dt; collisions();
            if (t - lastSend > SEND) { lastSend = t; sync(); }
        }
        draw(); raf = requestAnimationFrame(loop);
    };
    const setDir = (d) => { if (auth) desired = d; else ctx.send({ t: 'dir', d }); };

    window.Appmegle.register({
        id: 'pacman', label: 'Pac-Man', css: 'apps/pacman.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null; grid = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<canvas id="pm-canvas" width="' + (GW*CELL) + '" height="' + (GH*CELL) + '"></canvas>' +
                '<div id="pm-pad"><button data-d="0">▲</button><button data-d="3">◀</button><button data-d="1">▶</button><button data-d="2">▼</button></div></div>';
            canvas = ctx.root.querySelector('#pm-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            ctx.root.querySelectorAll('#pm-pad button').forEach(b => b.addEventListener('click', () => setDir(+b.dataset.d)));
            onKey = (e) => { const k = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code]; if (k !== undefined) { e.preventDefault(); setDir(k); } };
            window.addEventListener('keydown', onKey);
            if (auth) newGame(); else draw();
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ctx = canvas = g = statEl = null; pacs = { a: null, b: null }; ghosts = []; rp = null; },
        onData(msg) {
            if (msg.t === 'maze' && !auth) parse(msg.grid.split('|'));
            else if (msg.t === 's' && !auth) { view = msg.v; }
            else if (msg.t === 'eat' && !auth) { const k = msg.x+','+msg.y; dots.delete(k); pellets.delete(k); }
            else if (msg.t === 'dir' && auth) oppDir = msg.d;
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
