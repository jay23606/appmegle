// Hangman for appmegle. Caller SETS a secret word; answerer GUESSES. The setter is
// authoritative and only broadcasts the masked view, so the secret word never travels
// over the wire. New word lets the setter go again.
(function () {
    const MAX = 6, ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let ctx = null, role = 'setter', view = null;
    let word = '', guessed = {}, wrong = 0;        // setter-only state
    let statEl, setBox, dispEl, usedEl, keysEl, nb, wordInput;

    const computeView = () => {
        const used = Object.keys(guessed).sort();
        const wl = used.filter(l => !word.includes(l));
        const won = word && word.split('').every(ch => guessed[ch]);
        const lost = wl.length >= MAX;
        return {
            shown: word.split('').map(ch => guessed[ch] ? ch : '_').join(' '),
            used, wrong: wl.length, max: MAX,
            status: won ? 'won' : lost ? 'lost' : 'play',
            reveal: (won || lost) ? word : null
        };
    };
    const pushView = () => { view = computeView(); render(); ctx.send({ t: 'state', view }); };

    const render = () => {
        const guesser = role === 'guesser';
        if (!view) { statEl.textContent = guesser ? 'Waiting for a word…' : 'Type a word for them to guess'; }
        else {
            const s = view.status;
            statEl.textContent = (s === 'won' ? (guesser ? 'You got it! ' : 'They guessed it! ')
                : s === 'lost' ? (guesser ? 'Out of guesses — it was "' + view.reveal + '"' : 'They lost — "' + view.reveal + '"')
                : 'Misses ' + view.wrong + ' / ' + view.max);
            dispEl.textContent = view.reveal ? view.reveal.split('').join(' ') : view.shown;
            usedEl.innerHTML = '❌ ' + view.used.filter(l => view.reveal ? !view.reveal.includes(l) : true)
                .map(l => '<span class="hm-bad">' + l + '</span>').join(' ');
        }
        if (keysEl) [...keysEl.children].forEach(btn => {
            const used = view && view.used.includes(btn.dataset.l);
            btn.disabled = used || !view || view.status !== 'play';
            btn.classList.toggle('used', !!used);
        });
    };

    const guessLetter = (l) => {                    // setter applies a guess from the answerer
        if (!word || guessed[l] || computeView().status !== 'play') return;
        guessed[l] = true; pushView();
    };

    window.Appmegle.register({
        id: 'hangman', label: 'Hangman', css: 'apps/hangman.css',
        mount(c) {
            ctx = c; role = ctx.amCaller ? 'setter' : 'guesser'; view = null; word = ''; guessed = {}; wrong = 0;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                (role === 'setter' ? '<button class="app-btn nb">New word</button>' : '') + '</div>' +
                (role === 'setter' ? '<div id="hm-set"><input id="hm-word" maxlength="20" placeholder="secret word" autocomplete="off"><button class="app-btn" id="hm-go">Set</button></div>' : '') +
                '<div id="hm-disp"></div><div id="hm-used"></div>' +
                (role === 'guesser' ? '<div id="hm-keys"></div>' : '') + '</div>';
            statEl = ctx.root.querySelector('.stat');
            dispEl = ctx.root.querySelector('#hm-disp');
            usedEl = ctx.root.querySelector('#hm-used');
            keysEl = ctx.root.querySelector('#hm-keys');
            nb = ctx.root.querySelector('.nb');
            setBox = ctx.root.querySelector('#hm-set');
            wordInput = ctx.root.querySelector('#hm-word');

            if (role === 'setter') {
                const setWord = () => {
                    const w = (wordInput.value || '').toLowerCase().replace(/[^a-z]/g, '');
                    if (w.length < 2) return;
                    word = w; guessed = {}; wrong = 0; pushView();
                };
                ctx.root.querySelector('#hm-go').addEventListener('click', setWord);
                wordInput.addEventListener('keypress', e => { if (e.key === 'Enter') setWord(); });
                nb.addEventListener('click', () => { word = ''; view = null; wordInput.value = ''; render(); ctx.send({ t: 'state', view: null }); });
            } else {
                ALPHA.forEach(l => {
                    const b = document.createElement('button'); b.className = 'hm-key'; b.dataset.l = l; b.textContent = l;
                    b.addEventListener('click', () => { if (!b.disabled) { b.disabled = true; ctx.send({ t: 'guess', l }); } });
                    keysEl.appendChild(b);
                });
            }
            render();
        },
        unmount() { ctx = statEl = dispEl = usedEl = keysEl = nb = setBox = wordInput = null; view = null; },
        onData(msg) {
            if (msg.t === 'guess' && role === 'setter') guessLetter(msg.l);
            else if (msg.t === 'state' && role === 'guesser') { view = msg.view; render(); }
        }
    });
})();
