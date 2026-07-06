// Alibi (2-player co-op) for appmegle. You're both suspects. 60 seconds to invent your shared
// alibi OUT LOUD over the call — then the interrogation separates you: the same 5 detail
// questions, answered privately by typing (no talking!). Answers are compared side by side;
// match enough details and you're cleared. Caller owns the case deck + timer. Caller = Blue,
// answerer = Orange.
(function () {
    const CASES = [
        { s: 'A diamond vanished from the city museum at midnight. You two claim you were together all evening — where?', q: ['Where were you two?','What time did you get there?','Who paid for what?','What did you eat or drink?','How did you get home?'] },
        { s: "Your boss's birthday cake disappeared from the office fridge an hour before the party.", q: ['Where were you when it vanished?','What were you two doing?','Who else saw you there?','What was the weather like?','What did you have for lunch?'] },
        { s: "A neighbor's garden gnomes were rearranged into a giant smiley face overnight.", q: ['Where were you at 3am?','What were you wearing?','What did you watch that night?','What snack did you share?','What time did you fall asleep?'] },
        { s: 'Someone released 200 balloons inside the shopping mall. Security wants answers.', q: ['Which store were you in?','What did you buy?','Roughly how much did it cost?','Why were you at the mall?','Where did you go after?'] },
        { s: "The town fountain is suddenly full of bubble bath and nobody's laughing. Well, everybody's laughing.", q: ['Where were you last night?','Who suggested going there?','What did you two talk about?','What song was playing?','When did you leave?'] },
        { s: 'Every clock in the public library was set back exactly 47 minutes.', q: ['Which section were you in?','What book did you look at?','What did the librarian look like?','What time did you leave?','Where did you go next?'] }
    ];
    const TALK = 60;
    let ctx = null, auth = false, me = 'a', deck = [], ci = -1, phase = 'idle', left = TALK, lastSec = -1, myAns = null, ans = { a: null, b: null }, statEl = null, bodyEl = null, raf = 0;
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const normW = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const matches = (x, y) => { const nx = normW(x), ny = normW(y); if (!nx || !ny) return false; if (nx === ny || nx.includes(ny) || ny.includes(nx)) return true; const wx = nx.split(/\s+/).filter(w => w.length > 3); return wx.some(w => ny.includes(w)); };
    const newCase = () => { if (!auth) return ctx.send({ t: 'newreq' }); if (!deck.length) deck = shuffle(CASES.map((_, i) => i)); ci = deck.pop(); phase = 'talk'; left = TALK; lastSec = -1; myAns = null; ans = { a: null, b: null }; ctx.send({ t: 'case', i: ci }); sync(); };
    const toQuiz = () => { phase = 'quiz'; sync(); };
    const submitAns = (arr) => { myAns = arr; if (auth) { ans.a = arr; checkRev(); } else ctx.send({ t: 'ans', arr }); render(); };
    const checkRev = () => { if (ans.a && ans.b) { phase = 'reveal'; ctx.send({ t: 'rev', a: ans.a, b: ans.b }); render(); } };
    const sync = () => { ctx.send({ t: 's', phase, left: Math.ceil(left) }); render(); };
    const render = () => {
        if (!bodyEl) return; const c = CASES[ci];
        statEl.textContent = phase === 'talk' ? '🕐 ' + Math.ceil(left) + 's to sync your story' : phase === 'quiz' ? '🚔 Interrogation — NO TALKING' : phase === 'reveal' ? 'The verdict' : 'Alibi';
        let h = '';
        if (phase === 'idle') h = '<div class="al-msg">Waiting for the host…</div>';
        else if (phase === 'talk') h = '<div class="al-case">' + c.s + '</div><div class="al-timer">' + Math.ceil(left) + '</div><div class="al-msg">Agree on every detail out loud — they\'ll check.</div>' + (auth ? '<button class="app-btn" id="al-skip">We\'re ready →</button>' : '');
        else if (phase === 'quiz') h = myAns
            ? '<div class="al-msg">Statement given. Waiting for your accomplice…</div>'
            : '<div class="al-msg al-warn">🤫 Answer alone — no talking!</div>' + c.q.map((q, i) => '<label class="al-q">' + q + '<input class="al-in" data-i="' + i + '" maxlength="60" autocomplete="off"></label>').join('') + '<button class="app-btn" id="al-sub">Submit statement</button>';
        else if (phase === 'reveal' && ans.a && ans.b) {
            let hits = 0;
            h = '<div class="al-case">' + c.s + '</div><table class="al-tab"><tr><th></th><th>' + (me === 'a' ? 'You' : 'Them') + '</th><th>' + (me === 'a' ? 'Them' : 'You') + '</th></tr>';
            c.q.forEach((q, i) => { const m = matches(ans.a[i], ans.b[i]); if (m) hits++; h += '<tr class="' + (m ? 'al-hit' : 'al-miss') + '"><td>' + q + '</td><td>' + (ans.a[i] || '—') + '</td><td>' + (ans.b[i] || '—') + '</td></tr>'; });
            h += '</table><div class="al-verdict">' + hits + '/5 aligned — ' + (hits >= 3 ? '✅ CLEARED. Your story holds.' : '🚔 BUSTED. Take them away.') + '</div><button class="app-btn" id="al-next">New case</button>';
        }
        bodyEl.innerHTML = h;
        const sk = bodyEl.querySelector('#al-skip'), sb = bodyEl.querySelector('#al-sub'), nx = bodyEl.querySelector('#al-next');
        if (sk) sk.addEventListener('click', toQuiz);
        if (sb) sb.addEventListener('click', () => submitAns([...bodyEl.querySelectorAll('.al-in')].map(i => i.value.trim())));
        if (nx) nx.addEventListener('click', newCase);
    };
    const loop = (t) => { if (auth && phase === 'talk') { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; sync(); } if (left <= 0) toQuiz(); } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'alibi', label: 'Alibi', css: 'apps/alibi.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle';
            ctx.root.innerHTML = '<div class="app-col" id="al"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New case</button></div><div id="al-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#al-body');
            ctx.root.querySelector('.nb').addEventListener('click', newCase);
            if (auth) newCase(); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'case' && !auth) { ci = msg.i; myAns = null; ans = { a: null, b: null }; phase = 'talk'; render(); }
            else if (msg.t === 's' && !auth) { phase = msg.phase; left = msg.left; render(); }
            else if (msg.t === 'ans' && auth) { ans.b = msg.arr; checkRev(); }
            else if (msg.t === 'rev' && !auth) { ans = { a: msg.a, b: msg.b }; phase = 'reveal'; render(); }
            else if (msg.t === 'newreq' && auth) newCase();
        }
    });
})();
