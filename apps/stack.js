// Stack (2-player race) for appmegle. The classic block-stacker: a translucent block slides
// back and forth; tap/click to drop it onto the tower — the overhang is sliced off, so the
// tower narrows as you misalign. Each client builds its own tower (lag-free one-tap control)
// and reports height; the caller arbitrates the win (first to the target height, or tallest
// if both topple). Caller = blue side, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const BH = 0.8, TARGET = 16, RANGE = 4.2;

    let ctx = null, auth = false, me = 'a', raf = 0, wrap = null, statEl = null;
    let THREE, scene, cam, renderer, tower, slider = null;
    let blocks = [], cur = null, height = 0, alive = true, over = false, result = null, oppH = 0, oppAlive = true, lastT = 0;

    const hue = (i) => new THREE.Color().setHSL((0.55 + i*0.04) % 1, 0.6, 0.6);
    const mkBlock = (w, d, y, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, BH, d), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: 0.62, roughness: 0.25, clearcoat: 0.6 })); m.position.y = y; return m; };

    const status = () => { if (!statEl) return; statEl.textContent = over ? (result === 'tie' ? 'Tie!' : result === me ? '🏆 You win!' : 'You lose') : 'You ' + height + ' · Them ' + oppH + ' · target ' + TARGET; };
    const evaluate = () => { if (!auth || over) return; if (height >= TARGET) win('a'); else if (oppH >= TARGET) win('b'); else if (!alive && !oppAlive) win(height > oppH ? 'a' : height < oppH ? 'b' : 'tie'); };
    const win = (w) => { over = true; result = w; ctx.send({ t: 'result', w }); status(); };
    const sendH = () => { ctx.send({ t: auth ? 'ch' : 'h', h: height, alive }); if (auth) evaluate(); };

    const spawn = () => {
        const top = blocks[blocks.length - 1], axis = height % 2 === 0 ? 'x' : 'z';
        cur = { x: top.x, z: top.z, w: top.w, d: top.d, y: height * BH + BH, axis, dir: 1, t: -RANGE };
        if (axis === 'x') cur.x = top.x - RANGE; else cur.z = top.z - RANGE;
        if (slider) tower.remove(slider);
        slider = mkBlock(cur.w, cur.d, cur.y, 0xffffff); slider.material.opacity = 0.8; tower.add(slider);
    };
    const drop = () => {
        if (over || !alive || !cur) return;
        const top = blocks[blocks.length - 1];
        if (cur.axis === 'x') { const delta = cur.x - top.x, ov = top.w - Math.abs(delta); if (ov <= 0.05) return die(); cur.w = ov; cur.x = top.x + delta/2; }
        else { const delta = cur.z - top.z, ov = top.d - Math.abs(delta); if (ov <= 0.05) return die(); cur.d = ov; cur.z = top.z + delta/2; }
        if (slider) tower.remove(slider); slider = null;
        const b = { x: cur.x, z: cur.z, w: cur.w, d: cur.d };
        const m = mkBlock(b.w, b.d, height * BH + BH, hue(height)); m.position.x = b.x; m.position.z = b.z; tower.add(m);
        blocks.push(b); height++; cur = null; sendH();
        if (!over && height < TARGET) spawn();
    };
    const die = () => { alive = false; cur = null; if (slider) { tower.remove(slider); slider = null; } statEl.textContent = 'Toppled at ' + height + '! ' + (auth ? '' : 'waiting…'); sendH(); };

    const newGame = (bcast) => {
        while (tower && tower.children.length) tower.remove(tower.children[0]);
        blocks = []; height = 0; alive = true; over = false; result = null; oppH = 0; oppAlive = true; slider = null;
        const base = { x: 0, z: 0, w: 3, d: 3 }; const m0 = mkBlock(3, 3, 0, hue(0)); tower.add(m0); blocks.push(base);
        spawn(); status();
        if (bcast) ctx.send({ t: 'restart' });
    };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 480, h = wrap.clientHeight || 600;
        cam = new THREE.PerspectiveCamera(50, w/h, 0.1, 200); cam.position.set(6, 6, 7);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.85)); const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(5, 10, 6); scene.add(dl);
        tower = new THREE.Group(); scene.add(tower);
    };
    const loop = (t) => {
        const dt = Math.min(0.05, (t - lastT)/1000 || 0); lastT = t;
        if (cur && slider && alive && !over) {
            const sp = 4 + height * 0.25; cur.t += cur.dir * sp * dt; if (cur.t > RANGE) { cur.t = RANGE; cur.dir = -1; } if (cur.t < -RANGE) { cur.t = -RANGE; cur.dir = 1; }
            if (cur.axis === 'x') { cur.x = blocks[blocks.length-1].x + cur.t; slider.position.x = cur.x; } else { cur.z = blocks[blocks.length-1].z + cur.t; slider.position.z = cur.z; }
        }
        if (renderer) { const ty = height * BH; cam.position.y += (ty + 6 - cam.position.y) * Math.min(1, dt*3); cam.lookAt(0, ty, 0); renderer.render(scene, cam); }
        raf = requestAnimationFrame(loop);
    };

    window.Appmegle.register({
        id: 'stack', label: 'Stack', css: 'apps/stack.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="st-wrap"></div><div class="st-hint">tap / Space to drop the block</div></div>';
            wrap = ctx.root.querySelector('#st-wrap'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            const tap = (e) => { e.preventDefault(); drop(); };
            ensureThree().then(() => {
                if (!wrap) return; build(); newGame(false);
                wrap.addEventListener('pointerdown', tap);
                this._key = (e) => { if (e.code === 'Space') { e.preventDefault(); drop(); } }; window.addEventListener('keydown', this._key);
                lastT = performance.now(); raf = requestAnimationFrame(loop);
            });
        },
        unmount() { cancelAnimationFrame(raf); if (this._key) window.removeEventListener('keydown', this._key); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = tower = slider = wrap = statEl = ctx = null; blocks = []; },
        onData(msg) {
            if (msg.t === 'h' && auth) { oppH = msg.h; oppAlive = msg.alive; status(); evaluate(); }
            else if (msg.t === 'ch' && !auth) { oppH = msg.h; oppAlive = msg.alive; status(); }
            else if (msg.t === 'result') { over = true; result = msg.w; status(); }
            else if (msg.t === 'restart') newGame(false);
        }
    });
})();
