// Mirror Match (2-player co-op) for appmegle. One of you leads, the other mirrors — the app
// reads where motion happens in each camera (a 3x3 grid of motion), flips the partner's grid
// (you're facing each other), and scores how well your movements line up. A live SYNC meter,
// then a final score for the round. Caller computes the score from both motion grids.
// Caller = Blue, answerer = Orange.
(function () {
    const MW = 60, MH = 48, MTH = 24, ROUND = 20;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null, vid = null, prev = null;
    let myVec = null, oppVec = null, live = 0, avg = 0, sumS = 0, cnt = 0, phase = 'idle', countEnd = 0, roundEnd = 0, lastT = 0, lastSend = 0;
    const regionVec = () => {
        if (!vid || !vid.videoWidth) return null; const s = Math.max(MW/vid.videoWidth, MH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s;
        mg.drawImage(vid, (MW-dw)/2, (MH-dh)/2, dw, dh); const cur = mg.getImageData(0, 0, MW, MH).data; const first = !prev; if (first) prev = new Float32Array(MW*MH);
        const v = new Array(9).fill(0); let tot = 0;
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y*MW+x, p = i*4, gr = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gr - prev[i]) > MTH) { const reg = ((y*3/MH)|0)*3 + ((x*3/MW)|0); v[reg]++; tot++; } prev[i] = gr; }
        if (tot < 12) return null; for (let i = 0; i < 9; i++) v[i] /= tot; return v;
    };
    const mirror = (v) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r*3+c] = v[r*3+(2-c)]; return o; };
    const cos = (a, b) => { let d = 0, ma = 0, mb = 0; for (let i = 0; i < 9; i++) { d += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i]; } return (ma && mb) ? d/Math.sqrt(ma*mb) : 0; };

    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); phase = 'count'; countEnd = performance.now() + 3000; sumS = 0; cnt = 0; live = 0; avg = 0; ctx.send({ t: 'start' }); };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, 320, 320); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, 320, 320);
        const pct = Math.round((phase === 'done' ? avg : live) * 100);
        g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(160, 170, 110, Math.PI*0.8, Math.PI*2.2); g.stroke();
        const hue = 120 * Math.max(0, (pct-40)/60); g.strokeStyle = 'hsl(' + hue + ',70%,55%)'; g.beginPath(); g.arc(160, 170, 110, Math.PI*0.8, Math.PI*0.8 + (Math.PI*1.4)*Math.max(0, pct/100)); g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 52px system-ui'; g.textAlign = 'center'; g.fillText(pct + '%', 160, 185);
        g.font = '15px system-ui'; g.fillText(phase === 'done' ? 'SYNC SCORE' : 'SYNC', 160, 215);
        if (phase === 'count') { const n = Math.ceil((countEnd - performance.now())/1000); g.font = 'bold 40px system-ui'; g.fillText(n > 0 ? n : 'GO!', 160, 60); }
        else if (phase === 'play') { g.font = '16px system-ui'; g.fillText('🪞 mirror each other!', 160, 50); }
    };
    const status = () => { if (statEl) statEl.textContent = phase === 'idle' ? 'Tap Start, then mirror each other' : phase === 'done' ? 'Final sync: ' + Math.round(avg*100) + '%' : phase === 'count' ? 'Get ready…' : '🪞 stay in sync!'; };
    const loop = (t) => {
        const now = performance.now(); myVec = regionVec();
        if (phase === 'count' && now >= countEnd) { phase = 'play'; roundEnd = now + ROUND*1000; sumS = 0; cnt = 0; }
        if (phase === 'play') {
            if (auth) { if (myVec && oppVec) { const s = cos(myVec, mirror(oppVec)); live = live*0.7 + s*0.3; sumS += s; cnt++; } avg = cnt ? sumS/cnt : 0; if (now >= roundEnd) { phase = 'done'; } ctx.send({ t: 'm', live: +live.toFixed(3), avg: +avg.toFixed(3), phase, t: Math.ceil((roundEnd-now)/1000) }); }
            if (!auth && t - lastSend > 90) { lastSend = t; if (myVec) ctx.send({ t: 'v', vec: myVec.map(x => +x.toFixed(3)) }); }
        } else if (auth && t - lastSend > 120) { lastSend = t; ctx.send({ t: 'm', live: +live.toFixed(3), avg: +avg.toFixed(3), phase, t: 0 }); }
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'mirror', label: 'Mirror Match', css: 'apps/mirror.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; prev = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start</button></div><canvas id="mr-canvas" width="320" height="320"></canvas><div class="mr-hint">needs camera · one leads, the other mirrors</div></div>';
            canvas = ctx.root.querySelector('#mr-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = mc = mg = vid = prev = null; },
        onData(msg) {
            if (msg.t === 'v' && auth) oppVec = msg.vec;
            else if (msg.t === 'm' && !auth) { live = msg.live; avg = msg.avg; phase = msg.phase; }
            else if (msg.t === 'start' && !auth) { phase = 'count'; countEnd = performance.now() + 3000; prev = null; }
            else if (msg.t === 'startreq' && auth) newGame();
        }
    });
})();
