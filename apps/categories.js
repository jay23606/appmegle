// Categories / Scattergories (2-player) for appmegle. A random letter + a list of categories;
// race to fill each with a word starting with that letter before the timer. You score for each
// valid answer, but identical answers cancel out (the classic twist). Caller-authoritative for
// letter/categories/timer/scoring. Caller = Blue, answerer = Orange.
(function () {
    const POOL = ['Animal','Food','City','Movie','Famous person','Something in a kitchen','Sport','Country','Color','Job','Fruit or vegetable','A name','Something cold','Body part','School subject','Thing in nature','Brand','Board game','Something round','Musical instrument','Item of clothing','Drink','Cartoon character','Something you own'];
    const LETTERS = 'ABCDEFGHIJKLMNOPRSTW', N = 8, ROUND = 60;
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let ctx = null, auth = false, me = 'a', letter = 'A', cats = [], phase = 'idle', roundEnd = 0, ansA = [], ansB = [], scores = { a: 0, b: 0 }, collected = false;
    let statEl = null, bodyEl = null, timeEl = null, raf = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const newRound = () => { if (!auth) return ctx.send({ t: 'newreq' }); letter = LETTERS[(Math.random()*LETTERS.length)|0]; cats = shuffle([...POOL]).slice(0, N); phase = 'play'; collected = false; ansA = []; ansB = []; ctx.send({ t: 'round', letter, cats }); start(); };
    const start = () => { phase = 'play'; collected = false; roundEnd = performance.now() + ROUND*1000; buildPlay(); };
    const readFields = () => cats.map((_, i) => (bodyEl.querySelector('#ct-' + i) || {}).value || '');
    const score = () => {
        scores = { a: 0, b: 0 };
        for (let i = 0; i < cats.length; i++) { const a = (ansA[i] || '').trim(), b = (ansB[i] || '').trim(); const aOk = a && a[0].toUpperCase() === letter, bOk = b && b[0].toUpperCase() === letter; if (aOk && bOk && a.toLowerCase() === b.toLowerCase()) continue; if (aOk) scores.a++; if (bOk) scores.b++; }
        phase = 'reveal'; ctx.send({ t: 'reveal', a: ansA, b: ansB, scores }); revealUI();
    };
    const collect = () => { if (collected) return; collected = true; ansA = readFields(); ctx.send({ t: 'collect' }); };

    const buildPlay = () => {
        if (!bodyEl) return;
        statEl.textContent = "Letter: " + letter;
        bodyEl.innerHTML = '<div class="ct-letter">' + letter + '</div><div class="ct-time" id="ct-time"></div>' + cats.map((c, i) => '<div class="ct-row"><label>' + c + '</label><input id="ct-' + i + '" autocomplete="off" placeholder="' + letter + '…"></div>').join('') + '<button class="app-btn" id="ct-done">I\'m done</button>';
        timeEl = bodyEl.querySelector('#ct-time');
        bodyEl.querySelector('#ct-done').addEventListener('click', () => { if (auth) { if (!collected) { collect(); } } else ctx.send({ t: 'done' }); });
    };
    const revealUI = () => {
        if (!bodyEl) return; const opp = other(me), mine = me === 'a' ? ansA : ansB, them = me === 'a' ? ansB : ansA;
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[opp] + ' Them';
        bodyEl.innerHTML = '<div class="ct-letter">' + letter + '</div>' + cats.map((c, i) => '<div class="ct-rev"><label>' + c + '</label><span class="ct-you">' + (mine[i] || '—') + '</span><span class="ct-them">' + (them[i] || '—') + '</span></div>').join('') + '<button class="app-btn" id="ct-next">New round →</button>';
        bodyEl.querySelector('#ct-next').addEventListener('click', newRound);
    };
    const loop = (t) => {
        if (phase === 'play') { const left = Math.max(0, Math.ceil((roundEnd - performance.now())/1000)); if (timeEl) timeEl.textContent = '⏱ ' + left; if (auth && left <= 0 && !collected) collect(); }
        raf = requestAnimationFrame(loop);
    };
    window.Appmegle.register({
        id: 'categories', label: 'Categories', css: 'apps/categories.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col" id="ct"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New round</button></div><div id="ct-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ct-body');
            ctx.root.querySelector('.nb').addEventListener('click', newRound);
            if (auth) newRound(); else bodyEl.textContent = 'Waiting for the host…';
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = timeEl = null; },
        onData(msg) {
            if (msg.t === 'round' && !auth) { letter = msg.letter; cats = msg.cats; start(); }
            else if (msg.t === 'collect' && !auth) { ctx.send({ t: 'ans', answers: readFields() }); }
            else if (msg.t === 'ans' && auth) { ansB = msg.answers; score(); }
            else if (msg.t === 'done' && auth) { if (!collected) collect(); }
            else if (msg.t === 'reveal' && !auth) { ansA = msg.a; ansB = msg.b; scores = msg.scores; phase = 'reveal'; revealUI(); }
            else if (msg.t === 'newreq' && auth) newRound();
        }
    });
})();
