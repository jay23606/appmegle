// Webcam Volleyball (2-player, motion-controlled) for appmegle. The ball lives on ONE
// player's camera at a time; bump it up with your hand (frame-difference motion detection)
// and it flies over the top to your opponent's feed. Let it hit your floor and they score.
// First to 7 wins. The owner of the ball simulates it locally (they need their own motion);
// the caller is authoritative for score + serving. Caller = Blue, answerer = Orange.
(function () {
    const CW = 480, CH = 620, MW = 64, MH = 84, G = 900, MTH = 22, BR = 22, BUMP = 640, WIN = 7;
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null, mc = null, mg = null;
    let vid = null, prev = null, ball = null, owner = 'a', rally = false, score = { a: 0, b: 0 }, over = false, winner = null, flash = 0, bumpCd = 0, lastT = 0;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const coverDraw = (c, v, w, h) => { const s = Math.max(w/v.videoWidth, h/v.videoHeight), dw = v.videoWidth*s, dh = v.videoHeight*s; c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(v, (w-dw)/2, (h-dh)/2, dw, dh); c.restore(); };
    const motion = () => { if (!vid || !vid.videoWidth) return null; coverDraw(mg, vid, MW, MH); const cur = mg.getImageData(0, 0, MW, MH).data; const first = !prev; if (first) prev = new Float32Array(MW*MH); let sx = 0, sy = 0, n = 0; for (let i = 0, p = 0; i < MW*MH; i++, p += 4) { const gray = (cur[p]+cur[p+1]+cur[p+2])/3; if (!first && Math.abs(gray - prev[i]) > MTH) { sx += i % MW; sy += (i/MW)|0; n++; } prev[i] = gray; } return n > 8 ? { cx: sx/n/MW*CW, cy: sy/n/MH*CH, n } : null; };

    const iOwn = () => owner === me && rally && !over;
    const startServe = () => { ball = { x: CW/2, y: -BR, vx: (Math.random()*2-1)*70, vy: 150 }; rally = true; };
    const startIncoming = (vx) => { ball = { x: CW/2, y: -BR, vx: (vx || 0)*0.7, vy: 130 }; rally = true; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); score = { a: 0, b: 0 }; over = false; winner = null; owner = 'a'; ctx.send({ t: 'serve', owner, score, over, winner }); startServe(); status(); };

    const point = (scorer) => { if (over) return; score[scorer]++; if (score[scorer] >= WIN) { over = true; winner = scorer; } else owner = scorer; ctx.send({ t: 'serve', owner, score, over, winner }); rally = false; if (!over && owner === me) startServe(); status(); };
    const callerMiss = () => point(other(owner));
    const callerPass = (vx) => { const from = owner; owner = other(from); ctx.send({ t: 'incoming', owner, vx }); rally = false; if (owner === me) startIncoming(vx); status(); };
    const doMiss = () => { rally = false; if (auth) callerMiss(); else ctx.send({ t: 'miss' }); };
    const doPass = (vx) => { rally = false; if (auth) callerPass(vx); else ctx.send({ t: 'pass', vx }); };

    const sim = (dt) => {
        if (!iOwn()) return;
        if (bumpCd > 0) bumpCd -= dt;
        const mo = motion();
        if (mo && bumpCd <= 0 && Math.hypot(mo.cx - ball.x, mo.cy - ball.y) < BR + 46) { ball.vy = -BUMP; ball.vx += (ball.x - mo.cx) * 6; ball.vx = Math.max(-420, Math.min(420, ball.vx)); flash = 1; bumpCd = 0.22; }
        ball.vy += G*dt; ball.x += ball.vx*dt; ball.y += ball.vy*dt;
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); } if (ball.x > CW-BR) { ball.x = CW-BR; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < -BR && ball.vy < 0) return doPass(ball.vx);
        if (ball.y > CH + BR) return doMiss();
    };
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === me ? '🏆 You win! ' : 'You lose ') + score[me] + '–' + score[other(me)] : 'You ' + score[me] + ' – ' + score[other(me)] + ' Them · ' + (owner === me ? 'YOUR ball — bump it!' : "opponent's ball"); };
    const draw = () => {
        if (!g) return;
        if (vid && vid.videoWidth) coverDraw(g, vid, CW, CH); else { g.fillStyle = '#111'; g.fillRect(0, 0, CW, CH); }
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, CW, CH);
        // net line top, floor bottom
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(0, 6); g.lineTo(CW, 6); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(200,80,80,.5)'; g.fillRect(0, CH-6, CW, 6);
        if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (flash*0.25) + ')'; g.fillRect(0, 0, CW, CH); flash -= 0.08; }
        if (owner === me && rally && !over && ball) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, 7); g.fill(); g.strokeStyle = '#e85'; g.lineWidth = 2; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, 3.3); g.stroke(); }
        else if (!over) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, CH/2-30, CW, 60); g.fillStyle = '#fff'; g.font = 'bold 22px system-ui'; g.textAlign = 'center'; g.fillText("Opponent's serve…", CW/2, CH/2+8); }
        if (over) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, CH/2-40, CW, 80); g.fillStyle = '#fff'; g.font = 'bold 28px system-ui'; g.textAlign = 'center'; g.fillText(winner === me ? 'YOU WIN!' : 'YOU LOSE', CW/2, CH/2+10); }
        status();
    };
    const loop = (t) => { const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t; sim(dt); draw(); raf = requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'volley', label: 'Webcam Volleyball', css: 'apps/volley.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; prev = null; rally = false; over = false; score = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><canvas id="vb-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="vb-hint">bump the ball up with your hand — don\'t let it hit your floor</div></div>';
            canvas = ctx.root.querySelector('#vb-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            vid = document.getElementById('local-video');
            mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; mg = mc.getContext('2d', { willReadFrequently: true });
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else statEl.textContent = 'Waiting for the host…';
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = vid = mc = mg = prev = ball = null; },
        onData(msg) {
            if (msg.t === 'serve') { score = msg.score; owner = msg.owner; over = msg.over; winner = msg.winner; rally = false; if (!over && owner === me) startServe(); status(); }
            else if (msg.t === 'incoming') { owner = msg.owner; rally = false; if (owner === me) startIncoming(msg.vx); status(); }
            else if (msg.t === 'miss' && auth) callerMiss();
            else if (msg.t === 'pass' && auth) callerPass(msg.vx);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
