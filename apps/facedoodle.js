// Face Doodle (2-player toy) for appmegle. A transparent shared canvas riding over the live
// video — draw mustaches, crowns and tears straight onto your partner's face (and they onto
// yours), or stamp emoji. Everything syncs live both ways in normalized coordinates. A toy,
// not a game; people stay for it. No sides, no authority.
(function () {
    const COLORS = ['#ff4fd8', '#4fffea', '#ffd24a', '#ffffff', '#7bff6b'];
    const STAMPS = ['🤓', '👑', '🎩', '💋', '😈', '⭐', '❤️', '🥸'];
    let ctx = null, canvas = null, g = null, mode = 'pen', color = COLORS[0], stamp = STAMPS[0], drawing = false, last = null, barEl = null;
    const seg = (x0, y0, x1, y1, col) => { g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0*canvas.width, y0*canvas.height); g.lineTo(x1*canvas.width, y1*canvas.height); g.stroke(); };
    const put = (x, y, e) => { g.font = Math.round(canvas.width*0.09) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x*canvas.width, y*canvas.height); };
    const rebar = () => {
        barEl.innerHTML = COLORS.map(c => '<button class="fd-sw' + (mode === 'pen' && color === c ? ' fd-on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>').join('') +
            STAMPS.map(s => '<button class="fd-st' + (mode === 'stamp' && stamp === s ? ' fd-on' : '') + '" data-s="' + s + '">' + s + '</button>').join('') +
            '<button class="app-btn" id="fd-clr">Clear</button>';
        barEl.querySelectorAll('.fd-sw').forEach(b => b.addEventListener('click', () => { mode = 'pen'; color = b.dataset.c; rebar(); }));
        barEl.querySelectorAll('.fd-st').forEach(b => b.addEventListener('click', () => { mode = 'stamp'; stamp = b.dataset.s; rebar(); }));
        barEl.querySelector('#fd-clr').addEventListener('click', () => { g.clearRect(0, 0, canvas.width, canvas.height); ctx.send({ t: 'clr' }); });
    };
    const norm = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/r.width, y: (e.clientY-r.top)/r.height }; };
    window.Appmegle.register({
        id: 'facedoodle', label: 'Face Doodle', css: 'apps/facedoodle.css',
        mount(c) {
            ctx = c;
            ctx.root.innerHTML = '<div class="app-col" id="fd"><div id="fd-bar"></div><canvas id="fd-canvas" width="720" height="480"></canvas><div class="fd-hint">draw right on their face — they see it too ✏️</div></div>';
            canvas = ctx.root.querySelector('#fd-canvas'); g = canvas.getContext('2d'); barEl = ctx.root.querySelector('#fd-bar');
            rebar();
            canvas.addEventListener('pointerdown', (e) => { const p = norm(e); if (mode === 'stamp') { put(p.x, p.y, stamp); ctx.send({ t: 'st', x: +p.x.toFixed(3), y: +p.y.toFixed(3), e: stamp }); } else { drawing = true; last = p; } e.preventDefault(); });
            canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = norm(e); seg(last.x, last.y, p.x, p.y, color); ctx.send({ t: 'sg', a: [+last.x.toFixed(3), +last.y.toFixed(3), +p.x.toFixed(3), +p.y.toFixed(3)], c: color }); last = p; });
            window.addEventListener('pointerup', this._up = () => { drawing = false; });
        },
        unmount() { window.removeEventListener('pointerup', this._up); ctx = canvas = g = barEl = null; },
        onData(msg) {
            if (!g) return;
            if (msg.t === 'sg') seg(msg.a[0], msg.a[1], msg.a[2], msg.a[3], msg.c);
            else if (msg.t === 'st') put(msg.x, msg.y, msg.e);
            else if (msg.t === 'clr') g.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
})();
