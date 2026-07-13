// Tiny generated sound palette shared by every in-call app. No assets are
// downloaded; the browser creates short tones after a user interaction unlocks
// its AudioContext.
(function () {
    let ac = null;
    const context = () => {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        return ac;
    };
    const tone = (from, to, seconds, type = 'sine', gain = 0.035, delay = 0) => {
        try {
            const c = context(), at = c.currentTime + delay, osc = c.createOscillator(), vol = c.createGain();
            osc.type = type; osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + seconds);
            vol.gain.setValueAtTime(0.0001, at); vol.gain.exponentialRampToValueAtTime(gain, at + 0.012); vol.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
            osc.connect(vol).connect(c.destination); osc.start(at); osc.stop(at + seconds + 0.02);
        } catch (e) {}
    };
    const play = (kind = 'tap') => {
        if (kind === 'tap' || kind === 'move') return tone(440, 520, 0.045, 'triangle', 0.025);
        if (kind === 'score' || kind === 'correct') { tone(520, 740, 0.09, 'sine', 0.04); return tone(740, 940, 0.11, 'sine', 0.04, 0.07); }
        if (kind === 'wrong' || kind === 'lose') return tone(240, 115, 0.18, 'sawtooth', 0.028);
        if (kind === 'start') return tone(330, 500, 0.11, 'triangle', 0.03);
        if (kind === 'win') { tone(520, 700, 0.1, 'square', 0.027); tone(700, 1040, 0.17, 'square', 0.027, 0.1); }
    };
    window.AppmegleSound = { play };
})();
