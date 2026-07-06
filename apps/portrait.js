// Portrait Duel (2-player) for appmegle. 75 seconds to draw your partner's face while staring
// at their live video. Strokes stream to the other side as you draw but stay HIDDEN until the
// simultaneous reveal — then you each see yourself through a stranger's pen, and rate each
// other's masterpiece out of 5 stars. Caller-authoritative timer. Caller = Blue, answerer = Orange.
(function () {
    const W = 280, H = 340, TIME = 75;
    let ctx = null, auth = false, me = 'a', phase = 'idle', left = TIME, lastSec = -1, oppSegs = [], myRate = 0, theirRate = 0, statEl = null, bodyEl = null, myC = null, myG = null, opC = null, drawing = false, last = null, raf = 0;
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); phase = 'draw'; left = TIME; lastSec = -1; oppSegs = []; myRate = 0; theirRate = 0; ctx.send({ t: 'start' }); build(); };
    const seg = (gg, x0, y0, x1, y1) => { gg.strokeStyle = '#fff'; gg.lineWidth = 3; gg.lineCap = 'round'; gg.beginPath(); gg.moveTo(x0, y0); gg.lineTo(x1, y1); gg.stroke(); };
    const build = () => {
        if (!bodyEl) return;
        statEl.textContent = phase === 'draw' ? '🎨 Draw THEM! ⏱ ' + Math.ceil(left) : phase === 'reveal' ? 'The reveal' : 'Portrait Duel';
        if (phase === 'idle') { bodyEl.innerHTML = '<div class="pd-msg">75 seconds to draw your partner\'s face. Reveal is simultaneous.</div>' + (auth ? '<button class="app-btn" id="pd-start">Start</button>' : '<div class="pd-msg">waiting for the host…</div>'); }
        else if (phase === 'draw') bodyEl.innerHTML = '<div class="pd-msg">👀 stare at their video — draw what you see</div><canvas id="pd-my" width="' + W + '" height="' + H + '" class="pd-canvas"></canvas>';
        else if (phase === 'reveal') bodyEl.innerHTML = '<div class="pd-side"><div class="pd-cell"><div class="pd-lbl">You drew them' + (theirRate ? ' · they rated ' + '★'.repeat(theirRate) : '') + '</div><canvas id="pd-my" width="' + W + '" height="' + H + '" class="pd-canvas pd-small"></canvas></div><div class="pd-cell"><div class="pd-lbl">They drew you — rate it:</div><canvas id="pd-op" width="' + W + '" height="' + H + '" class="pd-canvas pd-small"></canvas><div class="pd-stars">' + [1,2,3,4,5].map(n => '<span class="pd-star' + (n <= myRate ? ' pd-on' : '') + '" data-n="' + n + '">★</span>').join('') + '</div></div></div>' + (auth ? '<button class="app-btn" id="pd-start">New duel</button>' : '');
        const st = bodyEl.querySelector('#pd-start'); if (st) st.addEventListener('click', newGame);
        const nc = bodyEl.querySelector('#pd-my');
        if (nc) { myC = nc; const g2 = nc.getContext('2d'); if (phase === 'reveal' && myG) g2.drawImage(myG.canvas, 0, 0); myG = g2;   // carry my drawing across the rebuild
            if (phase === 'draw') { const pt = (e) => { const r = nc.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width*W, y: (e.clientY-r.top)/r.height*H }; };
                nc.addEventListener('pointerdown', (e) => { drawing = true; last = pt(e); e.preventDefault(); });
                nc.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); seg(myG, last.x, last.y, p.x, p.y); ctx.send({ t: 'seg', a: [Math.round(last.x), Math.round(last.y), Math.round(p.x), Math.round(p.y)] }); last = p; });
                window.addEventListener('pointerup', () => { drawing = false; });
            } }
        const oc = bodyEl.querySelector('#pd-op');
        if (oc) { const og = oc.getContext('2d'); for (const s of oppSegs) seg(og, s[0], s[1], s[2], s[3]); opC = oc; }
        bodyEl.querySelectorAll('.pd-star').forEach(s => s.addEventListener('click', () => { myRate = +s.dataset.n; ctx.send({ t: 'rate', n: myRate }); build(); }));
    };
    const loop = (t) => { if (auth && phase === 'draw') { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; ctx.send({ t: 'tick', s }); statEl.textContent = '🎨 Draw THEM! ⏱ ' + s; } if (left <= 0) { phase = 'reveal'; ctx.send({ t: 'ph', p: 'reveal' }); build(); } } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'portrait', label: 'Portrait Duel', css: 'apps/portrait.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; oppSegs = [];
            ctx.root.innerHTML = '<div class="app-col" id="pd"><div class="app-bar"><span class="stat"></span></div><div id="pd-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#pd-body');
            build(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = myC = myG = opC = null; },
        onData(msg) {
            if (msg.t === 'seg') oppSegs.push(msg.a);
            else if (msg.t === 'start' && !auth) { phase = 'draw'; left = TIME; oppSegs = []; myRate = 0; theirRate = 0; build(); }
            else if (msg.t === 'tick' && !auth) { left = msg.s; if (statEl && phase === 'draw') statEl.textContent = '🎨 Draw THEM! ⏱ ' + msg.s; }
            else if (msg.t === 'ph' && !auth) { phase = msg.p; build(); }
            else if (msg.t === 'rate') { theirRate = msg.n; build(); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
