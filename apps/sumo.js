// Marble Sumo (2-player) for appmegle. Two glass balls on a round platform — build momentum
// and bump your opponent off the edge; last one on the platform wins. The caller authoritatively
// simulates both balls + their collision (like Pool); each player sends its own input vector.
// Tilt / keys / drag to push. Caller = blue, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const RAD = 7, BR = 0.7, ACC = 30, FR = 1.4, MAXV = 18, SEND = 50;

    let ctx = null, auth = false, me = 'a', raf = 0, wrap = null, statEl = null, enableBtn = null;
    let THREE, scene, cam, renderer, ballA, ballB, disc;
    let A = null, B = null, inX = 0, inY = 0, tiltX = 0, tiltY = 0, dragX = 0, dragY = 0, dragging = false, tiltBase = null, oppIn = { x: 0, y: 0 };
    let phase = 'wait', countEnd = 0, over = false, winner = null, view = null, lastT = 0, lastSend = 0, onKey = null, onTilt = null, onResize = null;

    const mk = (sx) => ({ x: sx, z: 0, vx: 0, vz: 0, y: BR, fall: false });
    const begin = () => { A = mk(-3.5); B = mk(3.5); over = false; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000; };
    const newGame = () => { if (auth) { begin(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'rematch' }); };

    const collide = () => {
        const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
        if (d > 0 && d < 2*BR) { const nx = dx/d, nz = dz/d, ov = 2*BR - d; A.x -= nx*ov/2; A.z -= nz*ov/2; B.x += nx*ov/2; B.z += nz*ov/2; const p = (A.vx - B.vx)*nx + (A.vz - B.vz)*nz; if (p > 0) { const k = p*1.15; A.vx -= k*nx; A.vz -= k*nz; B.vx += k*nx; B.vz += k*nz; } }
    };
    const stepBall = (b, ix, iy, dt) => {
        if (b.fall) { b.y -= 14*dt; b.x += b.vx*dt; b.z += b.vz*dt; return; }
        let ax = ix, ay = iy; const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
        b.vx += ax*ACC*dt; b.vz += ay*ACC*dt; b.vx -= b.vx*FR*dt; b.vz -= b.vz*FR*dt;
        const sp = Math.hypot(b.vx, b.vz); if (sp > MAXV) { b.vx *= MAXV/sp; b.vz *= MAXV/sp; }
        b.x += b.vx*dt; b.z += b.vz*dt;
        if (Math.hypot(b.x, b.z) > RAD) b.fall = true;
    };
    const sim = (dt) => {
        const aIn = { x: inX + tiltX + (dragging ? dragX : 0), y: inY + tiltY + (dragging ? dragY : 0) };
        stepBall(A, aIn.x, aIn.y, dt); stepBall(B, oppIn.x, oppIn.y, dt); collide();
        if (!over) { if (A.y < -7 || B.y < -7) { over = true; winner = (A.y < -7 && B.y < -7) ? 'tie' : (A.y < -7 ? 'b' : 'a'); } }
    };
    const snap = () => ({ a: { x: A.x, z: A.z, y: A.y }, b: { x: B.x, z: B.z, y: B.y }, phase, over, winner });
    const status = () => { const s = auth ? snap() : view; if (!statEl) return; if (!s) { statEl.textContent = 'Waiting…'; return; } statEl.textContent = s.over ? (s.winner === 'tie' ? 'Draw!' : s.winner === me ? '🏆 You win!' : 'You lose') : (s.phase === 'countdown' ? 'Get ready…' : 'Push them off the edge!'); };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 600, h = wrap.clientHeight || 480;
        cam = new THREE.PerspectiveCamera(52, w/h, 0.1, 200); cam.position.set(0, 16, 13); cam.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.85)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 12, 6); scene.add(dl);
        disc = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x4477aa, transparent: true, opacity: 0.28 })); disc.position.y = -0.25; scene.add(disc);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(RAD, 0.12, 10, 48), new THREE.MeshBasicMaterial({ color: 0x99ccff, transparent: true, opacity: 0.5 })); ring.rotation.x = Math.PI/2; scene.add(ring);
        const mkBall = (col) => new THREE.Mesh(new THREE.SphereGeometry(BR, 26, 18), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: 0.65, roughness: 0.1, clearcoat: 1, emissive: col, emissiveIntensity: 0.18 }));
        ballA = mkBall(0x5db4ff); ballB = mkBall(0xff9d3d); scene.add(ballA); scene.add(ballB);
    };
    const render = () => { const s = auth ? snap() : view; if (!renderer || !s) return; ballA.position.set(s.a.x, s.a.y, s.a.z); ballB.position.set(s.b.x, s.b.y, s.b.z); renderer.render(scene, cam); status(); };
    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) phase = 'fight';
        if (auth && phase === 'fight' && !over) sim(dt);
        if (auth && t - lastSend > 33) { lastSend = t; view = snap(); ctx.send({ t: 's', v: view }); }
        if (!auth && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'in', x: +(inX + tiltX + (dragging ? dragX : 0)).toFixed(2), y: +(inY + tiltY + (dragging ? dragY : 0)).toFixed(2) }); }
        render(); raf = requestAnimationFrame(loop);
    };
    const enableTilt = () => { const add = () => { onTilt = (e) => { if (e.gamma == null) return; if (tiltBase == null) tiltBase = e.beta; tiltX = Math.max(-1, Math.min(1, e.gamma/24)); tiltY = Math.max(-1, Math.min(1, (e.beta - tiltBase)/22)); }; window.addEventListener('deviceorientation', onTilt); enableBtn.style.display = 'none'; }; if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted' || p === 'grant') add(); }).catch(() => {}); else add(); };

    window.Appmegle.register({
        id: 'sumo', label: 'Marble Sumo (3D)', css: 'apps/sumo.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; view = null;
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat">Loading 3D…</span><button class="app-btn tilt">Enable tilt</button><button class="app-btn nb">New game</button></div><div id="su-wrap"></div></div>';
            wrap = ctx.root.querySelector('#su-wrap'); statEl = ctx.root.querySelector('.stat'); enableBtn = ctx.root.querySelector('.tilt');
            if (!('DeviceOrientationEvent' in window)) enableBtn.style.display = 'none';
            enableBtn.addEventListener('click', enableTilt);
            ctx.root.querySelector('.nb').addEventListener('click', newGame);
            onKey = (e) => { const d = e.type === 'keydown' ? 1 : 0; if (e.code === 'ArrowLeft' || e.code === 'KeyA') inX = d ? -1 : 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') inX = d ? 1 : 0; else if (e.code === 'ArrowUp' || e.code === 'KeyW') inY = d ? -1 : 0; else if (e.code === 'ArrowDown' || e.code === 'KeyS') inY = d ? 1 : 0; else return; e.preventDefault(); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ensureThree().then(() => {
                if (!wrap) return; build();
                const setDrag = (e) => { const r = wrap.getBoundingClientRect(); dragX = Math.max(-1, Math.min(1, (e.clientX-(r.left+r.width/2))/(r.width/3))); dragY = Math.max(-1, Math.min(1, (e.clientY-(r.top+r.height/2))/(r.height/3))); };
                wrap.addEventListener('pointerdown', (e) => { dragging = true; setDrag(e); });
                wrap.addEventListener('pointermove', (e) => { if (dragging) setDrag(e); });
                wrap.addEventListener('pointerup', () => { dragging = false; dragX = dragY = 0; }); wrap.addEventListener('pointerleave', () => { dragging = false; dragX = dragY = 0; });
                onResize = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); }; window.addEventListener('resize', onResize);
                lastT = performance.now(); raf = requestAnimationFrame(loop); if (auth) newGame(); else statEl.textContent = 'Waiting for the host…';
            });
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); if (onTilt) window.removeEventListener('deviceorientation', onTilt); if (onResize) window.removeEventListener('resize', onResize); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = ballA = ballB = disc = A = B = wrap = statEl = enableBtn = ctx = null; tiltBase = null; inX = inY = tiltX = tiltY = 0; },
        onData(msg) { if (msg.t === 's' && !auth) { view = msg.v; phase = msg.v.phase; over = msg.v.over; } else if (msg.t === 'in' && auth) oppIn = { x: msg.x, y: msg.y }; else if (msg.t === 'start') { begin(); } else if (msg.t === 'rematch' && auth) newGame(); }
    });
})();
