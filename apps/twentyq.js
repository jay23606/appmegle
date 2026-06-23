// 20 Questions for appmegle. The caller thinks of something; the answerer asks out
// loud (voice/chat). The thinker taps Yes/No/Maybe; the app syncs the answer and a
// running question count to the asker. Lightweight scorekeeper around the conversation.
(function () {
    const ANS = [['Yes', 'y'], ['No', 'n'], ['Maybe', 'm'], ['Got it! 🎉', 'win']];
    let ctx = null, thinker = false, n = 0, last = '', done = false, statEl = null, bigEl = null, ctrlEl = null;

    const render = () => {
        statEl.textContent = done ? (thinker ? 'They guessed it! 🎉' : 'You guessed it! 🎉')
            : 'Question ' + n + ' / 20' + (n > 20 ? ' — over the limit!' : '');
        bigEl.textContent = done ? '🎉' : (last || (thinker ? 'Think of something, then answer their questions' : 'Ask a yes/no question out loud'));
        if (ctrlEl) [...ctrlEl.children].forEach(b => b.disabled = done);
    };

    const answer = (label, code) => {
        if (done) return;
        if (code === 'win') { done = true; ctx.send({ t: 'state', n, last, done: true }); return render(); }
        n++; last = 'Q' + n + ': ' + label;
        ctx.send({ t: 'state', n, last, done: false }); render();
    };
    const reset = (broadcast) => { n = 0; last = ''; done = false; if (broadcast) ctx.send({ t: 'reset' }); render(); };

    window.Appmegle.register({
        id: 'twentyq', label: '20 Questions', css: 'apps/twentyq.css',
        mount(c) {
            ctx = c; thinker = ctx.amCaller; n = 0; last = ''; done = false;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span>' +
                (thinker ? '<button class="app-btn nb">New round</button>' : '') + '</div>' +
                '<div id="tq-big"></div>' +
                (thinker ? '<div id="tq-ctrl">' + ANS.map(([l, code]) => '<button class="app-btn" data-a="' + code + '">' + l + '</button>').join('') + '</div>'
                         : '<div id="tq-role">You\'re the asker — ask away</div>') + '</div>';
            statEl = ctx.root.querySelector('.stat');
            bigEl = ctx.root.querySelector('#tq-big');
            ctrlEl = ctx.root.querySelector('#tq-ctrl');
            if (thinker) {
                ctrlEl.querySelectorAll('button').forEach(b =>
                    b.addEventListener('click', () => answer(b.textContent, b.dataset.a)));
                ctx.root.querySelector('.nb').addEventListener('click', () => reset(true));
            }
            render();
        },
        unmount() { ctx = statEl = bigEl = ctrlEl = null; },
        onData(msg) {
            if (msg.t === 'state') { n = msg.n; last = msg.last; done = msg.done; render(); }
            else if (msg.t === 'reset') reset(false);
        }
    });
})();
