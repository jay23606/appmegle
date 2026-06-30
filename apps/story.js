// Story Builder (2-player) for appmegle. Take turns adding one line at a time to build a
// ridiculous story together — funniest read aloud. Caller-authoritative for the shared story
// + whose turn. Caller = Blue, answerer = Orange.
(function () {
    const STARTERS = ['Once upon a time, in a town that smelled faintly of cinnamon,', 'It was the kind of Tuesday that started with a missing sock and ended with a parade.', "Nobody believed the lighthouse keeper, but they should have.", 'The package arrived with no return address and a single instruction.', 'She had exactly four minutes to fix everything.', 'The last thing the astronaut expected to find on the moon was a mailbox.', 'Deep in the forest, a very small dragon was learning to whistle.', 'He opened the fridge and, to his complete surprise, it was full of bees.'];
    let ctx = null, auth = false, me = 'a', lines = [], turn = 'a', statEl = null, storyEl = null, formEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const newStory = () => { if (!auth) return ctx.send({ t: 'newreq' }); lines = [{ t: STARTERS[(Math.random()*STARTERS.length)|0], a: '-' }]; turn = 'b'; sync(); };
    const apply = (text) => { lines.push({ t: text, a: turn }); turn = other(turn); sync(); };
    const doAdd = (text) => { text = (text || '').trim(); if (!text || turn !== me) return; if (auth) apply(text); else ctx.send({ t: 'add', text }); };
    const sync = () => { ctx.send({ t: 's', lines, turn }); render(); };
    const render = () => {
        if (!storyEl) return; const mine = turn === me;
        statEl.textContent = lines.length <= 1 ? 'Build a story together!' : (mine ? 'Your turn — add a line' : "Their turn…");
        storyEl.innerHTML = lines.map(l => '<span class="' + (l.a === 'a' ? 'sb-a' : l.a === 'b' ? 'sb-b' : 'sb-0') + '">' + l.t.replace(/</g, '&lt;') + '</span>').join(' ');
        storyEl.scrollTop = storyEl.scrollHeight;
        formEl.innerHTML = mine ? '<input id="sb-in" maxlength="140" placeholder="add a sentence…" autocomplete="off"><button class="app-btn" id="sb-go">Add →</button>' : '<div class="sb-wait">…waiting for them to write…</div>';
        const inp = formEl.querySelector('#sb-in'), go = formEl.querySelector('#sb-go');
        if (inp) { inp.focus(); inp.addEventListener('keypress', e => { if (e.key === 'Enter') { doAdd(inp.value); } }); go.addEventListener('click', () => doAdd(inp.value)); }
    };
    window.Appmegle.register({
        id: 'story', label: 'Story Builder', css: 'apps/story.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="sb"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New story</button></div><div id="sb-story"></div><div id="sb-form"></div></div>';
            statEl = ctx.root.querySelector('.stat'); storyEl = ctx.root.querySelector('#sb-story'); formEl = ctx.root.querySelector('#sb-form');
            ctx.root.querySelector('.nb').addEventListener('click', newStory);
            if (auth) newStory(); else { storyEl.textContent = 'Waiting for the host…'; }
        },
        unmount() { ctx = statEl = storyEl = formEl = null; lines = []; },
        onData(msg) { if (msg.t === 's') { lines = msg.lines; turn = msg.turn; render(); } else if (msg.t === 'add' && auth) { if (turn === 'b') apply(msg.text); } else if (msg.t === 'newreq' && auth) newStory(); }
    });
})();
