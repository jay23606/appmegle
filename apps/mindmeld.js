// Mind Meld (2-player co-op) for appmegle. The telepathy game: you each type ANY word, reveal
// simultaneously, then each type a word "between" the two previous words — and repeat until you
// both type the SAME word. Watching a stranger's brain converge with yours in a few rounds is
// the whole magic. Pure word-exchange (revealed only when both have submitted). No sides.
(function () {
    let ctx = null, round = 1, hist = [], mineArr = {}, oppArr = {}, won = false, statEl = null, bodyEl = null;
    const norm = (w) => (w || '').trim().toLowerCase().replace(/[^a-z0-9À-ɏ' -]/g, '');
    const tryReveal = () => {
        const m = mineArr[round], o = oppArr[round];
        if (m !== undefined && o !== undefined) {
            hist.push([m, o]);
            if (norm(m) && norm(m) === norm(o)) won = true; else round++;
        }
        render();
    };
    const reset = () => { round = 1; hist = []; mineArr = {}; oppArr = {}; won = false; render(); };
    const render = () => {
        if (!bodyEl) return;
        statEl.textContent = won ? '🧠⚡ MIND MELD in ' + hist.length + (hist.length === 1 ? ' round!' : ' rounds!') : 'Round ' + round;
        let h = hist.map((p, i) => '<div class="mm-row' + (won && i === hist.length-1 ? ' mm-hit' : '') + '"><span>' + p[0] + '</span><em>·</em><span>' + p[1] + '</span></div>').join('');
        if (won) h += '<div class="mm-win">🎉 You said the same word!</div><button class="app-btn" id="mm-new">Go again</button>';
        else if (mineArr[round] !== undefined) h += '<div class="mm-msg">Locked in — waiting for them…</div>';
        else h += '<div class="mm-msg">' + (round === 1 ? 'Type any word.' : 'Type a word <b>between</b> "' + hist[hist.length-1][0] + '" and "' + hist[hist.length-1][1] + '".') + '</div><div class="mm-in"><input id="mm-w" maxlength="30" autocomplete="off" placeholder="your word"><button class="app-btn" id="mm-go">Lock in</button></div>';
        bodyEl.innerHTML = h;
        const inp = bodyEl.querySelector('#mm-w'), go = bodyEl.querySelector('#mm-go'), nw = bodyEl.querySelector('#mm-new');
        const submit = () => { const w = inp.value.trim(); if (!w) return; mineArr[round] = w; ctx.send({ t: 'w', w, r: round }); tryReveal(); };
        if (go) { go.addEventListener('click', submit); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }); inp.focus(); }
        if (nw) nw.addEventListener('click', () => { ctx.send({ t: 'new' }); reset(); });
    };
    window.Appmegle.register({
        id: 'mindmeld', label: 'Mind Meld', css: 'apps/mindmeld.css',
        mount(c) {
            ctx = c;
            ctx.root.innerHTML = '<div class="app-col" id="mm"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">Restart</button></div><div id="mm-body"></div><div class="mm-hint">converge on the same word — each round, aim between the two last words</div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#mm-body');
            ctx.root.querySelector('.nb').addEventListener('click', () => { ctx.send({ t: 'new' }); reset(); });
            reset();
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'w') { oppArr[msg.r] = msg.w; tryReveal(); }
            else if (msg.t === 'new') reset();
        }
    });
})();
