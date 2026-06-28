// Tunnel Flyer (2-player race) for appmegle. Steer a glowing orb down a translucent tube,
// threading through a series of rings; miss a ring and you slow down. Each client flies its
// own orb locally (lag-free; tilt / keys / drag to steer, auto-forward) on a seed-synced
// identical tunnel; caller arbitrates who reaches the end first. Caller = blue, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const TUBE = 5, ORB = 0.55, GAP = 1.7, NRINGS = 12, SPC = 13, LEN = NRINGS*SPC + 16, FWD = 17, ACC = 30, FR = 3, SEND = 33;
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    let ctx = null, auth = false, role = 'a', raf = 0, wrap = null, statEl = null, enableBtn = null;
    let THREE, scene, cam, renderer, orbMesh, oppMesh, ringGroup;
    let gates = [], curSeed = 0, builtFor = -1;
    let orb = null, opp = { x: 0, y: 0, z: 0 }, inX = 0, inY = 0, tiltX = 0, tiltY = 0, dragX = 0, dragY = 0, dragging = false, tiltBase = null;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null, onTilt = null, onResize = null;

    const genGates = (seed) => { const rnd = mulberry32(seed >>> 0), g = []; for (let k = 1; k <= NRINGS; k++) { const ang = rnd()*Math.PI*2, rad = rnd()*(TUBE - GAP - 0.4); g.push({ z: -k*SPC, cx: Math.cos(ang)*rad, cy: Math.sin(ang)*rad }); } return g; };
    const begin = (seed) => { curSeed = (seed == null ? (Math.random()*4294967296)>>>0 : seed>>>0); gates = genGates(curSeed); orb = { x: 0, y: 0, z: 0, vx: 0, vy: 0, fwd: FWD, slow: 0, fin: false, prevZ: 0 }; opp = { x: 0, y: 0, z: 0 }; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000; };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start', seed: curSeed }); } else ctx.send({ t: 'rematch' }); };

    const sim = (dt) => {
        let ax = inX + tiltX + (dragging ? dragX : 0), ay = inY + tiltY + (dragging ? dragY : 0); const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
        orb.vx += ax*ACC*dt; orb.vy += ay*ACC*dt; orb.vx -= orb.vx*FR*dt; orb.vy -= orb.vy*FR*dt;
        orb.x += orb.vx*dt; orb.y += orb.vy*dt;
        const rr = Math.hypot(orb.x, orb.y), lim = TUBE - ORB; if (rr > lim) { orb.x *= lim/rr; orb.y *= lim/rr; orb.vx *= 0.3; orb.vy *= 0.3; }
        if (orb.slow > 0) orb.slow -= dt;
        const speed = orb.slow > 0 ? FWD*0.4 : FWD; orb.prevZ = orb.z; orb.z -= speed*dt;
        for (const g of gates) if (orb.prevZ > g.z && orb.z <= g.z) { if (Math.hypot(orb.x - g.cx, orb.y - g.cy) > GAP) orb.slow = 0.6; }
        if (orb.z <= -LEN && !orb.fin) { orb.fin = true; onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they reached the end first'; };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 700, h = wrap.clientHeight || 460;
        cam = new THREE.PerspectiveCamera(70, w/h, 0.1, 400);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(2, 4, 6); scene.add(dl);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(TUBE, TUBE, LEN + 20, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x4488cc, transparent: true, opacity: 0.12, side: THREE.DoubleSide, wireframe: false }));
        tube.rotation.x = Math.PI/2; tube.position.z = -LEN/2; scene.add(tube);
        const grid = new THREE.Mesh(new THREE.CylinderGeometry(TUBE-0.02, TUBE-0.02, LEN + 20, 16, 30, true), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.12, side: THREE.BackSide, wireframe: true })); grid.rotation.x = Math.PI/2; grid.position.z = -LEN/2; scene.add(grid);
        ringGroup = new THREE.Group(); scene.add(ringGroup);
        const mkOrb = (col, op) => new THREE.Mesh(new THREE.SphereGeometry(ORB, 22, 16), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: op, roughness: 0.1, clearcoat: 1, emissive: col, emissiveIntensity: 0.3 }));
        orbMesh = mkOrb(role === 'a' ? 0x5db4ff : 0xff9d3d, 0.85); oppMesh = mkOrb(role === 'a' ? 0xff9d3d : 0x5db4ff, 0.4); scene.add(orbMesh); scene.add(oppMesh);
    };
    const buildRings = () => {
        while (ringGroup.children.length) { const m = ringGroup.children.pop(); m.geometry.dispose(); }
        gates.forEach(g => { const m = new THREE.Mesh(new THREE.TorusGeometry(GAP, 0.18, 10, 28), new THREE.MeshStandardMaterial({ color: 0x55ffaa, transparent: true, opacity: 0.55, emissive: 0x33cc77, emissiveIntensity: 0.5 })); m.position.set(g.cx, g.cy, g.z); ringGroup.add(m); });
    };
    const render = () => {
        if (!renderer) return;
        if (builtFor !== curSeed && gates.length) { buildRings(); builtFor = curSeed; }
        if (orb) { orbMesh.position.set(orb.x, orb.y, orb.z); cam.position.set(orb.x*0.4, orb.y*0.4 + 1.2, orb.z + 9); cam.lookAt(orb.x, orb.y, orb.z - 8); }
        oppMesh.position.set(opp.x, opp.y, opp.z);
        renderer.render(scene, cam);
    };
    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Fly through the rings to the end!'; }
        if (phase === 'race' && orb) sim(dt);
        if (orb && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: +orb.x.toFixed(2), y: +orb.y.toFixed(2), z: +orb.z.toFixed(1) }); }
        if (phase === 'countdown' && statEl) statEl.textContent = 'Starting in ' + Math.max(0, Math.ceil((countEnd - performance.now())/1000)) + '…';
        render(); raf = requestAnimationFrame(loop);
    };
    const enableTilt = () => { const add = () => { onTilt = (e) => { if (e.gamma == null) return; if (tiltBase == null) tiltBase = e.beta; tiltX = Math.max(-1, Math.min(1, e.gamma/24)); tiltY = Math.max(-1, Math.min(1, -(e.beta - tiltBase)/22)); }; window.addEventListener('deviceorientation', onTilt); enableBtn.style.display = 'none'; statEl.textContent = 'Tilt to steer!'; }; if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted' || p === 'grant') add(); }).catch(() => {}); else add(); };

    window.Appmegle.register({
        id: 'tunnel', label: 'Tunnel Flyer (3D)', css: 'apps/tunnel.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b'; builtFor = -1; gates = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat">Loading 3D…</span><button class="app-btn tilt">Enable tilt</button><button class="app-btn nb">New race</button></div><div id="tn-wrap"></div></div>';
            wrap = ctx.root.querySelector('#tn-wrap'); statEl = ctx.root.querySelector('.stat'); enableBtn = ctx.root.querySelector('.tilt');
            if (!('DeviceOrientationEvent' in window)) enableBtn.style.display = 'none';
            enableBtn.addEventListener('click', enableTilt);
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => { const d = e.type === 'keydown' ? 1 : 0; if (e.code === 'ArrowLeft' || e.code === 'KeyA') inX = d ? -1 : 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') inX = d ? 1 : 0; else if (e.code === 'ArrowUp' || e.code === 'KeyW') inY = d ? 1 : 0; else if (e.code === 'ArrowDown' || e.code === 'KeyS') inY = d ? -1 : 0; else return; e.preventDefault(); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ensureThree().then(() => {
                if (!wrap) return; build();
                const setDrag = (e) => { const r = wrap.getBoundingClientRect(); dragX = Math.max(-1, Math.min(1, (e.clientX-(r.left+r.width/2))/(r.width/3))); dragY = Math.max(-1, Math.min(1, -(e.clientY-(r.top+r.height/2))/(r.height/3))); };
                wrap.addEventListener('pointerdown', (e) => { dragging = true; setDrag(e); });
                wrap.addEventListener('pointermove', (e) => { if (dragging) setDrag(e); });
                wrap.addEventListener('pointerup', () => { dragging = false; dragX = dragY = 0; }); wrap.addEventListener('pointerleave', () => { dragging = false; dragX = dragY = 0; });
                onResize = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); }; window.addEventListener('resize', onResize);
                statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host…';
                lastT = performance.now(); raf = requestAnimationFrame(loop); if (auth) newRace();
            });
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); if (onTilt) window.removeEventListener('deviceorientation', onTilt); if (onResize) window.removeEventListener('resize', onResize); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = orbMesh = oppMesh = ringGroup = orb = wrap = statEl = enableBtn = ctx = null; gates = []; tiltBase = null; inX = inY = tiltX = tiltY = 0; },
        onData(msg) { if (msg.t === 'p') opp = { x: msg.x, y: msg.y, z: msg.z }; else if (msg.t === 'start') begin(msg.seed); else if (msg.t === 'rematch' && auth) newRace(); else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); } else if (msg.t === 'result') finish(msg.w); }
    });
})();
