// What's That Sound? (2-player) for appmegle. Foley guessing: grab a real object from your room
// and make a sound with it — off camera if you can! — while your partner guesses out loud what
// made it. The prompt card ("something metallic…") steers you; the performer confirms or skips.
// Uses their actual physical world as the game board. Performer-authoritative prompts.
(function () {
    const PROMPTS = ['something metallic','something crinkly','something that pours','something electronic','a door or drawer','something fabric','something that clicks','something bouncy','something wooden','something glass (careful!)','something with pages','something that zips','something inflatable','something in your kitchen','something that jingles','something squeaky','something you can drum on','something that tears','something with buttons','something that rolls','something velcro','something that sloshes'];
    let ctx = null, me = 'a', performer = 'a', prompt = '', phase = 'idle', scores = { a: 0, b: 0 }, seen = new Set(), statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const pickPrompt = () => { if (seen.size >= PROMPTS.length) seen.clear(); let p; do { p = PROMPTS[(Math.random()*PROMPTS.length)|0]; } while (seen.has(p)); seen.add(p); return p; };
    const startRound = () => { performer = me; prompt = pickPrompt(); phase = 'play'; ctx.send({ t: 'round', performer: me }); render(); };
    const got = () => { scores[other(me)]++; phase = 'between'; ctx.send({ t: 'end', scores, ok: true }); render(); };
    const stumped = () => { scores[me]++; phase = 'between'; ctx.send({ t: 'end', scores, ok: false }); render(); };
    const render = () => {
        if (!bodyEl) return; const amPerf = performer === me;
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[other(me)] + ' Them';
        let h = '';
        if (phase === 'idle') h = '<div class="ws-msg">🔊 Make a sound with a real object; partner guesses what made it. Point for a stump, point for a catch.</div><button class="app-btn" id="ws-start">I\'ll make a sound first</button>';
        else if (phase === 'play') h = amPerf
            ? '<div class="ws-msg">Find and sound out…</div><div class="ws-prompt">' + prompt + '</div><div class="ws-msg">hide it from the camera 🙈 — let them guess out loud</div><div class="ws-btns"><button class="app-btn" id="ws-got">✓ They guessed it</button><button class="app-btn" id="ws-stump">🧱 Totally stumped</button><button class="app-btn" id="ws-skip">↷ New prompt</button></div>'
            : '<div class="ws-big">👂 Listen closely…</div><div class="ws-msg">what IS that? guess out loud!</div>';
        else if (phase === 'between') h = '<div class="ws-big">' + (performer === me ? 'Round over' : 'Round over') + '</div><button class="app-btn" id="ws-start">' + (amPerf ? 'Their turn — wait…' : 'My turn to make a sound →') + '</button>';
        bodyEl.innerHTML = h;
        const st = bodyEl.querySelector('#ws-start'), gt = bodyEl.querySelector('#ws-got'), sp = bodyEl.querySelector('#ws-stump'), sk = bodyEl.querySelector('#ws-skip');
        if (st) { if (phase === 'between' && performer === me) st.disabled = true; else st.addEventListener('click', startRound); }
        if (gt) gt.addEventListener('click', got);
        if (sp) sp.addEventListener('click', stumped);
        if (sk) sk.addEventListener('click', () => { prompt = pickPrompt(); render(); });
    };
    window.Appmegle.register({
        id: 'whatsound', label: "What's That Sound?", css: 'apps/whatsound.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; seen = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="ws"><div class="app-bar"><span class="stat"></span></div><div id="ws-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ws-body');
            render();
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'round') { performer = msg.performer; phase = 'play'; render(); }
            else if (msg.t === 'end') { scores = msg.scores; phase = 'between'; render(); }
        }
    });
})();
