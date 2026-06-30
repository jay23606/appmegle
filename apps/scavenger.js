// Scavenger Hunt (2-player) for appmegle. A prompt appears ("show me something blue!"); race
// to grab a real object from your room and hold it to the camera, then tap "Found it!" — your
// opponent confirms what they see. First to a set number of finds wins. Uses your two real
// rooms, which only a video call can. Caller owns prompts + scores. Caller = Blue, answerer = Orange.
(function () {
    const PROMPTS = ['something blue', 'something round', 'something older than you', 'a spoon', 'something soft', 'something red', 'a book', 'something that makes noise', 'something shiny', 'a photo of someone', 'something green', 'a hat', 'something from the kitchen', 'something with a screen', 'something fuzzy', 'a pen or pencil', 'something yellow', 'something you love', 'a snack', 'something square', 'something that smells nice', 'a pair of socks', 'something breakable', 'something with a logo', 'something that fits in your hand'];
    const WIN = 7;
    let ctx = null, auth = false, me = 'a', prompt = '', claimer = null, scores = { a: 0, b: 0 }, phase = 'idle', over = false, winner = null, deck = [], di = 0, statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); scores = { a: 0, b: 0 }; over = false; winner = null; deck = shuffle([...PROMPTS]); di = -1; nextRound(); };
    const nextRound = () => { di++; if (di >= deck.length) { shuffle(deck); di = 0; } prompt = deck[di]; claimer = null; phase = 'hunt'; sync(); };
    const claim = (p) => { if (phase !== 'hunt' || claimer) return; claimer = p; sync(); };
    const confirm = () => { if (!claimer) return; scores[claimer]++; if (scores[claimer] >= WIN) { over = true; winner = claimer; sync(); } else nextRound(); };
    const reject = () => { if (!claimer) return; claimer = null; sync(); };
    const sync = () => { ctx.send({ t: 's', prompt, claimer, scores, phase, over, winner }); render(); };
    const render = () => {
        if (!bodyEl) return; const opp = other(me);
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[opp] + ' Them (first to ' + WIN + ')';
        let h = '';
        if (phase === 'idle') h = '<div class="sv-msg">Waiting for the host…</div>';
        else if (over) h = '<div class="sv-big">' + (winner === me ? '🏆 You win!' : 'You lose') + '</div><button class="app-btn" id="sv-new">New game</button>';
        else { h = '<div class="sv-prompt">Show me…<br><b>' + prompt + '</b></div>';
            if (!claimer) h += '<button class="app-btn sv-find" id="sv-find">✋ Found it!</button>';
            else if (claimer === me) h += '<div class="sv-msg">Hold it to the camera — waiting for them to confirm…</div>';
            else h += '<div class="sv-msg">They found it! Do you see it?</div><div class="sv-jbtns"><button class="app-btn" id="sv-yes">✓ Confirm</button><button class="app-btn" id="sv-no">✗ Nope</button></div>';
        }
        bodyEl.innerHTML = h;
        const f = bodyEl.querySelector('#sv-find'), y = bodyEl.querySelector('#sv-yes'), n = bodyEl.querySelector('#sv-no'), nw = bodyEl.querySelector('#sv-new');
        if (f) f.addEventListener('click', () => { if (auth) claim('a'); else ctx.send({ t: 'claim' }); });
        if (y) y.addEventListener('click', () => { if (auth) confirm(); else ctx.send({ t: 'confirm' }); });
        if (n) n.addEventListener('click', () => { if (auth) reject(); else ctx.send({ t: 'reject' }); });
        if (nw) nw.addEventListener('click', newGame);
    };
    window.Appmegle.register({
        id: 'scavenger', label: 'Scavenger Hunt', css: 'apps/scavenger.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col" id="sv"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="sv-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#sv-body');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else render();
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { prompt = msg.prompt; claimer = msg.claimer; scores = msg.scores; phase = msg.phase; over = msg.over; winner = msg.winner; render(); }
            else if (msg.t === 'claim' && auth) claim('b');
            else if (msg.t === 'confirm' && auth) confirm();
            else if (msg.t === 'reject' && auth) reject();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
