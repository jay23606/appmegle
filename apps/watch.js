// Watch Together (2-player) for appmegle. Paste a YouTube link and watch it in sync — the
// caller (host) controls play/pause/seek and the other player's video follows, so you react to
// clips at the same instant. Co-watching is core to a video call. Uses the YouTube IFrame API.
// Caller = host (controls playback), answerer = follower.
(function () {
    const ensureYT = () => new Promise((res) => { if (window.YT && window.YT.Player) return res(); const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); }; if (!document.getElementById('yt-api')) { const s = document.createElement('script'); s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); } });
    const vidId = (u) => { u = (u || '').trim(); let m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(u) ? u : null); };
    let ctx = null, auth = false, player = null, ready = false, statEl = null, pending = null, syncTimer = 0;

    const onState = (e) => { if (!auth || !ready) return; const t = player.getCurrentTime(); if (e.data === 1) ctx.send({ t: 'sync', s: 'play', time: t }); else if (e.data === 2) ctx.send({ t: 'sync', s: 'pause', time: t }); };
    const applySync = (s, time) => { if (!ready) { pending = { s, time }; return; } const cur = player.getCurrentTime ? player.getCurrentTime() : 0; if (Math.abs(cur - time) > 1.2) player.seekTo(time, true); if (s === 'play') player.playVideo(); else player.pauseVideo(); };
    const load = (id) => { if (!ready) { pending = { load: id }; return; } player.loadVideoById(id); };
    const onReady = () => { ready = true; if (pending) { if (pending.load) load(pending.load); else applySync(pending.s, pending.time); pending = null; } if (auth) { statEl.textContent = 'Paste a YouTube link and press Load'; syncTimer = setInterval(() => { if (ready && player.getPlayerState) { const st = player.getPlayerState(); ctx.send({ t: 'time', time: player.getCurrentTime(), playing: st === 1 }); } }, 2500); } else statEl.textContent = "Following the host's video"; };

    window.Appmegle.register({
        id: 'watch', label: 'Watch Together', css: 'apps/watch.css',
        mount(c) {
            ctx = c; auth = ctx.amCaller; ready = false; pending = null;
            ctx.root.innerHTML = '<div class="app-col" id="wt"><div class="app-bar"><span class="stat">Loading player…</span>' + (auth ? '<input id="wt-url" placeholder="paste YouTube link"><button class="app-btn" id="wt-load">Load</button>' : '') + '</div><div id="wt-wrap"><div id="wt-player"></div></div><div class="wt-hint">tip: mute your call audio (or the video) to avoid echo</div></div>';
            statEl = ctx.root.querySelector('.stat');
            ensureYT().then(() => {
                if (!ctx) return; const el = ctx.root.querySelector('#wt-player');
                player = new YT.Player(el, { width: '100%', height: '100%', videoId: '', playerVars: { rel: 0, modestbranding: 1, playsinline: 1 }, events: { onReady, onStateChange: onState } });
            });
            if (auth) { const ld = ctx.root.querySelector('#wt-load'); ld.addEventListener('click', () => { const id = vidId(ctx.root.querySelector('#wt-url').value); if (!id) { statEl.textContent = 'Hmm, not a valid YouTube link'; return; } load(id); ctx.send({ t: 'load', id }); statEl.textContent = 'Loaded — playback is synced'; }); }
        },
        unmount() { clearInterval(syncTimer); if (player && player.destroy) try { player.destroy(); } catch (e) {} ctx = statEl = player = null; ready = false; },
        onData(msg) {
            if (auth) return;
            if (msg.t === 'load') load(msg.id);
            else if (msg.t === 'sync') applySync(msg.s, msg.time);
            else if (msg.t === 'time') { if (!ready) return; const st = player.getPlayerState && player.getPlayerState(); if (msg.playing && Math.abs(player.getCurrentTime() - msg.time) > 1.5) player.seekTo(msg.time, true); if (msg.playing && st !== 1) player.playVideo(); if (!msg.playing && st === 1) player.pauseVideo(); }
        }
    });
})();
