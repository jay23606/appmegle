// Tank Duel (2-player artillery) for appmegle. Turn-based: drag back from your tank to set
// angle + power, release to lob a shell over the terrain — gravity and a per-turn wind affect
// the arc. Shells crater the ground and splash-damage tanks; drop the opponent to 0 HP to win.
// The caller is authoritative (computes the trajectory + damage, syncs the deformed terrain);
// both animate the shot. Caller = blue (left), answerer = orange (right).
(function () {
    const W = 720, H = 400, GRAV = 320, HIT = 16, BLAST = 58, MAXDMG = 46, CR = 26;
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let terr = [], tanks = { a: { x: 70, y: 200, hp: 100 }, b: { x: W-70, y: 200, hp: 100 } }, wind = 0, turn = 'a', over = false, winner = null;
    let aiming = false, aimX = 0, aimY = 0, anim = null, pending = null, lastT = 0;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const groundY = (x) => terr[Math.max(0, Math.min(W-1, x|0))];
    const genTerrain = (seed) => { const rnd = mulberry32(seed >>> 0), base = 250 + rnd()*30, p1 = 0.006 + rnd()*0.004, p2 = 0.02 + rnd()*0.01; terr = new Array(W); for (let x = 0; x < W; x++) terr[x] = Math.max(120, Math.min(H-16, base - Math.sin(x*p1 + seed)*46 - Math.sin(x*p2)*16 - Math.cos(x*0.0015)*26)); };
    const sit = () => { tanks.a.y = groundY(tanks.a.x); tanks.b.y = groundY(tanks.b.x); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); const seed = (Math.random()*4294967296)>>>0; genTerrain(seed); tanks = { a: { x: 70, y: 0, hp: 100 }, b: { x: W-70, y: 0, hp: 100 } }; sit(); wind = (Math.random()*2-1)*60; turn = 'a'; over = false; winner = null; ctx.send({ t: 'state', seed, tanks, wind, turn }); status(); };

    const fire = (p, vx, vy) => {
        if (over || turn !== p || anim) return;
        const t = tanks[p], pts = []; let x = t.x, y = t.y - 12, ix = x, iy = y, hit = null;
        for (let i = 0; i < 1400; i++) { vy += GRAV*(1/120); vx += wind*(1/120); x += vx*(1/120); y += vy*(1/120); if (i % 3 === 0) pts.push([x, y]); ix = x; iy = y; const ob = tanks[other(p)]; if (Math.hypot(x-ob.x, y-(ob.y-8)) < HIT) { hit = 'tank'; break; } if (x < -20 || x > W+20) { hit = 'out'; break; } if (y >= groundY(x)) { hit = 'ground'; break; } }
        // crater + splash
        if (hit !== 'out') { for (let dx = -CR; dx <= CR; dx++) { const gx = (ix+dx)|0; if (gx >= 0 && gx < W) terr[gx] = Math.min(H-12, terr[gx] + (CR - Math.abs(dx))*0.7); } sit(); for (const q of ['a', 'b']) { const d = Math.hypot(ix - tanks[q].x, iy - tanks[q].y); if (d < BLAST) tanks[q].hp = Math.max(0, tanks[q].hp - Math.round((1 - d/BLAST)*MAXDMG)); } }
        if (tanks.a.hp <= 0 || tanks.b.hp <= 0) { over = true; winner = tanks.a.hp <= 0 && tanks.b.hp <= 0 ? 'tie' : tanks.a.hp <= 0 ? 'b' : 'a'; }
        else { turn = other(p); wind = (Math.random()*2-1)*60; }
        const shot = { pts, terr: terr.slice(), tanks: JSON.parse(JSON.stringify(tanks)), wind, turn, over, winner };
        ctx.send({ t: 'shot', s: shot }); startAnim(shot);
    };
    const startAnim = (shot) => { anim = { pts: shot.pts, i: 0 }; pending = shot; };
    const applyShot = (s) => { terr = s.terr; tanks = s.tanks; wind = s.wind; turn = s.turn; over = s.over; winner = s.winner; anim = pending = null; status(); };

    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === 'tie' ? 'Draw!' : winner === me ? '🏆 You win!' : 'You lose') : 'You ' + tanks[me].hp + ' · Them ' + tanks[other(me)].hp + ' · ' + (turn === me ? 'your shot — drag back to aim' : 'their shot') + ' · wind ' + (wind > 0 ? '→' : '←') + Math.abs(wind|0); };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H);
        if (terr.length) { g.fillStyle = 'rgba(90,60,35,.55)'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x < W; x += 3) g.lineTo(x, terr[x]); g.lineTo(W, H); g.closePath(); g.fill(); g.strokeStyle = 'rgba(120,200,120,.5)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < W; x += 3) (x ? g.lineTo : g.moveTo).call(g, x, terr[x]); g.stroke(); }
        for (const q of ['a', 'b']) { const t = tanks[q]; if (t.hp <= 0) continue; g.fillStyle = q === 'a' ? '#5db4ff' : '#ff9d3d'; g.beginPath(); g.roundRect(t.x-13, t.y-12, 26, 12, 4); g.fill(); g.beginPath(); g.arc(t.x, t.y-12, 7, Math.PI, 0); g.fill(); const bw = 30, bx = t.x-bw/2; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(bx, t.y-26, bw, 4); g.fillStyle = q === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillRect(bx, t.y-26, bw*t.hp/100, 4); }
        if (anim && anim.pts[anim.i]) { const [px, py] = anim.pts[anim.i]; g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); }
        if (aiming && turn === me && !over && !anim) { const t = tanks[me], dx = t.x - aimX, dy = (t.y-12) - aimY, d = Math.hypot(dx, dy)||1, L = Math.min(d, 200); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.setLineDash([6,6]); g.beginPath(); g.moveTo(t.x, t.y-12); g.lineTo(t.x + dx/d*L, t.y-12 + dy/d*L); g.stroke(); g.setLineDash([]); }
        // wind arrow
        g.fillStyle = '#fff'; g.font = '13px system-ui'; g.textAlign = 'center'; g.fillText('wind ' + (wind > 0 ? '→' : '←') + ' ' + Math.abs(wind|0), W/2, 20);
    };
    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; if (anim) { anim.i += 2; if (anim.i >= anim.pts.length) applyShot(pending); } draw(); raf = requestAnimationFrame(loop); };
    const worldAt = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*W, (e.clientY-r.top)/r.height*H]; };
    const doFire = (vx, vy) => { if (auth) fire('a', vx, vy); else ctx.send({ t: 'fire', vx, vy }); };

    window.Appmegle.register({
        id: 'tanks', label: 'Tank Duel', css: 'apps/tanks.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="tk-canvas" width="' + W + '" height="' + H + '"></canvas></div>';
            canvas = ctx.root.querySelector('#tk-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            canvas.addEventListener('pointerdown', (e) => { if (turn !== me || over || anim) return; aiming = true; [aimX, aimY] = worldAt(e); });
            canvas.addEventListener('pointermove', (e) => { if (aiming) [aimX, aimY] = worldAt(e); });
            canvas.addEventListener('pointerup', () => { if (!aiming) return; aiming = false; const t = tanks[me], dx = t.x - aimX, dy = (t.y-12) - aimY, d = Math.hypot(dx, dy); if (d < 12) return; const pow = Math.min(d, 200)/200 * 520, a = Math.atan2(dy, dx); doFire(Math.cos(a)*pow, Math.sin(a)*pow); });
            if (auth) newGame(); else statEl.textContent = 'Waiting for the host…';
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = null; terr = []; anim = pending = null; },
        onData(msg) {
            if (msg.t === 'state' && !auth) { genTerrain(msg.seed); tanks = msg.tanks; wind = msg.wind; turn = msg.turn; over = false; winner = null; status(); }
            else if (msg.t === 'shot' && !auth) startAnim(msg.s);
            else if (msg.t === 'fire' && auth) fire('b', msg.vx, msg.vy);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
