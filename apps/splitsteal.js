// Split or Steal (2-player) for appmegle. Golden Balls with a stranger: 100 points on the
// table, 60 seconds to negotiate FACE TO FACE, then both secretly pick SPLIT or STEAL and
// reveal simultaneously. Both split = 50 each; one steals = they take all 100; both steal =
// nothing. Running totals across rounds. Caller-authoritative timer + payout. Caller = Blue,
// answerer = Orange.
(function () {
    const POT = 100, TALK = 60;
    let ctx = null, auth = false, me = 'a', phase = 'idle', left = TALK, picks = { a: null, b: null }, res = null, tot = { a: 0, b: 0 }, lastSec = -1, statEl = null, bodyEl = null, raf = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const newRound = () => { if (!auth) return ctx.send({ t: 'newreq' }); phase = 'talk'; left = TALK; lastSec = -1; picks = { a: null, b: null }; res = null; sync(); };
    const settle = () => {
        if (!picks.a || !picks.b) return;
        let pa = 0, pb = 0;
        if (picks.a === 'split' && picks.b === 'split') { pa = pb = POT/2; }
        else if (picks.a === 'steal' && picks.b === 'split') pa = POT;
        else if (picks.a === 'split' && picks.b === 'steal') pb = POT;
        tot.a += pa; tot.b += pb; res = { a: picks.a, b: picks.b, pa, pb }; phase = 'reveal'; sync();
    };
    const pick = (p, c) => { if (phase !== 'choose' || picks[p]) return; picks[p] = c; if (auth) settle(); render(); };
    const sync = () => { ctx.send({ t: 's', phase, left: Math.ceil(left), res, ta: tot.a, tb: tot.b }); render(); };
    const render = () => {
        if (!bodyEl) return; const opp = other(me);
        statEl.textContent = 'You ' + tot[me] + ' – ' + tot[opp] + ' Them';
        let h = '';
        if (phase === 'idle') h = '<div class="ss-msg">Waiting for the host…</div>';
        else if (phase === 'talk') h = '<div class="ss-pot">💰 ' + POT + '</div><div class="ss-big">NEGOTIATE</div><div class="ss-timer">' + Math.ceil(left) + '</div><div class="ss-msg">look them in the eye — will they split?</div>';
        else if (phase === 'choose') h = picks[me]
            ? '<div class="ss-big">Locked in.</div><div class="ss-msg">waiting for their choice…</div>'
            : '<div class="ss-big">CHOOSE — in secret</div><div class="ss-btns"><button class="ss-choice ss-split" data-c="split">🤝 SPLIT</button><button class="ss-choice ss-steal" data-c="steal">😈 STEAL</button></div>';
        else if (phase === 'reveal' && res) {
            const mineC = res[me], oppC = res[opp], mineP = me === 'a' ? res.pa : res.pb;
            h = '<div class="ss-rev"><div>You: <b class="' + (mineC === 'steal' ? 'ss-red' : 'ss-green') + '">' + mineC.toUpperCase() + '</b></div><div>Them: <b class="' + (oppC === 'steal' ? 'ss-red' : 'ss-green') + '">' + oppC.toUpperCase() + '</b></div></div>' +
                '<div class="ss-big">' + (mineP === POT ? '😈 You took it ALL' : mineP === POT/2 ? '🤝 Fair split' : oppC === 'steal' && mineC === 'steal' ? '💥 Mutual destruction' : '💔 Betrayed') + '</div>' +
                '<div class="ss-msg">you win ' + mineP + ' this round</div><button class="app-btn" id="ss-next">Next round</button>';
        }
        bodyEl.innerHTML = h;
        bodyEl.querySelectorAll('.ss-choice').forEach(b => b.addEventListener('click', () => { const c = b.dataset.c; if (auth) pick('a', c); else { picks.b = c; ctx.send({ t: 'pick', c }); render(); } }));
        const nx = bodyEl.querySelector('#ss-next'); if (nx) nx.addEventListener('click', newRound);
    };
    const loop = (t) => { if (auth && phase === 'talk') { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; sync(); } if (left <= 0) { phase = 'choose'; sync(); } } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'splitsteal', label: 'Split or Steal', css: 'apps/splitsteal.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; tot = { a: 0, b: 0 };
            ctx.root.innerHTML = '<div class="app-col" id="ss"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New round</button></div><div id="ss-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ss-body');
            ctx.root.querySelector('.nb').addEventListener('click', newRound);
            if (auth) newRound(); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { const keepPick = picks.b; phase = msg.phase; left = msg.left; res = msg.res; tot = { a: msg.ta, b: msg.tb }; if (phase !== 'choose') picks = { a: null, b: null }; else picks.b = keepPick; render(); }
            else if (msg.t === 'pick' && auth) { picks.b = msg.c; settle(); }
            else if (msg.t === 'newreq' && auth) newRound();
        }
    });
})();
