// Codenames Duet (2-player co-op) for appmegle. A 5x5 grid of words. Each of you has a secret
// key showing which words are YOUR agents (your partner must find) and which are assassins
// (your partner must avoid). Take turns giving a one-word clue + number out loud/typed; your
// partner taps guesses. Find every agent without hitting an assassin to win together. The
// caller is authoritative and sends each player only their own key. Caller = Blue, answerer = Orange.
(function () {
    const WORDS = ['Apple','Robot','Ocean','Castle','Tiger','Moon','Guitar','Pirate','Rocket','Forest','Diamond','Dragon','Coffee','Mountain','Ghost','Pencil','River','Engine','Cookie','Planet','Anchor','Jungle','Mirror','Volcano','Crown','Whistle','Ladder','Comet','Garden','Vampire','Compass','Pillow','Cactus','Thunder','Marble','Lantern','Bridge','Igloo','Saddle','Wizard','Tornado','Trumpet','Glacier','Beacon','Maze','Falcon','Kettle','Meteor','Harbor','Sphinx'];
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let ctx = null, auth = false, me = 'a', words = [], keyA = [], keyB = [], myKey = [], found = [], greens = [], gtotal = 0, turn = 'a', phase = 'clue', clue = null, over = false, result = '';
    let statEl = null, gridEl = null, ctrlEl = null;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const genKey = () => { const k = Array(25).fill('n'), idx = shuffle([...Array(25).keys()]); for (let i = 0; i < 9; i++) k[idx[i]] = 'g'; for (let i = 9; i < 12; i++) k[idx[i]] = 'x'; return k; };
    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        words = shuffle([...WORDS]).slice(0, 25); keyA = genKey(); keyB = genKey();
        greens = []; for (let i = 0; i < 25; i++) if (keyA[i] === 'g' || keyB[i] === 'g') greens.push(i); gtotal = greens.length;
        found = []; turn = 'a'; phase = 'clue'; clue = null; over = false; result = ''; myKey = keyA; sync();
    };
    const giverKey = () => turn === 'a' ? keyA : keyB;
    const resolveTap = (i) => {
        if (over || phase !== 'guess' || found.includes(i)) return; const k = giverKey()[i];
        if (k === 'g') { found.push(i); if (greens.every(x => found.includes(x))) { over = true; result = 'win'; } }
        else if (k === 'x') { over = true; result = 'lose'; }
        else { turn = other(turn); phase = 'clue'; clue = null; }
        sync();
    };
    const giveClue = (word, num) => { if (phase !== 'clue') return; clue = { word, num }; phase = 'guess'; sync(); };
    const passTurn = () => { if (phase !== 'guess') return; turn = other(turn); phase = 'clue'; clue = null; sync(); };
    const sync = () => { ctx.send({ t: 's', words, key: keyB, found, turn, phase, clue, over, result, gn: gtotal }); render(); };

    const render = () => {
        if (!gridEl) return; const amGiver = turn === me && phase === 'clue', amGuesser = turn !== me && phase === 'guess';
        statEl.textContent = over ? (result === 'win' ? '🎉 You both win!' : '💀 Assassin! You lose') : 'Found ' + found.length + '/' + gtotal + ' · ' + (turn === me ? 'your clue' : "partner's clue") + (clue ? ' — “' + clue.word + '” ' + clue.num : '');
        gridEl.innerHTML = words.map((w, i) => { const f = found.includes(i); const mk = myKey[i]; let cls = 'cn-tile'; if (f) cls += ' found'; else { if (mk === 'g') cls += ' mg'; else if (mk === 'x') cls += ' mx'; } if (amGuesser && !f && !over) cls += ' tappable'; return '<button class="' + cls + '" data-i="' + i + '">' + w + '</button>'; }).join('');
        if (amGuesser && !over) gridEl.querySelectorAll('.tappable').forEach(b => b.addEventListener('click', () => { if (auth) resolveTap(+b.dataset.i); else ctx.send({ t: 'tap', i: +b.dataset.i }); }));
        let h = '';
        if (over) h = '';
        else if (amGiver) h = '<input id="cn-w" placeholder="one-word clue" autocomplete="off"><input id="cn-n" type="number" min="1" max="9" value="1" style="width:54px"><button class="app-btn" id="cn-go">Give clue</button>';
        else if (amGuesser) h = '<button class="app-btn" id="cn-pass">End turn / Pass</button>';
        else h = '<div class="cn-msg">…' + (phase === 'clue' ? 'partner is giving a clue' : 'your partner is guessing') + '…</div>';
        ctrlEl.innerHTML = h;
        const go = ctrlEl.querySelector('#cn-go'), pass = ctrlEl.querySelector('#cn-pass');
        if (go) go.addEventListener('click', () => { const w = (ctrlEl.querySelector('#cn-w').value || '').trim(), n = +ctrlEl.querySelector('#cn-n').value || 1; if (!w) return; if (auth) giveClue(w, n); else ctx.send({ t: 'clue', word: w, num: n }); });
        if (pass) pass.addEventListener('click', () => { if (auth) passTurn(); else ctx.send({ t: 'pass' }); });
    };
    window.Appmegle.register({
        id: 'codenames', label: 'Codenames Duet', css: 'apps/codenames.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col" id="cn"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="cn-grid"></div><div id="cn-ctrl"></div></div>';
            statEl = ctx.root.querySelector('.stat'); gridEl = ctx.root.querySelector('#cn-grid'); ctrlEl = ctx.root.querySelector('#cn-ctrl');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else statEl.textContent = 'Waiting for the host…';
        },
        unmount() { ctx = statEl = gridEl = ctrlEl = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { words = msg.words; myKey = msg.key; found = msg.found; turn = msg.turn; phase = msg.phase; clue = msg.clue; over = msg.over; result = msg.result; gtotal = msg.gn; render(); }
            else if (msg.t === 'tap' && auth) resolveTap(msg.i);
            else if (msg.t === 'clue' && auth) giveClue(msg.word, msg.num);
            else if (msg.t === 'pass' && auth) passTurn();
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
