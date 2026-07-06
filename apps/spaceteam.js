// Spaceteam (2-player co-op) for appmegle. You each have a control panel of absurdly-named
// buttons, and you each get a command — but the control it names might be on your PARTNER'S
// panel, so you shout it across and they tap it before the timer runs out. Complete commands
// to power the ship; miss too many and you're toast. Only works because you can yell at each
// other live. Caller-authoritative. Caller = Blue, answerer = Orange.
(function () {
    const LABELS = ['Flux Valve','Warp Coil','Bingo Dial','Quasar Knob','Photon Lever','Goblin Switch','Turbo Encabulator','Plasma Vent','Nebula Crank','Cosmic Gizmo','Hyper Toggle','Antigrav Pad','Wobble Pump','Zorp Button','Glonk Slider','Defrobnicator','Spline Reticulator','Bonk Trigger','Yeet Cannon','Meeb Regulator'];
    const GOAL = 12;
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let ctx = null, auth = false, me = 'a', panel = { a: [], b: [] }, cmd = { a: '', b: '' }, cmdEnd = { a: 0, b: 0 }, progress = 0, shields = 3, phase = 'idle', over = false, win = false;
    let vPanel = [], vCmd = '', vLeft = 0, statEl = null, bodyEl = null, raf = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const all = () => panel.a.concat(panel.b);
    const dur = () => Math.max(4, 9 - progress*0.35);
    const reissue = (o) => { cmd[o] = all()[(Math.random()*all().length)|0]; cmdEnd[o] = performance.now() + dur()*1000; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); const s = shuffle([...LABELS]); panel = { a: s.slice(0, 6), b: s.slice(6, 12) }; progress = 0; shields = 3; over = false; win = false; phase = 'play'; reissue('a'); reissue('b'); sync(); };
    const complete = (o) => { progress++; if (progress >= GOAL) { over = true; win = true; phase = 'over'; } else reissue(o); };
    const tap = (p, label) => { if (over || phase !== 'play') return; if (cmd.a === label) complete('a'); else if (cmd.b === label) complete('b'); sync(); };
    const sync = () => { const now = performance.now(); ctx.send({ t: 's', panel: panel.b, cmd: cmd.b, left: Math.max(0, (cmdEnd.b - now)/1000), progress, shields, over, win, phase }); render(); };
    const render = () => {
        if (!bodyEl) return; const myPanel = auth ? panel.a : vPanel, myCmd = auth ? cmd.a : vCmd, left = auth ? Math.max(0, (cmdEnd.a - performance.now())/1000) : vLeft;
        statEl.textContent = phase === 'over' ? (win ? '🚀 Ship powered — you win!' : '💥 Ship lost') : 'Power ' + progress + '/' + GOAL + ' · 🛡' + shields;
        if (phase === 'idle') { bodyEl.innerHTML = '<div class="st-msg">Waiting for the host…</div>'; return; }
        if (phase === 'over') { bodyEl.innerHTML = '<div class="st-big">' + (win ? '🚀 WIN!' : '💥 GAME OVER') + '</div><button class="app-btn" id="st-new">New game</button>'; bodyEl.querySelector('#st-new').addEventListener('click', newGame); return; }
        bodyEl.innerHTML = '<div class="st-cmd">📣 ' + myCmd + '</div><div class="st-bar"><div class="st-fill" style="width:' + Math.min(100, left/dur()*100) + '%"></div></div>' +
            '<div class="st-panel">' + myPanel.map(l => '<button class="st-btn" data-l="' + l + '">' + l + '</button>').join('') + '</div>';
        bodyEl.querySelectorAll('.st-btn').forEach(b => b.addEventListener('click', () => { const l = b.dataset.l; if (auth) tap('a', l); else ctx.send({ t: 'tap', l }); }));
    };
    const loop = (t) => { if (auth && phase === 'play') { const now = performance.now(); for (const o of ['a','b']) if (now > cmdEnd[o]) { shields--; if (shields <= 0) { over = true; win = false; phase = 'over'; } else reissue(o); } if (!loop._s || t - loop._s > 220) { loop._s = t; sync(); } } render(); raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'spaceteam', label: 'Spaceteam', css: 'apps/spaceteam.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col" id="st"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="st-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#st-body');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { vPanel = msg.panel; vCmd = msg.cmd; vLeft = msg.left; progress = msg.progress; shields = msg.shields; over = msg.over; win = msg.win; phase = msg.phase; render(); }
            else if (msg.t === 'tap' && auth) tap('b', msg.l);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
