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

  // desbloqueia em qualquer interação inicial
  ['click', 'keydown', 'pointerdown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlock, { once: false, passive: true });
  });

  window.GTA = window.GTA || {};
  window.GTA.Audio = { play, setMuted, isMuted, init, unlock };
})();
