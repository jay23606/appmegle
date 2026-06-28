// Helix Descent (2-player race) for appmegle. A glass ball bounces down a spiral tower of
// ring-platforms; rotate the tower so a gap lines up under the ball and it drops to the next
// level — race to the bottom. Each client runs its own identical (seed-synced) tower and ball
// locally (lag-free; rotate via keys / drag / tilt); the caller arbitrates the finish.
// Caller = blue, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const NUM = 14, SPC = 2.2, RR = 2.4, PR = 1.2, BR = 0.45, GRAV = 22, BOUNCE = 8, ROT = 2.6, SEND = 33;
    const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const norm = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };

    let ctx = null, auth = false, role = 'a', raf = 0, wrap = null, statEl = null, enableBtn = null;
    let THREE, scene, cam, renderer, towerGroup, ballMesh;
    let plats = [], curSeed = 0, builtFor = -1;
    let ball = null, rot = 0, oppD = 0, inRot = 0, tiltR = 0, dragR = 0, dragging = false;
    let phase = 'wait', countEnd = 0, winner = null, lastT = 0, lastSend = 0, onKey = null, onTilt = null, onResize = null;

    const genTower = (seed) => { const rnd = mulberry32(seed >>> 0), p = []; for (let k = 0; k < NUM; k++) p.push({ y: -k*SPC, gap: rnd()*Math.PI*2, w: 0.6 + rnd()*0.6 }); return p; };
    const begin = (seed) => { curSeed = (seed == null ? (Math.random()*4294967296)>>>0 : seed>>>0); plats = genTower(curSeed); ball = { y: SPC, vy: 0, level: 0, fin: false }; rot = 0; oppD = 0; winner = null; phase = 'countdown'; countEnd = performance.now() + 3000; };
    const newRace = () => { if (auth) { begin(); ctx.send({ t: 'start', seed: curSeed }); } else ctx.send({ t: 'rematch' }); };

    const passable = (k) => Math.abs(norm(0 - (plats[k].gap + rot))) < plats[k].w/2;   // gap under the ball (front, angle 0)
    const sim = (dt) => {
        rot += (inRot + tiltR + (dragging ? dragR : 0)) * ROT * dt;
        ball.vy -= GRAV*dt; ball.y += ball.vy*dt;
        if (ball.level < NUM && ball.y <= plats[ball.level].y) {
            if (passable(ball.level)) { ball.level++; }
            else { ball.y = plats[ball.level].y; ball.vy = BOUNCE; }
        }
        if (ball.level >= NUM && !ball.fin) { ball.fin = true; onFinish(); }
    };
    const onFinish = () => { if (phase !== 'race') return; if (auth) setResult('a'); else { phase = 'doneWait'; statEl.textContent = 'Finished! waiting on the judge…'; ctx.send({ t: 'finish' }); } };
    const setResult = (w) => { winner = w; ctx.send({ t: 'result', w }); finish(w); };
    const finish = (w) => { phase = 'done'; statEl.textContent = w === role ? '🏁 You win!' : 'You lose — they hit the bottom first'; };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 460, h = wrap.clientHeight || 600;
        cam = new THREE.PerspectiveCamera(55, w/h, 0.1, 200); cam.position.set(0, 3, 9);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.85)); const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(4, 6, 8); scene.add(dl);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, NUM*SPC + 4, 20), new THREE.MeshStandardMaterial({ color: 0x5577aa, transparent: true, opacity: 0.25 })); pillar.position.y = -NUM*SPC/2 + SPC; scene.add(pillar);
        towerGroup = new THREE.Group(); scene.add(towerGroup);
        const colB = role === 'a' ? 0x5db4ff : 0xff9d3d;
        ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BR, 22, 16), new THREE.MeshPhysicalMaterial({ color: colB, transparent: true, opacity: 0.8, roughness: 0.1, clearcoat: 1, emissive: colB, emissiveIntensity: 0.3 })); scene.add(ballMesh);
    };
    const buildTower = () => {
        while (towerGroup.children.length) { const m = towerGroup.children.pop(); m.geometry.dispose(); }
        plats.forEach((p, k) => { const arc = Math.PI*2 - p.w; const m = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.32, 8, 30, arc), new THREE.MeshStandardMaterial({ color: k === NUM-1 ? 0x55ff99 : 0x88aacc, transparent: true, opacity: 0.55, emissive: k === NUM-1 ? 0x33aa66 : 0x223344, emissiveIntensity: 0.4 })); m.rotation.x = Math.PI/2; m.position.y = p.y; m.rotation.z = -(p.gap + p.w/2); towerGroup.add(m); });
    };
    const render = () => {
        if (!renderer) return;
        if (builtFor !== curSeed && plats.length) { buildTower(); builtFor = curSeed; }
        if (towerGroup) towerGroup.rotation.y = rot;
        if (ball) { ballMesh.position.set(RR, ball.y, 0); cam.position.y += (ball.y + 3 - cam.position.y) * 0.1; cam.lookAt(0, ball.y - 1, 0); }
        renderer.render(scene, cam);
    };
    const loop = (t) => {
        const dt = Math.min(0.033, (t - lastT)/1000 || 0); lastT = t;
        if (phase === 'countdown' && performance.now() >= countEnd) { phase = 'race'; statEl.textContent = 'Rotate to drop through the gaps!'; }
        if (phase === 'race' && ball) sim(dt);
        if (ball && t - lastSend > SEND) { lastSend = t; ctx.send({ t: 'p', d: ball.level }); }
        if (phase === 'countdown' && statEl) statEl.textContent = 'Starting in ' + Math.max(0, Math.ceil((countEnd - performance.now())/1000)) + '…';
        else if (phase === 'race' && statEl && ball) statEl.textContent = 'Depth ' + ball.level + '/' + NUM + ' · Them ' + oppD;
        render(); raf = requestAnimationFrame(loop);
    };
    const enableTilt = () => { const add = () => { onTilt = (e) => { if (e.gamma == null) return; tiltR = Math.max(-1, Math.min(1, -e.gamma/25)); }; window.addEventListener('deviceorientation', onTilt); enableBtn.style.display = 'none'; }; if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted' || p === 'grant') add(); }).catch(() => {}); else add(); };

    window.Appmegle.register({
        id: 'helix', label: 'Helix Descent (3D)', css: 'apps/helix.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; role = auth ? 'a' : 'b'; builtFor = -1; plats = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat">Loading 3D…</span><button class="app-btn tilt">Enable tilt</button><button class="app-btn nb">New race</button></div><div id="hx-wrap"></div><div class="hx-hint">rotate: ◀ ▶ / A D / drag / tilt</div></div>';
            wrap = ctx.root.querySelector('#hx-wrap'); statEl = ctx.root.querySelector('.stat'); enableBtn = ctx.root.querySelector('.tilt');
            if (!('DeviceOrientationEvent' in window)) enableBtn.style.display = 'none';
            enableBtn.addEventListener('click', enableTilt);
            ctx.root.querySelector('.nb').addEventListener('click', newRace);
            onKey = (e) => { const d = e.type === 'keydown' ? 1 : 0; if (e.code === 'ArrowLeft' || e.code === 'KeyA') inRot = d ? 1 : 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') inRot = d ? -1 : 0; else return; e.preventDefault(); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            ensureThree().then(() => {
                if (!wrap) return; build();
                let lastX = 0; wrap.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; dragR = 0; });
                wrap.addEventListener('pointermove', (e) => { if (dragging) { dragR = Math.max(-1, Math.min(1, (e.clientX - lastX) / 40)); } });
                wrap.addEventListener('pointerup', () => { dragging = false; dragR = 0; }); wrap.addEventListener('pointerleave', () => { dragging = false; dragR = 0; });
                onResize = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); }; window.addEventListener('resize', onResize);
                statEl.textContent = auth ? 'Get ready…' : 'Waiting for the host…';
                lastT = performance.now(); raf = requestAnimationFrame(loop); if (auth) newRace();
            });
        },
        unmount() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); if (onTilt) window.removeEventListener('deviceorientation', onTilt); if (onResize) window.removeEventListener('resize', onResize); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = towerGroup = ballMesh = ball = wrap = statEl = enableBtn = ctx = null; plats = []; tiltR = inRot = 0; },
        onData(msg) { if (msg.t === 'p') oppD = msg.d; else if (msg.t === 'start') begin(msg.seed); else if (msg.t === 'rematch' && auth) newRace(); else if (msg.t === 'finish' && auth) { if (!winner) setResult('b'); } else if (msg.t === 'result') finish(msg.w); }
    });
})();
