// Siren Flight (2-player) for appmegle. Flappy-bird-meets-choir: your VOICE PITCH controls your
// bird's altitude — sing higher to climb, lower to dive, silence to fall. Both fly the same
// seed-synced gate course for 45 seconds; most gates cleared wins. Pitch detection is plain
// autocorrelation on the mic's time-domain signal. Caller seeds + starts. Caller = Blue,
// answerer = Orange.
(function () {
    const W = 520, H = 320, RUN = 45, FMIN = 100, FMAX = 500;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let actx = null, analyser = null, fbuf = null, stream = null, micOn = false;
    let seed = 1, gates = [], wx = 0, y = H/2, vy = 0, pitchS = 0, stumble = 0, score = 0, opp = { y: H/2, wx: 0, sc: 0 }, phase = 'idle', endAt = 0, lastT = 0, lastSend = 0, over = false, winner = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const mul = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const initMic = async () => { if (micOn) return true; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaStreamSource(stream); analyser = actx.createAnalyser(); analyser.fftSize = 1024; fbuf = new Float32Array(analyser.fftSize); src.connect(analyser); micOn = true; return true; } catch (e) { statEl.textContent = 'Mic needed!'; return false; } };
    const pitch = () => {
        if (!analyser) return 0; analyser.getFloatTimeDomainData(fbuf);
        let rms = 0; for (let i = 0; i < fbuf.length; i++) rms += fbuf[i]*fbuf[i]; rms = Math.sqrt(rms/fbuf.length); if (rms < 0.015) return 0;
        const sr = actx.sampleRate, minL = Math.floor(sr/600), maxL = Math.min(fbuf.length-1, Math.ceil(sr/85));
        let best = -1, bl = 0; for (let lag = minL; lag <= maxL; lag++) { let s = 0; for (let i = 0; i < fbuf.length-lag; i++) s += fbuf[i]*fbuf[i+lag]; if (s > best) { best = s; bl = lag; } }
        return bl ? sr/bl : 0;
    };
    const buildCourse = (sd) => { const rnd = mul(sd); gates = []; for (let i = 0; i < 40; i++) gates.push({ x: 400 + i*270, gy: 55 + rnd()*(H-200), gh: Math.max(74, 105 - i*1.2), hit: false, passed: false }); };
    const newGame = async () => { if (!(await initMic())) return; if (!auth) return ctx.send({ t: 'startreq' }); seed = (Math.random()*1e9)|0; ctx.send({ t: 'start', seed }); begin(seed); };
    const begin = (sd) => { buildCourse(sd); wx = 0; y = H/2; vy = 0; score = 0; stumble = 0; over = false; winner = null; opp = { y: H/2, wx: 0, sc: 0 }; phase = 'play'; endAt = performance.now() + RUN*1000; };
    const finish = () => { phase = 'done'; ctx.send({ t: 'fin', sc: score }); if (auth) arbitrate(); };
    const arbitrate = () => { if (!auth || over || phase !== 'done' || !opp.fin) return; winner = score === opp.sc ? 'tie' : score > opp.sc ? 'a' : 'b'; over = true; ctx.send({ t: 'result', w: winner }); render(); };
    const step = (dt) => {
        const f = pitch();
        if (f >= FMIN*0.8) { const t = Math.max(0, Math.min(1, (Math.log(Math.max(f, FMIN)) - Math.log(FMIN)) / (Math.log(FMAX) - Math.log(FMIN)))); const ty = (H-50) - t*(H-90); vy += (ty - y)*7*dt*10; vy *= 0.82; pitchS = f; }
        else { vy += 330*dt; pitchS = 0; }
        y = Math.max(24, Math.min(H-24, y + vy*dt));
        if (stumble > 0) stumble -= dt; else wx += 130*dt;
        for (const gt of gates) { const sx = gt.x - wx + 90;
            if (!gt.passed && !gt.hit && sx < 90 - 14) { gt.passed = true; score++; }
            if (!gt.hit && !gt.passed && Math.abs(sx - 90) < 14 && (y < gt.gy || y > gt.gy + gt.gh)) { gt.hit = true; stumble = 0.8; } }
        if (performance.now() >= endAt) finish();
    };
    const render = () => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(10,20,45,.35)'; g.fillRect(0, 0, W, H);
        for (const gt of gates) { const sx = gt.x - wx + 90; if (sx < -20 || sx > W+20) continue; g.fillStyle = gt.hit ? 'rgba(220,80,80,.6)' : gt.passed ? 'rgba(90,220,120,.35)' : 'rgba(150,170,230,.55)'; g.fillRect(sx-8, 0, 16, gt.gy); g.fillRect(sx-8, gt.gy+gt.gh, 16, H-gt.gy-gt.gh); }
        const gx = opp.wx - wx + 90; if (gx > -20 && gx < W+20) { g.globalAlpha = 0.55; g.font = '22px system-ui'; g.textAlign = 'center'; g.fillText('🐦', gx, opp.y+7); g.globalAlpha = 1; }
        g.font = '26px system-ui'; g.textAlign = 'center'; g.save(); if (stumble > 0) g.globalAlpha = 0.4 + 0.3*Math.sin(performance.now()/40); g.fillText('🎤🐦', 90, y+8); g.restore();
        g.fillStyle = '#fff'; g.font = 'bold 15px system-ui'; g.textAlign = 'left'; g.fillText('You ' + score, 10, 20); g.textAlign = 'right'; g.fillText('Them ' + opp.sc, W-10, 20);
        if (phase === 'play') { g.textAlign = 'center'; g.font = '12px system-ui'; g.fillText(pitchS ? Math.round(pitchS) + ' Hz' : 'sing to fly!', W/2, 18); g.fillText('⏱ ' + Math.max(0, Math.ceil((endAt-performance.now())/1000)), W/2, 34); }
        if (over) { g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText(winner === 'tie' ? 'TIE' : winner === me ? '🏆 YOU WIN' : 'YOU LOSE', W/2, H/2); }
        statEl.textContent = phase === 'idle' ? 'Tap Start, then SING' : over ? (winner === me ? '🏆 You win!' : winner === 'tie' ? 'Tie!' : 'You lose') : phase === 'done' ? 'Waiting for them to land…' : 'higher note = higher bird 🎶';
    };
    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; if (phase === 'play') { step(dt); if (t - lastSend > 90) { lastSend = t; ctx.send({ t: 'p', y: Math.round(y), wx: Math.round(wx), sc: score }); } } render(); raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'siren', label: 'Siren Flight', css: 'apps/siren.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start</button></div><canvas id="sf-canvas" width="' + W + '" height="' + H + '"></canvas><div class="sf-hint">needs mic · your voice pitch is the flight stick — silence = falling</div></div>';
            canvas = ctx.root.querySelector('#sf-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); if (actx) actx.close(); ctx = canvas = g = statEl = analyser = stream = actx = null; micOn = false; },
        onData(msg) {
            if (msg.t === 'p') { opp.y = msg.y; opp.wx = msg.wx; opp.sc = msg.sc; }
            else if (msg.t === 'start' && !auth) { initMic().then(ok => { if (ok) begin(msg.seed); }); }
            else if (msg.t === 'startreq' && auth) newGame();
            else if (msg.t === 'fin') { opp.sc = msg.sc; opp.fin = true; arbitrate(); }
            else if (msg.t === 'result') { over = true; winner = msg.w; }
        }
    });
})();
