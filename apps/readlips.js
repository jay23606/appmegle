// Read My Lips (2-player co-op) for appmegle. The speaker MOUTHS a secret phrase silently — no
// whispering! — and the partner lip-reads and types their guess. Literally impossible anywhere
// but a live video call. 8 rounds, roles swap each round. Speaker-authoritative: the speaker's
// client picks the phrase locally (it never crosses the wire) and judges the guess.
(function () {
    const PHRASES = ['good morning','i love pizza','happy birthday','where are you from','nice to meet you','call me later','what time is it','i like your hair','see you tomorrow','this is so weird','are you hungry','lets be friends','you look great','olive juice','elephant shoes','bubble gum','chocolate milkshake','world peace','vacuum cleaner','turtle neck sweater','red lorry yellow lorry','do you like music','my dog ate it','space alien invasion','banana pancakes'];
    const ROUNDS = 8;
    let ctx = null, me = 'a', speaker = 'a', phrase = '', roundN = 0, hits = 0, phase = 'idle', lastGuess = '', lastOk = false, lastPh = '', statEl = null, bodyEl = null, seen = new Set();
    const other = (p) => p === 'a' ? 'b' : 'a';
    const normW = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const matches = (x, y) => { const nx = normW(x), ny = normW(y); if (!nx || !ny) return false; if (nx === ny) return true; const wx = nx.split(/\s+/), wy = new Set(ny.split(/\s+/)); const hit = wx.filter(w => wy.has(w)).length; return hit >= Math.max(1, wx.length - 1); };
    const pickPhrase = () => { if (seen.size >= PHRASES.length) seen.clear(); let p; do { p = PHRASES[(Math.random()*PHRASES.length)|0]; } while (seen.has(p)); seen.add(p); return p; };
    const startRound = () => { roundN++; phrase = pickPhrase(); phase = 'play'; ctx.send({ t: 'round', n: roundN, speaker: me }); render(); };
    const judge = (guess) => { lastGuess = guess; lastOk = matches(phrase, guess); lastPh = phrase; if (lastOk) hits++; phase = 'reveal'; ctx.send({ t: 'verdict', ok: lastOk, ph: phrase, guess, hits }); render(); };
    const render = () => {
        if (!bodyEl) return; const amSpeak = speaker === me;
        statEl.textContent = phase === 'idle' ? 'Read My Lips' : 'Round ' + roundN + '/' + ROUNDS + ' · ' + hits + ' read';
        let h = '';
        if (phase === 'idle') h = '<div class="rl2-msg">' + (me === speaker ? 'You speak first — tap Start.' : 'They speak first — get ready to lip-read.') + '</div>' + (me === speaker ? '<button class="app-btn" id="rl2-start">Start round</button>' : '');
        else if (phase === 'play') h = amSpeak
            ? '<div class="rl2-ph">🤐 Mouth this — <b>NO sound:</b></div><div class="rl2-word">' + phrase + '</div><div class="rl2-msg">exaggerate, repeat, no whispering!</div>'
            : '<div class="rl2-msg">👀 Watch their lips…</div><div class="rl2-in"><input id="rl2-g" maxlength="50" autocomplete="off" placeholder="what are they saying?"><button class="app-btn" id="rl2-go">Guess</button></div>';
        else if (phase === 'reveal') {
            h = '<div class="rl2-msg">Phrase: <b>' + lastPh + '</b> · guess: <b>' + (lastGuess || '—') + '</b></div><div class="rl2-big">' + (lastOk ? '✅ Read it!' : '❌ Lost in translation') + '</div>';
            h += roundN >= ROUNDS ? '<div class="rl2-final">' + hits + '/' + ROUNDS + ' lip-read — ' + (hits >= 6 ? '👄 fluent' : hits >= 4 ? '😅 conversational' : '🙈 mumbling') + '</div><button class="app-btn" id="rl2-new">Play again</button>'
                : (speaker !== me ? '<button class="app-btn" id="rl2-next">Your turn to speak →</button>' : '<div class="rl2-msg">their turn to speak…</div>');
        }
        bodyEl.innerHTML = h;
        const st = bodyEl.querySelector('#rl2-start'), go = bodyEl.querySelector('#rl2-go'), nx = bodyEl.querySelector('#rl2-next'), nw = bodyEl.querySelector('#rl2-new'), inp = bodyEl.querySelector('#rl2-g');
        if (st) st.addEventListener('click', startRound);
        if (go) { const sub = () => { const w = inp.value.trim(); if (w) ctx.send({ t: 'guess', w }); go.disabled = true; }; go.addEventListener('click', sub); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sub(); }); inp.focus(); }
        if (nx) nx.addEventListener('click', () => { speaker = me; startRound(); });
        if (nw) nw.addEventListener('click', () => { ctx.send({ t: 'new' }); reset(); });
    };
    const reset = () => { roundN = 0; hits = 0; phase = 'idle'; speaker = 'a'; seen = new Set(); render(); };
    window.Appmegle.register({
        id: 'readlips', label: 'Read My Lips', css: 'apps/readlips.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="rl2"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Restart</button></div><div id="rl2-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#rl2-body');
            ctx.root.querySelector('.nb').addEventListener('click', () => { ctx.send({ t: 'new' }); reset(); });
            reset();
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'round') { roundN = msg.n; speaker = msg.speaker; phase = 'play'; render(); }
            else if (msg.t === 'guess' && speaker === me) judge(msg.w);
            else if (msg.t === 'verdict') { lastOk = msg.ok; lastPh = msg.ph; lastGuess = msg.guess; hits = msg.hits; phase = 'reveal'; render(); }
            else if (msg.t === 'new') reset();
        }
    });
})();
