// ===========================================================================
//  Chess app for appmegle.
//
//  Registers itself with the Appmegle host (window.Appmegle). The host shows it
//  in the "-- Apps --" dropdown; picking it mounts the board over the video for
//  both peers. Pieces are drawn outline-only (see apps/chess.css) so the live
//  video shows through. Only moves are exchanged — each side keeps its own
//  chess.js engine in lockstep. Caller (player 1) is White, answerer is Black.
//
//  This file is fully self-contained: it loads its own chess engine and styles,
//  and touches nothing in index.html beyond the Appmegle.register contract.
// ===========================================================================
(function () {
    const ENGINE = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';

    // load the chess.js engine once, lazily; resolves when window.Chess is ready
    let enginePromise = null;
    const ensureEngine = () => {
        if (window.Chess) return Promise.resolve();
        if (!enginePromise) {
            enginePromise = new Promise((res) => {
                const s = document.createElement('script');
                s.src = ENGINE; s.onload = () => res();
                document.head.appendChild(s);
            });
        }
        return enginePromise;
    };
    ensureEngine();   // kick off the download early so it's ready by the time anyone pairs

    const FILES = 'abcdefgh';
    const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

    let ctx = null, game = null, myColor = 'w', selSq = null, board = null, statEl = null;
    const sqEl = {};

    const buildBoard = () => {
        board.innerHTML = '';
        for (const k in sqEl) delete sqEl[k];
        // orient so our own pieces sit at the bottom
        const ranks = myColor === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
        const files = myColor === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
        for (const r of ranks) for (const f of files) {
            const sq = FILES[f] + r;
            const el = document.createElement('div');
            el.className = 'sq ' + (((f + r) % 2 === 0) ? 'light' : 'dark');
            el.addEventListener('click', () => onSquare(sq));
            board.appendChild(el); sqEl[sq] = el;
        }
    };

    const render = () => {
        if (!game) return;
        for (const sq in sqEl) {
            const el = sqEl[sq]; el.classList.remove('sel', 'legal', 'cap');
            const p = game.get(sq);
            el.innerHTML = p ? '<span class="pc ' + p.color + '">' + GLYPH[p.type] + '</span>' : '';
        }
        if (selSq && sqEl[selSq]) {
            sqEl[selSq].classList.add('sel');
            game.moves({ square: selSq, verbose: true }).forEach((m) => {
                const t = sqEl[m.to];
                if (t) { t.classList.add('legal'); if (m.flags.includes('c') || m.flags.includes('e')) t.classList.add('cap'); }
            });
        }
        status();
    };

    const status = () => {
        if (!game || !statEl) return;
        let s = (myColor === 'w' ? 'You are White' : 'You are Black');
        if (game.in_checkmate()) s = (game.turn() === myColor) ? 'Checkmate — you lose' : 'Checkmate — you win!';
        else if (game.in_stalemate()) s += ' · stalemate';
        else if (game.in_draw()) s += ' · draw';
        else { if (game.in_check()) s += ' · check'; s += (game.turn() === myColor) ? ' · your move' : ' · their move'; }
        statEl.textContent = s;
    };

    const applyMove = (mv, broadcast) => {
        const res = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
        if (!res) return;
        if (broadcast) ctx.send({ t: 'move', from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
        selSq = null; render();
    };

    const onSquare = (sq) => {
        if (!game) return;
        const myTurn = game.turn() === myColor, p = game.get(sq);
        if (selSq) {
            if (sq === selSq) { selSq = null; return render(); }                 // deselect
            const legal = game.moves({ square: selSq, verbose: true }).find(m => m.to === sq);
            if (legal) return applyMove({ from: selSq, to: sq, promotion: legal.promotion }, true);
            selSq = (p && p.color === myColor && myTurn) ? sq : null;             // reselect own / clear
            return render();
        }
        if (p && p.color === myColor && myTurn) { selSq = sq; render(); }         // pick up
    };

    const newGame = () => { game = new Chess(); selSq = null; buildBoard(); render(); };

    window.Appmegle.register({
        id: 'chess',
        label: 'Chess',
        css: 'apps/chess.css',
        mount(c) {
            ctx = c;
            myColor = ctx.amCaller ? 'w' : 'b';
            ctx.root.innerHTML =
                '<div id="chess-ui">' +
                  '<div id="chess-top"><span id="chess-stat">Loading…</span><button id="chess-new">New game</button></div>' +
                  '<div id="board"></div>' +
                '</div>';
            board = ctx.root.querySelector('#board');
            statEl = ctx.root.querySelector('#chess-stat');
            ctx.root.querySelector('#chess-new').addEventListener('click', () => { if (game) { newGame(); ctx.send({ t: 'reset' }); } });
            ensureEngine().then(newGame);
        },
        unmount() {
            game = null; selSq = null; board = null; statEl = null; ctx = null;
            for (const k in sqEl) delete sqEl[k];
        },
        onData(msg) {
            if (msg.t === 'move') ensureEngine().then(() => { if (game) applyMove(msg, false); });
            else if (msg.t === 'reset') ensureEngine().then(() => { if (board) newGame(); });
        }
    });
})();
