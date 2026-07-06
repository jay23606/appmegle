// Egg Buddy (2-player co-op toy) for appmegle. A creature that hatches when you both start it
// and lives ONLY during this call — feed it, play with it, wash it (either of you can), name it
// together, watch it grow egg → hatchling → kid → grown-up... and when someone hits Next, it's
// gone forever. Ephemerality as a feature. Caller simulates; both send taps. No winners.
(function () {
    const W = 300, H = 300;
    let ctx = null, auth = false, raf = 0, canvas = null, g = null, statEl = null, ctrlEl = null, lastT = 0, lastSend = 0;
    let st = null;   // {born, hunger, fun, clean, name, sadFor, gone}
    const fresh = () => ({ born: performance.now(), hunger: 90, fun: 90, clean: 90, name: '', sadFor: 0, gone: false });
    const stageOf = () => { const age = (performance.now() - st.born)/1000; return age < 25 ? 0 : age < 110 ? 1 : age < 240 ? 2 : 3; };
    const mood = () => st.gone ? 0 : Math.min(st.hunger, st.fun, st.clean);
    const act = (k) => { if (!st || st.gone) return; if (!auth) return ctx.send({ t: 'act', k }); apply(k); };
    const apply = (k) => { if (!st || st.gone) return; if (k === 'feed') st.hunger = Math.min(100, st.hunger + 34); if (k === 'play') st.fun = Math.min(100, st.fun + 34); if (k === 'wash') st.clean = Math.min(100, st.clean + 34); };
    const setName = (n) => { if (!st) return; st.name = n.slice(0, 14); if (!auth) ctx.send({ t: 'name', n: st.name }); else ctx.send({ t: 's', v: pack() }); rebuild(); };
    const pack = () => ({ age: (performance.now() - st.born)/1000, hunger: Math.round(st.hunger), fun: Math.round(st.fun), clean: Math.round(st.clean), name: st.name, gone: st.gone });
    const step = (dt) => {
        if (!auth || !st || st.gone) return;
        st.hunger = Math.max(0, st.hunger - 1.1*dt); st.fun = Math.max(0, st.fun - 1.4*dt); st.clean = Math.max(0, st.clean - 0.8*dt);
        if (st.hunger < 12 && st.fun < 12 && st.clean < 12) { st.sadFor += dt; if (st.sadFor > 18) { st.gone = true; ctx.send({ t: 's', v: pack() }); rebuild(); } } else st.sadFor = 0;
    };
    const draw = (t) => {
        if (!g || !st) return; g.clearRect(0, 0, W, H);
        const stg = stageOf(), m = mood(), cx = W/2, bounce = st.gone ? 0 : Math.sin(t/300)*(m > 40 ? 6 : 2), cy = H/2 + 14 + bounce;
        if (st.gone) { g.fillStyle = '#fff'; g.font = 'bold 17px system-ui'; g.textAlign = 'center'; g.fillText('💨 ' + (st.name || 'your buddy') + ' ran away…', cx, H/2); g.font = '13px system-ui'; g.fillText('you both stopped caring 💔', cx, H/2 + 24); return; }
        const R = [34, 30, 40, 52][stg];
        if (stg === 0) {   // egg
            g.fillStyle = 'rgba(255,250,235,.92)'; g.beginPath(); g.ellipse(cx, cy, R*0.82, R, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
            const age = (performance.now() - st.born)/1000; g.strokeStyle = 'rgba(120,90,60,.7)'; g.lineWidth = 2;
            if (age > 8) { g.beginPath(); g.moveTo(cx-12, cy-6); g.lineTo(cx-4, cy+2); g.lineTo(cx+6, cy-8); g.stroke(); }
            if (age > 17) { g.beginPath(); g.moveTo(cx+2, cy+10); g.lineTo(cx+12, cy+4); g.stroke(); }
            g.fillStyle = '#fff'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText('keep it warm… 🥚', cx, cy + R + 24);
        } else {
            const hue = 150 + (st.name.length*17) % 120;   // its color comes from the name you gave it
            g.fillStyle = 'hsla(' + hue + ',60%,58%,.92)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
            if (stg >= 2) { g.beginPath(); g.arc(cx - R*0.75, cy - R*0.9, R*0.28, 0, 7); g.arc(cx + R*0.75, cy - R*0.9, R*0.28, 0, 7); g.fill(); }   // ears
            if (stg === 3) { g.fillStyle = '#ffd24a'; g.font = (R*0.5|0) + 'px system-ui'; g.textAlign = 'center'; g.fillText('👑', cx, cy - R - 6); }
            g.fillStyle = '#1b1b28'; g.beginPath(); g.arc(cx - R*0.34, cy - R*0.15, R*0.11, 0, 7); g.arc(cx + R*0.34, cy - R*0.15, R*0.11, 0, 7); g.fill();
            g.strokeStyle = '#1b1b28'; g.lineWidth = 2.5; g.beginPath();
            if (m > 55) g.arc(cx, cy + R*0.18, R*0.3, 0.15*Math.PI, 0.85*Math.PI);
            else if (m > 25) { g.moveTo(cx - R*0.25, cy + R*0.32); g.lineTo(cx + R*0.25, cy + R*0.32); }
            else g.arc(cx, cy + R*0.5, R*0.28, 1.15*Math.PI, 1.85*Math.PI);
            g.stroke();
            if (st.clean < 30) { g.fillStyle = 'rgba(120,150,60,.7)'; g.font = '16px system-ui'; g.fillText('🦟', cx + R*0.9, cy - R*0.5); }
            if (st.hunger < 30) { g.font = '15px system-ui'; g.fillText('💭🍔', cx - R*1.2, cy - R*0.8); }
        }
        const bar = (x, v, lbl, col) => { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, 14, 76, 9); g.fillStyle = col; g.fillRect(x, 14, 76*v/100, 9); g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'left'; g.fillText(lbl, x, 36); };
        bar(8, st.hunger, '🍔 food', '#ff9d3d'); bar(112, st.fun, '🎈 fun', '#5db4ff'); bar(216, st.clean, '🧼 clean', '#7be08a');
        if (st.name) { g.fillStyle = '#fff'; g.font = 'bold 15px system-ui'; g.textAlign = 'center'; g.fillText(st.name + ['  🥚','','  ✨','  👑'][stg], cx, H - 10); }
    };
    const rebuild = () => {
        if (!ctrlEl || !st) return;
        statEl.textContent = st.gone ? 'gone forever' : ['incubating…', 'it hatched!!', 'growing up', 'all grown up'][stageOf()] + (st.name ? ' · ' + st.name : '');
        ctrlEl.innerHTML = st.gone ? '<button class="app-btn" id="eb-new">New egg</button>'
            : '<div class="eb-btns"><button class="eb-a" data-k="feed">🍔 Feed</button><button class="eb-a" data-k="play">🎈 Play</button><button class="eb-a" data-k="wash">🧼 Wash</button></div>' + (st.name ? '' : '<div class="eb-nm"><input id="eb-n" maxlength="14" placeholder="name it together…"><button class="app-btn" id="eb-set">Name</button></div>');
        ctrlEl.querySelectorAll('.eb-a').forEach(b => b.addEventListener('click', () => act(b.dataset.k)));
        const sn = ctrlEl.querySelector('#eb-set'); if (sn) sn.addEventListener('click', () => { const n = ctrlEl.querySelector('#eb-n').value.trim(); if (n) setName(n); });
        const nw = ctrlEl.querySelector('#eb-new'); if (nw) nw.addEventListener('click', () => { if (auth) { st = fresh(); ctx.send({ t: 's', v: pack() }); rebuild(); } else ctx.send({ t: 'newreq' }); });
    };
    const loop = (t) => { const dt = Math.min(0.1, (t - lastT)/1000 || 0); lastT = t; step(dt); if (auth && st && t - lastSend > 600) { lastSend = t; ctx.send({ t: 's', v: pack() }); } draw(t); raf = requestAnimationFrame(loop); };
    window.Appmegle.register({
        id: 'eggbuddy', label: 'Egg Buddy', css: 'apps/eggbuddy.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller;
            ctx.root.innerHTML = '<div class="app-col" id="eb"><div class="app-bar"><span class="stat"></span></div><canvas id="eb-canvas" width="' + W + '" height="' + H + '"></canvas><div id="eb-ctrl"></div><div class="eb-hint">it lives only during this call — when someone leaves, it\'s gone 🥺</div></div>';
            statEl = ctx.root.querySelector('.stat'); canvas = ctx.root.querySelector('#eb-canvas'); g = canvas.getContext('2d'); ctrlEl = ctx.root.querySelector('#eb-ctrl');
            if (auth) { st = fresh(); }
            rebuild(); lastT = performance.now(); raf = requestAnimationFrame(loop);
        },
        unmount() { cancelAnimationFrame(raf); ctx = canvas = g = statEl = ctrlEl = st = null; },
        onData(msg) {
            if (msg.t === 's' && !auth) { const hadName = st && st.name, wasGone = st && st.gone; st = { born: performance.now() - msg.v.age*1000, hunger: msg.v.hunger, fun: msg.v.fun, clean: msg.v.clean, name: msg.v.name, sadFor: 0, gone: msg.v.gone }; if (!ctrlEl) return; if ((msg.v.name && !hadName) || (!msg.v.name && hadName) || msg.v.gone !== wasGone || !ctrlEl.innerHTML) rebuild(); else statEl.textContent = (msg.v.gone ? 'gone forever' : ['incubating…','it hatched!!','growing up','all grown up'][stageOf()] + (st.name ? ' · ' + st.name : '')); }
            else if (msg.t === 'act' && auth) apply(msg.k);
            else if (msg.t === 'name' && auth) setName(msg.n);
            else if (msg.t === 'newreq' && auth) { st = fresh(); ctx.send({ t: 's', v: pack() }); rebuild(); }
        }
    });
})();
