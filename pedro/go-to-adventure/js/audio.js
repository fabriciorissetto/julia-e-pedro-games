// Áudio sintetizado via Web Audio API. Nada de arquivos — economia de banda
// e zero dependência. Todos os sons são procedurais (osciladores + envelopes).
//
// Uso: window.GTA.Audio.play('attack')
// Eventos disponíveis: click, hover, attack, hit, mobDie, playerHurt, levelUp,
// craft, harvest, drop, openPanel, closePanel, skillCast, skillFire, chat, chatRecv.
(function () {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35; // volume geral conservador
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }

  // navegadores exigem gesto do usuário pra desbloquear áudio
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function envGain(t0, attack, decay, sustain, release, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
    g.gain.linearRampToValueAtTime(0, t0 + attack + decay + release);
    return g;
  }

  // Tom simples com envelope ADSR.
  // freq pode ser número ou [freqInicial, freqFinal] pra sweep.
  function tone(opts) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    if (Array.isArray(opts.freq)) {
      osc.frequency.setValueAtTime(opts.freq[0], t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freq[1]), t0 + (opts.dur || 0.2));
    } else {
      osc.frequency.value = opts.freq;
    }
    const a = opts.attack != null ? opts.attack : 0.005;
    const d = opts.decay != null ? opts.decay : 0.04;
    const s = opts.sustain != null ? opts.sustain : 0.4;
    const r = opts.release != null ? opts.release : 0.1;
    const peak = (opts.gain != null ? opts.gain : 0.5);
    const g = envGain(t0, a, d, s, r, peak);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + a + d + r + 0.05);
  }

  // Burst de ruído filtrado — bom pra batidas, passos, fogo.
  function noise(opts) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.15;
    const sampleCount = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.filterType || 'lowpass';
    filt.frequency.value = opts.filterFreq || 1500;
    if (opts.filterSweep) {
      filt.frequency.setValueAtTime(opts.filterSweep[0], t0);
      filt.frequency.exponentialRampToValueAtTime(Math.max(20, opts.filterSweep[1]), t0 + dur);
    }
    const peak = opts.gain != null ? opts.gain : 0.4;
    const g = envGain(t0, 0.002, 0.02, 0.3, dur - 0.022, peak);
    src.connect(filt).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- Catálogo de SFX ----------
  const SOUNDS = {
    click:    () => tone({ freq: 880, type: 'square', dur: 0.06, gain: 0.25, decay: 0.02, release: 0.04 }),
    hover:    () => tone({ freq: 1320, type: 'triangle', dur: 0.04, gain: 0.12, release: 0.02 }),

    attack:   () => {
      // swoosh + thud
      noise({ dur: 0.12, filterType: 'bandpass', filterSweep: [3000, 600], gain: 0.22 });
      tone({ freq: [220, 110], type: 'sawtooth', dur: 0.08, gain: 0.18, release: 0.05 });
    },
    hit:      () => {
      // impacto curto e seco
      noise({ dur: 0.08, filterType: 'lowpass', filterFreq: 800, gain: 0.35 });
      tone({ freq: [180, 60], type: 'sine', dur: 0.06, gain: 0.3 });
    },
    mobDie:   () => {
      tone({ freq: [400, 60], type: 'square', dur: 0.35, gain: 0.3, release: 0.15 });
      noise({ dur: 0.25, filterType: 'lowpass', filterFreq: 600, gain: 0.2 });
    },
    playerHurt: () => {
      tone({ freq: [380, 180], type: 'sawtooth', dur: 0.2, gain: 0.35, release: 0.12 });
    },
    levelUp:  () => {
      tone({ freq: 523, type: 'triangle', dur: 0.1, gain: 0.3 });
      tone({ freq: 659, type: 'triangle', dur: 0.1, gain: 0.3, delay: 0.1 });
      tone({ freq: 784, type: 'triangle', dur: 0.1, gain: 0.3, delay: 0.2 });
      tone({ freq: 1047, type: 'triangle', dur: 0.25, gain: 0.35, delay: 0.3, release: 0.18 });
    },
    craft:    () => {
      // martelo — duas batidas
      noise({ dur: 0.06, filterType: 'lowpass', filterFreq: 600, gain: 0.35 });
      tone({ freq: [600, 300], type: 'square', dur: 0.06, gain: 0.18 });
      noise({ dur: 0.06, filterType: 'lowpass', filterFreq: 600, gain: 0.35, delay: 0.12 });
      tone({ freq: [600, 300], type: 'square', dur: 0.06, gain: 0.18, delay: 0.12 });
    },
    harvest:  () => {
      // golpe na natureza
      noise({ dur: 0.1, filterType: 'highpass', filterFreq: 800, gain: 0.18 });
      tone({ freq: [320, 180], type: 'sine', dur: 0.08, gain: 0.2 });
    },
    drop:     () => tone({ freq: [660, 440], type: 'triangle', dur: 0.08, gain: 0.2 }),
    pickup:   () => {
      tone({ freq: 600, type: 'triangle', dur: 0.05, gain: 0.22 });
      tone({ freq: 900, type: 'triangle', dur: 0.05, gain: 0.22, delay: 0.05 });
    },

    openPanel:  () => tone({ freq: [220, 660], type: 'square', dur: 0.1, gain: 0.18, release: 0.05 }),
    closePanel: () => tone({ freq: [660, 220], type: 'square', dur: 0.08, gain: 0.18, release: 0.05 }),

    skillCast: () => {
      // upcast genérico (taunt/heal/arrowRain)
      tone({ freq: [220, 660], type: 'sine', dur: 0.3, gain: 0.3, release: 0.15 });
      tone({ freq: [330, 990], type: 'triangle', dur: 0.3, gain: 0.18, release: 0.15 });
    },
    skillFire: () => {
      // mago: fogo grande — explosão grave + chamas
      tone({ freq: [120, 30], type: 'sawtooth', dur: 0.45, gain: 0.5, release: 0.25 });
      noise({ dur: 0.6, filterType: 'lowpass', filterFreq: 800, gain: 0.45 });
      noise({ dur: 0.4, filterType: 'highpass', filterSweep: [2000, 400], gain: 0.25, delay: 0.05 });
    },

    chat:     () => tone({ freq: 700, type: 'triangle', dur: 0.05, gain: 0.2 }),
    chatRecv: () => {
      tone({ freq: 880, type: 'sine', dur: 0.05, gain: 0.18 });
      tone({ freq: 1100, type: 'sine', dur: 0.05, gain: 0.18, delay: 0.06 });
    },
  };

  function play(name) {
    init();
    if (!ctx || muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { fn(); } catch (e) { /* silencioso */ }
  }

  function setMuted(m) { muted = !!m; }
  function isMuted() { return muted; }

  // ---------- Música de fundo procedural ----------
  // Sequência de notas em modo dórico (medieval-RPG vibe), tocadas em loop por
  // um oscilador "pad" + uma melodia simples. Tudo baixo volume pra não atrapalhar SFX.
  let bgmTimer = null;
  let bgmGain = null;
  let bgmActive = false;

  // Modo dórico em D: D E F G A B C — 7 graus, intervalo característico medieval
  const DORIAN_D = [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66];
  // Sequência da melodia (índices no DORIAN_D + duração em segundos)
  const MELODY = [
    [0, 0.5], [2, 0.5], [3, 0.5], [4, 1.0],
    [3, 0.5], [2, 0.5], [0, 1.0], [-1, 0.5],
    [4, 0.5], [5, 0.5], [4, 0.5], [3, 1.0],
    [2, 0.5], [1, 0.5], [0, 1.5], [-1, 0.5],
    [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5],
    [4, 0.5], [3, 0.5], [2, 0.5], [0, 1.5],
  ];

  function playMelodyNote(noteIdx, dur, when) {
    if (noteIdx < 0) return; // pausa
    const freq = DORIAN_D[noteIdx];
    if (!freq) return;
    const t0 = when;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const peak = 0.18;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.04);
    g.gain.linearRampToValueAtTime(peak * 0.5, t0 + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g).connect(bgmGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function playPadDrone(when, dur) {
    // pad sustenta a tônica D + quinta A em duas oitavas
    const freqs = [73.42, 110.00, 146.83]; // D2, A2, D3
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.06, when + 0.5);
      g.gain.linearRampToValueAtTime(0.06, when + dur - 0.5);
      g.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(g).connect(bgmGain);
      o.start(when);
      o.stop(when + dur + 0.1);
    }
  }

  function startMusic() {
    init();
    if (!ctx || muted || bgmActive) return;
    bgmActive = true;
    if (!bgmGain) {
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.5; // sub-mix de música
      bgmGain.connect(master);
    }
    scheduleNextLoop();
  }

  function scheduleNextLoop() {
    if (!bgmActive || !ctx) return;
    const now = ctx.currentTime;
    let t = now + 0.1;
    // pad drone cobrindo toda a melodia
    let total = 0;
    for (const [, d] of MELODY) total += d;
    playPadDrone(t, total);
    // notas
    for (const [idx, dur] of MELODY) {
      playMelodyNote(idx, dur, t);
      t += dur;
    }
    // agenda próximo loop um pouco antes do fim pra não ter gap
    const ms = (total - 0.05) * 1000;
    bgmTimer = setTimeout(scheduleNextLoop, ms);
  }

  function stopMusic() {
    bgmActive = false;
    if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
    if (bgmGain) {
      try {
        const now = ctx.currentTime;
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
        bgmGain.gain.linearRampToValueAtTime(0, now + 0.5);
      } catch {}
    }
  }

  function setMusicVolume(v) {
    if (bgmGain) bgmGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // desbloqueia em qualquer interação inicial
  ['click', 'keydown', 'pointerdown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlock, { once: false, passive: true });
  });

  window.GTA = window.GTA || {};
  window.GTA.Audio = { play, setMuted, isMuted, init, unlock, startMusic, stopMusic, setMusicVolume };
})();
