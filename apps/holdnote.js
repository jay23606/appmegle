// Hold the Note (2-player) for appmegle. On GO, both sing/hum one continuous note; the app
// reads your live mic and measures how long you sustain it above a volume floor. Drop the note
// and your time locks — longest hold wins. Each client measures its own mic + broadcasts its
// hold time; the caller arbitrates. Caller = Blue, answerer = Orange.
(function () {
    const FLOOR = 0.07, GRACE = 0.35;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let actx = null, analyser = null, buf = null, stream = null, micOn = false;
    let level = 0, hold = 0, done = false, started = false, singStart = 0, below = 0, oppHold = 0, oppDone = false;
    let phase = 'idle', countEnd = 0, scores = { a: 0, b: 0 }, over = false, winner = null, lastT = 0, lastSend = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const initMic = async () => { if (micOn) return true; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaStreamSource(stream); analyser = actx.createAnalyser(); analyser.fftSize = 512; buf = new Uint8Array(analyser.fftSize); src.connect(analyser); micOn = true; return true; } catch (e) { statEl.textContent = 'Mic needed — allow microphone access'; return false; } };
    const readLevel = () => { if (!analyser) return 0; analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128)/128; s += v*v; } return Math.min(1, Math.sqrt(s/buf.length) * 3.2); };

    const startRound = () => { hold = 0; done = false; started = false; below = 0; oppHold = 0; oppDone = false; over = false; winner = null; phase = 'count'; countEnd = performance.now() + 3000; };
    const newGame = async () => { if (!(await initMic())) return; if (auth) { scores = { a: 0, b: 0 }; startRound(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'startreq' }); };
    const finish = () => { if (!auth) return; over = true; winner = hold === oppHold ? 'tie' : hold > oppHold ? 'a' : 'b'; if (winner !== 'tie') scores[winner]++; ctx.send({ t: 'result', winner, a: hold, b: oppHold, scores }); };

    const draw = () => {
        if (!g) return; g.clearRect(0, 0, 360, 260); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, 360, 260);
        const card = (x, label, t, d, singing, col) => { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, 60, 150, 150); g.fillStyle = col; g.font = 'bold 36px system-ui'; g.textAlign = 'center'; g.fillText(t.toFixed(1) + 's', x+75, 130); g.fillStyle = '#fff'; g.font = '13px system-ui'; g.fillText(label, x+75, 90); g.fillText(d ? 'stopped' : singing ? '🎵 holding' : '…', x+75, 180); };
        card(20, 'YOU', me === 'a' ? hold : oppHold, me === 'a' ? done : oppDone, started && !done && phase === 'sing', '#5db4ff');
        card(190, 'THEM', me === 'a' ? oppHold : hold, me === 'a' ? oppDone : done, false, '#ff9d3d');
        if (phase === 'count') { const n = Math.ceil((countEnd - performance.now())/1000); g.fillStyle = '#fff'; g.font = 'bold 56px system-ui'; g.textAlign = 'center'; g.fillText(n > 0 ? n : 'GO!', 180, 40); }
        else if (phase === 'sing') { g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.textAlign = 'center'; g.fillText('🎤 Hooooold the note!', 180, 36); }
    };
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === 'tie' ? 'Tie! ' : (winner === me ? '🏆 You win! ' : 'You lose ')) + scores[me] + '–' + scores[other(me)] : phase === 'idle' ? 'Tap Start, then hold one note' : phase === 'count' ? 'Get ready…' : (done ? 'You held ' + hold.toFixed(1) + 's' : 'Keep going! 🎵'); };
    const loop = (t) => {
        const dt = (t - lastT)/1000 || 0; lastT = t; level = micOn ? readLevel() : 0;
        if (phase === 'count' && performance.now() >= countEnd) { phase = 'sing'; singStart = performance.now(); }
        if (phase === 'sing' && !done) {
            if (level >= FLOOR) { started = true; below = 0; hold = (performance.now() - singStart)/1000; } else if (started) { below += dt; if (below >= GRACE) { done = true; } }
        }
        if (t - lastSend > 80) { lastSend = t; ctx.send({ t: 'h', time: +hold.toFixed(2), done }); }
        if (auth && phase === 'sing' && done && oppDone && !over) finish();
        draw(); status(); raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'holdnote', label: 'Hold the Note', css: 'apps/holdnote.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Start round</button></div><canvas id="hn-canvas" width="360" height="260"></canvas><div class="hn-hint">needs mic · hold one continuous note the longest</div></div>';
            canvas = ctx.root.querySelector('#hn-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); if (actx) actx.close(); ctx = canvas = g = statEl = analyser = stream = actx = null; micOn = false; },
        onData(msg) {
            if (msg.t === 'h') { oppHold = msg.time; oppDone = msg.done; }
            else if (msg.t === 'start' && !auth) { initMic(); startRound(); }
            else if (msg.t === 'startreq' && auth) { scores = { a: 0, b: 0 }; startRound(); ctx.send({ t: 'start' }); }
            else if (msg.t === 'result') { over = true; winner = msg.winner; hold = me === 'a' ? msg.a : msg.b; oppHold = me === 'a' ? msg.b : msg.a; scores = msg.scores; status(); }
        }
    });
})();
