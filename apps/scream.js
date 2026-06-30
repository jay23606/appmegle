// Scream Meter (2-player) for appmegle. A countdown, then you both YELL — the app reads your
// live mic volume (Web Audio AnalyserNode) and tracks your loudest sustained level; loudest
// wins the round. The mic is appmegle's most untapped input. Each client measures its own mic
// and broadcasts its level; the caller arbitrates the winner. Caller = Blue, answerer = Orange.
(function () {
    const ROUND = 5;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, startBtn = null;
    let actx = null, analyser = null, buf = null, stream = null, micOn = false;
    let myLevel = 0, myPeak = 0, oppLevel = 0, oppPeak = 0, phase = 'idle', countEnd = 0, scores = { a: 0, b: 0 }, over = false, winner = null, lastT = 0, lastSend = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';

    const initMic = async () => {
        if (micOn) return true;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaStreamSource(stream); analyser = actx.createAnalyser(); analyser.fftSize = 512; buf = new Uint8Array(analyser.fftSize); src.connect(analyser); micOn = true; return true; }
        catch (e) { statEl.textContent = 'Mic needed — allow microphone access'; return false; }
    };
    const readLevel = () => { if (!analyser) return 0; analyser.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128)/128; sum += v*v; } return Math.min(1, Math.sqrt(sum/buf.length) * 3.2); };

    const startRound = () => { myPeak = 0; oppPeak = 0; over = false; winner = null; phase = 'count'; countEnd = performance.now() + 3000; };
    const newGame = async () => { if (!(await initMic())) return; if (auth) { scores = { a: 0, b: 0 }; startRound(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'startreq' }); };
    const finishRound = () => { if (!auth) return; over = true; winner = myPeak === oppPeak ? 'tie' : myPeak > oppPeak ? 'a' : 'b'; if (winner !== 'tie') scores[winner]++; ctx.send({ t: 'result', winner, a: myPeak, b: oppPeak, scores }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, 300, 360); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, 300, 360);
        const bar = (x, lvl, peak, col) => { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, 30, 70, 280); g.fillStyle = col; g.fillRect(x, 310 - lvl*280, 70, lvl*280); g.fillStyle = '#fff'; g.fillRect(x-4, 310 - peak*280 - 1, 78, 3); };
        bar(70, me === 'a' ? myLevel : oppLevel, me === 'a' ? myPeak : oppPeak, '#5db4ff');
        bar(170, me === 'a' ? oppLevel : myLevel, me === 'a' ? oppPeak : myPeak, '#ff9d3d');
        g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.fillText('YOU', me === 'a' ? 105 : 205, 330); g.fillText('THEM', me === 'a' ? 205 : 105, 330);
        if (phase === 'count') { const n = Math.ceil((countEnd - performance.now())/1000); g.font = 'bold 70px system-ui'; g.fillText(n > 0 ? n : 'GO!', 150, 180); }
        else if (phase === 'yell') { g.font = 'bold 40px system-ui'; g.fillText('🔊 YELL!', 150, 175); }
    };
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === 'tie' ? "Tie! " : (winner === me ? '🏆 You win! ' : 'You lose ')) + scores[me] + '–' + scores[other(me)] : phase === 'idle' ? 'Tap Start, then SCREAM' : phase === 'count' ? 'Get ready…' : 'LOUDER! 🔊'; };
    const loop = (t) => {
        const dt = (t - lastT)/1000 || 0; lastT = t;
        myLevel = micOn ? readLevel() : 0;
        if (phase === 'count' && performance.now() >= countEnd) { phase = 'yell'; countEnd = performance.now() + ROUND*1000; }
        if (phase === 'yell') { if (myLevel > myPeak) myPeak = myLevel; if (performance.now() >= countEnd) { phase = 'done'; if (auth) finishRound(); } }
        if (t - lastSend > 60) { lastSend = t; ctx.send({ t: 'lvl', v: +myLevel.toFixed(3), p: +myPeak.toFixed(3) }); }
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'scream', label: 'Scream Meter', css: 'apps/scream.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start round</button></div><canvas id="sc-canvas" width="300" height="360"></canvas><div class="sc-hint">needs mic · loudest sustained scream wins</div></div>';
            canvas = ctx.root.querySelector('#sc-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat'); startBtn = ctx.root.querySelector('.nb');
            startBtn.addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); if (actx) actx.close(); ctx = canvas = g = statEl = analyser = stream = actx = null; micOn = false; },
        onData(msg) {
            if (msg.t === 'lvl') { oppLevel = msg.v; oppPeak = msg.p; }
            else if (msg.t === 'start' && !auth) { initMic(); startRound(); }
            else if (msg.t === 'startreq' && auth) { scores = { a: 0, b: 0 }; startRound(); ctx.send({ t: 'start' }); }
            else if (msg.t === 'result') { over = true; winner = msg.winner; myPeak = me === 'a' ? msg.a : msg.b; oppPeak = me === 'a' ? msg.b : msg.a; scores = msg.scores; status(); }
        }
    });
})();
