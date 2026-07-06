// Hum That Tune (2-player) for appmegle. The hummer sees a famous song title and hums/whistles
// it — no words, no lyrics! The partner guesses OUT LOUD; the hummer taps "got it" or skips.
// 60 seconds per turn, most correct wins. Hummer-authoritative: the hummer's client picks songs
// locally, so the title never crosses the wire.
(function () {
    const SONGS = ['Happy Birthday','Twinkle Twinkle Little Star','Jingle Bells','We Will Rock You','Bohemian Rhapsody','Seven Nation Army','Sweet Caroline','Take On Me','Billie Jean','Let It Go','The Imperial March (Star Wars)','Super Mario theme','Hey Jude','Smoke on the Water','Old MacDonald','Row Row Row Your Boat','YMCA','Dancing Queen','Baby Shark','The Addams Family theme','Harry Potter theme','James Bond theme','Eye of the Tiger','Für Elise','Ode to Joy','The Pink Panther theme','Wannabe (Spice Girls)','Shape of You','Uptown Funk','Africa (Toto)','Mamma Mia','Girls Just Want to Have Fun','Country Roads','Bad Romance','Rolling in the Deep','Hallelujah','Wonderwall','Despacito','Macarena','The Final Countdown'];
    const TURN = 60;
    let ctx = null, me = 'a', hummer = 'a', song = '', phase = 'idle', left = TURN, scores = { a: 0, b: 0 }, turnHits = 0, seen = new Set(), lastSec = -1, statEl = null, bodyEl = null, raf = 0;
    const other = (p) => p === 'a' ? 'b' : 'a';
    const pickSong = () => { if (seen.size >= SONGS.length) seen.clear(); let s; do { s = SONGS[(Math.random()*SONGS.length)|0]; } while (seen.has(s)); seen.add(s); return s; };
    const startTurn = () => { hummer = me; song = pickSong(); left = TURN; turnHits = 0; lastSec = -1; phase = 'play'; ctx.send({ t: 'turn', hummer: me }); render(); };
    const got = () => { turnHits++; scores[other(me)]++; song = pickSong(); ctx.send({ t: 'score', scores }); render(); };
    const skip = () => { song = pickSong(); render(); };
    const endTurn = () => { phase = 'between'; ctx.send({ t: 'end', hits: turnHits, scores }); render(); };
    const render = () => {
        if (!bodyEl) return; const amHum = hummer === me;
        statEl.textContent = 'You ' + scores[me] + ' – ' + scores[other(me)] + ' Them' + (phase === 'play' ? ' · ⏱ ' + Math.ceil(left) : '');
        let h = '';
        if (phase === 'idle') h = '<div class="ht-msg">🎵 Hum or whistle the song — no words! Partner guesses out loud.</div><button class="app-btn" id="ht-start">I\'ll hum first</button>';
        else if (phase === 'play') h = amHum
            ? '<div class="ht-msg">🎤 Hum this:</div><div class="ht-song">' + song + '</div><div class="ht-btns"><button class="app-btn" id="ht-got">✓ They got it</button><button class="app-btn" id="ht-skip">↷ Skip</button></div>'
            : '<div class="ht-big">🎧 Listen…</div><div class="ht-msg">shout your guesses out loud!</div>';
        else if (phase === 'between') h = '<div class="ht-big">' + turnHits + ' guessed that turn</div><button class="app-btn" id="ht-start">' + (amHum ? 'Their turn — wait…' : 'My turn to hum →') + '</button>';
        bodyEl.innerHTML = h;
        const st = bodyEl.querySelector('#ht-start'), gt = bodyEl.querySelector('#ht-got'), sk = bodyEl.querySelector('#ht-skip');
        if (st) { if (phase === 'between' && hummer === me) st.disabled = true; else st.addEventListener('click', startTurn); }
        if (gt) gt.addEventListener('click', got);
        if (sk) sk.addEventListener('click', skip);
    };
    const loop = (t) => { if (phase === 'play' && hummer === me) { if (!loop._l) loop._l = t; left -= (t - loop._l)/1000; loop._l = t; const s = Math.ceil(left); if (s !== lastSec) { lastSec = s; ctx.send({ t: 'tick', left: s }); statEl && render(); } if (left <= 0) endTurn(); } else loop._l = t; raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'humtune', label: 'Hum That Tune', css: 'apps/humtune.css',
        mount(c) {
            ctx = c; me = ctx.amCaller ? 'a' : 'b'; phase = 'idle'; scores = { a: 0, b: 0 }; seen = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="ht"><div class="app-bar"><span class="stat"></span></div><div id="ht-body"></div></div>';
            statEl = ctx.root.querySelector('.stat'); bodyEl = ctx.root.querySelector('#ht-body');
            render(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = statEl = bodyEl = null; },
        onData(msg) {
            if (msg.t === 'turn') { hummer = msg.hummer; phase = 'play'; left = TURN; render(); }
            else if (msg.t === 'score') { scores = msg.scores; render(); }
            else if (msg.t === 'tick') { left = msg.left; render(); }
            else if (msg.t === 'end') { scores = msg.scores; turnHits = msg.hits; phase = 'between'; render(); }
        }
    });
})();
