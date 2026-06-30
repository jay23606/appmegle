// Two Truths and a Lie (2-player) for appmegle. The teller writes three statements (two true,
// one lie); the other guesses which is the lie — watching their face is half the fun. The
// caller is authoritative and only reveals the lie once a guess is in. Roles swap each round.
// Caller = Blue, answerer = Orange.
(function () {
    let ctx = null, auth = false, me = 'a', teller = 'a', statements = null, lieIdx = -1, guess = -1, phase = 'write', scores = { a: 0, b: 0 };
    let statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const newRound = (swap) => { if (!auth) return ctx.send({ t: 'newreq' }); if (swap) teller = other(teller); statements = null; lieIdx = -1; guess = -1; phase = 'write'; sync(); };
    const setStatements = (s, lie) => { statements = s; lieIdx = lie; phase = 'guess'; sync(); };
    const applyGuess = (idx) => { if (phase !== 'guess') return; guess = idx; if (idx === lieIdx) scores[other(teller)]++; phase = 'reveal'; sync(); };
    const sync = () => { ctx.send({ t: 's', teller, phase, st: phase === 'write' ? null : statements, lie: phase === 'reveal' ? lieIdx : -1, guess: phase === 'reveal' ? guess : -1, scores }); render(); };

    const render = () => {
        if (!bodyEl) return; const amTeller = teller === me, opp = other(me);
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[opp] + ' Them';
        let h = '';
        if (phase === 'write') {
            if (amTeller) h = '<div class="tt-msg">Write 3 statements — make one a lie:</div>' + [0,1,2].map(i => '<input class="tt-in" data-i="' + i + '" maxlength="80" placeholder="statement ' + (i+1) + '">').join('') + '<div class="tt-msg">Which one is the lie?</div><div id="tt-lie">' + [0,1,2].map(i => '<button class="tt-lb" data-i="' + i + '">' + (i+1) + '</button>').join('') + '</div><button class="app-btn" id="tt-go" disabled>Submit</button>';
            else h = '<div class="tt-msg">✍️ They\'re writing their three statements…</div>';
        } else if (phase === 'guess') {
            if (!amTeller) h = '<div class="tt-msg">Which one is the LIE?</div>' + statements.map((s, i) => '<button class="tt-opt" data-i="' + i + '">' + s.replace(/</g,'&lt;') + '</button>').join('');
            else h = '<div class="tt-msg">🤔 Waiting for their guess…</div>' + statements.map(s => '<div class="tt-stat">' + s.replace(/</g,'&lt;') + '</div>').join('');
        } else {
            h = statements.map((s, i) => '<div class="tt-stat ' + (i === lieIdx ? 'lie' : 'true') + (i === guess ? ' picked' : '') + '">' + s.replace(/</g,'&lt;') + (i === lieIdx ? ' 🤥' : ' ✓') + '</div>').join('') +
                '<div class="tt-msg">' + (guess === lieIdx ? (amTeller ? 'They caught the lie!' : 'You caught it! 🎉') : (amTeller ? 'They got fooled!' : 'Fooled you!')) + '</div><button class="app-btn" id="tt-next">Next round →</button>';
        }
        bodyEl.innerHTML = h;
        if (phase === 'write' && amTeller) {
            let chosen = -1; const ins = [...bodyEl.querySelectorAll('.tt-in')], go = bodyEl.querySelector('#tt-go');
            const upd = () => { go.disabled = !(chosen >= 0 && ins.every(x => x.value.trim())); };
            ins.forEach(x => x.addEventListener('input', upd));
            bodyEl.querySelectorAll('.tt-lb').forEach(b => b.addEventListener('click', () => { chosen = +b.dataset.i; bodyEl.querySelectorAll('.tt-lb').forEach(z => z.classList.toggle('sel', z === b)); upd(); }));
            go.addEventListener('click', () => { const s = ins.map(x => x.value.trim()); if (auth) setStatements(s, chosen); else ctx.send({ t: 'set', s, lie: chosen }); });
        }
        if (phase === 'guess' && !amTeller) bodyEl.querySelectorAll('.tt-opt').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.i; if (auth) applyGuess(i); else ctx.send({ t: 'guess', i }); }));
        const nx = bodyEl.querySelector('#tt-next'); if (nx) nx.addEventListener('click', () => newRound(true));
    };
    window.Appmegle.register({
        id: 'twotruths', label: 'Two Truths & a Lie', css: 'apps/twotruths.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; scores = { a: 0, b: 0 }; teller = 'a';
            ctx.root.innerHTML = '<div class="app-col" id="tt"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="tt-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#tt-body');
            ctx.root.querySelector('.nb').addEventListener('click', () => { if (auth) { scores = { a: 0, b: 0 }; teller = 'a'; newRound(false); } else ctx.send({ t: 'newreq' }); });
            if (auth) newRound(false); else bodyEl.textContent = 'Waiting for the host…';
        },
        unmount() { ctx = statEl = bodyEl = null; statements = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { teller = msg.teller; phase = msg.phase; statements = msg.st; lieIdx = msg.lie; guess = msg.guess; scores = msg.scores; render(); }
            else if (msg.t === 'set' && auth) setStatements(msg.s, msg.lie);
            else if (msg.t === 'guess' && auth) applyGuess(msg.i);
            else if (msg.t === 'newreq' && auth) newRound(false);
        }
    });
})();
