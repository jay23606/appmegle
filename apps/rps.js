// Rock-Paper-Scissors for appmegle. Both pick; reveal when both are in. Running score.
// Note: picks are sent on choice, so it's casual/trust-based (a peer could peek at the
// message before choosing). Fine for play with someone you're on camera with.
(function () {
    const EMO = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let ctx = null, mine = null, theirs = null, myScore = 0, theirScore = 0, statEl = null, pickWrap = null, resEl = null;

    const resolve = () => {
        if (!mine || !theirs) return;
        let r;
        if (mine === theirs) r = 'Tie';
        else if (BEATS[mine] === theirs) { myScore++; r = 'You win the round!'; }
        else { theirScore++; r = 'You lose the round'; }
        resEl.textContent = 'You ' + EMO[mine] + '  vs  ' + EMO[theirs] + ' Them — ' + r;
        statEl.textContent = 'You ' + myScore + ' — ' + theirScore + ' Them';
        pickWrap.querySelectorAll('button').forEach(b => b.disabled = true);
    };

    const pick = (choice) => {
        if (mine) return;
        mine = choice;
        ctx.send({ t: 'pick', choice });
        pickWrap.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.c === choice));
        resEl.textContent = theirs ? '' : 'Waiting for them…';
        resolve();
    };

    const nextRound = (broadcast) => {
        mine = theirs = null; resEl.textContent = '';
        pickWrap.querySelectorAll('button').forEach(b => { b.disabled = false; b.classList.remove('sel'); });
        statEl.textContent = 'You ' + myScore + ' — ' + theirScore + ' Them';
        if (broadcast) ctx.send({ t: 'next' });
    };

    window.Appmegle.register({
        id: 'rps', label: 'Rock-Paper-Scissors', css: 'apps/rps.css',
        mount(c) {
            ctx = c; mine = theirs = null; myScore = theirScore = 0;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">Next round</button></div>' +
                '<div id="rps-pick">' + Object.keys(EMO).map(k =>
                    '<button data-c="' + k + '" title="' + k + '">' + EMO[k] + '</button>').join('') + '</div>' +
                '<div id="rps-res"></div></div>';
            statEl = ctx.root.querySelector('.stat');
            pickWrap = ctx.root.querySelector('#rps-pick');
            resEl = ctx.root.querySelector('#rps-res');
            pickWrap.querySelectorAll('button').forEach(b => b.addEventListener('click', () => pick(b.dataset.c)));
            ctx.root.querySelector('.nb').addEventListener('click', () => nextRound(true));
            nextRound(false);
        },
        unmount() { ctx = statEl = pickWrap = resEl = null; },
        onData(msg) {
            if (msg.t === 'pick') { theirs = msg.choice; if (!mine) resEl.textContent = 'They picked — your move'; resolve(); }
            else if (msg.t === 'next') nextRound(false);
        }
    });
})();
