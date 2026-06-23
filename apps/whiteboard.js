// ===========================================================================
//  Whiteboard app for appmegle.
//
//  A shared transparent canvas drawn over the live video. Strokes are sent as
//  short line segments in NORMALIZED (0..1) coordinates, so both peers see the
//  same drawing regardless of screen size / video letterboxing. Each segment is
//  also kept locally so the canvas can be redrawn on resize. Caller defaults to
//  a cyan pen, answerer to orange; either can pick another color or clear.
// ===========================================================================
(function () {
    const PALETTE = ['#ff5d5d', '#ffd75d', '#5dff8f', '#5db4ff', '#ffffff', '#111111'];

    let ctx = null, canvas = null, g = null, drawing = false, color = '#5db4ff', last = null;
    let segs = [];   // {x0,y0,x1,y1,c} in normalized coords, for redraw on resize
    let onUp = null, onResize = null;

    const fit = () => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        g.lineCap = 'round'; g.lineJoin = 'round';
        redraw();
    };

    const drawSeg = (s) => {
        g.strokeStyle = s.c;
        g.lineWidth = Math.max(2, canvas.width * 0.006);
        g.beginPath();
        g.moveTo(s.x0 * canvas.width, s.y0 * canvas.height);
        g.lineTo(s.x1 * canvas.width, s.y1 * canvas.height);
        g.stroke();
    };
    const redraw = () => { g.clearRect(0, 0, canvas.width, canvas.height); segs.forEach(drawSeg); };

    const add = (s, broadcast) => {
        segs.push(s); drawSeg(s);
        if (broadcast) ctx.send({ t: 'seg', s });
    };
    const clearAll = (broadcast) => {
        segs = []; g.clearRect(0, 0, canvas.width, canvas.height);
        if (broadcast) ctx.send({ t: 'clear' });
    };

    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    window.Appmegle.register({
        id: 'whiteboard',
        label: 'Whiteboard',
        css: 'apps/whiteboard.css',
        mount(c) {
            ctx = c;
            color = ctx.amCaller ? '#5db4ff' : '#ff9d3d';
            ctx.root.innerHTML =
                '<div id="wb-wrap">' +
                  '<canvas id="wb-canvas"></canvas>' +
                  '<div id="wb-tools">' +
                    PALETTE.map(c2 => '<button class="wb-color" data-c="' + c2 + '" style="background:' + c2 + '"></button>').join('') +
                    '<button id="wb-clear">Clear</button>' +
                  '</div>' +
                '</div>';
            canvas = ctx.root.querySelector('#wb-canvas');
            g = canvas.getContext('2d');

            canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); });
            canvas.addEventListener('pointermove', (e) => {
                if (!drawing) return;
                const p = pos(e);
                add({ x0: last.x, y0: last.y, x1: p.x, y1: p.y, c: color }, true);
                last = p;
            });
            onUp = () => { drawing = false; };
            window.addEventListener('pointerup', onUp);

            ctx.root.querySelectorAll('.wb-color').forEach(b =>
                b.addEventListener('click', () => { color = b.dataset.c; }));
            ctx.root.querySelector('#wb-clear').addEventListener('click', () => clearAll(true));

            onResize = fit;
            window.addEventListener('resize', onResize);
            requestAnimationFrame(fit);   // size once laid out
        },
        unmount() {
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('resize', onResize);
            ctx = null; canvas = null; g = null; segs = []; drawing = false;
        },
        onData(msg) {
            if (!g) return;
            if (msg.t === 'seg') add(msg.s, false);
            else if (msg.t === 'clear') clearAll(false);
        }
    });
})();
