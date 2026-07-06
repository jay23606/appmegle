// Séance (2-player toy) for appmegle. A Ouija board where the planchette moves by the AVERAGE
// of both players' finger-drags, plus a whisper of noise — so neither of you controls it, and
// neither can be blamed for what it spells. Ask a question out loud, both hold a finger on the
// board, and watch. Dwelling near a glyph selects it into the message. Caller simulates the
// physics; both send their pull. Caller = Blue, answerer = Orange.
(function () {
    const W = 460, H = 340;
    let ctx = null, auth = false, raf = 0, canvas = null, g = null, msgEl = null;
    let pos = { x: W/2, y: H/2 }, vel = { x: 0, y: 0 }, myT = null, oppT = null, message = '', dwell = 0, dwellGlyph = null, cooled = null, wander = 0, lastT = 0, lastSend = 0;
    const glyphs = [];
    (function build() {
        for (let i = 0; i < 13; i++) glyphs.push({ c: String.fromCharCode(65+i), x: 38 + i*((W-76)/12), y: 150 - Math.sin(Math.PI*i/12)*52 });
        for (let i = 0; i < 13; i++) glyphs.push({ c: String.fromCharCode(78+i), x: 38 + i*((W-76)/12), y: 215 - Math.sin(Math.PI*i/12)*52 });
        for (let i = 0; i < 10; i++) glyphs.push({ c: '' + i, x: 85 + i*((W-170)/9), y: 262 });
        glyphs.push({ c: 'YES', x: 60, y: 42 }, { c: 'NO', x: W-60, y: 42 }, { c: '★', x: W/2, y: 42 }, { c: ' ', x: W/2, y: 308 });
    })();
    const near = () => { let best = null, bd = 26; for (const gl of glyphs) { const d = Math.hypot(pos.x-gl.x, pos.y-gl.y); if (d < bd) { bd = d; best = gl; } } return best; };
    const pick = (gl) => { message += gl.c === '★' ? '✦' : gl.c; if (message.length > 40) message = message.slice(-40); ctx.send({ t: 'msg', m: message }); renderMsg(); };
    const renderMsg = () => { if (msgEl) msgEl.textContent = message || '…the board is silent…'; };
    const step = (dt) => {
        const pulls = [myT, oppT].filter(Boolean);
        let fx = 0, fy = 0;
        for (const t of pulls) { const dx = t.x-pos.x, dy = t.y-pos.y, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 90)/90; fx += dx/d*s*430; fy += dy/d*s*430; }
        if (pulls.length) { fx /= pulls.length; fy /= pulls.length; wander += (Math.random()-0.5)*3*dt; fx += Math.cos(wander)*70; fy += Math.sin(wander)*70; }
        vel.x = (vel.x + fx*dt)*0.90; vel.y = (vel.y + fy*dt)*0.90;
        pos.x = Math.max(16, Math.min(W-16, pos.x + vel.x*dt)); pos.y = Math.max(16, Math.min(H-16, pos.y + vel.y*dt));
        const gl = near(), speed = Math.hypot(vel.x, vel.y);
        if (gl && gl !== cooled && speed < 26 && pulls.length) { if (gl === dwellGlyph) { dwell += dt; if (dwell > 0.8) { pick(gl); cooled = gl; dwell = 0; } } else { dwellGlyph = gl; dwell = 0; } }
        else { dwellGlyph = null; dwell = 0; if (cooled && (!gl || gl !== cooled)) cooled = null; }
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,10,30,.55)'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(230,215,180,.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const gl of glyphs) { g.font = (gl.c.length > 1 ? 'bold 15px' : gl.c === ' ' ? '11px' : 'bold 17px') + ' Georgia, serif'; g.fillText(gl.c === ' ' ? '⎵ space' : gl.c, gl.x, gl.y); }
        // planchette
        g.save(); g.translate(pos.x, pos.y); g.globalAlpha = 0.85;
        g.fillStyle = 'rgba(120,80,160,.4)'; g.strokeStyle = '#d9c9a8'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(22, -4, 14, 16); g.quadraticCurveTo(0, 26, -14, 16); g.quadraticCurveTo(-22, -4, 0, -26); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.arc(0, -2, 7, 0, 7); g.strokeStyle = '#fff'; g.stroke(); g.restore();
        if (dwellGlyph && dwell > 0.15) { g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.beginPath(); g.arc(dwellGlyph.x, dwellGlyph.y, 18, -Math.PI/2, -Math.PI/2 + dwell/0.8*2*Math.PI); g.stroke(); }
    };
    const loop = (t) => {
        const dt = Math.min(0.04, (t - lastT)/1000 || 0); lastT = t;
        if (auth) { step(dt); if (t - lastSend > 50) { lastSend = t; ctx.send({ t: 'p', x: Math.round(pos.x), y: Math.round(pos.y) }); } }
        draw(); raf = requestAnimationFrame(loop);
    };
    const ptOf = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width*W, y: (e.clientY-r.top)/r.height*H }; };
    window.Appmegle.register({
        id: 'seance', label: 'Séance', css: 'apps/seance.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; pos = { x: W/2, y: H/2 }; vel = { x: 0, y: 0 }; message = ''; myT = oppT = null;
            ctx.root.innerHTML = '<div class="app-col" id="se"><div class="app-bar"><span class="se-msg-out" id="se-out"></span><button class="app-btn" id="se-clear">Clear</button></div><canvas id="se-canvas" width="' + W + '" height="' + H + '"></canvas><div class="se-hint">ask a question out loud… then both hold a finger on the board 👻</div></div>';
            canvas = ctx.root.querySelector('#se-canvas'); g = canvas.getContext('2d'); msgEl = ctx.root.querySelector('#se-out'); renderMsg();
            const setT = (e) => { const p = ptOf(e); if (auth) myT = p; else { myT = p; ctx.send({ t: 'f', x: Math.round(p.x), y: Math.round(p.y) }); } e.preventDefault(); };
            const clrT = () => { myT = null; if (!auth) ctx.send({ t: 'f', x: null }); };
            canvas.addEventListener('pointerdown', setT); canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') setT(e); });
            canvas.addEventListener('pointerup', clrT); canvas.addEventListener('pointerleave', clrT);
            ctx.root.querySelector('#se-clear').addEventListener('click', () => { message = ''; ctx.send({ t: 'clr' }); renderMsg(); });
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = msgEl = null; },
        onData(msg) {
            if (msg.t === 'f' && auth) oppT = msg.x === null ? null : { x: msg.x, y: msg.y };
            else if (msg.t === 'p' && !auth) { pos.x = msg.x; pos.y = msg.y; }
            else if (msg.t === 'msg') { message = msg.m; renderMsg(); }
            else if (msg.t === 'clr') { message = ''; renderMsg(); }
        }
    });
})();
