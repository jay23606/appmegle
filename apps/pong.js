// ===========================================================================
//  Pong app for appmegle.
//
//  Real-time, so it uses an authoritative model instead of trading inputs:
//    - The caller (player 1) owns the ball physics and the score. It sends
//      ball + score state ~30x/sec, and renders the left paddle.
//    - The answerer (player 2) renders from that state and only simulates its
//      own paddle, which it sends back ~30x/sec.
//  Each side controls its paddle by moving the pointer up/down over the board.
//  Logical coordinates are a fixed 600x360 grid; CSS scales the canvas.
// ===========================================================================
(function () {
    const W = 600, H = 360, R = 7, PADX = 22, PW = 10, PH = 74, SEND_MS = 33;

    let ctx = null, canvas = null, g = null, auth = false, raf = 0;
    let leftY = 0.5, rightY = 0.5;                 // normalized paddle centers (0..1)
    let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 }, sl = 0, sr = 0;
    let lastT = 0, lastSend = 0, onMove = null;

    const serve = (dir) => {                        // dir: -1 toward left, +1 toward right
        ball.x = W / 2; ball.y = H / 2;
        const ang = (Math.random() * 0.6 - 0.3);    // small vertical spread
        const sp = 300;
        ball.vx = dir * sp * Math.cos(ang);
        ball.vy = sp * Math.sin(ang);
    };

    const hit = (py) => Math.abs(ball.y - py * H) < PH / 2 + R;   // ball within a paddle's span

    const step = (dt) => {                          // authoritative physics (caller only)
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
        if (ball.y > H - R) { ball.y = H - R; ball.vy = -Math.abs(ball.vy); }
        // left paddle
        if (ball.vx < 0 && ball.x - R < PADX + PW && ball.x - R > PADX - 6 && hit(leftY)) {
            ball.x = PADX + PW + R; ball.vx = -ball.vx * 1.04;
            ball.vy += (ball.y - leftY * H) * 2.2;
        }
        // right paddle
        if (ball.vx > 0 && ball.x + R > W - PADX - PW && ball.x + R < W - PADX + 6 && hit(rightY)) {
            ball.x = W - PADX - PW - R; ball.vx = -ball.vx * 1.04;
            ball.vy += (ball.y - rightY * H) * 2.2;
        }
        if (ball.x < -R) { sr++; serve(1); }
        if (ball.x > W + R) { sl++; serve(-1); }
    };

    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.setLineDash([8, 12]);
        g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(255,255,255,.92)';
        g.fillRect(PADX, leftY * H - PH / 2, PW, PH);
        g.fillRect(W - PADX - PW, rightY * H - PH / 2, PW, PH);
        g.beginPath(); g.arc(ball.x, ball.y, R, 0, 7); g.fill();
        g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillText(sl, W / 2 - 40, 44); g.fillText(sr, W / 2 + 40, 44);
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT) / 1000 || 0); lastT = t;
        if (auth) {
            step(dt);
            if (t - lastSend > SEND_MS) { lastSend = t; ctx.send({ t: 's', x: ball.x, y: ball.y, sl, sr, ly: leftY }); }
        }
        draw();
        raf = requestAnimationFrame(loop);
    };

    const setMyPaddle = (e) => {
        const r = canvas.getBoundingClientRect();
        const y = Math.max(0.08, Math.min(0.92, (e.clientY - r.top) / r.height));
        if (auth) leftY = y; else {
            rightY = y;
            const now = performance.now();
            if (now - lastSend > SEND_MS) { lastSend = now; ctx.send({ t: 'p', y }); }
        }
    };

    window.Appmegle.register({
        id: 'pong',
        label: 'Pong',
        css: 'apps/pong.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller;
            sl = sr = 0; leftY = rightY = 0.5;
            ctx.root.innerHTML =
                '<div id="pong-wrap">' +
                  '<canvas id="pong-canvas" width="' + W + '" height="' + H + '"></canvas>' +
                  '<div id="pong-hint">' + (auth ? 'You are the LEFT paddle' : 'You are the RIGHT paddle') + ' — move your pointer up/down</div>' +
                '</div>';
            canvas = ctx.root.querySelector('#pong-canvas');
            g = canvas.getContext('2d');
            onMove = setMyPaddle;
            canvas.addEventListener('pointermove', onMove);
            canvas.addEventListener('pointerdown', onMove);
            if (auth) serve(Math.random() < 0.5 ? -1 : 1);
            lastT = performance.now(); lastSend = 0;
            raf = requestAnimationFrame(loop);
        },
        unmount() {
            cancelAnimationFrame(raf);
            if (canvas && onMove) { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onMove); }
            ctx = null; canvas = null; g = null; raf = 0;
        },
        onData(msg) {
            if (msg.t === 's' && !auth) {            // answerer applies authoritative state
                ball.x = msg.x; ball.y = msg.y; sl = msg.sl; sr = msg.sr; leftY = msg.ly;
            } else if (msg.t === 'p' && auth) {      // caller reads answerer's paddle
                rightY = msg.y;
            }
        }
    });
})();
