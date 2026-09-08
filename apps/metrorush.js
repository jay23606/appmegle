// Metro Rush — a two-player, three-lane endless-runner race. Each browser
// simulates its own runner for responsive controls while a shared seed produces
// the same course. The caller starts rounds and arbitrates the first finish.
(function () {
    const W = 600, H = 390, HORIZON = 72, GROUND = 340, VIEW = 980, FINISH = 9200;
    const BASE = 300, BOOST = 455, BOOST_SECS = 2.25, GRAV = 1850, JUMP = 690;
    let ctx = null, auth = false, me = 'a', canvas = null, g = null, statEl = null, scoreEl = null, raf = 0;
    let seed = 1, course = [], dist = 0, lane = 1, laneX = 1, jumpY = 0, jumpV = 0, sliding = 0, boost = 0, crash = 0;
    let phase = 'idle', winner = null, round = 0, wins = { a: 0, b: 0 }, hit = new Set(), collected = new Set();
    let opp = { d: 0, l: 1, j: 0, boost: 0, crash: 0 }, lastT = 0, lastSend = 0, countEnd = 0, swipe = null, onKey = null;
    const rndFor = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    const build = (sd) => {
        const rnd = rndFor(sd); course = []; let x = 520;
        while (x < FINISH - 300) {
            const lanes = [0, 1, 2].sort(() => rnd() - .5), difficulty = x / FINISH;
            const count = rnd() < .22 + difficulty * .2 ? 2 : 1;
            for (let i = 0; i < count; i++) {
                const r = rnd(), type = r < .43 ? 'barrier' : r < .73 ? 'sign' : 'train';
                course.push({ x, lane: lanes[i], type });
            }
            const clear = lanes.slice(count);
            if (clear.length && rnd() < .42) course.push({ x: x + 72, lane: clear[(rnd() * clear.length) | 0], type: 'boost' });
            x += Math.max(175, 260 - difficulty * 65) + rnd() * 90;
        }
    };
    const begin = (sd, n, tally) => {
        seed = sd; round = n || round + 1; if (tally) wins = { a: tally.a || 0, b: tally.b || 0 };
        build(seed); dist = 0; lane = laneX = 1; jumpY = jumpV = sliding = boost = crash = 0;
        hit = new Set(); collected = new Set(); winner = null; opp = { d: 0, l: 1, j: 0, boost: 0, crash: 0 };
        phase = 'count'; countEnd = performance.now() + 1200; renderScore();
    };
    const newRound = () => {
        if (!auth) return ctx.send({ t: 'roundreq' });
        const sd = (Math.random() * 0x7fffffff) | 0, n = round + 1;
        ctx.send({ t: 'start', seed: sd, round: n, wins }); begin(sd, n, wins);
    };
    const declare = (who) => {
        if (winner) return; winner = who; wins[who]++; phase = 'finished';
        ctx.send({ t: 'result', w: who, wins, round }); renderScore();
    };
    const finish = () => {
        if (phase !== 'run') return;
        phase = 'waiting';
        if (auth) declare('a'); else ctx.send({ t: 'finish' });
    };
    const changeLane = (dir) => { if (phase === 'run' || phase === 'count') lane = Math.max(0, Math.min(2, lane + dir)); };
    const jump = () => { if (phase === 'idle') return newRound(); if (phase === 'finished') return; if (jumpY <= 0 && sliding <= 0) jumpV = JUMP; };
    const slide = () => { if (jumpY < 18) sliding = .62; };

    const step = (dt) => {
        if (phase !== 'run') return;
        laneX += (lane - laneX) * Math.min(1, dt * 14);
        if (boost > 0) boost -= dt; if (crash > 0) crash -= dt; if (sliding > 0) sliding -= dt;
        if (jumpV || jumpY > 0) { jumpY += jumpV * dt; jumpV -= GRAV * dt; if (jumpY <= 0) jumpY = jumpV = 0; }
        const speed = crash > 0 ? BASE * .28 : (boost > 0 ? BOOST : BASE);
        dist += speed * dt;
        for (let i = 0; i < course.length; i++) {
            const o = course[i], dz = o.x - dist;
            if (dz < -24 || dz > 38 || Math.abs(laneX - o.lane) > .34) continue;
            if (o.type === 'boost') {
                if (!collected.has(i)) { collected.add(i); boost = BOOST_SECS; ctx.send({ t: 'boost' }); }
                continue;
            }
            if (hit.has(i)) continue;
            const safe = o.type === 'barrier' ? jumpY > 48 : o.type === 'sign' ? sliding > .08 : false;
            if (!safe) { hit.add(i); crash = .75; boost = 0; ctx.send({ t: 'crash' }); }
        }
        if (dist >= FINISH) finish();
    };

    const project = (z, ln) => {
        const p = Math.max(0, Math.min(1, 1 - z / VIEW)), y = HORIZON + p * (GROUND - HORIZON);
        const spread = 18 + p * 128;
        return { x: W / 2 + (ln - 1) * spread, y, p };
    };
    const runner = (x, y, scale, color, slideNow, glow) => {
        g.save(); g.translate(x, y); g.scale(scale, scale); if (glow) { g.shadowColor = glow; g.shadowBlur = 20; }
        g.fillStyle = color;
        if (slideNow) { g.beginPath(); g.roundRect(-19, -21, 38, 21, 8); g.fill(); }
        else { g.beginPath(); g.arc(0, -38, 9, 0, Math.PI * 2); g.fill(); g.lineWidth = 7; g.strokeStyle = color; g.beginPath(); g.moveTo(0, -28); g.lineTo(0, -10); g.moveTo(0, -22); g.lineTo(-12, -12); g.moveTo(0, -10); g.lineTo(-10, 1); g.moveTo(0, -10); g.lineTo(11, 1); g.stroke(); }
        g.restore();
    };
    const drawObject = (o, i) => {
        const z = o.x - dist; if (z < -35 || z > VIEW) return; const q = project(z, o.lane), s = .22 + q.p * .95;
        g.save(); g.translate(q.x, q.y); g.scale(s, s);
        if (o.type === 'boost') { if (!collected.has(i)) { g.shadowColor = '#ffe45e'; g.shadowBlur = 18; g.fillStyle = '#ffd83d'; g.beginPath(); g.moveTo(0,-34); g.lineTo(15,-10); g.lineTo(5,-10); g.lineTo(18,8); g.lineTo(-12,-5); g.lineTo(-2,-5); g.closePath(); g.fill(); } }
        else if (o.type === 'barrier') { g.fillStyle = '#ff7043'; g.fillRect(-25, -35, 50, 35); g.fillStyle = '#fff'; for (let x = -22; x < 22; x += 16) { g.save(); g.translate(x,-18); g.rotate(-.55); g.fillRect(-3,-20,6,40); g.restore(); } }
        else if (o.type === 'sign') { g.fillStyle = '#ffc83d'; g.fillRect(-34, -64, 68, 20); g.fillStyle = '#666'; g.fillRect(-29,-44,5,44); g.fillRect(24,-44,5,44); }
        else { g.fillStyle = '#ef3f67'; g.beginPath(); g.roundRect(-31,-88,62,88,8); g.fill(); g.fillStyle = '#bdeaff'; g.fillRect(-22,-76,44,23); g.fillStyle = '#1b2140'; g.fillRect(-22,-40,44,7); }
        g.restore();
    };
    const draw = () => {
        if (!g) return; const grad = g.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#321b68'); grad.addColorStop(.52,'#ff758c'); grad.addColorStop(1,'#10182c'); g.fillStyle = grad; g.fillRect(0,0,W,H);
        // Skyline and converging three-lane track.
        g.fillStyle = 'rgba(15,20,48,.7)'; for (let x = 0; x < W; x += 42) g.fillRect(x, 25 + ((x*13)%55), 34, HORIZON - 12);
        g.fillStyle = '#22283b'; g.beginPath(); g.moveTo(W/2-35,HORIZON); g.lineTo(40,H); g.lineTo(W-40,H); g.lineTo(W/2+35,HORIZON); g.fill();
        g.strokeStyle = '#edf2ff55'; g.lineWidth = 2; [-.5,.5].forEach(k => { g.beginPath(); g.moveTo(W/2 + k*36,HORIZON); g.lineTo(W/2 + k*258,H); g.stroke(); });
        const stripe = dist % 115; for (let z = 60 - stripe; z < VIEW; z += 115) { if (z < 0) continue; const a=project(z,0), b=project(z,2); g.strokeStyle='#ffffff18'; g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); }
        for (let i = course.length - 1; i >= 0; i--) drawObject(course[i], i);
        if (opp.d > dist - 60 && opp.d < dist + VIEW) { const q = project(opp.d-dist, opp.l); runner(q.x, q.y-opp.j*q.p, .25+q.p*.75, me==='a'?'#ff9d3d':'#5db4ff', false, null); }
        const myX = project(0,laneX).x; runner(myX, GROUND-jumpY, 1, me==='a'?'#5db4ff':'#ff9d3d', sliding>0, boost>0?'#ffe45e':null);
        g.fillStyle='#ffffff24'; g.fillRect(18,16,W-36,7); g.fillStyle=me==='a'?'#5db4ff':'#ff9d3d'; g.fillRect(18,16,(W-36)*Math.min(1,dist/FINISH),7); g.fillStyle=me==='a'?'#ff9d3d':'#5db4ff'; g.fillRect(18+(W-36)*Math.min(1,opp.d/FINISH)-4,12,8,15);
        g.fillStyle='#fff'; g.font='bold 13px system-ui'; g.textAlign='right'; g.fillText('🏁',W-15,27);
        if (boost>0) { g.textAlign='center'; g.font='bold 17px system-ui'; g.fillStyle='#ffe45e'; g.fillText('⚡ SPEED BOOST '+boost.toFixed(1)+'s',W/2,48); }
        if (crash>0) { g.fillStyle='rgba(255,40,60,.2)'; g.fillRect(0,0,W,H); }
        if (phase==='count') { g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 38px system-ui'; g.fillText('GET READY!',W/2,H/2); }
        if (phase==='idle') { g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 25px system-ui'; g.fillText('Metro Rush',W/2,H/2-10); g.font='14px system-ui'; g.fillText('switch lanes · jump barriers · slide under signs',W/2,H/2+20); }
        if (phase==='finished' || phase==='waiting') { g.fillStyle='#0009'; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 38px system-ui'; g.fillText(phase==='waiting'?'Finished!':winner===me?'🏆 YOU WIN!':'They win',W/2,H/2); }
    };
    const renderScore = () => { if (scoreEl) scoreEl.textContent = `Round ${round || '–'}  ·  You ${wins[me]} – ${wins[me==='a'?'b':'a']} Them`; };
    const status = () => { if (!statEl) return; statEl.textContent = phase==='idle' ? 'Three-lane runner race' : phase==='finished' ? (winner===me?'🏆 Round won!':'Round lost') : phase==='waiting' ? 'Finished — waiting…' : `${Math.min(100,Math.round(dist/FINISH*100))}% · them ${Math.min(100,Math.round(opp.d/FINISH*100))}%`; };
    const loop = (t) => { const dt=Math.min(.035,(t-lastT)/1000||0); lastT=t; if(phase==='count'&&performance.now()>=countEnd)phase='run'; step(dt); if (phase==='run' && t-lastSend>80) { lastSend=t; ctx.send({t:'p',d:Math.round(dist),l:+laneX.toFixed(2),j:Math.round(jumpY),boost:boost>0,crash:crash>0}); } draw(); status(); raf=requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'metrorush', label: 'Metro Rush', css: 'apps/metrorush.css',
        mount(c) {
            ctx=c; auth=ctx.amCaller; me=auth?'a':'b'; phase='idle'; winner=null; round=0; wins={a:0,b:0};
            ctx.root.innerHTML='<div class="app-col mr-wrap"><div class="app-bar"><span class="stat"></span><strong class="mr-score"></strong><button class="app-btn nb">New round</button></div><canvas id="mr-canvas" width="'+W+'" height="'+H+'"></canvas><div id="mr-pad"><button data-a="left">◀</button><button data-a="jump">⬆ Jump</button><button data-a="slide">⬇ Slide</button><button data-a="right">▶</button></div><div class="mr-hint">swipe or use arrows/WASD · collect ⚡ for a momentary speed boost</div></div>';
            canvas=ctx.root.querySelector('#mr-canvas'); g=canvas.getContext('2d'); statEl=ctx.root.querySelector('.stat'); scoreEl=ctx.root.querySelector('.mr-score'); renderScore();
            ctx.root.querySelector('.nb').addEventListener('click',newRound);
            const act=(a)=>{if(a==='left')changeLane(-1);else if(a==='right')changeLane(1);else if(a==='jump')jump();else slide();};
            ctx.root.querySelectorAll('#mr-pad button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();act(b.dataset.a);}));
            canvas.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
            canvas.addEventListener('pointerup',e=>{if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return jump();if(Math.abs(dx)>Math.abs(dy))changeLane(dx>0?1:-1);else if(dy<0)jump();else slide();});
            onKey=e=>{if(e.repeat)return;const k=e.code;if(k==='ArrowLeft'||k==='KeyA')changeLane(-1);else if(k==='ArrowRight'||k==='KeyD')changeLane(1);else if(k==='ArrowUp'||k==='KeyW'||k==='Space')jump();else if(k==='ArrowDown'||k==='KeyS')slide();else return;e.preventDefault();}; window.addEventListener('keydown',onKey);
            lastT=performance.now();raf=requestAnimationFrame(loop);if(auth)newRound();
        },
        unmount(){cancelAnimationFrame(raf);window.removeEventListener('keydown',onKey);ctx=canvas=g=statEl=scoreEl=null;course=[];},
        onData(msg){
            if(msg.t==='start'&&!auth)begin(msg.seed,msg.round,msg.wins);
            else if(msg.t==='roundreq'&&auth)newRound();
            else if(msg.t==='p')opp={d:msg.d||0,l:Number(msg.l)||0,j:msg.j||0,boost:!!msg.boost,crash:!!msg.crash};
            else if(msg.t==='finish'&&auth&&!winner)declare('b');
            else if(msg.t==='result'){winner=msg.w;wins={a:msg.wins?.a||0,b:msg.wins?.b||0};round=msg.round||round;phase='finished';renderScore();}
        }
    });
})();
