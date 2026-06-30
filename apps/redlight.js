// Red Light, Green Light (2-player) for appmegle. On GREEN, move toward the camera to advance;
// on RED, hold perfectly still — any motion (frame-differenced from your camera) sends you back.
// First to the finish wins. The light is synced by the caller; each detects its own motion;
// caller arbitrates the win. Caller = Blue, answerer = Orange.
(function () {
    const MW = 64, MH = 48, MTH = 24;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null, vid = null, prev = null;
    let green = false, prog = 0, oppProg = 0, caught = 0, flash = 0, phase = 'idle', lightT = 0, over = false, winner = null, lastT = 0, lastSend = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const motion = () => { if (!vid || !vid.videoWidth) return 0; const s = Math.max(MW/vid.videoWidth, MH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s; mg.drawImage(vid, (MW-dw)/2, (MH-dh)/2, dw, dh); const cur = mg.getImageData(0, 0, MW, MH).data; const first = !prev; if (first) prev = new Float32Array(MW*MH); let n = 0; for (let i = 0, p = 0; i < MW*MH; i++, p += 4) { const gr = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gr - prev[i]) > MTH) n++; prev[i] = gr; } return n/(MW*MH); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'startreq' }); prog = 0; oppProg = 0; over = false; winner = null; green = true; lightT = 2.2; phase = 'play'; prev = null; ctx.send({ t: 'light', g: green }); };
    const onFinish = () => { if (over) return; if (auth) setResult('a'); else { over = true; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { over = true; winner = w; ctx.send({ t: 'result', w }); };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, 460, 300); g.fillStyle = green && !over ? 'rgba(30,150,60,.4)' : 'rgba(150,30,30,.4)'; g.fillRect(0, 0, 460, 300);
        if (flash > 0) { g.fillStyle = 'rgba(255,0,0,' + flash*0.4 + ')'; g.fillRect(0, 0, 460, 300); flash -= 0.06; }
        g.fillStyle = (green && !over) ? '#3f3' : '#f44'; g.beginPath(); g.arc(230, 70, 36, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 26px system-ui'; g.textAlign = 'center'; g.fillText(over ? (winner === me ? 'YOU WIN' : 'YOU LOSE') : (green ? 'GREEN — GO!' : 'RED — FREEZE'), 230, 130);
        const track = (y, p, col, lbl) => { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(30, y, 400, 16); g.fillStyle = col; g.fillRect(30, y, 400*Math.min(1, p), 16); g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(lbl, 30, y-4); g.fillText('🏁', 432, y+13); };
        track(180, prog, '#5db4ff', 'YOU'); track(230, oppProg, '#ff9d3d', 'THEM');
    };
    const status = () => { if (statEl) statEl.textContent = over ? (winner === me ? '🏆 You win!' : 'You lose') : 'Green = move · Red = freeze'; };
    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; const m = motion();
        if (phase === 'play' && !over) {
            if (auth) { lightT -= dt; if (lightT <= 0) { green = !green; lightT = green ? 1 + Math.random()*2.5 : 1 + Math.random()*1.8; ctx.send({ t: 'light', g: green }); } }
            if (caught > 0) caught -= dt;
            if (green) { if (m > 0.02) prog = Math.min(1, prog + Math.min(m, 0.25)*2.4*dt); }
            else if (caught <= 0 && m > 0.06) { prog = Math.max(0, prog - 0.14); caught = 0.7; flash = 1; }
            if (prog >= 1) onFinish();
            if (t - lastSend > 80) { lastSend = t; ctx.send({ t: 'p', v: +prog.toFixed(3) }); }
        }
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'redlight', label: 'Red Light Green Light', css: 'apps/redlight.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; prog = 0; prev = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start</button></div><canvas id="rl-canvas" width="460" height="300"></canvas><div class="rl-hint">needs camera · move toward the lens on green, freeze on red</div></div>';
            canvas = ctx.root.querySelector('#rl-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = mc = mg = vid = prev = null; },
        onData(msg) {
            if (msg.t === 'light' && !auth) { green = msg.g; if (phase !== 'play') { phase = 'play'; prog = 0; oppProg = 0; over = false; winner = null; prev = null; } }
            else if (msg.t === 'p') oppProg = msg.v;
            else if (msg.t === 'startreq' && auth) newGame();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') { over = true; winner = msg.w; }
        }
    });
})();
