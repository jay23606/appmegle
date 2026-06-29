// Buzz-in Trivia (2-player) for appmegle. Head-to-head: both see the same question and the
// FIRST correct answer wins the point; a wrong answer locks you out of that question. The
// caller fetches questions live from the free OpenTDB API (CORS-friendly, no key) and is the
// authoritative judge — it never sends the correct answer until the question resolves, so a
// peer can't cheat by reading messages. Falls back to a small embedded set if the API fails.
// Caller = Blue, answerer = Orange.
(function () {
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const FALLBACK = [
        { q: 'What planet is known as the Red Planet?', o: ['Mars', 'Venus', 'Jupiter', 'Mercury'], c: 0 },
        { q: 'How many continents are there?', o: ['Five', 'Six', 'Seven', 'Eight'], c: 2 },
        { q: 'What is the largest mammal?', o: ['Elephant', 'Blue whale', 'Giraffe', 'Hippo'], c: 1 },
        { q: 'Who painted the Mona Lisa?', o: ['Van Gogh', 'Picasso', 'Da Vinci', 'Monet'], c: 2 },
        { q: 'What gas do plants absorb?', o: ['Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon dioxide'], c: 3 },
        { q: 'How many sides does a hexagon have?', o: ['Five', 'Six', 'Seven', 'Eight'], c: 1 },
        { q: 'What is the smallest prime number?', o: ['0', '1', '2', '3'], c: 2 },
        { q: 'Which ocean is the largest?', o: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], c: 3 }
    ];
    const fetchQs = async () => {
        try {
            const r = await fetch('https://opentdb.com/api.php?amount=10&type=multiple&encode=url3986'); const j = await r.json();
            if (j.response_code !== 0 || !j.results.length) throw 0;
            return j.results.map(x => { const correct = decodeURIComponent(x.correct_answer); const o = shuffle([correct, ...x.incorrect_answers.map(decodeURIComponent)]); return { q: decodeURIComponent(x.question), o, c: o.indexOf(correct) }; });
        } catch (e) { return shuffle([...FALLBACK]); }
    };

    let ctx = null, auth = false, me = 'a';
    let qs = [], idx = 0, score = { a: 0, b: 0 }, cur = null, lockA = false, lockB = false, resolved = false, phase = 'load', revealC = -1, revealBy = null, myLocked = false, total = 8;
    let statEl = null, qEl = null, optEl = null, resEl = null;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const newGame = async () => { if (!auth) return ctx.send({ t: 'newreq' }); phase = 'load'; render(); qs = await fetchQs(); total = qs.length; idx = 0; score = { a: 0, b: 0 }; ask(); };
    const ask = () => { cur = qs[idx]; lockA = lockB = resolved = false; revealC = -1; revealBy = null; phase = 'q'; ctx.send({ t: 'q', n: idx+1, total, q: cur.q, o: cur.o, score }); render(); };
    const reveal = (by) => { resolved = true; revealC = cur.c; revealBy = by; phase = 'reveal'; ctx.send({ t: 'rev', c: cur.c, by, score }); render(); setTimeout(() => { idx++; if (idx >= qs.length) over(); else ask(); }, 2200); };
    const over = () => { phase = 'over'; const w = score.a === score.b ? 'tie' : score.a > score.b ? 'a' : 'b'; ctx.send({ t: 'over', score, w }); render(); };
    const judge = (p, i) => { if (resolved || (p === 'a' ? lockA : lockB)) return; if (i === cur.c) { score[p]++; reveal(p); } else { if (p === 'a') lockA = true; else lockB = true; if (p === 'b') ctx.send({ t: 'lock' }); if (lockA && lockB) reveal(null); else render(); } };
    const answer = (i) => { if (phase !== 'q' || myLocked) return; if (auth) judge('a', i); else { myLocked = false; ctx.send({ t: 'ans', i }); } };

    const render = () => {
        if (!qEl) return; const opp = other(me);
        statEl.textContent = phase === 'over' ? (revealBy === 'tie' || score[me] === score[opp] ? 'Tie ' : (score[me] > score[opp] ? '🏆 You win ' : 'You lose ')) + score[me] + '–' + score[opp]
            : phase === 'load' ? 'Loading trivia…' : 'You ' + score[me] + ' · Them ' + score[opp];
        qEl.textContent = phase === 'load' ? 'Fetching questions…' : phase === 'over' ? 'Game over' : (cur ? cur.q : '');
        if (!cur || phase === 'load' || phase === 'over') { optEl.innerHTML = ''; resEl.textContent = ''; return; }
        optEl.innerHTML = cur.o.map((o, i) => '<button class="tv-opt" data-i="' + i + '">' + o + '</button>').join('');
        optEl.querySelectorAll('button').forEach(b => { const i = +b.dataset.i;
            if (phase === 'reveal') { b.disabled = true; if (i === revealC) b.classList.add('right'); }
            else { b.disabled = myLocked; b.addEventListener('click', () => answer(i)); }
        });
        resEl.textContent = phase === 'reveal' ? (revealBy ? (revealBy === me ? 'You buzzed in first! ✓' : 'They got it') : 'Nobody got it') : (myLocked ? 'Locked out — wait for the reveal' : 'Buzz in — first correct wins!');
    };

    window.Appmegle.register({
        id: 'trivia', label: 'Trivia', css: 'apps/trivia.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; myLocked = false;
            ctx.root.innerHTML = '<div class="app-col" id="tv"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div>' +
                '<div id="tv-q">…</div><div id="tv-opts"></div><div id="tv-res"></div></div>';
            statEl = ctx.root.querySelector('.stat'); qEl = ctx.root.querySelector('#tv-q'); optEl = ctx.root.querySelector('#tv-opts'); resEl = ctx.root.querySelector('#tv-res');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else { phase = 'load'; qEl.textContent = 'Waiting for the host…'; }
        },
        unmount() { ctx = statEl = qEl = optEl = resEl = null; qs = []; },
        onData(msg) {
            if (msg.t === 'q') { cur = { q: msg.q, o: msg.o, c: -1 }; score = msg.score; idx = msg.n - 1; total = msg.total; myLocked = false; phase = 'q'; render(); }
            else if (msg.t === 'rev') { revealC = msg.c; revealBy = msg.by; score = msg.score; phase = 'reveal'; render(); }
            else if (msg.t === 'over') { score = msg.score; revealBy = msg.w; phase = 'over'; render(); }
            else if (msg.t === 'lock' && !auth) { myLocked = true; render(); }
            else if (msg.t === 'ans' && auth) judge('b', msg.i);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
