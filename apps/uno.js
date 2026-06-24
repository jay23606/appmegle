// Uno for appmegle. Hidden-hand card game, so the caller is the authoritative referee:
// it owns the deck, both hands and the discard pile, and sends each player a tailored
// view (own hand + opponent's card count + public state). The answerer sends intents
// (play / draw / pass / pick colour); the caller validates and re-broadcasts. 2-player
// rules: Skip / Reverse / Draw Two / Wild Draw Four all let you go again. Caller deals.
(function () {
    const COLORS = ['r', 'y', 'g', 'b'];
    const SYM = { skip: '⊘', rev: '⇄', d2: '+2', wild: '★', wd4: '+4' };
    const FILL = { r: '#e23b3b', y: '#e0b020', g: '#3ab35a', b: '#3a78e2', w: '#333' };

    let ctx = null, auth = false, me = 'a';
    // caller-only authoritative state
    let deck = [], discard = [], hands = { a: [], b: [] }, turn = 'a', color = 'r', over = false, winner = null;
    let drewPlayer = null, drewIdx = -1, lastMsg = '';
    // client render bits
    let view = null, pendingWild = -1;
    let oppEl, midEl, topEl, colEl, handEl, drawBtn, passBtn, colorBox, statEl;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const makeDeck = () => {
        const d = [];
        for (const c of COLORS) { d.push({ c, v: '0' }); for (let n = 1; n <= 9; n++) { d.push({ c, v: '' + n }); d.push({ c, v: '' + n }); } for (const a of ['skip', 'rev', 'd2']) { d.push({ c, v: a }); d.push({ c, v: a }); } }
        for (let i = 0; i < 4; i++) { d.push({ c: 'w', v: 'wild' }); d.push({ c: 'w', v: 'wd4' }); }
        return d;
    };
    const top = () => discard[discard.length - 1];
    const ensure = (n) => { if (deck.length < n) { const keep = discard.pop(); deck = deck.concat(discard.splice(0)); shuffle(deck); discard.push(keep); } };
    const drawCards = (p, n) => { for (let i = 0; i < n; i++) { ensure(1); if (deck.length) hands[p].push(deck.pop()); } };
    const legalC = (card, col, t) => card.c === 'w' || card.c === col || card.v === t.v;

    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        deck = shuffle(makeDeck()); hands = { a: [], b: [] }; discard = [];
        drawCards('a', 7); drawCards('b', 7);
        let s = deck.pop(); while (s.c === 'w') { deck.unshift(s); s = deck.pop(); }
        discard.push(s); color = s.c; turn = 'a'; over = false; winner = null; drewPlayer = null; drewIdx = -1; lastMsg = 'Game on';
        sync();
    };

    const applyPlay = (p, idx, chosen) => {
        if (over || turn !== p) return;
        const card = hands[p][idx]; if (!card || !legalC(card, color, top())) return;
        if (card.c === 'w' && !chosen) return;
        if (drewPlayer === p && idx !== drewIdx) return;          // after drawing, only the drawn card may be played
        hands[p].splice(idx, 1); discard.push(card);
        color = card.c === 'w' ? chosen : card.c;
        drewPlayer = null; drewIdx = -1;
        const opp = other(p); let stay = false;
        if (card.v === 'd2') { drawCards(opp, 2); stay = true; }
        else if (card.v === 'wd4') { drawCards(opp, 4); stay = true; }
        else if (card.v === 'skip' || card.v === 'rev') stay = true;
        lastMsg = 'Played ' + (card.c === 'w' ? 'Wild' : '') + (SYM[card.v] || ' ' + card.v);
        if (!hands[p].length) { over = true; winner = p; }
        else turn = stay ? p : opp;
        sync();
    };
    const applyDraw = (p) => {
        if (over || turn !== p || drewPlayer) return;
        drawCards(p, 1); const card = hands[p][hands[p].length - 1];
        if (legalC(card, color, top())) { drewPlayer = p; drewIdx = hands[p].length - 1; lastMsg = 'Drew a card'; }
        else { turn = other(p); lastMsg = 'Drew and passed'; }
        sync();
    };
    const applyPass = (p) => { if (over || turn !== p) return; drewPlayer = null; drewIdx = -1; turn = other(p); lastMsg = 'Passed'; sync(); };

    const buildView = (p) => ({
        hand: hands[p], oppCount: hands[other(p)].length, top: top(), color, deckCount: deck.length,
        myTurn: turn === p && !over, drewIdx: drewPlayer === p ? drewIdx : -1,
        over, win: over ? winner === p : null, msg: lastMsg
    });
    const sync = () => { view = buildView('a'); render(); ctx.send({ t: 'state', v: buildView('b') }); };

    // ---- rendering (both sides, from `view`) ----
    const cardBtn = (card, idx, on) => '<button class="uno-card ' + card.c + '" data-idx="' + idx + '"' + (on ? '' : ' disabled') + '>' + (SYM[card.v] || card.v) + '</button>';
    const render = () => {
        if (!view) { statEl.textContent = 'Waiting for the host to deal…'; return; }
        oppEl.innerHTML = Array.from({ length: view.oppCount }, () => '<span class="uno-back"></span>').join('');
        topEl.className = 'uno-card ' + view.top.c; topEl.textContent = SYM[view.top.v] || view.top.v;
        colEl.style.background = FILL[view.color];
        drawBtn.disabled = !(view.myTurn && view.drewIdx < 0);
        passBtn.style.display = (view.myTurn && view.drewIdx >= 0) ? '' : 'none';
        handEl.innerHTML = view.hand.map((c, i) => {
            const playable = view.myTurn && (view.drewIdx < 0 ? legalC(c, view.color, view.top) : i === view.drewIdx);
            return cardBtn(c, i, playable);
        }).join('');
        handEl.querySelectorAll('.uno-card').forEach(b => b.addEventListener('click', () => onCard(+b.dataset.idx)));
        colorBox.classList.add('hidden'); pendingWild = -1;
        statEl.textContent = view.over ? (view.win ? '🎉 You win!' : 'You lose')
            : (view.myTurn ? ('Your turn' + (view.drewIdx >= 0 ? ' — play it or Pass' : '')) : 'Their turn') + (view.msg ? ' · ' + view.msg : '');
    };
    const onCard = (idx) => {
        const card = view.hand[idx];
        if (!view.myTurn) return;
        if (view.drewIdx >= 0 && idx !== view.drewIdx) return;
        if (!legalC(card, view.color, view.top)) return;
        if (card.c === 'w') { pendingWild = idx; colorBox.classList.remove('hidden'); return; }
        doPlay(idx, null);
    };
    const doPlay = (idx, col) => { if (auth) applyPlay('a', idx, col); else ctx.send({ t: 'play', idx, color: col }); };
    const doDraw = () => { if (auth) applyDraw('a'); else ctx.send({ t: 'draw' }); };
    const doPass = () => { if (auth) applyPass('a'); else ctx.send({ t: 'pass' }); };

    window.Appmegle.register({
        id: 'uno', label: 'Uno', css: 'apps/uno.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null;
            ctx.root.innerHTML = '<div class="app-col" id="uno"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<div id="uno-opp"></div>' +
                '<div id="uno-mid"><button id="uno-draw" class="uno-card back" title="Draw"></button>' +
                '<div id="uno-top" class="uno-card"></div><span id="uno-color"></span>' +
                '<button class="app-btn" id="uno-pass">Pass</button></div>' +
                '<div id="uno-hand"></div>' +
                '<div id="uno-colors" class="hidden">' + COLORS.map(c2 => '<button data-c="' + c2 + '" style="background:' + FILL[c2] + '"></button>').join('') + '</div></div>';
            oppEl = ctx.root.querySelector('#uno-opp'); midEl = ctx.root.querySelector('#uno-mid');
            topEl = ctx.root.querySelector('#uno-top'); colEl = ctx.root.querySelector('#uno-color');
            handEl = ctx.root.querySelector('#uno-hand'); drawBtn = ctx.root.querySelector('#uno-draw');
            passBtn = ctx.root.querySelector('#uno-pass'); colorBox = ctx.root.querySelector('#uno-colors');
            statEl = ctx.root.querySelector('.stat');
            drawBtn.addEventListener('click', doDraw);
            passBtn.addEventListener('click', doPass);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            colorBox.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (pendingWild >= 0) doPlay(pendingWild, b.dataset.c); }));
            if (auth) newGame(); else render();
        },
        unmount() { ctx = null; view = null; },
        onData(msg) {
            if (msg.t === 'state' && !auth) { view = msg.v; render(); }
            else if (!auth) return;
            else if (msg.t === 'play') applyPlay('b', msg.idx, msg.color);
            else if (msg.t === 'draw') applyDraw('b');
            else if (msg.t === 'pass') applyPass('b');
            else if (msg.t === 'newreq') newGame();
        }
    });
})();
