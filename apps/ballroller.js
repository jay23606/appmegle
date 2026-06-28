// Ball Roller (3D, 2-player maze race) for appmegle. Roll a translucent glass ball through
// a randomly-generated maze to the goal. Uses three.js (loaded on demand from CDN, UMD
// global THREE). The renderer is transparent so the live video shows through the canvas and
// the ball. Each client simulates its own ball locally (tilt on mobile, WASD/arrows or drag
// on laptop). A NEW random maze every race: the caller picks a seed and sends only the seed
// in `start`; both regenerate the identical maze from it. Caller arbitrates the finish.
// Caller = blue ball, answerer = orange.
(function () {
    const THREE_URL = 'https://unpkg.com/three@0.149.0/build/three.min.js';
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = THREE_URL; s.onload = () => res(); document.head.appendChild(s); });

    const COLS = 9, ROWS = 6, CELL = 3.4, T = 0.5, R = 0.78, G = 26, FR = 2.7, MAXV = 16, SEND = 33;
    const AW = COLS * CELL / 2, AZ = ROWS * CELL / 2;
    const cellX = (c) => -AW + (c + 0.5) * CELL, cellZ = (r) => -AZ + (r + 0.5) * CELL;
    const MR = Math.floor(ROWS / 2);
    const startPos = { x: cellX(0), z: cellZ(MR) }, goalPos = { x: cellX(COLS - 1), z: cellZ(MR) };
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    let ctx = null, auth = false, role = 'a', raf = 0, wrap = null, statEl = null, enableBtn = null;
    let THREE, scene, cam, renderer, ballMesh, oppMesh, mazeGroup, wallMat, goalPad, goalBeam;
    let OBST = [], curSeed = 0, mazeBuiltFor = -1;
    let bk = null, opp = { x: startPos.x, z: startPos.z }, keyX = 0, keyZ = 0, tiltX = 0, tiltZ = 0, dragX = 0, dragZ = 0, dragging = false, tiltBase = null;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null, onTilt = null, onResize = null;

    const generateMaze = (seed) => {
        const rnd = mulberry32(seed >>> 0);
        const remV = Array.from({ length: COLS }, () => Array(ROWS).fill(false));   // wall removed between (c,r)-(c+1,r)
        const remH = Array.from({ length: COLS }, () => Array(ROWS).fill(false));   // removed between (c,r)-(c,r+1)
        const vis = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
        const stack = [[0, MR]]; vis[0][MR] = true;
        while (stack.length) {
            const [c, r] = stack[stack.length - 1], nb = [];
            if (c > 0 && !vis[c-1][r]) nb.push([c-1, r, 'W']);
            if (c < COLS-1 && !vis[c+1][r]) nb.push([c+1, r, 'E']);
            if (r > 0 && !vis[c][r-1]) nb.push([c, r-1, 'N']);
            if (r < ROWS-1 && !vis[c][r+1]) nb.push([c, r+1, 'S']);
            if (!nb.length) { stack.pop(); continue; }
            const [nc, nr, dir] = nb[(rnd() * nb.length) | 0];
            if (dir === 'E') remV[c][r] = true; else if (dir === 'W') remV[c-1][r] = true;
            else if (dir === 'S') remH[c][r] = true; else remH[c][r-1] = true;
            vis[nc][nr] = true; stack.push([nc, nr]);
        }
        const walls = [];
        for (let c = 0; c < COLS-1; c++) for (let r = 0; r < ROWS; r++) if (!remV[c][r]) walls.push({ x: -AW + (c+1)*CELL, z: cellZ(r), hw: T/2, hd: CELL/2 });
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS-1; r++) if (!remH[c][r]) walls.push({ x: cellX(c), z: -AZ + (r+1)*CELL, hw: CELL/2, hd: T/2 });
        walls.push({ x: -AW, z: 0, hw: T/2, hd: AZ }, { x: AW, z: 0, hw: T/2, hd: AZ }, { x: 0, z: -AZ, hw: AW, hd: T/2 }, { x: 0, z: AZ, hw: AW, hd: T/2 });
        return walls;
    };

    const begin = (seed) => {
        curSeed = (seed == null ? (Math.random() * 4294967296) >>> 0 : seed >>> 0);
        OBST = generateMaze(curSeed);
        bk = { x: startPos.x, z: startPos.z, vx: 0, vz: 0, rx: 0, rz: 0, fin: false };
        opp = { x: startPos.x, z: startPos.z }; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000;
    };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start', seed: curSeed }); } else ctx.send({ t: 'rematch' }); };

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
        OBST.forEach(hitBox);
        bk.rx += bk.vz*dt/R; bk.rz -= bk.vx*dt/R;
        if (!bk.fin && Math.hypot(bk.x - goalPos.x, bk.z - goalPos.z) < CELL*0.5) { bk.fin = true; onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they reached the goal first'; };

    const buildScene = () => {
        THREE = window.THREE;
        scene = new THREE.Scene();
        const w = wrap.clientWidth || 760, h = wrap.clientHeight || 500;
        cam = new THREE.PerspectiveCamera(56, w/h, 0.1, 300); cam.position.set(0, 30, 12); cam.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h); renderer.setClearColor(0x000000, 0);
        wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(6, 18, 8); scene.add(dl);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW*2, AZ*2), new THREE.MeshStandardMaterial({ color: 0x224466, transparent: true, opacity: 0.16 }));
        floor.rotation.x = -Math.PI/2; scene.add(floor);
        const grid = new THREE.GridHelper(Math.max(AW, AZ)*2, COLS*2, 0x88aacc, 0x446688); grid.material.transparent = true; grid.material.opacity = 0.16; scene.add(grid);
        wallMat = new THREE.MeshStandardMaterial({ color: 0x66aaff, transparent: true, opacity: 0.3 });
        mazeGroup = new THREE.Group(); scene.add(mazeGroup);
        // highlighted goal zone: a glowing floor pad filling the goal cell...
        goalPad = new THREE.Mesh(new THREE.BoxGeometry(CELL*0.92, 0.06, CELL*0.92), new THREE.MeshStandardMaterial({ color: 0x55ff99, transparent: true, opacity: 0.55, emissive: 0x33ff88, emissiveIntensity: 0.8 }));
        goalPad.position.set(goalPos.x, 0.04, goalPos.z); scene.add(goalPad);
        // ...plus a soft light column rising above the walls so it's findable from anywhere
        goalBeam = new THREE.Mesh(new THREE.CylinderGeometry(CELL*0.32, CELL*0.32, 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x55ff99, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
        goalBeam.position.set(goalPos.x, 4, goalPos.z); scene.add(goalBeam);
        const mkBall = (col, op) => new THREE.Mesh(new THREE.SphereGeometry(R, 28, 22), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: op, roughness: 0.12, metalness: 0, clearcoat: 1, emissive: col, emissiveIntensity: 0.14 }));
        ballMesh = mkBall(role === 'a' ? 0x5db4ff : 0xff9d3d, 0.6); oppMesh = mkBall(role === 'a' ? 0xff9d3d : 0x5db4ff, 0.38);
        scene.add(ballMesh); scene.add(oppMesh);
    };
    const buildMaze = () => {
        while (mazeGroup.children.length) { const m = mazeGroup.children.pop(); m.geometry.dispose(); mazeGroup.remove(m); }
        OBST.forEach(o => { const m = new THREE.Mesh(new THREE.BoxGeometry(o.hw*2, 1.4, o.hd*2), wallMat); m.position.set(o.x, 0.7, o.z); mazeGroup.add(m); });
    };
    const render3 = () => {
        if (!renderer) return;
        if (mazeBuiltFor !== curSeed && OBST.length) { buildMaze(); mazeBuiltFor = curSeed; }
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 320);   // gentle glow pulse on the goal
        if (goalPad) goalPad.material.emissiveIntensity = 0.5 + 0.7 * pulse;
        if (goalBeam) goalBeam.material.opacity = 0.1 + 0.16 * pulse;
        if (bk) { ballMesh.position.set(bk.x, R, bk.z); ballMesh.rotation.x = bk.rx; ballMesh.rotation.z = bk.rz; }
        oppMesh.position.set(opp.x, R, opp.z);
        renderer.render(scene, cam);
    };

    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Roll through the maze to the green goal!'; }
        if (phase === 'race' && bk) sim(dt);
        if (bk && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', x: +bk.x.toFixed(2), z: +bk.z.toFixed(2) }); }
        if (phase === 'countdown' && statEl) statEl.textContent = 'Starting in ' + Math.max(0, Math.ceil((countEnd - performance.now())/1000)) + '…';
        render3(); raf = requestAnimationFrame(loop);
    };

    const enableTilt = () => {
        const add = () => { onTilt = (e) => { if (e.gamma == null) return; if (tiltBase == null) tiltBase = e.beta; tiltX = Math.max(-1, Math.min(1, e.gamma/26)); tiltZ = Math.max(-1, Math.min(1, -(e.beta - tiltBase)/22)); }; window.addEventListener('deviceorientation', onTilt); enableBtn.style.display = 'none'; statEl.textContent = 'Tilt to roll!'; };
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted' || p === 'grant') add(); }).catch(() => {});
        else add();
    };

    window.Appmegle.register({
        id: 'ballroller', label: 'Ball Roller (3D)', css: 'apps/ballroller.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b'; mazeBuiltFor = -1; OBST = [];
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
                if (!wrap) return;
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
            scene = cam = renderer = ballMesh = oppMesh = mazeGroup = bk = null; wrap = statEl = enableBtn = ctx = null; tiltBase = null; keyX = keyZ = tiltX = tiltZ = 0; OBST = [];
        },
        onData(msg) {
            if (msg.t === 'p') opp = { x: msg.x, z: msg.z };
            else if (msg.t === 'start') begin(msg.seed);
            else if (msg.t === 'rematch' && auth) newRace();
            else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); }
            else if (msg.t === 'result') finish(msg.w);
        }
    });
})();
