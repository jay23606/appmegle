// Flappy Race (2-player duel) for appmegle. Both players fly the SAME seed-synced pipe
// field: tap / click / SPACE to flap, squeeze through the gaps, one touch ends your run.
// Unlike Geometry Dash's restart-from-zero race this stays true to Flappy Bird — a crash
// is final and your score is the pipes you cleared, so the round ends once both birds are
// down and the higher score takes it. While you fly, your opponent's ghost bird drifts
// through the same world ahead of or behind you, which is what makes it feel like a race.
// Each client simulates its own bird; the caller seeds the field and arbitrates the win.
// Caller = Blue bird, answerer = Orange bird.
(function () {
    const CW = 560, CH = 320, GH = 34, GY = CH - GH;           // canvas, ground strip
    const PX = 110, BR = 13;                                    // bird screen x, radius
    const GRAV = 1750, FLAP = -470, MAXV = 620, SPEED = 178;    // floaty enough to stay fair on a phone
    const PW = 58, SP = 250, FIRST = 620;                       // pipe width, spacing, first pipe world x
    const GAP0 = 138, GAP1 = 98, RAMP = 26;                     // the gap tightens over the first RAMP pipes
    let ctx = null, auth = false, me = 'a', raf = 0, canvas = null, g = null, statEl = null;
    let seed = 1, dist = 0, by = CH / 2, vy = 0, rot = 0, score = 0, passed = -1;
    let phase = 'idle', winner = null, myFinal = null, oppFinal = null;
    let oppD = 0, oppY = CH / 2, oppScore = 0, oppAlive = false;
    let lastT = 0, lastSend = 0, flash = 0, best = 0, trail = [];

    // Deterministic per-pipe randomness: both clients derive an identical field from the
    // seed alone, so no pipe geometry ever has to cross the wire.
    const hash = (s, i) => { let t = (s ^ Math.imul(i + 1, 0x9E3779B1)) | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pipeX = (i) => FIRST + i * SP;
    const gapH = (i) => Math.max(GAP1, GAP0 - (GAP0 - GAP1) * Math.min(1, i / RAMP));
    const gapY = (i) => { const h = gapH(i), m = 46; return m + hash(seed, i) * (GY - h - m * 2); };
    const firstIdx = (worldL) => Math.max(0, Math.floor((worldL - FIRST - PW) / SP));

    const resetBird = () => { dist = 0; by = CH / 2; vy = 0; rot = 0; score = 0; passed = -1; trail = []; };
    const startRound = (sd) => {
        seed = sd; resetBird();
        winner = null; myFinal = null; oppFinal = null;
        oppD = 0; oppY = CH / 2; oppScore = 0; oppAlive = true;
        phase = 'run';
    };
    const newGame = () => {
        if (!auth) return ctx.send({ t: 'startreq' });
        seed = (Math.random() * 1e9) | 0;
        ctx.send({ t: 'start', seed });
        startRound(seed);
    };
    // The caller owns the verdict so the two sides can never disagree about who won.
    const settle = () => {
        if (!auth || winner || myFinal === null || oppFinal === null) return;
        const w = myFinal === oppFinal ? 'tie' : (myFinal > oppFinal ? me : (me === 'a' ? 'b' : 'a'));
        winner = w; phase = 'over'; ctx.send({ t: 'result', w });
    };
    const die = () => {
        if (phase !== 'run') return;
        phase = 'dead'; flash = 1; myFinal = score; best = Math.max(best, score);
        ctx.send({ t: 'dead', s: score });
        settle();
    };

    const step = (dt) => {
        if (phase !== 'run') return;
        vy = Math.min(MAXV, vy + GRAV * dt); by += vy * dt; dist += SPEED * dt;
        rot = Math.max(-0.5, Math.min(1.15, vy / 520));
        trail.push({ x: PX - 6, y: by, a: 1 }); if (trail.length > 12) trail.shift();
        for (const p of trail) p.a -= dt * 2.4;
        if (by + BR >= GY || by - BR <= 0) { by = Math.max(BR, Math.min(GY - BR, by)); return die(); }
        const birdL = dist, birdR = dist + BR * 2, birdC = dist + BR;
        for (let i = firstIdx(birdL); pipeX(i) <= birdR; i++) {
            const px = pipeX(i);
            if (px + PW < birdL) { if (i > passed) { passed = i; score++; } continue; }
            const top = gapY(i), bot = top + gapH(i);
            if (by - BR < top || by + BR > bot) return die();
            if (birdC > px + PW / 2 && i > passed) { passed = i; score++; }
        }
    };

    const drawBird = (x, y, tilt, colour, dark, alpha) => {
        g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(tilt);
        g.fillStyle = colour; g.beginPath(); g.ellipse(0, 0, BR * 1.15, BR, 0, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.ellipse(-BR * 0.3, BR * 0.12, BR * 0.5, BR * 0.34, 0.25, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(BR * 0.42, -BR * 0.3, BR * 0.34, 0, 7); g.fill();
        g.fillStyle = '#101026'; g.beginPath(); g.arc(BR * 0.54, -BR * 0.3, BR * 0.16, 0, 7); g.fill();
        g.fillStyle = '#ffc23a'; g.beginPath(); g.moveTo(BR * 0.95, 0); g.lineTo(BR * 1.6, BR * 0.16); g.lineTo(BR * 0.95, BR * 0.32); g.closePath(); g.fill();
        g.restore();
    };

    const draw = () => {
        if (!g) return;
        g.clearRect(0, 0, CW, CH);
        const sky = g.createLinearGradient(0, 0, 0, GY); sky.addColorStop(0, '#12103a'); sky.addColorStop(1, '#2b1f5c');
        g.fillStyle = sky; g.fillRect(0, 0, CW, GY);
        // parallax skyline, so speed still reads in the gaps between pipes
        g.fillStyle = 'rgba(120,110,200,.20)';
        for (let i = 0; i < 16; i++) {
            const bx = ((i * 130 - dist * 0.28) % (CW + 160) + CW + 160) % (CW + 160) - 80;
            const bh = 30 + ((i * 37) % 46);
            g.fillRect(bx, GY - bh, 62, bh);
        }
        for (let i = firstIdx(dist - PX); pipeX(i) - dist < CW; i++) {
            const sx = PX + (pipeX(i) - dist);
            const top = gapY(i), bot = top + gapH(i);
            const body = g.createLinearGradient(sx, 0, sx + PW, 0);
            body.addColorStop(0, '#39c07a'); body.addColorStop(0.45, '#5be6a0'); body.addColorStop(1, '#2a9660');
            g.fillStyle = body; g.fillRect(sx, 0, PW, top); g.fillRect(sx, bot, PW, GY - bot);
            g.fillStyle = '#7ff0bb'; g.fillRect(sx - 5, top - 22, PW + 10, 22); g.fillRect(sx - 5, bot, PW + 10, 22);
            g.strokeStyle = 'rgba(8,40,26,.75)'; g.lineWidth = 2;
            g.strokeRect(sx, 0, PW, top); g.strokeRect(sx, bot, PW, GY - bot);
            g.strokeRect(sx - 5, top - 22, PW + 10, 22); g.strokeRect(sx - 5, bot, PW + 10, 22);
        }
        g.fillStyle = '#4a3a72'; g.fillRect(0, GY, CW, GH);
        g.fillStyle = 'rgba(255,255,255,.16)';
        for (let x = -(dist % 26); x < CW; x += 26) g.fillRect(x, GY, 13, 5);
        g.strokeStyle = '#8f8fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, GY); g.lineTo(CW, GY); g.stroke();
        // the opponent's ghost, drawn in the shared world so you can see who is ahead
        const oppColour = me === 'a' ? '#ff9d3d' : '#5db4ff', oppDark = me === 'a' ? '#b35e18' : '#2a6cb0';
        if (oppAlive && phase !== 'idle') {
            const ox = PX + (oppD - dist);
            if (ox > -40 && ox < CW + 40) drawBird(ox, oppY, 0, oppColour, oppDark, 0.42);
            else {
                const behind = ox <= -40;
                g.fillStyle = oppColour; g.font = 'bold 12px system-ui'; g.textAlign = behind ? 'left' : 'right';
                g.fillText(behind ? '◀ them' : 'them ▶', behind ? 8 : CW - 8, 42);
            }
        }
        for (const p of trail) {
            if (p.a <= 0) continue;
            g.globalAlpha = p.a * 0.35; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d';
            g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
        if (phase !== 'over') drawBird(PX + BR, by, rot, me === 'a' ? '#5db4ff' : '#ff9d3d', me === 'a' ? '#2a6cb0' : '#b35e18', phase === 'dead' ? 0.5 : 1);
        g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.textAlign = 'center';
        g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(String(score), CW / 2, 44); g.shadowBlur = 0;
        g.font = 'bold 12px system-ui';
        g.textAlign = 'left'; g.fillStyle = me === 'a' ? '#5db4ff' : '#ff9d3d'; g.fillText('you ' + score, 12, 20);
        g.textAlign = 'right'; g.fillStyle = oppColour; g.fillText('them ' + (oppFinal === null ? oppScore : oppFinal + ' ✔'), CW - 12, 20);
        if (flash > 0) { g.fillStyle = 'rgba(255,80,80,' + flash * 0.5 + ')'; g.fillRect(0, 0, CW, CH); flash -= 0.05; }
        g.textAlign = 'center';
        if (phase === 'idle') { g.fillStyle = '#fff'; g.font = 'bold 19px system-ui'; g.fillText('tap / space to flap — most pipes wins', CW / 2, CH / 2); }
        if (phase === 'dead') {
            g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, CW, CH);
            g.fillStyle = '#fff'; g.font = 'bold 26px system-ui';
            g.fillText('down! ' + score + ' pipe' + (score === 1 ? '' : 's'), CW / 2, CH / 2);
            g.font = '14px system-ui';
            g.fillText(oppFinal === null ? 'they are still flying…' : 'waiting for the result…', CW / 2, CH / 2 + 26);
        }
        if (phase === 'over') {
            g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, CW, CH);
            g.fillStyle = '#fff'; g.font = 'bold 38px system-ui';
            g.fillText(winner === 'tie' ? '\u{1F91D} dead heat!' : (winner === me ? '\u{1F3C6} YOU WIN!' : 'you lose'), CW / 2, CH / 2);
            g.font = '15px system-ui';
            g.fillText((myFinal === null ? score : myFinal) + ' — ' + (oppFinal === null ? oppScore : oppFinal), CW / 2, CH / 2 + 30);
        }
    };

    const status = () => {
        if (!statEl) return;
        statEl.textContent = phase === 'idle' ? 'Flappy Race — most pipes wins'
            : phase === 'over' ? (winner === 'tie' ? '\u{1F91D} Dead heat' : winner === me ? '\u{1F3C6} You win!' : 'You lose')
            : phase === 'dead' ? 'Down on ' + score + (oppFinal === null ? ' · they are still flying' : ' · settling…')
            : score + ' pipe' + (score === 1 ? '' : 's') + (oppFinal === null ? ' · them ' + oppScore : ' · they finished on ' + oppFinal) + (best ? ' · best ' + best : '');
    };
    const loop = (t) => {
        const dt = Math.min(0.032, (t - lastT) / 1000 || 0); lastT = t;
        step(dt);
        if (phase === 'run' && t - lastSend > 90) { lastSend = t; ctx.send({ t: 'p', d: Math.round(dist), y: Math.round(by), s: score }); }
        draw(); status();
        raf = requestAnimationFrame(loop);
    };
    const flap = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (phase === 'idle') return newGame();
        if (phase !== 'run') return;
        vy = FLAP;
    };

    window.Appmegle.register({
        id: 'flappy', label: 'Flappy Race', css: 'apps/flappy.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            phase = 'idle'; winner = null; myFinal = null; oppFinal = null; oppAlive = false; best = 0;
            resetBird();
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">▶ New round</button></div><canvas id="fl-canvas" width="' + CW + '" height="' + CH + '"></canvas><div class="fl-hint">tap the board / SPACE to flap · one touch and your run is over · clear the most pipes to win</div></div>';
            canvas = ctx.root.querySelector('#fl-canvas'); g = canvas.getContext('2d'); statEl = ctx.root.querySelector('.stat');
            canvas.addEventListener('pointerdown', flap);
            this._kd = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') flap(e); };
            window.addEventListener('keydown', this._kd);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', this._kd);
            ctx = canvas = g = statEl = null; trail = [];
        },
        onData(msg) {
            if (msg.t === 'start') { if (!auth) startRound(msg.seed); }
            else if (msg.t === 'startreq' && auth) newGame();
            else if (msg.t === 'p') { oppD = msg.d; oppY = msg.y; oppScore = msg.s; oppAlive = true; }
            else if (msg.t === 'dead') { oppFinal = msg.s; oppScore = msg.s; oppAlive = false; settle(); }
            else if (msg.t === 'result') { winner = msg.w; phase = 'over'; if (myFinal === null) myFinal = score; }
        }
    });
})();
