// Exquisite Corpse (2-player) for appmegle. Fold-over collaborative drawing: one draws the
// HEAD, the other the TORSO (seeing only a sliver of what came above), back for the LEGS, and
// the FEET — then the fold opens and you meet your monster. Each finished band's strokes are
// sent across; the next drawer sees just the bottom 14px "fold" for continuity. No authority —
// strict turn order. Caller = head first.
(function () {
    const W = 300, BH = 130, BANDS = 4, H = BH*BANDS, PEEK = 14, PARTS = ['HEAD', 'TORSO', 'LEGS', 'FEET'];
    let ctx = null, me = 'a', cur = 0, bands = [], phase = 'draw', drawing = false, last = null, stroke = null, statEl = null, bodyEl = null, canvas = null, g = null;
    const drawerOf = (i) => i % 2 === 0 ? 'a' : 'b';
    const reset = () => { cur = 0; bands = [[], [], [], []]; phase = 'draw'; build(); };
    const paint = () => {
        if (!g) return; g.clearRect(0, 0, W, H);
        const amTurn = phase === 'draw' && drawerOf(cur) === me;
        if (phase === 'reveal') {
            g.fillStyle = 'rgba(15,20,40,.65)'; g.fillRect(0, 0, W, H);
            for (let i = 0; i < BANDS; i++) drawBand(i, 0);
        } else {
            const y0 = cur*BH;
            g.fillStyle = 'rgba(15,20,40,.65)'; g.fillRect(0, y0 - (cur ? PEEK : 0), W, BH + (cur ? PEEK : 0));
            g.fillStyle = 'rgba(255,255,255,.06)'; if (cur) g.fillRect(0, y0-PEEK, W, PEEK);
            if (cur) { g.save(); g.beginPath(); g.rect(0, y0-PEEK, W, PEEK); g.clip(); drawBand(cur-1, 0); g.restore(); }   // the fold sliver
            drawBand(cur, 0);
            g.fillStyle = 'rgba(255,255,255,.5)'; g.font = 'bold 13px system-ui'; g.textAlign = 'center';
            g.fillText(amTurn ? '✏️ draw the ' + PARTS[cur] + ' here' : (drawerOf(cur) === 'a' ? 'blue' : 'orange') + ' is drawing the ' + PARTS[cur] + '…', W/2, y0 + BH/2);
        }
    };
    const drawBand = (i, dy) => { g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round'; for (const pl of bands[i]) { g.beginPath(); for (let k = 0; k < pl.length; k += 2) { const x = pl[k], y = pl[k+1]+dy; k === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } };
    const build = () => {
        if (!bodyEl) return; const amTurn = phase === 'draw' && drawerOf(cur) === me;
        statEl.textContent = phase === 'reveal' ? '👹 Behold your creation!' : 'Part ' + (cur+1) + '/4: ' + PARTS[cur] + (amTurn ? ' — your turn' : ' — their turn');
        bodyEl.innerHTML = '<canvas id="ec-canvas" width="' + W + '" height="' + H + '"></canvas>' + (phase === 'reveal' ? '<button class="app-btn" id="ec-new">New monster</button>' : amTurn ? '<button class="app-btn" id="ec-done">✓ Done with the ' + PARTS[cur] + '</button>' : '');
        canvas = bodyEl.querySelector('#ec-canvas'); g = canvas.getContext('2d');
        const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width*W, y: (e.clientY-r.top)/r.height*H }; };
        canvas.addEventListener('pointerdown', (e) => { if (phase !== 'draw' || drawerOf(cur) !== me) return; const p = pt(e); if (p.y < cur*BH || p.y > (cur+1)*BH) return; drawing = true; last = p; stroke = [Math.round(p.x), Math.round(p.y)]; e.preventDefault(); });
        canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); p.y = Math.max(cur*BH, Math.min((cur+1)*BH, p.y)); stroke.push(Math.round(p.x), Math.round(p.y)); last = p; paint(); g.strokeStyle = '#fff'; drawLive(); });
        window.addEventListener('pointerup', () => { if (drawing && stroke && stroke.length > 3) { bands[cur].push(stroke); } drawing = false; stroke = null; paint(); });
        const dn = bodyEl.querySelector('#ec-done'), nw = bodyEl.querySelector('#ec-new');
        if (dn) dn.addEventListener('click', () => { ctx.send({ t: 'band', i: cur, pl: bands[cur] }); advance(); });
        if (nw) nw.addEventListener('click', () => { ctx.send({ t: 'new' }); reset(); });
        paint();
    };
    const drawLive = () => { if (!stroke) return; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < stroke.length; k += 2) k === 0 ? g.moveTo(stroke[k], stroke[k+1]) : g.lineTo(stroke[k], stroke[k+1]); g.stroke(); };
    const advance = () => { cur++; if (cur >= BANDS) phase = 'reveal'; build(); };
    window.Appmegle.register({
        id: 'corpse', label: 'Exquisite Corpse', css: 'apps/corpse.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="ec"><div class="app-bar"><span class="stat"></span></div><div id="ec-body"></div><div class="ec-hint">fold-over drawing: head → torso → legs → feet, then the big reveal</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ec-body');
            reset();
        },
        unmount() { ctx = statEl = bodyEl = canvas = g = null; },
        onData(msg) {
            if (msg.t === 'band') { bands[msg.i] = msg.pl; if (msg.i === cur) advance(); else paint(); }
            else if (msg.t === 'new') reset();
        }
    });
})();
