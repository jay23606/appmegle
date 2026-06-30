// Make Me Laugh (2-player) for appmegle. The performer has 30 seconds to make their partner
// laugh — the judge taps "I laughed!" the moment they crack. Survive the 30s and the judge
// scores instead. Pure co-presence — only works because you can see each other. Roles swap.
// Caller-authoritative timer. Caller = Blue, answerer = Orange.
(function () {
    let ctx = null, auth = false, me = 'a', performer = 'a', phase = 'idle', time = 30, scores = { a: 0, b: 0 }, result = '', lastSec = -1, statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const newRound = (swap) => { if (!auth) return ctx.send({ t: 'newreq' }); if (swap && phase !== 'idle') performer = other(performer); phase = 'play'; time = 30; lastSec = -1; result = ''; sync(); };
    const laughed = () => { if (phase !== 'play') return; scores[performer]++; result = 'laugh'; phase = 'over'; sync(); };
    const survived = () => { if (phase !== 'play') return; scores[other(performer)]++; result = 'survived'; phase = 'over'; sync(); };
    const sync = () => { ctx.send({ t: 's', performer, phase, time: Math.ceil(time), sa: scores.a, sb: scores.b, result }); render(); };
    const render = () => {
        if (!bodyEl) return; const amPerf = performer === me, opp = other(me);
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[opp] + ' Them';
        let h = '';
        if (phase === 'idle') h = '<div class="ml-msg">Waiting for the host…</div>';
        else if (phase === 'over') {
            const txt = result === 'laugh' ? (amPerf ? 'You made them laugh! +1 😂' : 'They cracked you up — point to them') : (amPerf ? 'They held it together — point to them' : 'You survived! +1 😐');
            h = '<div class="ml-big">' + (result === 'laugh' ? '😂' : '😐') + '</div><div class="ml-msg">' + txt + '</div><button class="app-btn" id="ml-next">New round (swap)</button>';
        } else if (amPerf) h = '<div class="ml-big">😜 Make them LAUGH!</div><div class="ml-timer">⏱ ' + Math.ceil(time) + '</div><div class="ml-msg">pull faces, tell jokes — go!</div>';
        else h = '<div class="ml-big">😐 Don\'t laugh…</div><div class="ml-timer">⏱ ' + Math.ceil(time) + '</div><button id="ml-laugh">😂 I LAUGHED!</button>';
        bodyEl.innerHTML = h;
        const lb = bodyEl.querySelector('#ml-laugh'), nx = bodyEl.querySelector('#ml-next');
        if (lb) lb.addEventListener('click', () => { if (auth) laughed(); else ctx.send({ t: 'laugh' }); });
        if (nx) nx.addEventListener('click', () => newRound(true));
    };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; time -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(time); if (s !== lastSec) { lastSec = s; sync(); } if (time <= 0) { time = 0; survived(); } } else loop._l = t; loop._r = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'makelaugh', label: 'Make Me Laugh', css: 'apps/makelaugh.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; performer = 'a';
            ctx.root.innerHTML = '<div class="app-col" id="ml"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="ml-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ml-body');
            ctx.root.querySelector('.nb').addEventListener('click', () => newRound(false));
            if (auth) newRound(false); else render();
            loop._r = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(loop._r); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { performer = msg.performer; phase = msg.phase; time = msg.time; scores = { a: msg.sa, b: msg.sb }; result = msg.result; render(); }
            else if (msg.t === 'laugh' && auth) laughed();
            else if (msg.t === 'newreq' && auth) newRound(false);
        }
    });
})();
