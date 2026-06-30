// Truth or Dare (2-player) for appmegle. Take turns picking Truth or Dare; the dares happen
// live on camera and truths are answered out loud — which is exactly why it belongs on a
// video call. Caller owns the decks (no repeats). Caller = Blue, answerer = Orange.
(function () {
    const TRUTHS = ["What's a weird talent you have?","What's your most-used emoji?","What's the last thing you searched online?","What's a small thing that instantly annoys you?","What's your guilty-pleasure song?","What's a white lie you tell often?","Who was your childhood celebrity crush?","What's your most irrational fear?","What's the worst haircut you've ever had?","What's a habit you wish you could break?","What's the most childish thing you still do?","What's something you're weirdly proud of?","What's the last thing that made you cry-laugh?","What's a food you pretend to like?","What's the strangest thing you've ever eaten?","If you could un-invent one thing, what would it be?","What's a trend you secretly enjoy?","What's the most spontaneous thing you've ever done?","What's a small thing you're surprisingly competitive about?","What's your go-to comfort show?"];
    const DARES = ["Do your best robot dance for 10 seconds.","Show the camera the closest red object to you.","Talk in an accent until your next turn.","Do 5 jumping jacks.","Make the silliest face you can and hold it for 5 seconds.","Sing 'Happy Birthday' as dramatically as possible.","Show off your best dance move.","Do an impression of anyone you like.","Hold a plank for 15 seconds.","Speak only in questions until your next turn.","Do your best evil-villain laugh.","Pretend to be a news anchor reporting the weather.","Show the camera something that makes you happy.","Tell a joke — if they don't laugh, tell another.","Balance something on your head for 10 seconds.","Do your best slow-motion action scene.","Give your partner a sincere compliment.","Act out your morning routine in 10 seconds.","Show your most surprised face.","Do your best impression of your partner."];
    let ctx = null, auth = false, me = 'a', active = 'a', phase = 'pick', prompt = '', kind = '', seenT = new Set(), seenD = new Set(), statEl = null, bodyEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const pickFrom = (list, seen) => { if (seen.size >= list.length) seen.clear(); let q; do { q = list[(Math.random()*list.length)|0]; } while (seen.has(q)); seen.add(q); return q; };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); active = 'a'; phase = 'pick'; prompt = ''; sync(); };
    const applyPick = (k) => { if (phase !== 'pick') return; kind = k; prompt = k === 'truth' ? pickFrom(TRUTHS, seenT) : pickFrom(DARES, seenD); phase = 'show'; sync(); };
    const nextTurn = () => { active = other(active); phase = 'pick'; prompt = ''; sync(); };
    const sync = () => { ctx.send({ t: 's', active, phase, prompt, kind }); render(); };
    const render = () => {
        if (!bodyEl) return; const amA = active === me;
        statEl.textContent = amA ? 'Your turn' : "Their turn";
        let h = '';
        if (phase === 'pick') h = amA ? '<div class="td-msg">Pick one:</div><div id="td-pick"><button id="td-t">🗣 Truth</button><button id="td-d">🎭 Dare</button></div>' : '<div class="td-msg">They\'re choosing Truth or Dare…</div>';
        else h = '<div class="td-kind ' + kind + '">' + (kind === 'truth' ? 'TRUTH' : 'DARE') + '</div><div class="td-prompt">' + prompt + '</div>' + (amA ? '<button class="app-btn" id="td-done">Done — their turn →</button>' : '<div class="td-msg">…watch them ' + (kind === 'truth' ? 'answer' : 'do it') + '!</div>');
        bodyEl.innerHTML = h;
        const t = bodyEl.querySelector('#td-t'), d = bodyEl.querySelector('#td-d'), done = bodyEl.querySelector('#td-done');
        const pick = (k) => { if (auth) applyPick(k); else ctx.send({ t: 'pick', k }); };
        if (t) t.addEventListener('click', () => pick('truth')); if (d) d.addEventListener('click', () => pick('dare'));
        if (done) done.addEventListener('click', () => { if (auth) nextTurn(); else ctx.send({ t: 'next' }); });
    };
    window.Appmegle.register({
        id: 'truthdare', label: 'Truth or Dare', css: 'apps/truthdare.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; seenT = new Set(); seenD = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="td"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="td-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#td-body');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else bodyEl.textContent = 'Waiting for the host…';
        },
        unmount() { ctx = statEl = bodyEl = null; },
        onData(msg) { if (msg.t === 's' && !auth) { active = msg.active; phase = msg.phase; prompt = msg.prompt; kind = msg.kind; render(); } else if (msg.t === 'pick' && auth) { if (active === 'b') applyPick(msg.k); } else if (msg.t === 'next' && auth) { if (active === 'b') nextTurn(); } else if (msg.t === 'newreq' && auth) newGame(); }
    });
})();
