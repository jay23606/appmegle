// Couple's Quiz / "How well do you know each other" (2-player) for appmegle. Each round one
// person is the SUBJECT and secretly picks their real answer; the other guesses what they'll
// pick. Match = a point for the guesser. Roles swap each round. A perfect getting-to-know-a-
// stranger engine. Caller authoritative; the subject's answer stays hidden until both are in.
(function () {
    const POOL = [['Their ideal night:', 'Night in', 'Night out'], ['They prefer:', 'Sweet', 'Savory'], ['Their getaway:', 'Beach', 'Mountains'], ['They are more:', 'Early bird', 'Night owl'], ["They'd rather:", 'Text', 'Call'], ['Their pick:', 'Cats', 'Dogs'], ['Their drink:', 'Coffee', 'Tea'], ['They prefer:', 'Books', 'Movies'], ['Their style:', 'Plan ahead', 'Go with the flow'], ["They'd choose:", 'Adventure', 'Relaxation'], ['Their meal:', 'Cook at home', 'Eat out'], ['Their season:', 'Summer', 'Winter'], ['Their weekend:', 'Productive', 'Lazy'], ['Their music:', 'Throwbacks', 'New releases'], ['Their snack:', 'Salty', 'Sweet'], ["They'd rather:", 'Big party', 'Small gathering'], ['Their travel:', 'Road trip', 'Flight'], ['Their morning:', 'Workout', 'Sleep in'], ['Their movie:', 'Comedy', 'Thriller'], ['They prefer:', 'Spontaneous', 'Scheduled'], ['Their treat:', 'Ice cream', 'Chocolate'], ['Their seat:', 'Window', 'Aisle']];
    let ctx = null, auth = false, me = 'a', subject = 'a', q = null, subjAns = -1, guess = -1, phase = 'answer', scores = { a: 0, b: 0 }, deck = [], di = 0, myChoice = -1;
    let statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); scores = { a: 0, b: 0 }; subject = 'b'; deck = shuffle([...Array(POOL.length).keys()]); di = -1; nextRound(); };
    const nextRound = () => { subject = other(subject); di++; if (di >= deck.length) { shuffle(deck); di = 0; } q = POOL[deck[di]]; subjAns = -1; guess = -1; myChoice = -1; phase = 'answer'; sync(); };
    const tryReveal = () => { if (subjAns >= 0 && guess >= 0) { if (guess === subjAns) scores[other(subject)]++; phase = 'reveal'; sync(); } else sync(); };
    const sync = () => { ctx.send({ t: 's', subject, q, phase, scores, sa: phase === 'reveal' ? subjAns : -1, gs: phase === 'reveal' ? guess : -1 }); render(); };

    const render = () => {
        if (!bodyEl) return; const amSubj = subject === me, opp = other(me);
        statEl.textContent = 'You got ' + scores[me] + ' · Them ' + scores[opp];
        let h = '<div class="cq-q">' + q[0] + '</div>';
        if (phase === 'reveal') {
            h += '<div class="cq-opts">' + [1,2].map(i => '<div class="cq-rev' + (subjAns === i-1 ? ' real' : '') + (guess === i-1 ? ' guess' : '') + '">' + q[i] + '</div>').join('') + '</div>';
            h += '<div class="cq-msg">' + (guess === subjAns ? (amSubj ? 'They guessed you right! 🎯' : 'You nailed it! 🎯') : (amSubj ? 'They guessed wrong' : 'Missed it!')) + '</div><button class="app-btn" id="cq-next">Next →</button>';
        } else {
            const prompt = amSubj ? 'Your honest answer:' : 'What will they pick?';
            h += '<div class="cq-sub">' + prompt + '</div><div class="cq-opts">' + [1,2].map(i => '<button class="cq-opt' + (myChoice === i-1 ? ' picked' : '') + '" data-i="' + (i-1) + '"' + (myChoice >= 0 ? ' disabled' : '') + '>' + q[i] + '</button>').join('') + '</div>';
            if (myChoice >= 0) h += '<div class="cq-msg">locked — waiting…</div>';
        }
        bodyEl.innerHTML = h;
        if (phase !== 'reveal' && myChoice < 0) bodyEl.querySelectorAll('.cq-opt').forEach(b => b.addEventListener('click', () => choose(+b.dataset.i)));
        const nx = bodyEl.querySelector('#cq-next'); if (nx) nx.addEventListener('click', () => { if (auth) nextRound(); else ctx.send({ t: 'next' }); });
    };
    const choose = (i) => {
        if (myChoice >= 0 || phase === 'reveal') return; myChoice = i;
        if (subject === me) { if (auth) { subjAns = i; tryReveal(); } else ctx.send({ t: 'subj', i }); } else { if (auth) { guess = i; tryReveal(); } else ctx.send({ t: 'guess', i }); }
        render();
    };
    window.Appmegle.register({
        id: 'couples', label: "Couple's Quiz", css: 'apps/couples.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col" id="cq"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="cq-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#cq-body');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else bodyEl.textContent = 'Waiting for the host…';
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { subject = msg.subject; q = msg.q; phase = msg.phase; scores = msg.scores; subjAns = msg.sa; guess = msg.gs; if (phase === 'answer') myChoice = -1; render(); }
            else if (msg.t === 'subj' && auth) { subjAns = msg.i; tryReveal(); }
            else if (msg.t === 'guess' && auth) { guess = msg.i; tryReveal(); }
            else if (msg.t === 'next' && auth) nextRound();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
