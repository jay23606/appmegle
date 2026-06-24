// Monopoly (2-player) for appmegle. Authoritative caller owns the whole game (it's all
// public info) and broadcasts one shared state; the active player sends intents
// (roll/buy/skip/build/end/jail) which the caller validates and applies. Caller = Blue,
// answerer = Orange. v1 simplifications: no trading, no auctions, no mortgaging, and a
// player who can't cover a payment goes bankrupt (no selling to raise cash). Houses,
// monopolies, railroads, utilities, Chance/Chest, jail and doubles are all in.
(function () {
    const GC = { brown: '#7c4a2d', lblue: '#9fd3ef', pink: '#d63b8f', orange: '#e8821e', red: '#e23b3b', yellow: '#f2d31b', green: '#3ab35a', dblue: '#2554c7' };
    // 40 spaces. t: go|prop|rr|util|cc|ch|tax|jail|gojail|parking. r=[base,1h,2h,3h,4h,hotel], h=house cost
    const B = [
        { t: 'go', n: 'GO' },
        { t: 'prop', n: 'Mediterr.', g: 'brown', p: 60, h: 50, r: [2,10,30,90,160,250] },
        { t: 'cc', n: 'Chest' },
        { t: 'prop', n: 'Baltic', g: 'brown', p: 60, h: 50, r: [4,20,60,180,320,450] },
        { t: 'tax', n: 'Income Tax', tax: 200 },
        { t: 'rr', n: 'Reading RR', p: 200 },
        { t: 'prop', n: 'Oriental', g: 'lblue', p: 100, h: 50, r: [6,30,90,270,400,550] },
        { t: 'ch', n: 'Chance' },
        { t: 'prop', n: 'Vermont', g: 'lblue', p: 100, h: 50, r: [6,30,90,270,400,550] },
        { t: 'prop', n: 'Connect.', g: 'lblue', p: 120, h: 50, r: [8,40,100,300,450,600] },
        { t: 'jail', n: 'Jail' },
        { t: 'prop', n: 'St.Charles', g: 'pink', p: 140, h: 100, r: [10,50,150,450,625,750] },
        { t: 'util', n: 'Electric', p: 150 },
        { t: 'prop', n: 'States', g: 'pink', p: 140, h: 100, r: [10,50,150,450,625,750] },
        { t: 'prop', n: 'Virginia', g: 'pink', p: 160, h: 100, r: [12,60,180,500,700,900] },
        { t: 'rr', n: 'Penn. RR', p: 200 },
        { t: 'prop', n: 'St.James', g: 'orange', p: 180, h: 100, r: [14,70,200,550,750,950] },
        { t: 'cc', n: 'Chest' },
        { t: 'prop', n: 'Tennessee', g: 'orange', p: 180, h: 100, r: [14,70,200,550,750,950] },
        { t: 'prop', n: 'New York', g: 'orange', p: 200, h: 100, r: [16,80,220,600,800,1000] },
        { t: 'parking', n: 'Free Park' },
        { t: 'prop', n: 'Kentucky', g: 'red', p: 220, h: 150, r: [18,90,250,700,875,1050] },
        { t: 'ch', n: 'Chance' },
        { t: 'prop', n: 'Indiana', g: 'red', p: 220, h: 150, r: [18,90,250,700,875,1050] },
        { t: 'prop', n: 'Illinois', g: 'red', p: 240, h: 150, r: [20,100,300,750,925,1100] },
        { t: 'rr', n: 'B&O RR', p: 200 },
        { t: 'prop', n: 'Atlantic', g: 'yellow', p: 260, h: 150, r: [22,110,330,800,975,1150] },
        { t: 'prop', n: 'Ventnor', g: 'yellow', p: 260, h: 150, r: [22,110,330,800,975,1150] },
        { t: 'util', n: 'Water Wks', p: 150 },
        { t: 'prop', n: 'Marvin', g: 'yellow', p: 280, h: 150, r: [24,120,360,850,1025,1200] },
        { t: 'gojail', n: 'Go to Jail' },
        { t: 'prop', n: 'Pacific', g: 'green', p: 300, h: 200, r: [26,130,390,900,1100,1275] },
        { t: 'prop', n: 'N.Carolina', g: 'green', p: 300, h: 200, r: [26,130,390,900,1100,1275] },
        { t: 'cc', n: 'Chest' },
        { t: 'prop', n: 'Penn. Ave', g: 'green', p: 320, h: 200, r: [28,150,450,1000,1200,1400] },
        { t: 'rr', n: 'Short Line', p: 200 },
        { t: 'ch', n: 'Chance' },
        { t: 'prop', n: 'Park Place', g: 'dblue', p: 350, h: 200, r: [35,175,500,1100,1300,1500] },
        { t: 'tax', n: 'Luxury Tax', tax: 100 },
        { t: 'prop', n: 'Boardwalk', g: 'dblue', p: 400, h: 200, r: [50,200,600,1400,1700,2000] }
    ];
    const GROUPS = {}; B.forEach((s, i) => { if (s.t === 'prop') (GROUPS[s.g] = GROUPS[s.g] || []).push(i); });
    const RR = [5, 15, 25, 35], UTIL = [12, 28];
    const CHANCE = [
        { txt: 'Advance to GO (+$200)', k: 'move', a: 0 }, { txt: 'Go directly to Jail', k: 'jail' },
        { txt: 'Bank dividend +$50', k: 'money', a: 50 }, { txt: 'Speeding fine -$15', k: 'money', a: -15 },
        { txt: 'Advance to Illinois Ave', k: 'move', a: 23 }, { txt: 'Advance to Boardwalk', k: 'move', a: 39 },
        { txt: 'Get out of Jail Free', k: 'free' }, { txt: 'Building loan +$150', k: 'money', a: 150 }
    ];
    const CHEST = [
        { txt: 'Bank error +$200', k: 'money', a: 200 }, { txt: "Doctor's fee -$50", k: 'money', a: -50 },
        { txt: 'Go directly to Jail', k: 'jail' }, { txt: 'Advance to GO (+$200)', k: 'move', a: 0 },
        { txt: 'Stock sale +$50', k: 'money', a: 50 }, { txt: 'Income tax refund +$20', k: 'money', a: 20 },
        { txt: 'Get out of Jail Free', k: 'free' }, { txt: 'Hospital -$100', k: 'money', a: -100 }
    ];

    let ctx = null, auth = false, meRole = 'a', s = null;     // s = shared snapshot (both sides)
    let boardEl, panelEl, statEl;
    // authoritative state (caller)
    let players, owner, houses, turn, dice, doubles, rolled, pendingBuy, mustEnd, over, winner, log;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const rn = (p) => p === 'a' ? 'Blue' : 'Orange';
    const rnd = () => 1 + ((Math.random() * 6) | 0);
    const addlog = (m) => { log.unshift(m); log = log.slice(0, 6); };

    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        players = { a: { pos: 0, money: 1500, jail: false, jt: 0, goojf: 0 }, b: { pos: 0, money: 1500, jail: false, jt: 0, goojf: 0 } };
        owner = Array(40).fill(null); houses = Array(40).fill(0);
        turn = 'a'; dice = [0, 0]; doubles = 0; rolled = false; pendingBuy = -1; mustEnd = false; over = false; winner = null; log = [];
        addlog('New game — Blue starts'); sync();
    };

    const hasMono = (p, g) => GROUPS[g].every(i => owner[i] === p);
    const cnt = (p, set) => set.filter(i => owner[i] === p).length;
    const rentFor = (pos, roll) => {
        const sp = B[pos], o = owner[pos];
        if (sp.t === 'rr') return [0, 25, 50, 100, 200][cnt(o, RR)];
        if (sp.t === 'util') return roll * (cnt(o, UTIL) === 2 ? 10 : 4);
        const h = houses[pos];
        if (h === 0) return hasMono(o, sp.g) ? sp.r[0] * 2 : sp.r[0];
        return sp.r[h];
    };
    const pay = (from, to, amt) => {
        const f = players[from];
        if (f.money < amt) { over = true; winner = to || other(from); addlog(rn(from) + ' is bankrupt!'); return; }
        f.money -= amt; if (to) players[to].money += amt;
    };
    const goJail = (p) => { players[p].pos = 10; players[p].jail = true; players[p].jt = 0; addlog(rn(p) + ' goes to Jail'); };

    const resolve = (p) => {
        const pos = players[p].pos, sp = B[pos];
        if (sp.t === 'prop' || sp.t === 'rr' || sp.t === 'util') {
            if (owner[pos] === null) { pendingBuy = pos; addlog(rn(p) + ' on ' + sp.n + ' ($' + sp.p + ')'); }
            else if (owner[pos] !== p) { const rent = rentFor(pos, dice[0] + dice[1]); addlog(rn(p) + ' pays $' + rent + ' rent'); pay(p, owner[pos], rent); }
        } else if (sp.t === 'tax') { addlog(rn(p) + ' pays ' + sp.n + ' $' + sp.tax); pay(p, null, sp.tax); }
        else if (sp.t === 'gojail') goJail(p);
        else if (sp.t === 'cc') drawCard(p, CHEST, 'Chest');
        else if (sp.t === 'ch') drawCard(p, CHANCE, 'Chance');
    };
    const moveBy = (p, steps) => { let np = players[p].pos + steps; if (np >= 40) { np -= 40; players[p].money += 200; addlog(rn(p) + ' passes GO +$200'); } players[p].pos = np; resolve(p); };
    const moveTo = (p, pos) => { if (pos < players[p].pos) { players[p].money += 200; addlog(rn(p) + ' passes GO +$200'); } players[p].pos = pos; resolve(p); };
    const drawCard = (p, deck, label) => {
        const c = deck[(Math.random() * deck.length) | 0]; addlog(label + ': ' + c.txt);
        if (c.k === 'money') { if (c.a >= 0) players[p].money += c.a; else pay(p, null, -c.a); }
        else if (c.k === 'move') moveTo(p, c.a);
        else if (c.k === 'jail') goJail(p);
        else if (c.k === 'free') players[p].goojf++;
    };

    const postRoll = (p) => {
        if (over) return;
        if (players[p].jail) { mustEnd = true; }
        else if (dice[0] === dice[1] && doubles > 0 && doubles < 3) { rolled = false; mustEnd = false; }
        else mustEnd = true;
    };

    const roll = (p) => {
        if (over || turn !== p || rolled || pendingBuy >= 0) return;
        if (players[p].jail) return jailRoll(p);
        const d1 = rnd(), d2 = rnd(); dice = [d1, d2]; rolled = true;
        addlog(rn(p) + ' rolls ' + d1 + '+' + d2);
        if (d1 === d2) { doubles++; if (doubles === 3) { goJail(p); mustEnd = true; return sync(); } }
        else doubles = 0;
        moveBy(p, d1 + d2);
        if (over || pendingBuy >= 0) return sync();
        postRoll(p); sync();
    };
    const jailRoll = (p) => {
        const d1 = rnd(), d2 = rnd(); dice = [d1, d2]; rolled = true;
        if (d1 === d2) { players[p].jail = false; addlog(rn(p) + ' rolls doubles — out of Jail'); moveBy(p, d1 + d2); }
        else { players[p].jt++; if (players[p].jt >= 3) { addlog(rn(p) + " can't roll out — pays $50"); pay(p, null, 50); if (!over) { players[p].jail = false; moveBy(p, d1 + d2); } } else addlog(rn(p) + ' stays in Jail'); }
        if (over || pendingBuy >= 0) return sync();
        mustEnd = true; sync();
    };
    const buy = (p) => {
        if (turn !== p || pendingBuy < 0) return;
        const pos = pendingBuy, price = B[pos].p;
        if (players[p].money >= price) { players[p].money -= price; owner[pos] = p; addlog(rn(p) + ' buys ' + B[pos].n); }
        pendingBuy = -1; postRoll(p); sync();
    };
    const skip = (p) => { if (turn !== p || pendingBuy < 0) return; addlog(rn(p) + ' declines ' + B[pendingBuy].n); pendingBuy = -1; postRoll(p); sync(); };
    const build = (p, pos) => {
        if (turn !== p || over || pendingBuy >= 0) return;
        const sp = B[pos]; if (sp.t !== 'prop' || owner[pos] !== p || !hasMono(p, sp.g)) return;
        const minH = Math.min(...GROUPS[sp.g].map(i => houses[i]));
        if (houses[pos] !== minH || houses[pos] >= 5 || players[p].money < sp.h) return;
        players[p].money -= sp.h; houses[pos]++; addlog(rn(p) + ' builds on ' + sp.n + ' (-$' + sp.h + ')'); sync();
    };
    const jailPay = (p) => { if (turn !== p || !players[p].jail) return; pay(p, null, 50); if (!over) { players[p].jail = false; addlog(rn(p) + ' pays $50, leaves Jail'); } sync(); };
    const jailCard = (p) => { if (turn !== p || !players[p].jail || players[p].goojf < 1) return; players[p].goojf--; players[p].jail = false; addlog(rn(p) + ' uses Get-Out-of-Jail card'); sync(); };
    const endTurn = (p) => { if (turn !== p || !mustEnd || pendingBuy >= 0 || over) return; turn = other(p); rolled = false; doubles = 0; dice = [0, 0]; mustEnd = false; addlog(rn(turn) + "'s turn"); sync(); };

    const handleAct = (p, a) => ({ roll, buy, skip, end: endTurn, jailpay: jailPay, jailcard: jailCard }[a] || (() => {}))(p);

    const snapshot = () => ({ players, owner, houses, turn, dice, doubles, rolled, pendingBuy, mustEnd, over, winner, log });
    const sync = () => { s = snapshot(); render(); ctx.send({ t: 'state', s }); };

    // ---- send intents ----
    const act = (a) => { if (auth) handleAct('a', a); else ctx.send({ t: 'act', a }); };
    const doBuild = (pos) => { if (auth) build('a', pos); else ctx.send({ t: 'build', pos }); };

    // ---- rendering ----
    const rc = (pos) => pos <= 10 ? [10, 10 - pos] : pos <= 20 ? [20 - pos, 0] : pos <= 30 ? [0, pos - 20] : [pos - 30, 10];
    const render = () => {
        if (!s) { statEl.textContent = 'Waiting for the host…'; return; }
        boardEl.innerHTML = '';
        for (let pos = 0; pos < 40; pos++) {
            const sp = B[pos], [r, c] = rc(pos), el = document.createElement('div');
            el.className = 'mp-cell'; el.style.gridRow = r + 1; el.style.gridColumn = c + 1;
            let h = sp.g ? '<div class="mp-band" style="background:' + GC[sp.g] + '"></div>' : '';
            h += '<div class="mp-nm">' + sp.n + '</div>';
            if (sp.p) h += '<div class="mp-pr">$' + sp.p + '</div>';
            if (s.houses[pos] > 0) h += '<div class="mp-h">' + (s.houses[pos] === 5 ? '🏨' : '🏠'.repeat(s.houses[pos])) + '</div>';
            let tok = '';
            if (s.players.a.pos === pos) tok += '<span class="mp-tok a"></span>';
            if (s.players.b.pos === pos) tok += '<span class="mp-tok b"></span>';
            if (tok) h += '<div class="mp-toks">' + tok + '</div>';
            el.innerHTML = h;
            if (s.owner[pos]) el.classList.add('own-' + s.owner[pos]);
            el.addEventListener('click', () => doBuild(pos));
            boardEl.appendChild(el);
        }
        const panel = document.createElement('div'); panel.id = 'mp-center';
        const me = s.players[meRole], op = s.players[other(meRole)], myTurn = s.turn === meRole && !s.over;
        let btns = '';
        if (s.over) btns = '<b>' + (s.winner === meRole ? '🏆 You win!' : 'You lose') + '</b>';
        else if (!myTurn) btns = "Opponent's turn…";
        else if (s.pendingBuy >= 0) btns = '<button class="app-btn" data-a="buy">Buy $' + B[s.pendingBuy].p + '</button><button class="app-btn" data-a="skip">Skip</button>';
        else if (me.jail && !s.rolled) btns = '<button class="app-btn" data-a="jailpay">Pay $50</button><button class="app-btn" data-a="roll">Roll doubles</button>' + (me.goojf ? '<button class="app-btn" data-a="jailcard">Use card</button>' : '');
        else if (!s.rolled) btns = '<button class="app-btn" data-a="roll">🎲 Roll</button>';
        else if (s.mustEnd) btns = '<button class="app-btn" data-a="end">End turn</button>';
        panel.innerHTML =
            '<div class="mp-dice">' + (s.dice[0] ? '🎲 ' + s.dice[0] + ' + ' + s.dice[1] : '') + '</div>' +
            '<div class="mp-you" style="color:#7cf">You (' + rn(meRole) + '): $' + me.money + (me.jail ? ' · in Jail' : '') + '</div>' +
            '<div class="mp-them" style="color:#fd7">Them: $' + op.money + (op.jail ? ' · in Jail' : '') + '</div>' +
            '<div class="mp-btns">' + btns + '</div>' +
            '<div class="mp-log">' + s.log.map(l => '<div>' + l + '</div>').join('') + '</div>' +
            '<div class="mp-tip">tip: click your monopoly to build</div>';
        boardEl.appendChild(panel);
        panel.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => act(b.dataset.a)));
        statEl.textContent = s.over ? (s.winner === meRole ? 'You win!' : 'You lose') : (myTurn ? 'Your turn' : 'Their turn');
    };

    window.Appmegle.register({
        id: 'monopoly', label: 'Monopoly', css: 'apps/monopoly.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; meRole = auth ? 'a' : 'b'; s = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div><div id="mp-board"></div></div>';
            boardEl = ctx.root.querySelector('#mp-board'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else render();
        },
        unmount() { ctx = null; s = null; boardEl = statEl = null; },
        onData(msg) {
            if (!auth) { if (msg.t === 'state') { s = msg.s; render(); } return; }
            if (msg.t === 'act') handleAct('b', msg.a);
            else if (msg.t === 'build') build('b', msg.pos);
            else if (msg.t === 'newreq') newGame();
        }
    });
})();
