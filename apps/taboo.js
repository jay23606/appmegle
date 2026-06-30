// Don't Say The Word / Taboo (2-player) for appmegle. The clue-giver sees a word plus banned
// words and describes it out loud; the guesser shouts guesses and hits BUZZ if the clue-giver
// slips and says a forbidden word. The caller is authoritative and sends the card ONLY to the
// clue-giver. 75s rounds, roles swap, running score. Caller = Blue, answerer = Orange.
(function () {
    const CARDS = [['Birthday',['cake','candles','party','age','presents']],['Beach',['sand','ocean','sun','waves','towel']],['Pizza',['cheese','slice','pepperoni','Italian','dough']],['Winter',['cold','snow','ice','scarf','season']],['Guitar',['strings','music','play','band','rock']],['Doctor',['hospital','sick','nurse','medicine','patient']],['Coffee',['caffeine','morning','cup','bean','espresso']],['Football',['ball','team','goal','kick','field']],['Rainbow',['colors','rain','sky','arc','gold']],['Library',['books','quiet','read','shelf','borrow']],['Snowman',['carrot','snow','cold','build','Frosty']],['Airport',['plane','fly','luggage','gate','travel']],['Pancake',['syrup','breakfast','flip','batter','stack']],['Vampire',['blood','fangs','night','bat','Dracula']],['Wedding',['bride','groom','marry','ring','cake']],['Telescope',['stars','space','lens','look','night']],['Umbrella',['rain','wet','open','handle','cover']],['Dinosaur',['extinct','T-Rex','fossil','big','Jurassic']],['Popcorn',['movie','butter','kernel','pop','snack']],['Mountain',['climb','peak','tall','hike','summit']],['Penguin',['cold','bird','fly','Antarctica','waddle']],['Sunglasses',['eyes','sun','shades','cool','face']],['Robot',['metal','machine','beep','android','program']],['Volcano',['lava','erupt','mountain','hot','ash']],['Camera',['photo','picture','lens','snap','flash']]];
    const ROUND = 75;
    let ctx = null, auth = false, me = 'a', clue = 'a', deck = [], di = 0, card = null, count = 0, time = ROUND, scores = { a: 0, b: 0 }, phase = 'idle', lastSec = -1, vCard = null;
    let statEl = null, bodyEl = null, sel = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newRound = (swap) => { if (!auth) return ctx.send({ t: 'newreq' }); if (swap && phase !== 'idle') clue = other(clue); deck = shuffle([...Array(CARDS.length).keys()]); di = 0; card = CARDS[deck[0]]; count = 0; time = ROUND; phase = 'play'; lastSec = -1; sync(); };
    const nextCard = () => { di++; if (di >= deck.length) { shuffle(deck); di = 0; } card = CARDS[deck[di]]; };
    const applyClue = (a) => { if (phase !== 'play') return; if (a === 'got') count++; nextCard(); sync(); };
    const applyBuzz = () => { if (phase !== 'play') return; count = Math.max(0, count - 1); nextCard(); sync(); };
    const endRound = () => { phase = 'over'; scores[clue] += count; sync(); };
    const sync = () => { ctx.send({ t: 's', clue, time: Math.ceil(time), count, sa: scores.a, sb: scores.b, phase, card: clue === 'b' ? card : null }); render(); };

    const render = () => {
        if (!bodyEl) return; const amClue = clue === me, opp = other(me), c = auth ? card : vCard;
        statEl.textContent = phase === 'over' ? 'Round over · You ' + scores[me] + ' – ' + scores[opp] + ' Them' : phase === 'idle' ? '' : (amClue ? 'You give clues' : 'You guess & buzz') + ' · ⏱ ' + Math.ceil(time) + ' · ' + count;
        let h = '';
        if (phase === 'idle') h = '<div class="tb-msg">Waiting for the host…</div>';
        else if (phase === 'over') h = '<div class="tb-msg">⏰ Time! ' + (clue === me ? 'You got <b>' + count + '</b>' : 'They got <b>' + count + '</b>') + '</div><button class="app-btn" id="tb-new">New round (swap)</button>';
        else if (amClue && c) h = '<div class="tb-card"><div class="tb-word">' + c[0] + '</div><div class="tb-no">Don\'t say:</div>' + c[1].map(w => '<div class="tb-ban">' + w + '</div>').join('') + '</div><div class="tb-big">⏱ ' + Math.ceil(time) + '</div><div id="tb-btns"><button id="tb-got">✓ Got it</button><button id="tb-skip">Skip</button></div>';
        else h = '<div class="tb-msg">🔔 Listen & guess out loud! Hit BUZZ if they say a banned word.</div><div class="tb-big">⏱ ' + Math.ceil(time) + '</div><button id="tb-buzz">🔔 BUZZ!</button><div class="tb-cnt">they\'ve got ' + count + '</div>';
        bodyEl.innerHTML = h;
        const got = bodyEl.querySelector('#tb-got'), sk = bodyEl.querySelector('#tb-skip'), bz = bodyEl.querySelector('#tb-buzz'), nw = bodyEl.querySelector('#tb-new');
        const doClue = (a) => { if (auth) applyClue(a); else ctx.send({ t: 'clue', a }); };
        if (got) got.addEventListener('click', () => doClue('got')); if (sk) sk.addEventListener('click', () => doClue('skip'));
        if (bz) bz.addEventListener('click', () => { if (auth) applyBuzz(); else ctx.send({ t: 'buzz' }); });
        if (nw) nw.addEventListener('click', () => newRound(true));
    };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; time -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(time); if (s !== lastSec) { lastSec = s; sync(); } if (time <= 0) { time = 0; endRound(); } } else loop._l = t; loop._r = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'taboo', label: 'Taboo', css: 'apps/taboo.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; clue = 'a';
            ctx.root.innerHTML = '<div class="app-col" id="tb"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New round</button></div><div id="tb-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#tb-body');
            ctx.root.querySelector('.nb').addEventListener('click', () => newRound(true));
            if (auth) newRound(false); else render();
            loop._r = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(loop._r); ctx = statEl = bodyEl = null; deck = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) { clue = msg.clue; time = msg.time; count = msg.count; scores = { a: msg.sa, b: msg.sb }; phase = msg.phase; vCard = msg.card; render(); }
            else if (msg.t === 'clue' && auth) { if (clue === 'b') applyClue(msg.a); }
            else if (msg.t === 'buzz' && auth) { if (clue === 'a') applyBuzz(); }
            else if (msg.t === 'newreq' && auth) newRound(true);
        }
    });
})();
