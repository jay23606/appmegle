// 3D Tic-Tac-Toe (4x4x4 "Qubic") for appmegle. Turn-based move-exchange (both clients keep
// the board and apply the same moves, like 2D tic-tac-toe). Get 4 in a row along any line
// in 3D — rows, columns, pillars, and the many 3D diagonals (76 winning lines). Drag to
// rotate the glass cube, tap a cell to drop your marble. Caller = blue, answerer = orange.
(function () {
    const ensureThree = () => new Promise((res) => { if (window.THREE) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.149.0/build/three.min.js'; s.onload = () => res(); document.head.appendChild(s); });
    const N = 4, S = 2.1, idx = (x, y, z) => x + N*y + N*N*z;
    const LINES = (() => {
        const dirs = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            if (!dx && !dy && !dz) continue; const first = dx || dy || dz; if (first < 0) continue; dirs.push([dx, dy, dz]);
        }
        const inb = (a) => a >= 0 && a < N, lines = [];
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) for (const [dx, dy, dz] of dirs) {
            if (inb(x-dx) && inb(y-dy) && inb(z-dz)) continue;                       // not a line start
            if (!(inb(x+3*dx) && inb(y+3*dy) && inb(z+3*dz))) continue;
            const l = []; for (let t = 0; t < 4; t++) l.push(idx(x+t*dx, y+t*dy, z+t*dz)); lines.push(l);
        }
        return lines;
    })();

    let ctx = null, auth = false, me = 'a', board = [], turn = 'a', over = false, winner = null;
    let THREE, scene, cam, renderer, group, raf = 0, hitS = [], marbles = [], statEl = null, wrap = null;
    let rotX = -0.4, rotY = 0.6, dragging = false, moved = 0, lx = 0, ly = 0, onResize = null;
    const COLA = 0x5db4ff, COLB = 0xff9d3d;

    const wins = (p) => LINES.some(l => l.every(i => board[i] === p));
    const status = () => { if (!statEl) return; statEl.textContent = over ? (winner === me ? '🏆 You win!' : winner ? 'You lose' : 'Draw') : (turn === me ? 'Your turn — tap a cell' : 'Their turn'); };
    const refresh = () => { for (let i = 0; i < 64; i++) { const m = marbles[i]; if (!m) continue; m.visible = !!board[i]; if (board[i]) m.material.color.setHex(board[i] === 'a' ? COLA : COLB); } };
    const apply = (i) => { if (over || board[i]) return; board[i] = turn; if (wins(turn)) { over = true; winner = turn; } else if (board.every(c => c)) over = true; turn = turn === 'a' ? 'b' : 'a'; refresh(); status(); };
    const place = (i) => { if (over || turn !== me || board[i]) return; ctx.send({ t: 'move', i }); apply(i); };
    const newGame = (bcast) => { board = Array(64).fill(''); turn = 'a'; over = false; winner = null; if (bcast) ctx.send({ t: 'reset' }); refresh(); status(); };

    const build = () => {
        THREE = window.THREE; scene = new THREE.Scene();
        const w = wrap.clientWidth || 600, h = wrap.clientHeight || 500;
        cam = new THREE.PerspectiveCamera(50, w/h, 0.1, 200); cam.position.set(0, 0, 17);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2)); renderer.setSize(w, h); renderer.setClearColor(0, 0); wrap.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 8, 10); scene.add(dl);
        group = new THREE.Group(); scene.add(group);
        const mkPos = (i) => { const x = i % N, y = (i >> 2) % N, z = (i >> 4) % N; return [(x-1.5)*S, (y-1.5)*S, (z-1.5)*S]; };
        const markMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.25, wireframe: true });
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        for (let i = 0; i < 64; i++) {
            const p = mkPos(i);
            const mk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), markMat); mk.position.set(...p); group.add(mk);
            const mb = new THREE.Mesh(new THREE.SphereGeometry(0.66, 24, 18), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.7, roughness: 0.1, clearcoat: 1, emissiveIntensity: 0.15 })); mb.position.set(...p); mb.visible = false; group.add(mb); marbles[i] = mb;
            const hs = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), hitMat); hs.position.set(...p); hs.userData.i = i; group.add(hs); hitS.push(hs);
        }
        // faint frame
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S*N, S*N, S*N)), new THREE.LineBasicMaterial({ color: 0x6699bb, transparent: true, opacity: 0.2 })); group.add(frame);
    };
    const pickAt = (e) => {
        const r = wrap.getBoundingClientRect(), rc = new THREE.Raycaster();
        const nd = new THREE.Vector2(((e.clientX-r.left)/r.width)*2 - 1, -((e.clientY-r.top)/r.height)*2 + 1);
        rc.setFromCamera(nd, cam); const hit = rc.intersectObjects(hitS, false);
        if (hit.length) place(hit[0].object.userData.i);
    };
    const loop = () => { if (group) { group.rotation.x = rotX; group.rotation.y = rotY; } if (renderer) renderer.render(scene, cam); raf = requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'qubic', label: '3D Tic-Tac-Toe', css: 'apps/qubic.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; me = auth ? 'a' : 'b'; hitS = []; marbles = [];
            ctx.root.innerHTML = '<div class="app-col"><div class="app-bar"><span class="stat"></span><button class="app-btn nb">New game</button></div><div id="q3-wrap"></div><div class="q3-hint">drag to rotate · tap a spot to place</div></div>';
            wrap = ctx.root.querySelector('#q3-wrap'); statEl = ctx.root.querySelector('.stat');
            ctx.root.querySelector('.nb').addEventListener('click', () => newGame(true));
            ensureThree().then(() => {
                if (!wrap) return; build(); newGame(false);
                wrap.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; });
                wrap.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX-lx, dy = e.clientY-ly; moved += Math.abs(dx)+Math.abs(dy); rotY += dx*0.01; rotX += dy*0.01; rotX = Math.max(-1.2, Math.min(1.2, rotX)); lx = e.clientX; ly = e.clientY; });
                wrap.addEventListener('pointerup', (e) => { dragging = false; if (moved < 6) pickAt(e); });
                onResize = () => { if (!renderer || !wrap) return; const w = wrap.clientWidth, h = wrap.clientHeight; cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w, h); };
                window.addEventListener('resize', onResize); raf = requestAnimationFrame(loop);
            });
        },
        unmount() { cancelAnimationFrame(raf); if (onResize) window.removeEventListener('resize', onResize); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } scene = cam = renderer = group = wrap = statEl = ctx = null; hitS = []; marbles = []; },
        onData(msg) { if (msg.t === 'move') apply(msg.i); else if (msg.t === 'reset') newGame(false); }
    });
})();
