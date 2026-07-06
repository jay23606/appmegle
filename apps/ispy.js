// I Spy Your Room (2-player) for appmegle. Inverted I-Spy: the spy picks something they can
// see in the PARTNER's video feed and gives the classic clue ("I spy, in YOUR room, something
// red…"). The partner hunts around their own room and guesses; the spy confirms or denies each
// guess. Turns their camera into your playground. Spy-authoritative — the secret stays local.
(function () {
    let ctx = null, me = 'a', spy = 'a', secret = '', hint = '', guesses = [], phase = 'idle', scores = { a: 0, b: 0 }, lastWin = null, statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const normW = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const startRound = (h, sec) => { hint = h; secret = sec; guesses = []; phase = 'play'; ctx.send({ t: 'round', hint: h, spy: me }); render(); };
    const verdict = (ok, gw) => { if (ok) { scores[other(me)]++; lastWin = other(me); phase = 'over'; ctx.send({ t: 'end', secret, win: lastWin, scores }); } else ctx.send({ t: 'no', w: gw }); render(); };
    const giveUp = () => { ctx.send({ t: 'giveup' }); };
    const render = () => {
        if (!bodyEl) return; const amSpy = spy === me;
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[other(me)] + ' Them';
        let h = '';
        if (phase === 'idle') h = me === spy
            ? '<div class="is-msg">🔎 Look at <b>their</b> video. Pick something you can see in their room.</div><div class="is-form"><input id="is-sec" maxlength="30" autocomplete="off" placeholder="the secret thing (e.g. lamp)"><input id="is-hint" maxlength="20" autocomplete="off" placeholder="one-word hint (e.g. red)"><button class="app-btn" id="is-start">I spy…</button></div>'
            : '<div class="is-msg">They\'re scanning your room for something to spy… 👀</div>';
        else if (phase === 'play') {
            h = '<div class="is-clue">🔎 I spy, in ' + (amSpy ? 'THEIR' : 'YOUR') + ' room,<br>something <b>' + hint + '</b></div>';
            if (guesses.length) h += '<div class="is-gs">' + guesses.map(g => '<span class="is-g' + (g.no ? ' is-no' : '') + '">' + g.w + '</span>').join('') + '</div>';
            if (amSpy) { const pend = guesses.find(g => !g.no && !g.done); h += pend ? '<div class="is-msg">They guessed <b>' + pend.w + '</b> — is that it?</div><div class="is-btns"><button class="app-btn" id="is-yes">✓ That\'s it!</button><button class="app-btn" id="is-nope">✗ Nope</button></div>' : '<div class="is-msg">watching them hunt… (secret: ' + secret + ')</div>'; }
            else h += '<div class="is-form"><input id="is-g" maxlength="30" autocomplete="off" placeholder="your guess"><button class="app-btn" id="is-go">Guess</button></div><button class="app-btn is-dim" id="is-quit">I give up</button>';
        } else if (phase === 'over') h = '<div class="is-big">' + (lastWin === null ? 'It was: ' + secret : lastWin === me ? '🏆 Point to you!' : 'Point to them') + '</div><div class="is-msg">the thing was: <b>' + secret + '</b></div><button class="app-btn" id="is-next">Swap — ' + (amSpy ? 'they spy' : 'you spy') + ' next</button>';
        bodyEl.innerHTML = h;
        const st = bodyEl.querySelector('#is-start'), go = bodyEl.querySelector('#is-go'), y = bodyEl.querySelector('#is-yes'), n = bodyEl.querySelector('#is-nope'), q = bodyEl.querySelector('#is-quit'), nx = bodyEl.querySelector('#is-next');
        if (st) st.addEventListener('click', () => { const s = bodyEl.querySelector('#is-sec').value.trim(), hh = bodyEl.querySelector('#is-hint').value.trim(); if (s && hh) startRound(hh, s); });
        if (go) { const inp = bodyEl.querySelector('#is-g'); const sub = () => { const w = inp.value.trim(); if (!w) return; guesses.push({ w, no: false, done: false }); ctx.send({ t: 'guess', w }); render(); }; go.addEventListener('click', sub); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sub(); }); inp.focus(); }
        if (y) y.addEventListener('click', () => { const pend = guesses.find(g => !g.no && !g.done); if (pend) { pend.done = true; verdict(true, pend.w); } });
        if (n) n.addEventListener('click', () => { const pend = guesses.find(g => !g.no && !g.done); if (pend) { pend.no = true; verdict(false, pend.w); } });
        if (q) q.addEventListener('click', giveUp);
        if (nx) nx.addEventListener('click', () => { spy = other(spy); secret = ''; hint = ''; guesses = []; phase = 'idle'; ctx.send({ t: 'swap', spy }); render(); });
    };
    window.Appmegle.register({
        id: 'ispy', label: 'I Spy Your Room', css: 'apps/ispy.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b'; spy = 'a'; scores = { a: 0, b: 0 }; phase = 'idle'; secret = ''; hint = ''; guesses = [];
            ctx.root.innerHTML = '<div class="app-col" id="is"><div class="app-bar"><span class="stat"></span></div><div id="is-body"></div><div class="is-hint2">the spy picks something in the OTHER person\'s room</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#is-body');
            render();
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'round') { spy = msg.spy; hint = msg.hint; guesses = []; phase = 'play'; render(); }
            else if (msg.t === 'guess' && spy === me) { guesses.push({ w: msg.w, no: false, done: false }); render(); }
            else if (msg.t === 'no') { const g = guesses.find(x => normW(x.w) === normW(msg.w) && !x.no); if (g) g.no = true; render(); }
            else if (msg.t === 'end') { scores = msg.scores; secret = msg.secret; lastWin = msg.win; phase = 'over'; render(); }
            else if (msg.t === 'giveup' && spy === me) { lastWin = me; scores[me]++; phase = 'over'; ctx.send({ t: 'end', secret, win: me, scores }); render(); }
            else if (msg.t === 'swap') { spy = msg.spy; secret = ''; hint = ''; guesses = []; phase = 'idle'; render(); }
        }
    });
})();
