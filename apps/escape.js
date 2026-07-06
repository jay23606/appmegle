// Two-Key Escape Room (2-player co-op) for appmegle. Three chambers, each split in half: one
// of you sees the puzzle, the other sees the key to it — glyph codes, corrupted color
// sequences, coordinate hunts. Talk your way through all three before the 6-minute clock dies.
// Wrong inputs burn 15 seconds. The caller generates everything and runs the clock; the
// input side validates locally. Caller = Blue key, answerer = Orange key.
(function () {
    const GLY = ['Ω','✦','¶','Ψ','☆','©','ƛ','ж'], CCOL = ['red', 'blue', 'green', 'yellow'], WORDS = ['GHOST','PIANO','TIGER','CLOUD','ROBOT','LEMON','WITCH','STORM'];
    const TIME = 360, PEN = 15;
    let ctx = null, auth = false, me = 'a', data = null, ch = 0, phase = 'idle', left = TIME, lastSec = -1, outcome = null, flash = '', statEl = null, bodyEl = null, raf = 0;
    let c1in = '', c2in = [], c3in = 0;
    const gen = () => {
        const syms = [...GLY].sort(() => Math.random()-0.5).slice(0, 4);
        const digits = Array.from({ length: 10 }, (_, i) => i).sort(() => Math.random()-0.5);
        const legend = {}; GLY.forEach((s, i) => legend[s] = digits[i % 10]);
        const seq = Array.from({ length: 6 }, () => CCOL[(Math.random()*4)|0]);
        let s1 = 1 + ((Math.random()*3)|0), s2 = 3 + ((Math.random()*3)|0); if (s2 <= s1) s2 = s1 + 2;
        const word = WORDS[(Math.random()*WORDS.length)|0];
        const cells = []; while (cells.length < 5) { const c = (Math.random()*16)|0; if (!cells.includes(c)) cells.push(c); }
        const grid = Array.from({ length: 16 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(Math.random()*26)|0]);
        cells.forEach((c, i) => grid[c] = word[i]);
        return { c1: { syms, legend }, c2: { seq, skips: [s1, s2] }, c3: { word, cells, grid } };
    };
    const coord = (c) => 'ABCD'[c % 4] + (1 + ((c/4)|0));
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); data = gen(); ch = 0; left = TIME; lastSec = -1; phase = 'play'; outcome = null; c1in = ''; c2in = []; c3in = 0; flash = ''; ctx.send({ t: 'data', data }); render(); };
    const advance = () => { ch++; c1in = ''; c2in = []; c3in = 0; flash = ''; ctx.send({ t: 'ch', n: ch }); if (ch >= 3) { phase = 'over'; outcome = 'escaped'; ctx.send({ t: 'end', o: 'escaped' }); } render(); };
    const penalty = () => { flash = '−' + PEN + 's!'; ctx.send({ t: 'pen' }); if (auth) left -= PEN; render(); setTimeout(() => { flash = ''; render(); }, 900); };
    const render = () => {
        if (!bodyEl || phase === 'idle' && !auth) { if (bodyEl) bodyEl.innerHTML = '<div class="er-msg">Waiting for the host…</div>'; return; }
        statEl.textContent = phase === 'over' ? (outcome === 'escaped' ? '🗝 ESCAPED!' : '⛓ Locked in forever') : phase === 'play' ? '⏱ ' + Math.max(0, Math.ceil(left)) + 's · chamber ' + (ch+1) + '/3 ' + flash : 'Two-Key Escape Room';
        let h = '';
        if (phase === 'idle') h = '<div class="er-msg">Waiting…</div>';
        else if (phase === 'over') h = '<div class="er-big">' + (outcome === 'escaped' ? '🗝 YOU ESCAPED — together' : '⛓ TIME\'S UP') + '</div>' + (auth ? '<button class="app-btn" id="er-new">New room</button>' : '');
        else if (ch === 0) { const c = data.c1;
            h = '<div class="er-t">Chamber 1 · The Glyph Lock</div>';
            if (me === 'a') h += '<div class="er-msg">Four glyphs are carved on the door — your partner has the legend. Enter the 4-digit code.</div><div class="er-syms">' + c.syms.join(' ') + '</div><div class="er-code">' + (c1in.padEnd(4, '·').split('').join(' ')) + '</div><div class="er-pad">' + [1,2,3,4,5,6,7,8,9,0].map(d => '<button class="er-key" data-d="' + d + '">' + d + '</button>').join('') + '<button class="er-key" id="er-back">⌫</button></div>';
            else h += '<div class="er-msg">You hold the LEGEND — they\'ll read you glyphs:</div><table class="er-leg">' + GLY.map(s => '<tr><td>' + s + '</td><td>' + c.legend[s] + '</td></tr>').join('') + '</table>';
        } else if (ch === 1) { const c = data.c2;
            h = '<div class="er-t">Chamber 2 · The Corrupted Sequence</div>';
            if (me === 'a') h += '<div class="er-msg">The wall shows six lights — read them out. (You can\'t see which are corrupted.)</div><div class="er-seq">' + c.seq.map(cc => '<span class="er-dot" style="background:' + cc + '"></span>').join('') + '</div>';
            else h += '<div class="er-msg">⚠ Positions <b>' + (c.skips[0]+1) + '</b> and <b>' + (c.skips[1]+1) + '</b> are corrupted — SKIP them. Press the other four in order.</div><div class="er-in">' + c2in.map(cc => '<span class="er-dot" style="background:' + cc + '"></span>').join('') + '</div><div class="er-btns">' + CCOL.map(cc => '<button class="er-cb" data-c="' + cc + '" style="background:' + cc + '"></button>').join('') + '</div>';
        } else { const c = data.c3;
            h = '<div class="er-t">Chamber 3 · The Letter Vault</div>';
            if (me === 'a') h += '<div class="er-msg">Your partner has five coordinates — click those cells IN ORDER. (' + c3in + '/5)</div><div class="er-grid"><div class="er-gr"><span></span>' + 'ABCD'.split('').map(x => '<span>' + x + '</span>').join('') + '</div>' + [0,1,2,3].map(r => '<div class="er-gr"><span>' + (r+1) + '</span>' + [0,1,2,3].map(cc => '<button class="er-cell" data-i="' + (r*4+cc) + '">' + c.grid[r*4+cc] + '</button>').join('') + '</div>').join('') + '</div>';
            else h += '<div class="er-msg">You hold the coordinates — read them out IN ORDER:</div><div class="er-coords">' + c.cells.map(coord).join(' → ') + '</div><div class="er-msg">the letters spell <b>' + c.word + '</b> — tell them that too!</div>';
        }
        bodyEl.innerHTML = h;
        const nw = bodyEl.querySelector('#er-new'); if (nw) nw.addEventListener('click', newGame);
        bodyEl.querySelectorAll('.er-key').forEach(k => k.addEventListener('click', () => { if (k.id === 'er-back') { c1in = c1in.slice(0, -1); render(); return; } if (c1in.length >= 4) return; c1in += k.dataset.d; if (c1in.length === 4) { const code = data.c1.syms.map(s => data.c1.legend[s]).join(''); c1in === code ? advance() : (c1in = '', penalty()); } else render(); }));
        bodyEl.querySelectorAll('.er-cb').forEach(b => b.addEventListener('click', () => { const want = data.c2.seq.filter((_, i) => !data.c2.skips.includes(i)); c2in.push(b.dataset.c); if (c2in[c2in.length-1] !== want[c2in.length-1]) { c2in = []; penalty(); } else if (c2in.length === want.length) advance(); else render(); }));
        bodyEl.querySelectorAll('.er-cell').forEach(b => b.addEventListener('click', () => { +b.dataset.i === data.c3.cells[c3in] ? (++c3in === 5 ? advance() : render()) : (c3in = 0, penalty()); }));
    };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; ctx.send({ t: 'tick', s }); statEl.textContent = '⏱ ' + Math.max(0, s) + 's · chamber ' + (ch+1) + '/3 ' + flash; } if (left <= 0) { phase = 'over'; outcome = 'trapped'; ctx.send({ t: 'end', o: 'trapped' }); render(); } } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'escape', label: 'Two-Key Escape Room', css: 'apps/escape.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col" id="er"><div class="app-bar"><span class="stat"></span>' + (auth ? '<button class="app-btn nb">New room</button>' : '') + '</div><div id="er-body"></div><div class="er-hint">each of you sees half of every puzzle — talk it out</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#er-body');
            const nb = ctx.root.querySelector('.nb'); if (nb) nb.addEventListener('click', newGame);
            if (auth) newGame(); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'data') { data = msg.data; ch = 0; left = TIME; phase = 'play'; outcome = null; c1in = ''; c2in = []; c3in = 0; render(); }
            else if (msg.t === 'tick') { left = msg.s; if (phase === 'play' && statEl) statEl.textContent = '⏱ ' + Math.max(0, Math.ceil(left)) + 's · chamber ' + (ch+1) + '/3 ' + flash; }
            else if (msg.t === 'ch') { ch = msg.n; c1in = ''; c2in = []; c3in = 0; flash = ''; if (ch < 3) render(); }
            else if (msg.t === 'pen') { if (auth) left -= PEN; flash = '−15s!'; render(); setTimeout(() => { flash = ''; if (phase === 'play') render(); }, 900); }
            else if (msg.t === 'end') { phase = 'over'; outcome = msg.o; render(); }
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
