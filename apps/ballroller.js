// Ball Roller (3D, 2-player race) for appmegle. A translucent glass ball you roll through a
// 3D obstacle arena to the goal pad. Uses three.js (loaded on demand from CDN, UMD global
// THREE — same pattern as the chess engine). The renderer is transparent so the live video
// shows through the canvas AND the translucent ball. Controls work on phone (device tilt)
// and laptop (WASD/arrows, or drag). Like the other racers, each client simulates its own
// ball locally (lag-free) and broadcasts position for the ghost; the caller arbitrates the
// finish. Caller = blue ball, answerer = orange.
(function () {
    const THREE_URL = 'https://unpkg.com/three@0.149.0/build/three.min.js';
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = THREE_URL; s.onload = () => res(); document.head.appendChild(s); });

    const AW = 9, AZ = 14, R = 0.9, G = 24, FR = 2.6, MAXV = 16, SEND = 33;
    const OBST = [{ x: -4, z: 5, hw: 1.6, hd: 1.6 }, { x: 4, z: 0.5, hw: 1.6, hd: 1.6 }, { x: -3, z: -5, hw: 1.6, hd: 1.6 }, { x: 3.5, z: -9, hw: 1.3, hd: 3 }, { x: -5, z: -10, hw: 1.3, hd: 1.3 }];
    const START = { x: 0, z: 12.5 }, GOALZ = -12.8;

    let ctx = null, auth = false, role = 'a', raf = 0, wrap = null, statEl = null, enableBtn = null;
    let THREE, scene, cam, renderer, ballMesh, oppMesh;
    let bk = null, opp = { x: 0, z: 12.5 }, keyX = 0, keyZ = 0, tiltX = 0, tiltZ = 0, dragX = 0, dragZ = 0, dragging = false, tiltBase = null;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null, onTilt = null, onResize = null;

    const begin = () => { bk = { x: START.x, z: START.z, vx: 0, vz: 0, rx: 0, rz: 0, fin: false }; opp = { x: START.x, z: START.z }; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000; };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start' }); } else ctx.send({ t: 'rematch' }); };

    const hitBox = (o) => {
        const cx = Math.max(o.x - o.hw, Math.min(bk.x, o.x + o.hw)), cz = Math.max(o.z - o.hd, Math.min(bk.z, o.z + o.hd));
        const dx = bk.x - cx, dz = bk.z - cz, d = Math.hypot(dx, dz);
        if (d < R && d > 0) { const nx = dx/d, nz = dz/d, push = R - d; bk.x += nx*push; bk.z += nz*push; const vn = bk.vx*nx + bk.vz*nz; if (vn < 0) { bk.vx -= vn*nx; bk.vz -= vn*nz; } }
    };
    const sim = (dt) => {
        let ax = keyX + tiltX + (dragging ? dragX : 0), az = keyZ + tiltZ + (dragging ? dragZ : 0);
        const m = Math.hypot(ax, az); if (m > 1) { ax /= m; az /= m; }
        bk.vx += ax*G*dt; bk.vz += az*G*dt;
        bk.vx -= bk.vx*FR*dt; bk.vz -= bk.vz*FR*dt;
        const sp = Math.hypot(bk.vx, bk.vz); if (sp > MAXV) { bk.vx *= MAXV/sp; bk.vz *= MAXV/sp; }
        bk.x += bk.vx*dt; bk.z += bk.vz*dt;
        if (bk.x < -AW + R) { bk.x = -AW + R; bk.vx = Math.abs(bk.vx)*0.4; } if (bk.x > AW - R) { bk.x = AW - R; bk.vx = -Math.abs(bk.vx)*0.4; }
        if (bk.z > AZ - R) { bk.z = AZ - R; bk.vz = -Math.abs(bk.vz)*0.4; } if (bk.z < -AZ + R) { bk.z = -AZ + R; bk.vz = Math.abs(bk.vz)*0.4; }
        OBST.forEach(hitBox);
        bk.rx += bk.vz*dt/R; bk.rz -= bk.vx*dt/R;
        if (bk.z < GOALZ && !bk.fin) { bk.fin = true; onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they reached the goal first'; };

    const buildScene = () => {
        THREE = window.THREE;
        scene = new THREE.Scene();
        const w = wrap.clientWidth || 640, h = wrap.clientHeight || 420;
        cam = new THREE.PerspectiveCamera(55, w/h, 0.1, 200); cam.position.set(0, 20, 22); cam.lookAt(0, 0, -2);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h); renderer.setClearColor(0x000000, 0);
        wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(6, 16, 8); scene.add(dl);
        // floor (faint, translucent) + grid
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW*2, AZ*2), new THREE.MeshStandardMaterial({ color: 0x224466, transparent: true, opacity: 0.18 }));
        floor.rotation.x = -Math.PI/2; scene.add(floor);
        const grid = new THREE.GridHelper(AZ*2, 28, 0x88aacc, 0x446688); grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
        // walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x66aaff, transparent: true, opacity: 0.22 });
        const wall = (x, z, sx, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.6, sz), wallMat); m.position.set(x, 0.8, z); scene.add(m); };
        wall(-AW, 0, 0.4, AZ*2); wall(AW, 0, 0.4, AZ*2); wall(0, AZ, AW*2, 0.4); wall(0, -AZ, AW*2, 0.4);
        OBST.forEach(o => wall(o.x, o.z, o.hw*2, o.hd*2));
        // goal pad
        const goal = new THREE.Mesh(new THREE.BoxGeometry(AW*2 - 1, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x44ee88, transparent: true, opacity: 0.5, emissive: 0x227744 }));
        goal.position.set(0, 0.1, GOALZ - 0.6); scene.add(goal);
        // balls
        const mkBall = (col, op) => new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: op, roughness: 0.15, metalness: 0, clearcoat: 1, emissive: col, emissiveIntensity: 0.12 }));
        ballMesh = mkBall(role === 'a' ? 0x5db4ff : 0xff9d3d, 0.55);
        oppMesh = mkBall(role === 'a' ? 0xff9d3d : 0x5db4ff, 0.35);
        scene.add(ballMesh); scene.add(oppMesh);
    };
    const render3 = () => {
        if (!renderer) return;
        if (bk) { ballMesh.position.set(bk.x, R, bk.z); ballMesh.rotation.x = bk.rx; ballMesh.rotation.z = bk.rz; }
        oppMesh.position.set(opp.x, R, opp.z);
        renderer.render(scene, cam);
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Roll to the green goal!'; }
        if (phase === 'race' && bk) sim(dt);
        if (bk && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: +bk.x.toFixed(2), z: +bk.z.toFixed(2) }); }
        if (phase === 'countdown' && statEl) statEl.textContent = 'Starting in ' + Math.max(0, Math.ceil((countEnd - performance.now())/1000)) + '…';
        render3(); raf = requestAnimationFrame(loop);
    };

    const enableTilt = () => {
        const add = () => { onTilt = (e) => { if (e.gamma == null) return; if (tiltBase == null) tiltBase = e.beta; tiltX = Math.max(-1, Math.min(1, e.gamma/28)); tiltZ = Math.max(-1, Math.min(1, -(e.beta - tiltBase)/24)); }; window.addEventListener('deviceorientation', onTilt); enableBtn.style.display = 'none'; statEl.textContent = 'Tilt to roll!'; };
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if (p === 'grant' || p === 'granted') add(); }).catch(() => {});
        else add();
    };

    window.Appmegle.register({
        id: 'ballroller', label: 'Ball Roller (3D)', css: 'apps/ballroller.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b';
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat">Loading 3D…</span>' +
                '<button class="app-btn tilt">Enable tilt</button><button class="app-btn nb">New race</button></div>' +
                '<div id="br-wrap"></div></div>';
            wrap = ctx.root.querySelector('#br-wrap'); statEl = ctx.root.querySelector('.stat'); enableBtn = ctx.root.querySelector('.tilt');
            if (!('DeviceOrientationEvent' in window)) enableBtn.style.display = 'none';
            enableBtn.addEventListener('click', enableTilt);
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => {
                const d = e.type === 'keydown' ? 1 : 0;
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyX = d ? -1 : 0;
                else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyX = d ? 1 : 0;
                else if (e.code === 'ArrowUp' || e.code === 'KeyW') keyZ = d ? -1 : 0;
                else if (e.code === 'ArrowDown' || e.code === 'KeyS') keyZ = d ? 1 : 0;
                else return;
                e.preventDefault();
            };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ensureThree().then(() => {
                if (!wrap) return;                              // app closed before three.js loaded
                buildScene();
                wrap.addEventListener('pointerdown', (e) => { dragging = true; setDrag(e); });
                wrap.addEventListener('pointermove', (e) => { if (dragging) setDrag(e); });
                wrap.addEventListener('pointerup', () => { dragging = false; dragX = dragZ = 0; });
                wrap.addEventListener('pointerleave', () => { dragging = false; dragX = dragZ = 0; });
                onResize = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); };
                window.addEventListener('resize', onResize);
                statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host…';
                lastT = performance.now(); lastSend = 0; raf = requestAnimationFrame(loop);
                if (auth) newRace();
            });
            function setDrag(e) { const r = wrap.getBoundingClientRect(); dragX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width/2)) / (r.width/3))); dragZ = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height/2)) / (r.height/3))); }
        },
        unmount() {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
            if (onTilt) window.removeEventListener('deviceorientation', onTilt);
            if (onResize) window.removeEventListener('resize', onResize);
            if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); }
            scene = cam = renderer = ballMesh = oppMesh = bk = null; wrap = statEl = enableBtn = ctx = null; tiltBase = null; keyX = keyZ = tiltX = tiltZ = 0;
        },
        onData(msg) {
            if (msg.t === 'p') opp = { x: msg.x, z: msg.z };
            else if (msg.t === 'start') begin();
            else if (msg.t === 'rematch' && auth) newRace();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
        }
    });
})();
