// Icebreakers for appmegle. A shared, effectively-endless question generator for the two
// people on the call. The caller GENERATES each question from natural-language templates
// filled from large word banks (multi-slot templates multiply out to thousands of unique
// combinations) and broadcasts it, so BOTH see the same prompt; either person taps/clicks
// to advance. A no-repeat set guarantees no question repeats within a session.
//
// Why generate instead of calling an API: this is a static PWA (no server to hold an API
// key), and there's no reliable free icebreaker API. Generation is instant, offline, and
// never runs out. To plug in a live/LLM source later, make `next()` on the caller async
// and fetch there, keeping this generator as the fallback.
(function () {
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const two = (a) => { const i = (Math.random()*a.length)|0; let j; do { j = (Math.random()*a.length)|0; } while (j === i); return [a[i], a[j]]; };

    // ---- word banks (every entry reads naturally in its template) ----
    const WR = ['be able to fly','be invisible','read minds','teleport anywhere','speak every language','talk to animals','be able to pause time','breathe underwater','have a perfect memory','never need sleep','be incredibly lucky','control the weather','never feel tired','instantly learn any skill','always know the perfect thing to say','heal any injury instantly','see one day into the future','relive any memory perfectly','understand any subject instantly','be the funniest person in the room','be the calmest person in any crisis','never get sick','always find a parking spot','have unlimited books to read','have unlimited travel','never lose anything again','talk to your past self','be able to nap anywhere instantly','summon coffee at will','always know what to cook'];
    const GIVEUP = ['coffee','your phone','music','dessert','travel','social media','watching TV','texting','your favorite food','weekend trips','online shopping','podcasts','video games','late-night snacks','streaming services','taking photos','take-out food','comfy clothes','your morning routine','air conditioning'];
    const FAV = ['comfort food','feel-good movie','season','way to spend a slow Sunday','childhood snack','kind of weather','song to belt out in the car','way to unwind after a long day','place you have traveled','type of music to work to','holiday','smell that brings back memories','thing to cook or bake','board game or video game','way to start the day','book genre','local hidden gem','way to treat yourself','road-trip snack','creative hobby','thing to do when it rains','kind of evening','ice cream flavor','pizza topping','karaoke song','way to spend time outdoors'];
    const SUP = ['best','most memorable','funniest','strangest','most surprising','most beautiful','most unexpected'];
    const EXP = ['meal you have ever had','place you have ever visited','trip you have ever taken','gift you have ever received','concert or event you have been to','surprise you have had','thing a stranger has done for you','compliment you have gotten','adventure you have been on','sunset or sunrise you have watched','story from your childhood','thing you have ever cooked','decision you have made'];
    const IFC = ['have any superpower, what would you choose','live anywhere in the world, where would it be','instantly master any skill, what would it be','have dinner with anyone, living or dead, who would it be','be fluent in any language, which would you pick','play any instrument perfectly, which would it be','have any animal as a pet, real or not, what would you get','swap lives with someone for a day, who would it be','add one hour to every day, how would you spend it','relive one day of your life, which would you choose','be famous for one thing, what would it be','master any sport overnight, which would it be','have any view from your window, what would you want','instantly know everything about one topic, which would you pick'];
    const TOT = [['Cats','dogs'],['Tea','coffee'],['Sweet','savory'],['Beach','mountains'],['Early bird','night owl'],['Texting','calling'],['Books','movies'],['City life','country life'],['Summer','winter'],['Sunrise','sunset'],['Planning ahead','going with the flow'],['Cooking at home','eating out'],['Window seat','aisle seat'],['Adventure','relaxation'],['Big party','small gathering'],['Sweet breakfast','savory breakfast'],['Road trip','flight']];
    const OPEN = ['something you are weirdly good at','a skill you would love to learn','something most people do not know about you','a small thing that always makes your day better','a goal you are working toward right now','something you have changed your mind about recently','a fear you have overcome','the most spontaneous thing you have ever done','a hobby you have always wanted to try','something you could talk about for hours','a tiny thing that brings you joy','a habit that has improved your life','something you are proud of but rarely mention','a dream you have not given up on','a quote you try to live by','the best advice you have ever gotten','something you find genuinely fascinating','a place that feels like home to you','something you are looking forward to','a talent you wish you had','a cause you really care about','a moment that always makes you smile','something new you would like to try this year','a small win you had recently','the kindest thing someone has done for you'];
    const WKND = ['exploring a new city','hiking in the mountains','relaxing on a beach','binge-watching a great series','trying new restaurants','reading by the window','road-tripping with friends','camping under the stars','wandering through museums','cooking a big meal','at a music festival','browsing a bookstore','kayaking on a lake','at a cozy cabin','people-watching at a café'];
    const MOOD = ['a quiet night in','a night out with friends','a long walk outside','an afternoon nap','a good book','a movie marathon','a hot coffee','a cold drink on a patio','a spontaneous adventure','a deep conversation','a board-game night','an early night of sleep'];
    const TELL = ['the last trip you took','a hobby you love','your hometown','the best meal you have had recently','something you are excited about','a book or show you would recommend','a tradition in your family','the most interesting person you have met','a goal you are chasing','your dream vacation','something you made recently','the best concert you have been to','a place you want to go next','a small joy in your daily routine'];
    const GEMS = ["What's the bravest thing you've ever done?","What were you like as a kid?","What's a place that exceeded your expectations?","If you could give your younger self one piece of advice, what would it be?","What's something simple you're really grateful for?","What's your idea of a perfect day, start to finish?","What's a movie everyone loves that you just don't get?","What's the most useful thing you learned in the last year?","What's a random act of kindness you'll never forget?","What's something that instantly puts you in a good mood?","What's the best decision you've ever made?","What's a place you could happily get lost in?","Who's someone you admire, and why?","What's the funniest thing that's happened to you lately?","What's a skill you think everyone should learn?","What's your comfort rewatch for a bad day?","What's the nicest compliment you've ever received?","What's a tradition you'd love to start?","What's something you believe that not many people agree with?","What's the most fun you've had on a budget?"];

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const TEMPLATES = [
        () => { const [a, b] = two(WR); return 'Would you rather ' + a + ' or ' + b + '?'; },
        () => { const [a, b] = two(GIVEUP); return 'If you had to give up ' + a + ' or ' + b + ' forever, which would you pick?'; },
        () => 'What\'s your favorite ' + pick(FAV) + '?',
        () => 'What\'s the ' + pick(SUP) + ' ' + pick(EXP) + '?',
        () => 'If you could ' + pick(IFC) + '?',
        () => { const t = pick(TOT); return t[0] + ' or ' + t[1].toLowerCase() + '?'; },
        () => 'What\'s ' + pick(OPEN) + '?',
        () => { const [a, b] = two(WKND); return 'Would you rather spend a weekend ' + a + ' or ' + b + '?'; },
        () => { const [a, b] = two(MOOD); return 'What sounds better right now: ' + a + ' or ' + b + '?'; },
        () => 'Tell me about ' + pick(TELL) + '.',
        () => pick(GEMS), () => pick(GEMS)        // weight the hand-written gems a bit
    ];

    let ctx = null, auth = false, seen = new Set(), cur = '', num = 0, cardEl = null, statEl = null;
    const gen = () => { for (let i = 0; i < 40; i++) { const q = pick(TEMPLATES)(); if (!seen.has(q)) { seen.add(q); return q; } } return pick(TEMPLATES)(); };

    const next = () => { cur = gen(); num++; render(); ctx.send({ t: 'q', text: cur, num }); };
    const reset = () => { seen = new Set(); num = 0; next(); };
    const advance = () => { if (auth) next(); else ctx.send({ t: 'next' }); };

    const render = () => {
        if (!cardEl) return;
        cardEl.querySelector('.ib-q').textContent = cur || 'Getting a question…';
        cardEl.querySelector('.ib-n').textContent = num ? '#' + num : '';
        statEl.textContent = 'Tap the card for the next question';
    };

    window.Appmegle.register({
        id: 'icebreakers', label: 'Icebreakers', css: 'apps/icebreakers.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; cur = ''; num = 0; seen = new Set();
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New set</button></div>' +
                '<div id="ib-card"><span class="ib-n"></span><div class="ib-q">…</div><div class="ib-hint">tap for the next one →</div></div></div>';
            cardEl = ctx.root.querySelector('#ib-card'); statEl = ctx.root.querySelector('.stat');
            cardEl.addEventListener('click', advance);
            ctx.root.querySelector('.nb').addEventListener('click', () => { if (auth) reset(); else ctx.send({ t: 'newreq' }); });
            if (auth) reset(); else { render(); statEl.textContent = 'Waiting for the first question…'; }
        },
        unmount() { ctx = null; cardEl = statEl = null; seen = new Set(); },
        onData(msg) {
            if (msg.t === 'q') { cur = msg.text; num = msg.num; render(); }
            else if (!auth) return;
            else if (msg.t === 'next') next();
            else if (msg.t === 'newreq') reset();
        }
    });
})();
