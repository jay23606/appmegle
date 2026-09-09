// Metro Rush — a two-player, three-lane endless-runner race. Each browser
// simulates its own runner for responsive controls while a shared seed produces
// the same course. The caller starts rounds and arbitrates the first finish.
(function () {
    const W = 600, H = 390, HORIZON = 72, GROUND = 340, VIEW = 980, FINISH = 9200;
    const BASE = 300, BOOST = 455, BOOST_SECS = 2.25, GRAV = 1850, JUMP = 690;
    const THEMES = [
        ['#321b68','#ff758c','#10182c','#22283b'], ['#063c4a','#25c6a2','#08192f','#173441'],
        ['#5b230a','#ffb347','#21102f','#3b2730'], ['#10195d','#6d5dfc','#180d2e','#252654'],
        ['#4b123f','#ea4c89','#17152b','#372239'],
    ];
    const THEME_NAMES = ['Neon Rain','Emerald Metro','Sunset Yard','Midnight Express','Candy Skyline'];
    const MODIFIERS = ['Classic Mix','Rush Hour','Coin Frenzy','Power Surge','Precision Run'];
    const SKINS = [['#5db4ff','#eaf7ff'],['#79e06b','#efffe9'],['#ff5f9d','#fff0f7'],['#b889ff','#f6efff'],['#ffb13b','#fff6df']];
    let ctx = null, auth = false, me = 'a', canvas = null, g = null, statEl = null, scoreEl = null, raf = 0;
    let seed = 1, course = [], dist = 0, lane = 1, laneX = 1, jumpY = 0, jumpV = 0, sliding = 0, boost = 0, magnet = 0, shield = 0, draft = 0, crash = 0, coins = 0;
    let phase = 'idle', winner = null, round = 0, wins = { a: 0, b: 0 }, hit = new Set(), collected = new Set(), passed = new Set(), usedSeeds = new Set(), theme = THEMES[0], modifier = 0, champRecorded = false;
    let particles = [], nearText = '', nearTimer = 0, shake = 0, combo = 0, bestCombo = 0, careerBest = Number(localStorage.getItem('mr-best-combo') || 0), matchWins = Number(localStorage.getItem('mr-match-wins') || 0), skin = Number(localStorage.getItem('mr-skin') || 0) % SKINS.length;
    let reducedMotion = localStorage.getItem('mr-reduced-motion') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    let opp = { d: 0, l: 1, j: 0, boost: 0, magnet: 0, shield: 0, crash: 0, coins: 0, combo: 0 }, lastT = 0, lastSend = 0, countEnd = 0, swipe = null, onKey = null;
    let oppView = { d: 0, l: 1, j: 0 };
    const rndFor = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

    const build = (sd) => {
        const rnd = rndFor(sd); course = []; theme = THEMES[Math.abs(sd) % THEMES.length];modifier=(sd>>>5)%MODIFIERS.length;
        let x = 460 + rnd() * 170, rhythm = .82 + rnd() * .42;
        while (x < FINISH - 300) {
            const lanes = [0, 1, 2], difficulty = x / FINISH;
            for (let i = lanes.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
            const count = rnd() < .16 + difficulty * .27 + (modifier===4?.08:0) ? 2 : 1;
            for (let i = 0; i < count; i++) {
                const r = rnd(), trainAt=modifier===1?.52:.73, type = r < .43 ? 'barrier' : r < trainAt ? 'sign' : 'train';
                course.push({ x, lane: lanes[i], type });
            }
            const clear = lanes.slice(count);
            const powerChance=.34+difficulty*.18+(modifier===3?.25:0)-(modifier===2?.12:0);
            if (clear.length && rnd() < powerChance) { const p=rnd(),type=p<(modifier===3?.72:.58)?'boost':p<.84?'magnet':'shield';course.push({ x: x + 48 + rnd() * 72, lane: clear[(rnd() * clear.length) | 0], type }); }
            else if (clear.length && rnd() < (modifier===2?.9:.62)) {
                const coinLane = clear[(rnd() * clear.length) | 0], n = 3 + ((rnd() * 3) | 0);
                for (let i = 0; i < n; i++) course.push({ x: x + 42 + i * 34, lane: coinLane, type: 'coin' });
                x += n * 20;
            }
            if (rnd() < .13) rhythm = .78 + rnd() * .5;
            x += (Math.max(165,270-difficulty*72)+rnd()*105)*rhythm*(modifier===4?.88:1);
        }
        course.sort((a,b)=>a.x-b.x);
    };
    const begin = (sd, n, tally) => {
        seed = sd; round = n || round + 1; if (tally) wins = { a: tally.a || 0, b: tally.b || 0 };
        build(seed); dist = 0; lane = laneX = 1; jumpY = jumpV = sliding = boost = magnet = shield = draft = crash = coins = 0;
        hit = new Set(); collected = new Set(); passed = new Set(); particles = []; nearText = ''; nearTimer = shake = combo = bestCombo = 0; winner = null; opp = { d: 0, l: 1, j: 0, boost: 0, magnet: 0, shield: 0, crash: 0, coins: 0, combo: 0, skin: 0 };oppView={d:0,l:1,j:0};
        phase = 'count'; countEnd = performance.now() + 3200; renderScore();
    };
    const newRound = () => {
        if (!auth) return ctx.send({ t: 'roundreq' });
        if(Math.max(wins.a,wins.b)>=3){wins={a:0,b:0};round=0;champRecorded=false;}
        // Mix cryptographic entropy, time and round number, then explicitly reject
        // every seed already used in this call. Both peers still receive one shared
        // seed, so their newly generated obstacle course remains identical.
        let sd;
        do {
            const entropy = crypto.getRandomValues(new Uint32Array(1))[0];
            sd = (entropy ^ Date.now() ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;
        } while (usedSeeds.has(sd));
        usedSeeds.add(sd);
        const n = round + 1;
        ctx.send({ t: 'start', seed: sd, round: n, wins }); begin(sd, n, wins);
    };
    const declare = (who) => {
        if (winner) return; winner = who; wins[who]++; phase = 'finished';
        burst(W / 2, H / 2, 70, ['#ffe45e','#5db4ff','#ff5f8f','#76f7c4']);
        if(wins[who]>=3){burst(W/2,H/2,120,['#ffe45e','#fff','#ff5f9d','#75eaff']);recordChampion(who);}
        ctx.send({ t: 'result', w: who, wins, round }); renderScore();
    };
    const recordChampion = (who) => { if(champRecorded)return;champRecorded=true;if(who===me){matchWins++;localStorage.setItem('mr-match-wins',matchWins);} };
    const finish = () => {
        if (phase !== 'run') return;
        phase = 'waiting';
        if (auth) declare('a'); else ctx.send({ t: 'finish' });
    };
    const changeLane = (dir) => { if (phase === 'run' || phase === 'count') lane = Math.max(0, Math.min(2, lane + dir)); };
    const jump = () => { if (phase === 'idle') return newRound(); if (phase === 'finished') return; if (jumpY <= 0 && sliding <= 0) jumpV = JUMP; };
    const slide = () => { if (jumpY < 18) sliding = .62; };
    const nextSkin = () => { skin=(skin+1)%SKINS.length;localStorage.setItem('mr-skin',skin); };
    const toggleFx = () => { reducedMotion=!reducedMotion;localStorage.setItem('mr-reduced-motion',reducedMotion?'1':'0');updateButtons(); };
    const toggleSound = () => { window.AppmegleSound?.toggle?.();updateButtons(); };
    const updateButtons = () => { if(!ctx?.root)return;const fx=ctx.root.querySelector('.fx'),snd=ctx.root.querySelector('.snd');if(fx)fx.textContent=reducedMotion?'FX low':'FX full';if(snd)snd.textContent=window.AppmegleSound?.muted?'Sound off':'Sound on'; };
    const buzz = (pattern) => { if(!reducedMotion)navigator.vibrate?.(pattern); };
    const burst = (x, y, n, colors) => { if(reducedMotion)n=Math.ceil(n*.25);for (let i=0;i<n;i++) particles.push({x,y,vx:(Math.random()-.5)*330,vy:-70-Math.random()*260,life:.55+Math.random()*.8,col:colors[i%colors.length],size:2+Math.random()*5}); };
    const stepFx = (dt) => { if(nearTimer>0)nearTimer-=dt;if(shake>0)shake-=dt; for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.life-=dt;} particles=particles.filter(p=>p.life>0); };

    const step = (dt) => {
        if (phase !== 'run') return;
        laneX += (lane - laneX) * Math.min(1, dt * 14);
        if (boost > 0) boost -= dt; if (magnet > 0) magnet -= dt; if (shield > 0) shield -= dt; if (crash > 0) crash -= dt; if (sliding > 0) sliding -= dt;
        if (jumpV || jumpY > 0) { jumpY += jumpV * dt; jumpV -= GRAV * dt; if (jumpY <= 0) jumpY = jumpV = 0; }
        const speed = crash > 0 ? BASE * .28 : (boost > 0 ? BOOST : BASE);
        dist += speed * dt;
        const gap=opp.d-dist,inWake=gap>55&&gap<430&&Math.abs(laneX-opp.l)<.42&&phase==='run';
        draft=Math.max(0,Math.min(1.65,draft+(inWake?dt:-dt*.8)));
        if(draft>=1.65){draft=0;boost=Math.max(boost,1.35);nearText='SLINGSHOT!';nearTimer=.9;burst(project(0,laneX).x,GROUND-25,22,['#75eaff','#fff','#b889ff']);buzz(35);ctx.send({t:'draft'});}
        for (let i = 0; i < course.length; i++) {
            const o = course[i], dz = o.x - dist;
            if (dz < -25 && !passed.has(i)) {
                passed.add(i);
                if (!hit.has(i) && !collected.has(i) && !['coin','boost','magnet','shield'].includes(o.type) && Math.abs(laneX-o.lane)<.58) { combo++;bestCombo=Math.max(bestCombo,combo);if(bestCombo>careerBest){careerBest=bestCombo;localStorage.setItem('mr-best-combo',careerBest);}if(combo%5===0){boost=Math.max(boost,.8);nearText='STREAK BOOST x'+combo;burst(project(0,laneX).x,GROUND-28,18,['#75eaff','#ffe45e','#fff']);buzz(24);ctx.send({t:'streak'});}else nearText=combo>1?'CLEAN x'+combo:'NEAR MISS!';nearTimer=.75; }
            }
            const attracted=o.type==='coin'&&magnet>0&&dz>-15&&dz<155;
            if (dz < -24 || dz > (attracted?155:38) || (!attracted&&Math.abs(laneX - o.lane) > .34)) continue;
            if (o.type === 'coin') {
                if (!collected.has(i)) { collected.add(i); coins++; burst(project(0,laneX).x,GROUND-jumpY-25,7,['#ffe45e','#fff2a6']);if(coins%5===0)buzz(18);ctx.send({t:'coin'}); }
                continue;
            }
            if (o.type === 'boost') {
                if (!collected.has(i)) { collected.add(i); boost = BOOST_SECS; burst(project(0,laneX).x,GROUND-24,18,['#ffe45e','#fff','#75eaff']);buzz(30);ctx.send({ t: 'boost' }); }
                continue;
            }
            if (o.type === 'magnet') {
                if (!collected.has(i)) { collected.add(i); magnet=5.5;nearText='COIN MAGNET';nearTimer=.8;burst(project(0,laneX).x,GROUND-24,18,['#ff5f9d','#fff','#b889ff']);buzz(30);ctx.send({t:'power'}); }
                continue;
            }
            if (o.type === 'shield') {
                if (!collected.has(i)) { collected.add(i); shield=7;nearText='SHIELD READY';nearTimer=.8;burst(project(0,laneX).x,GROUND-24,18,['#5db4ff','#fff','#75eaff']);buzz(30);ctx.send({t:'power'}); }
                continue;
            }
            if (hit.has(i)) continue;
            const safe = o.type === 'barrier' ? jumpY > 48 : o.type === 'sign' ? sliding > .08 : false;
            if (!safe) { hit.add(i);if(shield>0){shield=0;nearText='SHIELD SAVED YOU';nearTimer=.9;burst(project(0,laneX).x,GROUND-30,28,['#5db4ff','#fff','#75eaff']);buzz([25,35,25]);ctx.send({t:'shield'});}else{crash=.75;boost=0;combo=0;shake=reducedMotion?0:.35;burst(project(0,laneX).x,GROUND-30,25,['#ff385c','#ffb347','#fff']);buzz(90);ctx.send({t:'crash'});} }
        }
        if (dist >= FINISH) finish();
    };

    const project = (z, ln) => {
        const p = Math.max(0, Math.min(1, 1 - z / VIEW)), y = HORIZON + p * (GROUND - HORIZON);
        const spread = 18 + p * 128;
        const bend=(Math.sin((dist+z)/760+seed*.00001)*31+Math.sin((dist+z)/1500+seed*.00003)*19)*(1-p);
        return { x: W / 2 + bend + (ln - 1) * spread, y, p };
    };
    const runner = (x, y, scale, color, slideNow, glow, anim=0) => {
        g.save(); g.translate(x, y); g.scale(scale, scale); if (glow) { g.shadowColor = glow; g.shadowBlur = 20; }
        g.fillStyle = color;
        if (glow) { g.fillStyle='#ffe45e';g.beginPath();g.roundRect(-22,-5,44,7,4);g.fill();g.fillStyle=color; }
        if (slideNow) { g.beginPath(); g.roundRect(-19, -21, 38, 21, 8); g.fill(); }
        else { const swing=Math.sin(anim)*12; g.beginPath(); g.arc(0, -38, 9, 0, Math.PI * 2); g.fill(); g.lineWidth = 7; g.lineCap='round';g.strokeStyle = color; g.beginPath(); g.moveTo(0, -28); g.lineTo(0, -10); g.moveTo(0, -22); g.lineTo(-12-swing*.25, -12+swing*.22); g.moveTo(0,-22);g.lineTo(12+swing*.25,-12-swing*.22);g.moveTo(0,-10);g.lineTo(-10-swing*.4,1);g.moveTo(0,-10);g.lineTo(11+swing*.4,1);g.stroke(); }
        g.restore();
    };
    const drawObject = (o, i) => {
        const z = o.x - dist; if (z < -35 || z > VIEW) return; const q = project(z, o.lane), s = .22 + q.p * .95;
        g.save(); g.translate(q.x, q.y); g.scale(s, s);
        if (o.type === 'coin') { if(!collected.has(i)){g.shadowColor='#ffe45e';g.shadowBlur=12;g.fillStyle='#ffd83d';g.beginPath();g.ellipse(0,-24,9,13,0,0,7);g.fill();g.strokeStyle='#fff2a6';g.lineWidth=2;g.stroke();} }
        else if (o.type === 'boost') { if (!collected.has(i)) { g.shadowColor = '#ffe45e'; g.shadowBlur = 18; g.fillStyle = '#ffd83d'; g.beginPath(); g.moveTo(0,-34); g.lineTo(15,-10); g.lineTo(5,-10); g.lineTo(18,8); g.lineTo(-12,-5); g.lineTo(-2,-5); g.closePath(); g.fill(); } }
        else if (o.type === 'magnet') { if(!collected.has(i)){g.shadowColor='#ff5f9d';g.shadowBlur=18;g.strokeStyle='#ff5f9d';g.lineWidth=8;g.beginPath();g.arc(0,-20,15,.1,Math.PI-.1);g.stroke();g.fillStyle='#fff';g.fillRect(-19,-23,8,12);g.fillRect(11,-23,8,12);} }
        else if (o.type === 'shield') { if(!collected.has(i)){g.shadowColor='#75eaff';g.shadowBlur=18;g.fillStyle='#5db4ff';g.beginPath();g.moveTo(0,-43);g.lineTo(20,-34);g.lineTo(16,-8);g.lineTo(0,7);g.lineTo(-16,-8);g.lineTo(-20,-34);g.closePath();g.fill();g.strokeStyle='#fff';g.lineWidth=3;g.stroke();} }
        else if (o.type === 'barrier') { g.fillStyle = '#ff7043'; g.fillRect(-25, -35, 50, 35); g.fillStyle = '#fff'; for (let x = -22; x < 22; x += 16) { g.save(); g.translate(x,-18); g.rotate(-.55); g.fillRect(-3,-20,6,40); g.restore(); } }
        else if (o.type === 'sign') { g.fillStyle = '#ffc83d'; g.fillRect(-34, -64, 68, 20); g.fillStyle = '#666'; g.fillRect(-29,-44,5,44); g.fillRect(24,-44,5,44); }
        else { const bob=Math.sin(performance.now()/130+o.x)*3;g.translate(0,bob);g.fillStyle = '#ef3f67'; g.beginPath(); g.roundRect(-31,-88,62,88,8); g.fill();g.fillStyle='#fff8ad';g.shadowColor='#fff8ad';g.shadowBlur=12;g.beginPath();g.arc(-17,-14,5,0,7);g.arc(17,-14,5,0,7);g.fill();g.shadowBlur=0;g.fillStyle = '#bdeaff'; g.fillRect(-22,-76,44,23); g.fillStyle = '#1b2140'; g.fillRect(-22,-40,44,7); }
        g.restore();
    };
    const draw = () => {
        if (!g) return; g.save(); if(shake>0)g.translate((Math.random()-.5)*12,(Math.random()-.5)*7); const grad = g.createLinearGradient(0,0,0,H); grad.addColorStop(0,theme[0]); grad.addColorStop(.52,theme[1]); grad.addColorStop(1,theme[2]); g.fillStyle = grad; g.fillRect(-15,-10,W+30,H+20);
        // Skyline and converging three-lane track.
        g.fillStyle = 'rgba(15,20,48,.7)'; for (let x = 0; x < W; x += 42) g.fillRect(x, 25 + ((x*13)%55), 34, HORIZON - 12);
        const t=performance.now()/1000;g.fillStyle='#ffffff66';for(let i=0;i<10;i++){const x=(i*83+seed%71)%W,y=18+((i*37)%54);g.beginPath();g.arc(x,y,1.2+Math.sin(t+i)*.6,0,7);g.fill();}
        for(let i=0;i<28;i++){const mode=Math.abs(seed)%THEMES.length,x=(i*73+t*(mode===0?95:mode===2?28:14))%W,y=(i*41+t*(mode===1?34:58))%H;g.fillStyle=mode===1?'#dffcffaa':mode===2?'#ffd18aaa':mode===4?'#ff8bd1aa':'#ffffff66';if(mode===0)g.fillRect(x,y,1,10);else{g.beginPath();g.arc(x,y,mode===1?2.2:1.3,0,7);g.fill();}}
        const far=project(VIEW,1).x,near=project(0,1).x;g.fillStyle = theme[3]; g.beginPath(); g.moveTo(far-35,HORIZON); g.lineTo(near-260,H); g.lineTo(near+260,H); g.lineTo(far+35,HORIZON); g.fill();
        // Repeating neon gantries provide visual landmarks and emphasize speed.
        for(let z=220-(dist%720);z<VIEW;z+=720){if(z<80)continue;const q=project(z,1),s=.2+q.p*.9;g.save();g.translate(q.x,q.y);g.scale(s,s);g.strokeStyle=(Math.floor((dist+z)/720)%2)?'#75eaff99':'#ff5f9d99';g.lineWidth=8;g.shadowColor=g.strokeStyle;g.shadowBlur=10;g.beginPath();g.moveTo(-118,0);g.lineTo(-92,-105);g.lineTo(92,-105);g.lineTo(118,0);g.stroke();g.restore();}
        g.strokeStyle = '#edf2ff55'; g.lineWidth = 2; [-.5,.5].forEach(k => { g.beginPath();for(let z=VIEW;z>=0;z-=45){const q=project(z,1+k);if(z===VIEW)g.moveTo(q.x,q.y);else g.lineTo(q.x,q.y);}g.stroke(); });
        const stripe = dist % 115; for (let z = 60 - stripe; z < VIEW; z += 115) { if (z < 0) continue; const a=project(z,0), b=project(z,2); g.strokeStyle='#ffffff18'; g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); }
        for (let i = course.length - 1; i >= 0; i--) drawObject(course[i], i);
        if(boost>0&&!reducedMotion){g.strokeStyle='#ffffff80';g.lineWidth=2;for(let i=0;i<18;i++){const x=(i*97+t*430)%W,y=85+(i*47%270);g.beginPath();g.moveTo(x,y);g.lineTo(x-35-Math.random()*45,y);g.stroke();}}
        const os=SKINS[opp.skin%SKINS.length]||SKINS[0],ms=SKINS[skin];
        if (oppView.d > dist - 60 && oppView.d < dist + VIEW) { const q = project(oppView.d-dist, oppView.l);if(opp.shield){g.strokeStyle='#75eaffaa';g.lineWidth=3;g.beginPath();g.arc(q.x,q.y-25*q.p,18+q.p*22,0,7);g.stroke();}if(opp.boost&&!reducedMotion){g.strokeStyle='#ffe45e88';g.lineWidth=5;g.beginPath();g.moveTo(q.x,q.y);g.lineTo(q.x,q.y+22*q.p);g.stroke();}runner(q.x, q.y-oppView.j*q.p, .25+q.p*.75, os[0], false, opp.boost?'#ffe45e':os[1],dist/24); }
        const myX = project(0,laneX).x; runner(myX, GROUND-jumpY, 1, ms[0], sliding>0, boost>0?'#ffe45e':ms[1],dist/20);
        if(shield>0){g.strokeStyle='#75eaffcc';g.lineWidth=4;g.shadowColor='#75eaff';g.shadowBlur=10;g.beginPath();g.arc(myX,GROUND-jumpY-23,35,0,7);g.stroke();g.shadowBlur=0;}
        const finishZ=FINISH-dist;if(finishZ>0&&finishZ<VIEW){const f=project(finishZ,1),s=.22+f.p*.95;g.save();g.translate(f.x,f.y);g.scale(s,s);g.fillStyle='#fff';g.fillRect(-112,-92,9,92);g.fillRect(103,-92,9,92);for(let x=-103;x<103;x+=20){g.fillStyle=((x/20)&1)?'#fff':'#222';g.fillRect(x,-92,20,18);}g.restore();}
        for(const p of particles){g.globalAlpha=Math.max(0,p.life);g.fillStyle=p.col;g.fillRect(p.x,p.y,p.size,p.size);}g.globalAlpha=1;
        g.fillStyle='#ffffff24'; g.fillRect(18,16,W-36,7); g.fillStyle=me==='a'?'#5db4ff':'#ff9d3d'; g.fillRect(18,16,(W-36)*Math.min(1,dist/FINISH),7); g.fillStyle=me==='a'?'#ff9d3d':'#5db4ff'; g.fillRect(18+(W-36)*Math.min(1,opp.d/FINISH)-4,12,8,15);
        g.fillStyle='#fff'; g.font='bold 13px system-ui'; g.textAlign='right'; g.fillText('🏁',W-15,27);
        g.textAlign='left';g.fillStyle='#ffe45e';g.font='bold 13px system-ui';g.fillText('● '+coins,18,45);
        if(combo>1){g.fillStyle='#fff';g.fillText('Clean x'+combo,18,64);}
        const danger=course.find(o=>o.x-dist>120&&o.x-dist<430&&o.type!=='coin'&&o.type!=='boost');if(danger){const q=project(danger.x-dist,danger.lane);g.textAlign='center';g.fillStyle='#ffef72';g.font='900 18px system-ui';g.fillText('▼',q.x,q.y-70);}
        if (boost>0) { g.textAlign='center'; g.font='bold 17px system-ui'; g.fillStyle='#ffe45e'; g.fillText('⚡ SPEED BOOST '+boost.toFixed(1)+'s',W/2,48); }
        if(magnet>0||shield>0){g.textAlign='right';g.font='bold 13px system-ui';g.fillStyle='#fff';g.fillText((magnet>0?'🧲 '+magnet.toFixed(1)+'s  ':'')+(shield>0?'🛡 '+shield.toFixed(1)+'s':''),W-22,48);}
        if(draft>0){const w=118,p=draft/1.65;g.fillStyle='#071225bb';g.fillRect(W/2-w/2,76,w,10);g.fillStyle='#75eaff';g.fillRect(W/2-w/2+2,78,(w-4)*p,6);g.textAlign='center';g.font='900 10px system-ui';g.fillStyle='#fff';g.fillText('DRAFT BOOST',W/2,72);}
        if(phase==='run'){const lead=Math.round((dist-opp.d)/10),label=Math.abs(lead)<2?'NECK & NECK':lead>0?'LEADING +'+lead+'m':'BEHIND '+Math.abs(lead)+'m';g.textAlign='center';g.font='900 12px system-ui';g.fillStyle=lead>=0?'#75eaff':'#ffcf70';g.fillText(label,W/2,31);if(Math.abs(lead)>25){g.font='bold 11px system-ui';g.fillStyle='#ffffffaa';g.fillText(lead<0?'A boost can close the gap':'Keep the pressure on',W/2,66);}}
        if(nearTimer>0){g.textAlign='center';g.font='900 21px system-ui';g.fillStyle='#fff';g.fillText(nearText,W/2,82);}
        if(phase==='run'&&dist>FINISH*.8){g.textAlign='center';g.font='900 16px system-ui';g.fillStyle='#fff';g.fillText('FINAL STRETCH!',W/2,72);}
        if (crash>0) { g.fillStyle='rgba(255,40,60,.2)'; g.fillRect(0,0,W,H); }
        if (phase==='count') { const left=Math.max(0,countEnd-performance.now()),n=Math.max(0,Math.ceil((left-200)/1000));g.fillStyle='#0007';g.fillRect(0,0,W,H);g.fillStyle='#ffe45e';g.textAlign='center';g.font='900 17px system-ui';g.fillText((wins.a===2||wins.b===2?'MATCH POINT · ':'')+'ROUND '+round,W/2,H/2-82);g.fillStyle='#ffffffcc';g.font='bold 13px system-ui';g.fillText(THEME_NAMES[Math.abs(seed)%THEMES.length],W/2,H/2-59);g.fillStyle='#75eaff';g.font='900 12px system-ui';g.fillText(MODIFIERS[modifier].toUpperCase(),W/2,H/2-39);g.fillStyle='#fff';g.font='900 68px system-ui';g.fillText(n>0?n:'GO!',W/2,H/2+36); }
        if (phase==='idle') { g.fillStyle='#fff'; g.textAlign='center'; g.font='bold 25px system-ui'; g.fillText('Metro Rush',W/2,H/2-10); g.font='14px system-ui'; g.fillText('switch lanes · jump barriers · slide under signs',W/2,H/2+20); }
        if (phase==='finished' || phase==='waiting') { const championship=Math.max(wins.a,wins.b)>=3;g.fillStyle='#000b'; g.fillRect(0,0,W,H); g.fillStyle='#ffe45e';g.textAlign='center';g.font='bold 17px system-ui';g.fillText(championship?'CHAMPIONSHIP COMPLETE':'ROUND '+round+' · '+THEME_NAMES[Math.abs(seed)%THEMES.length],W/2,H/2-91);g.fillStyle='#75eaff';g.font='900 11px system-ui';g.fillText(championship?'FIRST TO THREE':MODIFIERS[modifier].toUpperCase(),W/2,H/2-72);g.fillStyle='#fff';g.font='900 40px system-ui';g.fillText(phase==='waiting'?'FINISH!':championship?(winner===me?'👑 CHAMPION!':'THEY ARE CHAMPION'):winner===me?'🏆 YOU WIN!':'THEY WIN',W/2,H/2-31);g.font='bold 22px system-ui';g.fillText(wins[me]+'  —  '+wins[me==='a'?'b':'a'],W/2,H/2+5);g.font='bold 13px system-ui';g.fillStyle='#75eaff';g.fillText('YOU  ● '+coins+'   clean x'+bestCombo,W/2,H/2+34);g.fillStyle='#ffb86b';g.fillText('THEM  ● '+opp.coins+'   clean x'+opp.combo,W/2,H/2+55);g.font='12px system-ui';g.fillStyle='#ffffffaa';g.fillText('Personal best x'+careerBest+'  ·  match wins '+matchWins,W/2,H/2+78); }
        g.restore();
    };
    const renderScore = () => { if (scoreEl) scoreEl.textContent = `Round ${round || '–'}  ·  You ${wins[me]} – ${wins[me==='a'?'b':'a']} Them`;const b=ctx?.root?.querySelector('.nb');if(b)b.textContent=Math.max(wins.a,wins.b)>=3?'New match':'New round'; };
    const status = () => { if (!statEl) return; statEl.textContent = phase==='idle' ? 'Three-lane runner race' : phase==='finished' ? (winner===me?'🏆 Round won!':'Round lost') : phase==='waiting' ? 'Finished — waiting…' : `${Math.min(100,Math.round(dist/FINISH*100))}% · them ${Math.min(100,Math.round(opp.d/FINISH*100))}%`; };
        const loop = (t) => { const dt=Math.min(.035,(t-lastT)/1000||0); lastT=t;oppView.d+=(opp.d-oppView.d)*Math.min(1,dt*9);oppView.l+=(opp.l-oppView.l)*Math.min(1,dt*13);oppView.j+=(opp.j-oppView.j)*Math.min(1,dt*13);if(phase==='count'&&performance.now()>=countEnd)phase='run'; step(dt);stepFx(dt); if (phase==='run' && t-lastSend>80) { lastSend=t; ctx.send({t:'p',d:Math.round(dist),l:+laneX.toFixed(2),j:Math.round(jumpY),boost:boost>0,magnet:magnet>0,shield:shield>0,crash:crash>0,coins,combo:bestCombo,skin}); } draw(); status(); raf=requestAnimationFrame(loop); };

    window.Appmegle.register({
        id: 'metrorush', label: 'Metro Rush', css: 'apps/metrorush.css',
        mount(c) {
            ctx=c; auth=ctx.amCaller; me=auth?'a':'b'; phase='idle'; winner=null; round=0; wins={a:0,b:0}; usedSeeds=new Set();champRecorded=false;
            ctx.root.innerHTML='<div class="app-col mr-wrap"><div class="app-bar"><span class="stat"></span><strong class="mr-score"></strong><button class="app-btn skin">Style</button><button class="app-btn fx"></button><button class="app-btn snd"></button><button class="app-btn nb">New round</button></div><canvas id="mr-canvas" width="'+W+'" height="'+H+'"></canvas><div id="mr-pad"><button data-a="left">◀</button><button data-a="jump">⬆ Jump</button><button data-a="slide">⬇ Slide</button><button data-a="right">▶</button></div><div class="mr-hint">swipe or use arrows/WASD · collect ⚡ for a momentary speed boost</div></div>';
            canvas=ctx.root.querySelector('#mr-canvas'); g=canvas.getContext('2d'); statEl=ctx.root.querySelector('.stat'); scoreEl=ctx.root.querySelector('.mr-score'); renderScore();
            ctx.root.querySelector('.nb').addEventListener('click',newRound);
            ctx.root.querySelector('.skin').addEventListener('click',nextSkin);
            ctx.root.querySelector('.fx').addEventListener('click',toggleFx);ctx.root.querySelector('.snd').addEventListener('click',toggleSound);updateButtons();
            const act=(a)=>{if(a==='left')changeLane(-1);else if(a==='right')changeLane(1);else if(a==='jump')jump();else slide();};
            ctx.root.querySelectorAll('#mr-pad button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();act(b.dataset.a);}));
            canvas.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
            canvas.addEventListener('pointerup',e=>{if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return jump();if(Math.abs(dx)>Math.abs(dy))changeLane(dx>0?1:-1);else if(dy<0)jump();else slide();});
            onKey=e=>{if(e.repeat)return;const k=e.code;if(k==='ArrowLeft'||k==='KeyA')changeLane(-1);else if(k==='ArrowRight'||k==='KeyD')changeLane(1);else if(k==='ArrowUp'||k==='KeyW'||k==='Space')jump();else if(k==='ArrowDown'||k==='KeyS')slide();else return;e.preventDefault();}; window.addEventListener('keydown',onKey);
            lastT=performance.now();raf=requestAnimationFrame(loop);if(auth)newRound();
        },
        unmount(){cancelAnimationFrame(raf);window.removeEventListener('keydown',onKey);ctx=canvas=g=statEl=scoreEl=null;course=[];},
        onData(msg){
            if(msg.t==='start'&&!auth){usedSeeds.add(msg.seed);begin(msg.seed,msg.round,msg.wins);}
            else if(msg.t==='roundreq'&&auth)newRound();
            else if(msg.t==='p')opp={d:msg.d||0,l:Number(msg.l)||0,j:msg.j||0,boost:!!msg.boost,magnet:!!msg.magnet,shield:!!msg.shield,crash:!!msg.crash,coins:Number(msg.coins)||0,combo:Number(msg.combo)||0,skin:Number(msg.skin)||0};
            else if(msg.t==='finish'&&auth&&!winner)declare('b');
            else if(msg.t==='result'){winner=msg.w;wins={a:msg.wins?.a||0,b:msg.wins?.b||0};round=msg.round||round;phase='finished';burst(W/2,H/2,70,['#ffe45e','#5db4ff','#ff5f8f','#76f7c4']);if(wins[msg.w]>=3){burst(W/2,H/2,120,['#ffe45e','#fff','#ff5f9d','#75eaff']);recordChampion(msg.w);}renderScore();}
        }
    });
})();
