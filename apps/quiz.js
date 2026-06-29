// Compatibility Quiz (2-player) for appmegle. Both answer the SAME this-or-that question at
// the same time; answers reveal only once both are in, and you score a point each time you
// match — building a running "compatibility %". Great with a stranger. The caller owns the
// shuffled deck and reveals; questions never repeat in a session. Caller = Blue, answerer = Orange.
(function () {
    const Q = [
        ['Beach', 'Mountains'], ['Cats', 'Dogs'], ['Coffee', 'Tea'], ['Sweet', 'Savory'], ['Early bird', 'Night owl'],
        ['Texting', 'Calling'], ['Books', 'Movies'], ['City', 'Countryside'], ['Summer', 'Winter'], ['Sunrise', 'Sunset'],
        ['Plan everything', 'Go with the flow'], ['Cook at home', 'Eat out'], ['Window seat', 'Aisle seat'], ['Adventure', 'Relaxation'],
        ['Big party', 'Small gathering'], ['Pineapple on pizza: yes', 'Pineapple on pizza: no'], ['Save it', 'Spend it'],
        ['Morning workout', 'Evening workout'], ['Comedy', 'Drama'], ['Spicy food', 'Mild food'], ['Road trip', 'Flight'],
        ['Stay in', 'Go out'], ['Tidy', 'Messy but happy'], ['Dawn patrol', 'Sleep in'], ['Salty snacks', 'Sweet snacks'],
        ['Sci-fi', 'Fantasy'], ['Dance', 'Sing'], ['Optimist', 'Realist'], ['Talk it out', 'Need space'], ['Plan the trip', 'Wing the trip'],
        ['Lake', 'Ocean'], ['Board games', 'Video games'], ['Spontaneous', 'Scheduled'], ['Hot weather', 'Cold weather'],
        ['Give gifts', 'Get gifts'], ['Lead', 'Follow'], ['Tea time', 'Happy hour'], ['Hugs', 'High-fives'], ['Pancakes', 'Waffles']
    ];
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

    let ctx = null, auth = false, me = 'a', deck = [], idx = 0, opts = ['', ''], picks = { a: null, b: null }, matches = 0, answered = 0, phase = 'answer';
    let statEl = null, qEl = null, optEl = null, resEl = null, nextBtn = null;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const broadcastQ = () => { opts = Q[deck[idx]]; picks = { a: null, b: null }; phase = 'answer'; ctx.send({ t: 'q', o: opts, matches, answered }); render(); };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); deck = shuffle([...Array(Q.length).keys()]); idx = 0; matches = 0; answered = 0; broadcastQ(); };
    const reveal = () => { const m = picks.a === picks.b; if (m) matches++; answered++; phase = 'reveal'; ctx.send({ t: 'rev', a: picks.a, b: picks.b, matches, answered }); render(); };
    const pick = (i) => {
        if (phase !== 'answer' || picks[me] !== null) return;
        if (auth) { picks.a = i; if (picks.b !== null) reveal(); else render(); }
        else { picks.b = i; ctx.send({ t: 'pick', i }); render(); }
    };
    const next = () => { if (phase !== 'reveal') return; if (auth) { idx = (idx + 1) % deck.length; if (idx === 0) deck = shuffle(deck); broadcastQ(); } else ctx.send({ t: 'next' }); };

    const render = () => {
        if (!qEl) return;
        const pct = answered ? Math.round(matches/answered*100) : 0;
        statEl.textContent = 'Compatibility ' + pct + '%  (' + matches + '/' + answered + ' matched)';
        qEl.textContent = phase === 'reveal' ? 'You ' + (picks.a === picks.b ? 'matched! 🎉' : "didn't match") : 'This or that?';
        optEl.innerHTML = opts.map((o, i) => '<button class="qz-opt" data-i="' + i + '">' + o + '</button>').join('');
        optEl.querySelectorAll('button').forEach(b => {
            const i = +b.dataset.i;
            if (picks[me] === i) b.classList.add('mine');
            if (phase === 'reveal') { b.disabled = true; if (picks.a === i) b.classList.add('a'); if (picks.b === i) b.classList.add('b'); }
            else { b.disabled = picks[me] !== null; b.addEventListener('click', () => pick(i)); }
        });
        resEl.textContent = phase === 'reveal' ? ('Blue: ' + (opts[picks.a] || '—') + '  ·  Orange: ' + (opts[picks.b] || '—')) : (picks[me] !== null ? 'Waiting for them…' : 'Pick one');
        nextBtn.style.display = phase === 'reveal' ? '' : 'none';
    };

    window.Appmegle.register({
        id: 'quiz', label: 'Compatibility Quiz', css: 'apps/quiz.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="qz"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<div id="qz-q">…</div><div id="qz-opts"></div><div id="qz-res"></div><button class="app-btn" id="qz-next">Next question →</button></div>';
            statEl = ctx.root.querySelector('.stat'); qEl = ctx.root.querySelector('#qz-q'); optEl = ctx.root.querySelector('#qz-opts'); resEl = ctx.root.querySelector('#qz-res'); nextBtn = ctx.root.querySelector('#qz-next');
            ctx.root.querySelector('.nb').addEventListener('click', newGame); nextBtn.addEventListener('click', next);
            if (auth) newGame(); else { qEl.textContent = 'Waiting for the host…'; }
        },
        unmount() { ctx = statEl = qEl = optEl = resEl = nextBtn = null; },
        onData(msg) {
            if (msg.t === 'q') { opts = msg.o; matches = msg.matches; answered = msg.answered; picks = { a: null, b: null }; phase = 'answer'; render(); }
            else if (msg.t === 'rev') { picks = { a: msg.a, b: msg.b }; matches = msg.matches; answered = msg.answered; phase = 'reveal'; render(); }
            else if (msg.t === 'pick' && auth) { picks.b = msg.i; if (picks.a !== null) reveal(); else render(); }
            else if (msg.t === 'next' && auth) next();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
