// Theremin Duet (2-player toy) for appmegle. Conduct music out of thin air: your hand height in
// the camera (motion centroid) plays the melody, quantized to a pentatonic scale so it always
// sounds good; your partner's hand plays the bass line an octave down. Both instruments sound
// on both sides — you're jamming across the planet. No score, no authority, just music.
(function () {
    const MW = 60, MH = 46, MTH = 24, STEPS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24], NAMES = ['A','C','D','E','G','A','C','D','E','G','A'];
    const W = 420, H = 300;
    let ctx = null, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null, vid = null, prev = null;
    let actx = null, osc1 = null, gn1 = null, osc2 = null, gn2 = null, audioOn = false;
    let myY = 0.5, myOn = false, opY = 0.5, opOn = false, myIdx = -1, opIdx = -1, lastSend = 0;
    const centroid = () => {
        if (!vid || !vid.videoWidth) return null; const s = Math.max(MW/vid.videoWidth, MH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s;
        mg.drawImage(vid, (MW-dw)/2, (MH-dh)/2, dw, dh); const cur = mg.getImageData(0, 0, MW, MH).data; const first = !prev; if (first) prev = new Float32Array(MW*MH);
        let n = 0, sy = 0;
        for (let i = 0, p = 0; i < MW*MH; i++, p += 4) { const gr = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gr - prev[i]) > MTH) { n++; sy += (i/MW)|0; } prev[i] = gr; }
        return n > 14 ? sy/n/MH : null;
    };
    const freqOf = (yv, oct) => { const idx = Math.max(0, Math.min(STEPS.length-1, Math.round((1-yv)*(STEPS.length-1)))); return { f: 220 * Math.pow(2, STEPS[idx]/12) * oct, idx }; };
    const initAudio = () => {
        if (audioOn) return; actx = new (window.AudioContext || window.webkitAudioContext)();
        osc1 = actx.createOscillator(); osc1.type = 'triangle'; gn1 = actx.createGain(); gn1.gain.value = 0; osc1.connect(gn1); gn1.connect(actx.destination); osc1.start();
        osc2 = actx.createOscillator(); osc2.type = 'sine'; gn2 = actx.createGain(); gn2.gain.value = 0; osc2.connect(gn2); gn2.connect(actx.destination); osc2.start();
        audioOn = true; statEl.textContent = '🎶 wave a hand up and down';
    };
    const loop = (t) => {
        const c = centroid();
        if (c !== null) { myY = myY*0.6 + c*0.4; myOn = true; } else myOn = false;
        if (audioOn) {
            const m = freqOf(myY, me === 'a' ? 2 : 2); myIdx = m.idx;
            osc1.frequency.setTargetAtTime(m.f, actx.currentTime, 0.04); gn1.gain.setTargetAtTime(myOn ? 0.16 : 0, actx.currentTime, 0.08);
            const o = freqOf(opY, 1); opIdx = o.idx;
            osc2.frequency.setTargetAtTime(o.f/2, actx.currentTime, 0.06); gn2.gain.setTargetAtTime(opOn ? 0.14 : 0, actx.currentTime, 0.1);
        }
        if (t - lastSend > 70) { lastSend = t; ctx.send({ t: 'h', y: +myY.toFixed(3), on: myOn }); }
        draw(); raf = requestAnimationFrame(loop);
    };
    const draw = () => {
        if (!g) return; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(5,10,30,.35)'; g.fillRect(0, 0, W, H);
        const beam = (x, yv, on, col, idx) => {
            g.fillStyle = on ? col.replace(')', ',.25)').replace('rgb', 'rgba') : 'rgba(255,255,255,.06)'; g.fillRect(x-34, 16, 68, H-32);
            for (let i = 0; i < STEPS.length; i++) { const yy = 16 + (1 - i/(STEPS.length-1))*(H-32); g.fillStyle = i === idx && on ? '#fff' : 'rgba(255,255,255,.22)'; g.fillRect(x-26, yy-1, 52, 2); }
            if (on) { const yy = 16 + yv*(H-32); g.fillStyle = col; g.beginPath(); g.arc(x, yy, 13, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText(NAMES[idx] || '', x, yy+4); }
        };
        beam(W*0.3, myY, myOn, 'rgb(93,180,255', myIdx); beam(W*0.7, opY, opOn, 'rgb(255,157,61', opIdx);
        g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText('YOU · melody', W*0.3, H-4); g.fillText('THEM · bass', W*0.7, H-4);
    };
    window.Appmegle.register({
        id: 'theremin', label: 'Theremin Duet', css: 'apps/theremin.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b'; prev = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat">tap to power on</span><button class="app-btn nb">🔌 Power on</button></div><canvas id="th-canvas" width="' + W + '" height="' + H + '"></canvas><div class="th-hint">needs camera · hand high = high note; pentatonic, so it always sounds good</div></div>';
            canvas = ctx.root.querySelector('#th-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', initAudio);
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); if (actx) { try { actx.close(); } catch (e) {} } ctx = canvas = g = statEl = mc = mg = vid = prev = actx = osc1 = osc2 = null; audioOn = false; },
        onData(msg) { if (msg.t === 'h') { opY = msg.y; opOn = msg.on; } }
    });
})();
