// 3D Mini Golf (2-player) for appmegle. Turn-based with authoritative ball physics (same
// idea as Pool). Players alternate putts on a shared green; drag to aim a slingshot shot,
// the caller simulates the roll (friction, wall bounces, hole capture) and switches turns.
// Each plays their own glass ball; fewest strokes to hole out wins. Caller = blue, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const BX = 7, BZ = 10, R = 0.5, HOLE = { x: 0, z: -8, r: 0.85 }, FR = 1.4, SUB = 4;
    const WALLS = [{ x: 0, z: -BZ, hw: BX, hd: 0.3 }, { x: 0, z: BZ, hw: BX, hd: 0.3 }, { x: -BX, z: 0, hw: 0.3, hd: BZ }, { x: BX, z: 0, hw: 0.3, hd: BZ }, { x: -2.5, z: -2, hw: 0.3, hd: 3.5 }, { x: 3, z: 3, hw: 3, hd: 0.3 }];

    let ctx = null, auth = false, me = 'a', raf = 0, wrap = null, statEl = null;
    let THREE, scene, cam, renderer, floorMesh, ballMeshes = {}, aimLine = null;
    let balls = { a: { x: -3, z: 8, vx: 0, vz: 0, holed: false }, b: { x: 3, z: 8, vx: 0, vz: 0, holed: false } };
    let strokes = { a: 0, b: 0 }, turn = 'a', phase = 'aim', over = false, winner = null;
    let aiming = false, aimWorld = null, view = null, lastT = 0, lastSend = 0;

    const other = (p) => p === 'a' ? 'b' : 'a';
    const stateForRender = () => auth ? { balls, strokes, turn, phase, over, winner } : view;
    const status = () => {
        const s = stateForRender(); if (!statEl || !s) { if (statEl) statEl.textContent = 'Waiting…'; return; }
        statEl.textContent = s.over ? (s.winner === 'tie' ? 'Tie ' : (s.winner === me ? 'You win ' : 'You lose ')) + s.strokes[me] + 'v' + s.strokes[other(me)]
            : 'You ' + s.strokes[me] + ' · Them ' + s.strokes[other(me)] + ' · ' + (s.turn === me ? (s.phase === 'aim' ? 'your putt — drag to aim' : 'rolling…') : 'their putt');
    };
    const newGame = () => { if (!auth) return ctx.send({ t: 'newreq' }); balls = { a: { x: -3, z: 8, vx: 0, vz: 0, holed: false }, b: { x: 3, z: 8, vx: 0, vz: 0, holed: false } }; strokes = { a: 0, b: 0 }; turn = 'a'; phase = 'aim'; over = false; winner = null; sync(); };

    const bounce = (b) => {
        for (const w of WALLS) { const cx = Math.max(w.x - w.hw, Math.min(b.x, w.x + w.hw)), cz = Math.max(w.z - w.hd, Math.min(b.z, w.z + w.hd)); const dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz); if (d < R && d > 0) { const nx = dx/d, nz = dz/d; b.x = cx + nx*R; b.z = cz + nz*R; const vn = b.vx*nx + b.vz*nz; if (vn < 0) { b.vx -= 2*vn*nx; b.vz -= 2*vn*nz; b.vx *= 0.8; b.vz *= 0.8; } } }
    };
    const step = (dt) => {
        for (const p of ['a', 'b']) { const b = balls[p]; if (b.holed) continue; b.x += b.vx*dt; b.z += b.vz*dt; bounce(b); const dh = Math.hypot(b.x - HOLE.x, b.z - HOLE.z); if (dh < HOLE.r && Math.hypot(b.vx, b.vz) < 6) { b.holed = true; b.x = HOLE.x; b.z = HOLE.z; b.vx = b.vz = 0; } }
    };
    const stopped = () => ['a', 'b'].every(p => balls[p].holed || Math.hypot(balls[p].vx, balls[p].vz) < 3.2);
    const resolve = () => {
        ['a', 'b'].forEach(p => { balls[p].vx = balls[p].vz = 0; });
        if (balls.a.holed && balls.b.holed) { over = true; winner = strokes.a < strokes.b ? 'a' : strokes.a > strokes.b ? 'b' : 'tie'; }
        else { let nt = other(turn); if (balls[nt].holed) nt = turn; if (balls[nt].holed) { over = true; winner = strokes.a < strokes.b ? 'a' : 'b'; } turn = nt; }
        phase = 'aim'; sync();
    };
    const shoot = (p, vx, vz) => { if (over || turn !== p || phase !== 'aim' || balls[p].holed) return; balls[p].vx = vx; balls[p].vz = vz; strokes[p]++; phase = 'roll'; };

    const sync = () => { view = { balls: JSON.parse(JSON.stringify(balls)), strokes: { ...strokes }, turn, phase, over, winner }; render(); ctx.send({ t: 's', v: view }); };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 540, h = wrap.clientHeight || 560;
        cam = new THREE.PerspectiveCamera(50, w/h, 0.1, 200); cam.position.set(0, 20, 16); cam.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.85)); const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(4, 12, 8); scene.add(dl);
        floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(BX*2, BZ*2), new THREE.MeshStandardMaterial({ color: 0x2c9c5a, transparent: true, opacity: 0.3 })); floorMesh.rotation.x = -Math.PI/2; scene.add(floorMesh);
        const wm = new THREE.MeshStandardMaterial({ color: 0x66cc88, transparent: true, opacity: 0.28 });
        WALLS.forEach(w2 => { const m = new THREE.Mesh(new THREE.BoxGeometry(w2.hw*2, 1, w2.hd*2), wm); m.position.set(w2.x, 0.5, w2.z); scene.add(m); });
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(HOLE.r, HOLE.r, 0.2, 22), new THREE.MeshBasicMaterial({ color: 0x111111 })); hole.position.set(HOLE.x, 0.05, HOLE.z); scene.add(hole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0xff4444 })); flag.position.set(HOLE.x + 0.3, 1.6, HOLE.z); scene.add(flag);
        ballMeshes.a = new THREE.Mesh(new THREE.SphereGeometry(R, 22, 16), new THREE.MeshPhysicalMaterial({ color: 0x5db4ff, transparent: true, opacity: 0.7, roughness: 0.1, clearcoat: 1 }));
        ballMeshes.b = new THREE.Mesh(new THREE.SphereGeometry(R, 22, 16), new THREE.MeshPhysicalMaterial({ color: 0xff9d3d, transparent: true, opacity: 0.7, roughness: 0.1, clearcoat: 1 }));
        scene.add(ballMeshes.a); scene.add(ballMeshes.b);
        aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.3 })); aimLine.visible = false; scene.add(aimLine);
    };
    const worldAt = (e) => { const r = wrap.getBoundingClientRect(), rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1), cam); const hit = rc.intersectObject(floorMesh); return hit.length ? hit[0].point : null; };
    const render = () => {
        const s = stateForRender(); if (!renderer || !s) return;
        ['a', 'b'].forEach(p => { ballMeshes[p].position.set(s.balls[p].x, R, s.balls[p].z); ballMeshes[p].visible = !s.balls[p].holed || true; });
        const myBall = (auth ? balls : view && view.balls)[me];
        if (aiming && aimWorld && myBall) { const dx = myBall.x - aimWorld.x, dz = myBall.z - aimWorld.z, d = Math.hypot(dx, dz) || 1, L = Math.min(d, 6); const pos = aimLine.geometry.attributes.position; pos.setXYZ(0, myBall.x, R, myBall.z); pos.setXYZ(1, myBall.x + dx/d*L, R, myBall.z + dz/d*L); pos.needsUpdate = true; aimLine.computeLineDistances(); aimLine.visible = true; } else aimLine.visible = false;
        renderer.render(scene, cam); status();
    };
    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (auth && phase === 'roll') { for (let i = 0; i < SUB; i++) step(dt/SUB); for (const p of ['a','b']) { const b = balls[p]; if (!b.holed) { b.vx -= b.vx*FR*dt; b.vz -= b.vz*FR*dt; } } if (t - lastSend > 33) { lastSend = t; sync(); } if (stopped()) resolve(); }
        render(); raf = requestAnimationFrame(loop);
    };
    const canAim = () => { const s = stateForRender(); return s && s.phase === 'aim' && s.turn === me && !s.over && !s.balls[me].holed; };
    const doShoot = (vx, vz) => { if (auth) shoot('a', vx, vz); else ctx.send({ t: 'shot', vx, vz }); };

    window.Appmegle.register({
        id: 'minigolf', label: 'Mini Golf (3D)', css: 'apps/minigolf.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="mg-wrap"></div></div>';
            wrap = ctx.root.querySelector('#mg-wrap'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            ensureThree().then(() => {
                if (!wrap) return; build();
                wrap.addEventListener('pointerdown', (e) => { if (!canAim()) return; aiming = true; aimWorld = worldAt(e); });
                wrap.addEventListener('pointermove', (e) => { if (aiming) aimWorld = worldAt(e); });
                wrap.addEventListener('pointerup', () => { if (!aiming) return; aiming = false; const mb = (auth ? balls : view.balls)[me]; if (!aimWorld) return; const dx = mb.x - aimWorld.x, dz = mb.z - aimWorld.z, d = Math.hypot(dx, dz); if (d < 0.4) return; const pow = Math.min(d, 6) / 6 * 17, a = Math.atan2(dz, dx); doShoot(Math.cos(a)*pow, Math.sin(a)*pow); });
                this._rs = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); }; window.addEventListener('resize', this._rs);
                if (auth) newGame();
                lastT = performance.now(); raf = requestAnimationFrame(loop);
            });
        },
        unmount() { cancelAnimationFrame(raf); if (this._rs) window.removeEventListener('resize', this._rs); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = wrap = statEl = ctx = null; ballMeshes = {}; },
        onData(msg) {
            if (msg.t === 's' && !auth) { view = msg.v; render(); }
            else if (msg.t === 'shot' && auth) shoot('b', msg.vx, msg.vz);
            else if (msg.t === 'newreq' && auth) newGame();
        }
    });
})();
