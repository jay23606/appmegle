// High-Five Replay (2-player) for appmegle. Count down, HIGH-FIVE your cameras at the same
// instant — then watch the side-by-side SLOW-MO replay with a sync score in milliseconds.
// Both video feeds exist locally, so each client records its own ring buffer of frames (no
// frames ever cross the wire); only each side's motion-peak timestamp is exchanged. Caller
// starts the countdown. The signature "we did a thing together" moment.
(function () {
    const FW = 152, FH = 114, CAPMS = 66, PRE = 1300, POST = 1300, W = 480, H = 200;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, capL = null, capR = null, prevL = null;
    let frames = [], t0 = 0, phase = 'idle', lastCap = 0, motions = [], myPeak = null, oppPeak = null, sync = null, repStart = 0, btn = null;
    const grab = (v, cv) => { const gg = cv.getContext('2d', { willReadFrequently: true }); if (!v || !v.videoWidth) { gg.fillStyle = '#111'; gg.fillRect(0, 0, FW, FH); return gg; } const s = Math.max(FW/v.videoWidth, FH/v.videoHeight), dw = v.videoWidth*s, dh = v.videoHeight*s; gg.save(); gg.translate(FW, 0); gg.scale(-1, 1); gg.drawImage(v, (FW-dw)/2, (FH-dh)/2, dw, dh); gg.restore(); return gg; };
    const start = () => { if (!auth) return ctx.send({ t: 'startreq' }); ctx.send({ t: 'go', in: 3000 }); begin(3000); };
    const begin = (ms) => { t0 = performance.now() + ms; frames = []; motions = []; prevL = null; myPeak = null; oppPeak = null; sync = null; phase = 'arm'; };
    const capture = (now) => {
        if (now - lastCap < CAPMS) return; lastCap = now;
        const lv = document.getElementById('local-video'), rv = document.getElementById('remote-video');
        const cl = document.createElement('canvas'); cl.width = FW; cl.height = FH; const glc = grab(lv, cl);
        const cr = document.createElement('canvas'); cr.width = FW; cr.height = FH; grab(rv, cr);
        // motion on my own feed
        const d = glc.getImageData(0, 0, FW, FH).data; let m = 0;
        if (prevL) { for (let i = 0, p = 0; i < FW*FH; i += 7, p += 28) { const gr = (d[p]+d[p+1]+d[p+2])/3; if (Math.abs(gr - prevL[i/7|0]) > 26) m++; } }
        const pl = new Float32Array(Math.ceil(FW*FH/7)); for (let i = 0, p = 0; i < FW*FH; i += 7, p += 28) pl[i/7|0] = (d[p]+d[p+1]+d[p+2])/3; prevL = pl;
        frames.push({ t: now - t0, l: cl, r: cr }); motions.push({ t: now - t0, m });
        while (frames.length > 60) frames.shift();
    };
    const findPeak = () => { let best = -1, bt = 0; for (const mo of motions) if (mo.t > -500 && mo.t < 900 && mo.m > best) { best = mo.m; bt = mo.t; } return bt; };
    const settle = () => { if (myPeak === null || oppPeak === null || sync !== null) return; sync = Math.abs(myPeak - oppPeak); phase = 'replay'; repStart = performance.now(); };
    const grade = (ms) => ms < 60 ? '🤝 TELEPATHIC' : ms < 140 ? '🔥 solid five' : ms < 280 ? '👍 pretty close' : '🐌 did you even five?';
    const loop = (t) => {
        const now = performance.now();
        if (phase === 'arm' || (phase === 'record')) {
            if (now >= t0 - PRE) { phase = 'record'; capture(now); }
            if (now >= t0 + POST) { phase = 'wait'; myPeak = findPeak(); ctx.send({ t: 'peak', ms: myPeak }); settle(); }
        }
        draw(now); raf = requestAnimationFrame(loop);
    };
    const draw = (now) => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
        if (phase === 'arm' || phase === 'record') { const s = Math.ceil((t0 - now)/1000); g.fillStyle = '#fff'; g.font = 'bold 64px system-ui'; g.textAlign = 'center'; g.fillText(s > 0 ? s : '✋ FIVE!', W/2, H/2+22); }
        else if (phase === 'replay' && frames.length) {
            const span = frames[frames.length-1].t - frames[0].t, el = ((now - repStart)*0.32) % span, ft = frames[0].t + el;
            let fr = frames[0]; for (const f of frames) { if (f.t <= ft) fr = f; else break; }
            g.drawImage(fr.l, 6, 24, 228, 171*0.85); g.drawImage(fr.r, 246, 24, 228, 171*0.85);
            g.fillStyle = fr.t > -80 && fr.t < 80 ? '#ffd24a' : 'rgba(255,255,255,.5)'; g.fillRect(6 + (el/span)*(W-12), H-10, 4, 8);
            g.fillStyle = '#fff'; g.font = 'bold 15px system-ui'; g.textAlign = 'center'; g.fillText('Δ ' + Math.round(sync) + 'ms — ' + grade(sync), W/2, 16);
        }
        else if (phase === 'wait') { g.fillStyle = '#fff'; g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.fillText('crunching the replay…', W/2, H/2); }
        else { g.fillStyle = '#fff'; g.font = '15px system-ui'; g.textAlign = 'center'; g.fillText('high-five your cameras at the exact same moment', W/2, H/2); }
        statEl.textContent = phase === 'replay' ? '🎬 slow-mo replay · Δ ' + Math.round(sync) + 'ms' : phase === 'idle' ? 'High-Five Replay' : phase === 'wait' ? 'syncing…' : 'get that hand ready…';
    };
    window.Appmegle.register({
        id: 'highfive', label: 'High-Five Replay', css: 'apps/highfive.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; frames = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">🖐 Count it down</button></div><canvas id="hf-canvas" width="' + W + '" height="' + H + '"></canvas><div class="hf-hint">needs camera · the replay never leaves your device — only the timing is compared</div></div>';
            canvas = ctx.root.querySelector('#hf-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', start);
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = prevL = null; frames = []; },
        onData(msg) {
            if (msg.t === 'go' && !auth) begin(msg.in);
            else if (msg.t === 'startreq' && auth) start();
            else if (msg.t === 'peak') { oppPeak = msg.ms; settle(); }
        }
    });
})();
