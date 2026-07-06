// Shadow Theater (2-player) for appmegle. Both players' SILHOUETTES (background-subtraction,
// like Hole in the Wall) are cast onto ONE shared stage — your shadows can overlap and "touch"
// across the planet. The performer acts out a prompt as a shadow puppet; the partner guesses
// out loud; got-it/skip scoring, roles swap. Masks are bit-packed (48x36 → 216 bytes) and
// streamed at ~8fps. Set your background first (step out of frame). Performer-authoritative.
(function () {
    const GW = 48, GH = 36, DIFF = 32, W = 480, H = 270;
    const PROMPTS = ['a T-rex','a butterfly','a boxing match','walking a dog','swimming','a helicopter','playing guitar','a cowboy duel','juggling','a ghost','weightlifting','conducting an orchestra','climbing a ladder','a chicken','slow-motion running','a robot','rowing a boat','a cat stretching','an umbrella in wind','making pizza'];
    let ctx = null, me = 'a', raf = 0, canvas = null, g = null, statEl = null, ctrlEl = null, mc = null, mg = null, vid = null, bg = null;
    let oppMask = null, performer = null, prompt = '', scores = { a: 0, b: 0 }, seen = new Set(), lastSend = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const grab = () => { if (!vid || !vid.videoWidth) return null; const s = Math.max(GW/vid.videoWidth, GH/vid.videoHeight), dw = vid.videoWidth*s, dh = vid.videoHeight*s; mg.save(); mg.translate(GW, 0); mg.scale(-1, 1); mg.drawImage(vid, (GW-dw)/2, (GH-dh)/2, dw, dh); mg.restore(); return mg.getImageData(0, 0, GW, GH).data; };
    const captureBG = () => { const d = grab(); if (!d) return; bg = new Float32Array(GW*GH); for (let i = 0, p = 0; i < GW*GH; i++, p += 4) bg[i] = (d[p]+d[p+1]+d[p+2])/3; statEl.textContent = 'Background set 🎭'; };
    const myMask = () => { const d = grab(); if (!d || !bg) return null; const m = new Uint8Array(GW*GH); for (let i = 0, p = 0; i < GW*GH; i++, p += 4) { const gr = (d[p]+d[p+1]+d[p+2])/3; if (Math.abs(gr - bg[i]) > DIFF) m[i] = 1; } return m; };
    const pack = (m) => { const out = []; for (let i = 0; i < GW*GH; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (m[i+k]) b |= 1 << k; out.push(b); } return out; };
    const unpack = (arr) => { const m = new Uint8Array(GW*GH); for (let i = 0; i < arr.length; i++) for (let k = 0; k < 8; k++) if (arr[i] & (1 << k)) m[i*8+k] = 1; return m; };
    const pickPrompt = () => { if (seen.size >= PROMPTS.length) seen.clear(); let p; do { p = PROMPTS[(Math.random()*PROMPTS.length)|0]; } while (seen.has(p)); seen.add(p); return p; };
    const startRound = () => { performer = me; prompt = pickPrompt(); ctx.send({ t: 'round', performer: me }); rebuild(); };
    const got = () => { scores[other(me)]++; performer = null; ctx.send({ t: 'end', scores }); rebuild(); };
    const drawMask = (m, col) => { if (!m) return; const cw = W/GW, ch = H/GH; g.fillStyle = col; for (let yy = 0; yy < GH; yy++) for (let xx = 0; xx < GW; xx++) if (m[yy*GW+xx]) g.fillRect(xx*cw-0.5, yy*ch-0.5, cw+1, ch+1); };
    const loop = (t) => {
        if (!g) { raf = requestAnimationFrame(loop); return; }
        g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,244,214,.14)'; g.fillRect(0, 0, W, H);   // lantern glow
        const mm = myMask();
        drawMask(oppMask, 'rgba(35,20,50,.75)'); drawMask(mm, 'rgba(15,25,60,.75)');
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, H-10, W, 10);
        if (mm && t - lastSend > 120) { lastSend = t; ctx.send({ t: 'm', a: pack(mm) }); }
        raf = requestAnimationFrame(loop);
    };
    const rebuild = () => {
        if (!ctrlEl) return; const amPerf = performer === me;
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[other(me)] + ' Them';
        let h = '';
        if (!bg) h = '<div class="sh-msg">Step out of frame, then set your background.</div>';
        else if (!performer) h = '<div class="sh-msg">🎭 Shadows on! Act out prompts — partner guesses out loud.</div><button class="app-btn" id="sh-start">I\'ll perform</button>';
        else if (amPerf) h = '<div class="sh-msg">Act out:</div><div class="sh-prompt">' + prompt + '</div><div class="sh-btns"><button class="app-btn" id="sh-got">✓ They got it</button><button class="app-btn" id="sh-skip">↷ Skip</button></div>';
        else h = '<div class="sh-msg">👀 What are they acting out? Shout your guesses!</div>';
        ctrlEl.innerHTML = h;
        const st = ctrlEl.querySelector('#sh-start'), gt = ctrlEl.querySelector('#sh-got'), sk = ctrlEl.querySelector('#sh-skip');
        if (st) st.addEventListener('click', startRound);
        if (gt) gt.addEventListener('click', got);
        if (sk) sk.addEventListener('click', () => { prompt = pickPrompt(); rebuild(); });
    };
    window.Appmegle.register({
        id: 'shadow', label: 'Shadow Theater', css: 'apps/shadow.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b'; bg = null; oppMask = null; performer = null; scores = { a: 0, b: 0 }; seen = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="sh"><div class="app-bar"><span class="stat"></span><button class="app-btn" id="sh-bg">Set background</button></div><canvas id="sh-canvas" width="' + W + '" height="' + H + '"></canvas><div id="sh-ctrl"></div><div class="sh-hint">needs camera · your shadows share one stage — they can touch</div></div>';
            canvas = ctx.root.querySelector('#sh-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat'); ctrlEl = ctx.root.querySelector('#sh-ctrl');
            vid = document.getElementById('local-video'); mc = document.createElement('canvas'); mc.width = GW; mc.height = GH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('#sh-bg').addEventListener('click', () => { captureBG(); rebuild(); });
            rebuild(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = ctrlEl = mc = mg = vid = bg = oppMask = null; },
        onData(msg) {
            if (msg.t === 'm') oppMask = unpack(msg.a);
            else if (msg.t === 'round') { performer = msg.performer; rebuild(); }
            else if (msg.t === 'end') { scores = msg.scores; performer = null; rebuild(); }
        }
    });
})();
