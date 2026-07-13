// Scrabble (2-player) for appmegle. Authoritative caller owns the bag, board and both
// (private) racks, and sends each player a tailored view (own rack + public board +
// opponent tile count). The active player composes a move locally (place tiles from the
// rack onto the board), then submits; the caller validates placement + scores it and
// re-broadcasts. Caller = player 1.
//
// A deliberately compact, common-English dictionary keeps the app light enough for a call.
// Placement, premiums, cross-words, blanks and the bingo bonus are all scored locally by
// the authoritative caller. Uncommon valid words may not be in this abridged list.
(function () {
    const VAL = { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,'?':0 };
    const DIST = { A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2 };
    const TW = [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]];
    const DW = [[1,1],[2,2],[3,3],[4,4],[10,10],[11,11],[12,12],[13,13],[1,13],[2,12],[3,11],[4,10],[13,1],[12,2],[11,3],[10,4],[7,7]];
    const TL = [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]];
    const DL = [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]];
    const PREM = Array.from({ length: 15 }, () => Array(15).fill(''));
    TW.forEach(([r,c]) => PREM[r][c] = 'TW'); DW.forEach(([r,c]) => PREM[r][c] = 'DW');
    TL.forEach(([r,c]) => PREM[r][c] = 'TL'); DL.forEach(([r,c]) => PREM[r][c] = 'DL');
    const DICTIONARY = new Set(('AA AB AD AE AG AH AI AL AM AN AR AS AT AW AX AY BA BE BI BO BY DA DE DO ED EF EH EL EM EN ER ES ET EX FA FE GI GO HA HE HI HM HO ID IF IN IS IT JO KA KI KO KY LA LI LO MA ME MI MM MO MU MY NA NE NG NI NO NU OD OE OF OH OI OM ON OP OR OS OW OX OY PA PE PI QI RE SH SI SO TA TE TI TO UH UM UN UP US UT WE WO XI XU YA YE YO ZA ' +
        'ACE ACT ADD AGE AID AIM AIR ALE ALL AND ANT ANY APE ARC ARE ARM ART ASH ASK ATE AWE AXE BAD BAG BAN BAR BAT BAY BED BEE BEG BET BID BIG BIN BIT BOB BOD BOG BOY BUD BUG BUN BUS BUT CAB CAN CAP CAR CAT CAW COD COG COP COW CRY CUB CUP CUT DAD DAM DAY DEA DEB DEN DEW DID DIE DIG DIM DIN DIP DOE DOG DOT DRY DUE DUG EAR EAT EEL EGG EGO ELF ELM END ERA EVE EWE EYE FAN FAR FAT FAX FED FEE FEW FIG FIN FIR FIT FIX FLY FOG FOR FOX FRO FUN FUR GAP GAS GAY GEM GET GIN GOD GUM GUN GUY GYM HAD HAM HAS HAT HAY HEN HER HEW HEX HID HIM HIP HIS HIT HOB HOD HOG HOP HOT HOW HUB HUE HUG HUM HUT ICE ILL INK INN IRE IVY JAM JAR JAW JET JIG JOB JOG JOT JOY JUG KEY KID KIN KIT LAB LAD LAP LAW LAY LED LEG LET LID LIE LIP LIT LOG LOT LOW LUG LYE MAD MAN MAP MAT MAY MEN MET MIX MOB MOM MOP MUD MUG NAG NAP NET NEW NIB NOD NOR NOT NOW NUT OAK OAR ODD ODE OFF OIL OLD ONE OPT ORE OUR OUT OVA OWE OWN PAD PAL PAN PAR PAT PAW PAY PEA PEG PEN PET PIE PIG PIN PIT PLY POD POP POT POW PUB PUG PUN PUP PUT RAG RAM RAN RAP RAT RAW RAY RED RIB RID RIG RIM RIP ROB ROD ROE ROT ROW RUB RUE RUG RUM RUN RUT RYE SAD SAG SAP SAT SAW SAY SEA SEE SET SEW SHE SHY SIN SIP SIR SIT SIX SKI SKY SLY SOB SOD SON SOY SPA SPY SUB SUE SUM SUN TAB TAD TAG TAN TAP TAR TAX TEA TED TEN THE TIE TIN TIP TOE TON TOO TOP TOW TOY TRY TUB TUG TWO USE VAN VET VEX VIE VOW WAD WAG WAR WAS WAX WAY WEB WED WET WHO WHY WIG WIN WIT WOE WON WOO WOW YAK YAM YAP YAW YEA YES YET YOU ZAP ZEN ZIP ZOO ' +
        'ABLE ABOUT ACORN ACTOR ADULT AFTER AGAIN AGREE AHEAD ALIVE ALONE AMBER ANGEL ANGER ANIMAL ANSWER APPLE APRIL ARENA ARGUE ARISE ARROW ASIDE ASSET ATLAS AUDIO AVOID AWAKE AWARD BADGE BAKER BEACH BEARD BEAST BEGIN BELOW BENCH BERRY BLACK BLADE BLAME BLEND BLIND BLOCK BLOOM BOARD BOAST BONE BOOK BOOST BRAIN BRAVE BREAD BREAK BRICK BRIDE BRING BROAD BROWN BRUSH BUILD CABLE CANDY CARRY CATCH CAUSE CEDAR CHAIN CHAIR CHARM CHASE CHEAP CHECK CHEER CHEST CHIEF CHILD CHIME CHOIR CHORD CLAIM CLASS CLEAN CLEAR CLERK CLIMB CLOCK CLOSE CLOUD COACH COAST COLOR COMET COOK COOL COPPER COUCH COUNT COURT COVER CRAFT CRANE CREAM CROWN DANCE DAIRY DEATH DELTA DEPTH DIRTY DOUBT DOZEN DRAFT DREAM DRINK DRIVE EARTH EIGHT ELBOW EMPTY ENJOY ENTRY EQUAL EVENT EVERY EXACT EXTRA FAITH FALSE FARM FERRY FIELD FIGHT FINAL FIRST FLAME FLOOR FLOWER FOCUS FORCE FORGE FRESH FRONT FRUIT GIANT GLASS GLOBE GLORY GRACE GRAIN GRAND GRANT GRAPE GRASS GREAT GREEN GROUP GUIDE HABIT HAPPY HEART HEAVY HONEY HORSE HOUSE HUMAN IMAGE INBOX INDEX INNER IRON JEWEL JOINT JUDGE JUICE KINGS KNIFE LABEL LAUGH LAYER LEARN LEAST LEMON LIGHT LIMIT LION LITTLE LOCAL LOGIC LOOSE LUCKY LUNCH MAGIC MAJOR MAKER MANGO MAPLE MARCH MATCH MAYOR METAL MIGHT MINOR MODEL MONEY MONTH MOOSE MOUTH MUSIC NIGHT NOBLE NORTH NOVEL NURSE OCEAN OFFER OLIVE ONION ORDER OTHER OUTER OWNER PAINT PANEL PAPER PARTY PEACE PEARL PHONE PHOTO PIANO PIECE PILOT PITCH PIZZA PLACE PLAIN PLANT PLATE PLAYER POINT POWER PRIDE PRIME PRIZE PROUD QUEEN QUICK RADIO RAISE RANGE RIVER ROBOT ROUGH ROUND ROUTE ROYAL RULES SCALE SCENE SCORE SCOUT SENSE SHAPE SHARE SHARK SHEEP SHELF SHINE SHIRT SHORE SHORT SIGHT SILVER SKILL SLEEP SLICE SMILE SNAKE SOLAR SOUND SOUTH SPACE SPARE SPEAK SPEED SPICE SPIKE SPIRIT SPORT SPRING SQUARE STAGE STAIR STAND START STEAM STEEL STONE STORE STORM STORY STRONG SUGAR TABLE TEACH THANK THEME THING TIGER TITLE TOAST TODAY TOKEN TOOTH TOUCH TOWER TRACK TRAIN TREAT TREND TRIAL TRUCK TRUST UNDER UNION URBAN VALUE VIDEO VOICE WATER WHEEL WHITE WHOLE WOMAN WORLD WORTH YELLOW YOUNG ZEBRA').split(/\s+/));

    let ctx = null, auth = false, meRole = 'a', view = null;
    // authoritative (caller)
    let bag, board, racks, scores, turn, over, winner, lastMsg, consec;
    // client-side compose state
    let pend = [], selRack = -1, swapMode = false, swapSel = new Set(), localErr = '';
    let boardEl, rackEl, ctrlEl, statEl, pickEl;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const shuffle = (a) => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newGame = () => {
        if (!auth) return ctx.send({ t: 'newreq' });
        bag = []; for (const L in DIST) for (let i = 0; i < DIST[L]; i++) bag.push(L); shuffle(bag);
        board = Array.from({ length: 15 }, () => Array(15).fill(null));
        racks = { a: bag.splice(0, 7), b: bag.splice(0, 7) };
        scores = { a: 0, b: 0 }; turn = 'a'; over = false; winner = null; lastMsg = 'Blue starts'; consec = 0;
        sync();
    };

    const at = (B, P, r, c) => (r < 0 || r > 14 || c < 0 || c > 14) ? null : (B[r][c] || P.get(r + ',' + c) || null);
    const spelling = (B, P, cells) => cells.map(([r, c]) => at(B, P, r, c).l).join('');
    const word = (B, P, r, c, dr, dc) => {
        let sr = r, sc = c; while (at(B, P, sr-dr, sc-dc)) { sr -= dr; sc -= dc; }
        const cells = []; let rr = sr, cc = sc; while (at(B, P, rr, cc)) { cells.push([rr, cc]); rr += dr; cc += dc; }
        return cells;
    };
    const validate = (p, tiles) => {
        if (!tiles.length) return { ok: false, err: 'place some tiles' };
        const rk = [...racks[p]];
        for (const t of tiles) { const n = t.blank ? '?' : t.l; const i = rk.indexOf(n); if (i < 0) return { ok: false, err: 'not your tiles' }; rk.splice(i, 1); }
        for (const t of tiles) if (board[t.r][t.c]) return { ok: false, err: 'cell taken' };
        const rows = new Set(tiles.map(t => t.r)), cols = new Set(tiles.map(t => t.c));
        if (rows.size > 1 && cols.size > 1) return { ok: false, err: 'one line only' };
        const P = new Map(); tiles.forEach(t => P.set(t.r + ',' + t.c, { l: t.l, blank: t.blank }));
        const empty = board.every(row => row.every(c => !c));
        if (empty && !P.has('7,7')) return { ok: false, err: 'first word must cross the centre' };
        const words = [];
        if (tiles.length > 1) {
            const [dr, dc] = rows.size === 1 ? [0, 1] : [1, 0];
            const mc = word(board, P, tiles[0].r, tiles[0].c, dr, dc);
            for (const t of tiles) if (!mc.some(([r, c]) => r === t.r && c === t.c)) return { ok: false, err: 'gap in word' };
            if (mc.length >= 2) words.push(mc);
            const [qr, qc] = rows.size === 1 ? [1, 0] : [0, 1];
            for (const t of tiles) { const w = word(board, P, t.r, t.c, qr, qc); if (w.length >= 2) words.push(w); }
        } else {
            const t = tiles[0], hw = word(board, P, t.r, t.c, 0, 1), vw = word(board, P, t.r, t.c, 1, 0);
            if (hw.length >= 2) words.push(hw); if (vw.length >= 2) words.push(vw);
            if (!words.length) return { ok: false, err: 'needs to make a word' };
        }
        if (!empty && !words.some(w => w.some(([r, c]) => board[r][c] && !P.has(r + ',' + c)))) return { ok: false, err: 'must connect to the board' };
        const unknown = words.map(w => spelling(board, P, w)).find(w => !DICTIONARY.has(w));
        if (unknown) return { ok: false, err: `${unknown.toLowerCase()} is not in the built-in dictionary` };
        let total = 0;
        for (const w of words) {
            let sum = 0, mult = 1;
            for (const [r, c] of w) {
                const isNew = P.has(r + ',' + c), cell = board[r][c] || P.get(r + ',' + c);
                let lv = cell.blank ? 0 : VAL[cell.l];
                if (isNew) { const pr = PREM[r][c]; if (pr === 'DL') lv *= 2; else if (pr === 'TL') lv *= 3; else if (pr === 'DW') mult *= 2; else if (pr === 'TW') mult *= 3; }
                sum += lv;
            }
            total += sum * mult;
        }
        if (tiles.length === 7) total += 50;
        return { ok: true, score: total };
    };
    const endGame = () => { over = true; for (const p of ['a','b']) racks[p].forEach(l => scores[p] -= VAL[l]); winner = scores.a === scores.b ? 'tie' : scores.a > scores.b ? 'a' : 'b'; };
    const applyPlay = (p, tiles) => {
        if (over || turn !== p) return false;
        const v = validate(p, tiles);
        if (!v.ok) { if (p === 'a') { localErr = v.err; render(); } else ctx.send({ t: 'reject', err: v.err }); return false; }
        tiles.forEach(t => { board[t.r][t.c] = { l: t.l, blank: t.blank }; const n = t.blank ? '?' : t.l; racks[p].splice(racks[p].indexOf(n), 1); });
        while (racks[p].length < 7 && bag.length) racks[p].push(bag.pop());
        scores[p] += v.score; consec = 0; lastMsg = (p === 'a' ? 'Blue' : 'Orange') + ' scored ' + v.score;
        if (!racks[p].length && !bag.length) endGame(); else turn = other(p);
        sync(); return true;
    };
    const applyPass = (p) => { if (over || turn !== p) return; consec++; lastMsg = (p === 'a' ? 'Blue' : 'Orange') + ' passed'; if (consec >= 4) endGame(); else turn = other(p); sync(); };
    const applySwap = (p, idxs) => {
        if (over || turn !== p || !idxs.length || bag.length < idxs.length) return;
        const rk = racks[p], out = idxs.map(i => rk[i]);
        idxs.sort((a, b) => b - a).forEach(i => rk.splice(i, 1));
        for (let i = 0; i < out.length; i++) rk.push(bag.pop());
        bag.push(...out); shuffle(bag); consec = 0; lastMsg = (p === 'a' ? 'Blue' : 'Orange') + ' swapped ' + out.length; turn = other(p); sync();
    };

    const buildView = (p) => ({ board: board.map(row => row.map(c => c ? [c.l, c.blank ? 1 : 0] : null)), scores, turn: turn === p, rack: racks[p], opp: racks[other(p)].length, bag: bag.length, over, win: over ? winner : null, msg: lastMsg });
    const sync = () => { view = buildView('a'); render(); ctx.send({ t: 'state', v: buildView('b') }); };

    // ---- intents ----
    const doPlay = () => {
        const tiles = pend.map(t => ({ r: t.r, c: t.c, l: t.l, blank: t.blank }));
        if (auth) { if (applyPlay('a', tiles)) { pend = []; selRack = -1; render(); } }   // keep pend on reject
        else ctx.send({ t: 'play', tiles });                                              // pend clears on next state
    };
    const doPass = () => { if (auth) applyPass('a'); else ctx.send({ t: 'pass' }); };
    const doSwap = (idxs) => { if (auth) applySwap('a', idxs); else ctx.send({ t: 'swap', idxs }); };

    // ---- rendering ----
    const usedRack = () => { const u = []; pend.forEach(t => u.push(t.rackIdx)); return u; };
    const render = () => {
        if (!view) { statEl.textContent = 'Waiting for the host…'; return; }
        const myTurn = view.turn && !view.over;
        boardEl.innerHTML = '';
        for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
            const el = document.createElement('div'); el.className = 'sc-cell';
            const committed = view.board[r][c], pt = pend.find(t => t.r === r && t.c === c);
            if (committed) el.innerHTML = tileHTML(committed[0], committed[1]);
            else if (pt) { el.innerHTML = tileHTML(pt.l, pt.blank ? 1 : 0); el.classList.add('pend'); }
            else { const pr = PREM[r][c]; if (r === 7 && c === 7) el.classList.add('ctr'); else if (pr) el.classList.add(pr.toLowerCase()); el.textContent = (r === 7 && c === 7) ? '★' : pr; }
            el.addEventListener('click', () => onCell(r, c));
            boardEl.appendChild(el);
        }
        const used = usedRack();
        rackEl.innerHTML = '';
        view.rack.forEach((l, i) => {
            const el = document.createElement('div'); el.className = 'sc-rt';
            if (used.includes(i)) el.classList.add('used');
            if (selRack === i) el.classList.add('sel');
            if (swapSel.has(i)) el.classList.add('swap');
            el.innerHTML = tileHTML(l === '?' ? '' : l, l === '?' ? 1 : 0);
            el.addEventListener('click', () => onRack(i));
            rackEl.appendChild(el);
        });
        ctrlEl.innerHTML =
            '<button class="app-btn" data-x="play"' + (myTurn && pend.length ? '' : ' disabled') + '>Play</button>' +
            '<button class="app-btn" data-x="recall"' + (pend.length ? '' : ' disabled') + '>Recall</button>' +
            '<button class="app-btn" data-x="shuffle">Shuffle</button>' +
            '<button class="app-btn" data-x="swap"' + (myTurn ? '' : ' disabled') + '>' + (swapMode ? (swapSel.size ? 'Confirm swap (' + swapSel.size + ')' : 'Cancel') : 'Swap') + '</button>' +
            '<button class="app-btn" data-x="pass"' + (myTurn ? '' : ' disabled') + '>Pass</button>';
        ctrlEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onCtrl(b.dataset.x)));
        const my = meRole, op = other(meRole);
        statEl.textContent = view.over ? (view.win === 'tie' ? 'Tie ' : (view.win === my ? 'You win! ' : 'You lose ')) + view.scores[my] + '–' + view.scores[op]
            : 'You ' + view.scores[my] + ' – ' + view.scores[op] + ' · ' + (myTurn ? 'your turn' : 'their turn') + (localErr ? ' · ⚠ ' + localErr : '') + (view.msg ? ' · ' + view.msg : '') + ' · bag ' + view.bag;
    };
    const tileHTML = (l, blank) => '<span class="tl">' + (l || ' ') + '</span>' + (l && !blank ? '<span class="vl">' + VAL[l] + '</span>' : '');

    const onCell = (r, c) => {
        localErr = '';
        const pi = pend.findIndex(t => t.r === r && t.c === c);
        if (pi >= 0) { pend.splice(pi, 1); render(); return; }                       // recall a pending tile
        if (!view.turn || view.over || view.board[r][c] || selRack < 0) return;
        const letter = view.rack[selRack];
        if (letter === '?') { askBlank((L) => { pend.push({ r, c, l: L, blank: true, rackIdx: selRack }); selRack = -1; render(); }); return; }
        pend.push({ r, c, l: letter, blank: false, rackIdx: selRack }); selRack = -1; render();
    };
    const onRack = (i) => {
        localErr = '';
        if (swapMode) { swapSel.has(i) ? swapSel.delete(i) : swapSel.add(i); render(); return; }
        if (usedRack().includes(i)) return;
        selRack = selRack === i ? -1 : i; render();
    };
    const onCtrl = (x) => {
        localErr = '';
        if (x === 'play') doPlay();
        else if (x === 'recall') { pend = []; selRack = -1; render(); }
        else if (x === 'shuffle') { pend = []; selRack = -1; view.rack = shuffle([...view.rack]); render(); }
        else if (x === 'pass') { swapMode = false; swapSel.clear(); doPass(); }
        else if (x === 'swap') {
            if (!swapMode) { swapMode = true; swapSel.clear(); pend = []; }
            else if (swapSel.size) { doSwap([...swapSel]); swapMode = false; swapSel.clear(); }
            else swapMode = false;
            render();
        }
    };
    const askBlank = (cb) => {
        pickEl.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(L => '<button>' + L + '</button>').join('');
        pickEl.classList.remove('hidden');
        pickEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { pickEl.classList.add('hidden'); cb(b.textContent); }));
    };

    window.Appmegle.register({
        id: 'scrabble', label: 'Scrabble', css: 'apps/scrabble.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; meRole = auth ? 'a' : 'b'; view = null; pend = []; selRack = -1; swapMode = false; swapSel = new Set();
            ctx.root.innerHTML = '<div class="app-col" id="sc"><div class="app-bar"><span class="stat"></span>' +
                '<button class="app-btn nb">New game</button></div>' +
                '<div id="sc-board"></div><div id="sc-rack"></div><div id="sc-ctrl"></div>' +
                '<div id="sc-pick" class="hidden"></div></div>';
            boardEl = ctx.root.querySelector('#sc-board'); rackEl = ctx.root.querySelector('#sc-rack');
            ctrlEl = ctx.root.querySelector('#sc-ctrl'); statEl = ctx.root.querySelector('.stat'); pickEl = ctx.root.querySelector('#sc-pick');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            if (auth) newGame(); else render();
        },
        unmount() { ctx = null; view = null; boardEl = rackEl = ctrlEl = statEl = pickEl = null; },
        onData(msg) {
            if (!auth) {
                if (msg.t === 'state') { view = msg.v; pend = []; selRack = -1; render(); }
                else if (msg.t === 'reject') { localErr = msg.err; render(); }
                return;
            }
            if (msg.t === 'play') applyPlay('b', msg.tiles);
            else if (msg.t === 'pass') applyPass('b');
            else if (msg.t === 'swap') applySwap('b', msg.idxs);
            else if (msg.t === 'newreq') newGame();
        }
    });
})();
