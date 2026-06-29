// Heads Up! (2-player) for appmegle. One player GUESSES (the word is hidden from them) while
// the other gives clues out loud over the live call. The caller owns the word deck and is
// authoritative; it sends the current word ONLY to the clue-giver, who sees it as a banner
// over the guesser's forehead in the video. The guesser just taps "Got it" / "Pass" (no need
// to hold the phone to their head — two devices, so the word travels digitally). Roles swap
// each round. Caller = Blue, answerer = Orange.
(function () {
    const CATS = {
        Animals: ['Elephant','Penguin','Kangaroo','Octopus','Giraffe','Dolphin','Hedgehog','Squirrel','Cheetah','Koala','Flamingo','Crocodile','Owl','Rhinoceros','Chameleon','Walrus','Peacock','Hamster','Jellyfish','Gorilla','Sloth','Raccoon','Platypus','Seahorse','Llama','Porcupine','Toucan','Meerkat','Narwhal','Bumblebee'],
        Food: ['Pizza','Sushi','Pancakes','Spaghetti','Tacos','Popcorn','Avocado','Cupcake','Watermelon','Pretzel','Burrito','Doughnut','Lasagna','Smoothie','Hamburger','Pineapple','Croissant','Nachos','Meatball','Waffle','Cheesecake','Ice cream','Hot dog','Bacon','Marshmallow','Cucumber','Lollipop','Omelette','Brownie','Spinach'],
        Actions: ['Sneezing','Juggling','Swimming','Tiptoeing','Yawning','Dancing','Boxing','Fishing','Skateboarding','Painting','Sleeping','Texting','Cooking','Bowling','Tickling','Shivering','Clapping','Stretching','Whistling','Karate','Hula hooping','Air guitar','Moonwalk','Brushing teeth','Tying shoes','Flexing','Snoring','Saluting','Skipping','Tightrope walking'],
        Movies: ['Titanic','Frozen','Jurassic Park','Star Wars','The Lion King','Harry Potter','Jaws','Shrek','Toy Story','Avatar','Spider-Man','Finding Nemo','The Matrix','Ghostbusters','Home Alone','Up','Cars','Batman','E.T.','Aladdin','Rocky','Grease','Mary Poppins','King Kong','The Avengers'],
        Things: ['Umbrella','Toothbrush','Backpack','Sunglasses','Stapler','Lawn mower','Microwave','Telescope','Pillow','Vacuum','Scissors','Flashlight','Hammer','Compass','Ladder','Anchor','Trampoline','Wheelbarrow','Kite','Bubble wrap','Snow globe','Yo-yo','Skateboard','Toaster','Binoculars']
    };
    const ROUND = 75;
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

    let ctx = null, auth = false, me = 'a', raf = 0;
    let cat = 'Animals', deck = [], idx = 0, curWord = '', guesser = 'b', count = 0, time = ROUND, scores = { a: 0, b: 0 }, phase = 'idle', lastSec = -1;
    let vWord = '', bandEl, colEl, statEl, sel;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const newRound = (swap) => {
        if (!auth) return ctx.send({ t: 'newreq' });
        if (swap && phase !== 'idle') guesser = other(guesser);
        deck = shuffle([...CATS[cat]]); idx = 0; curWord = deck[0]; count = 0; time = ROUND; phase = 'play'; lastSec = -1; sync();
    };
    const nextWord = () => { idx++; if (idx >= deck.length) { shuffle(deck); idx = 0; } curWord = deck[idx]; };
    const applyAct = (a) => { if (phase !== 'play') return; if (a === 'got') count++; nextWord(); sync(); };
    const doAct = (a) => { if (phase !== 'play' || guesser !== me) return; if (auth) applyAct(a); else ctx.send({ t: 'act', a }); };
    const endRound = () => { phase = 'over'; scores[guesser] += count; sync(); };

    const sync = () => { ctx.send({ t: 's', g: guesser, time: Math.ceil(time), count, sa: scores.a, sb: scores.b, phase, w: guesser === 'a' ? curWord : '' }); render(); };

    const render = () => {
        if (!colEl) return;
        const amG = guesser === me, amClue = !amG, opp = other(me);
        const word = auth ? (amG ? '' : curWord) : vWord;
        bandEl.classList.toggle('hidden', !(amClue && phase === 'play'));
        bandEl.textContent = word;
        statEl.textContent = phase === 'over' ? 'Round over · You ' + scores[me] + ' – ' + scores[opp] + ' Them' : phase === 'idle' ? '' : (amG ? 'You guess!' : 'You give clues') + ' · ⏱ ' + Math.ceil(time) + 's · got ' + count;
        let html = '';
        if (phase === 'idle') html = '<div class="hu-msg">Waiting for the host…</div>';
        else if (phase === 'over') html = '<div class="hu-msg">⏰ Time! ' + (guesser === me ? 'You got <b>' + count + '</b>' : 'They got <b>' + count + '</b>') + '</div><button class="app-btn" id="hu-new">New round (swap)</button>';
        else if (amG) html = '<div class="hu-big">⏱ ' + Math.ceil(time) + '</div><div class="hu-msg">Listen to your partner & guess!</div><div id="hu-btns"><button id="hu-got">✓ Got it</button><button id="hu-pass">Pass →</button></div><div class="hu-cnt">' + count + ' so far</div>';
        else html = '<div class="hu-msg">📣 Give clues out loud — don\'t say the word!</div><div class="hu-big">⏱ ' + Math.ceil(time) + '</div><div class="hu-cnt">they\'ve got ' + count + '</div>';
        colEl.innerHTML = html;
        const got = colEl.querySelector('#hu-got'), pass = colEl.querySelector('#hu-pass'), nw = colEl.querySelector('#hu-new');
        if (got) got.addEventListener('click', () => doAct('got'));
        if (pass) pass.addEventListener('click', () => doAct('pass'));
        if (nw) nw.addEventListener('click', () => newRound(true));
    };
    const loop = (t) => { if (auth && phase === 'play') { if (!loop._l) loop._l = t; time -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(time); if (s !== lastSec) { lastSec = s; sync(); } if (time <= 0) { time = 0; endRound(); } } else loop._l = t; raf = requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'headsup', label: 'Heads Up!', css: 'apps/headsup.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; guesser = 'b';
            ctx.root.innerHTML = '<div id="hu-band" class="hidden"></div><div class="app-col" id="hu"><div class="app-bar"><span class="stat"></span>' +
                (auth ? '<select id="hu-cat">' + Object.keys(CATS).map(k => '<option>' + k + '</option>').join('') + '</select>' : '') +
                '<button class="app-btn nb">New round</button></div><div id="hu-body"></div></div>';
            bandEl = ctx.root.querySelector('#hu-band'); colEl = ctx.root.querySelector('#hu-body'); statEl = ctx.root.querySelector('.stat'); sel = ctx.root.querySelector('#hu-cat');
            if (sel) sel.addEventListener('change', () => { cat = sel.value; });
            ctx.root.querySelector('.nb').addEventListener('click', () => newRound(true));
            if (auth) newRound(false); else render();
            raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = bandEl = colEl = statEl = sel = null; deck = []; },
        onData(msg) {
            if (msg.t === 's' && !auth) { guesser = msg.g; time = msg.time; count = msg.count; scores = { a: msg.sa, b: msg.sb }; phase = msg.phase; vWord = msg.w; render(); }
            else if (msg.t === 'act' && auth) { if (guesser === 'b') applyAct(msg.a); }
            else if (msg.t === 'newreq' && auth) newRound(true);
        }
    });
})();
