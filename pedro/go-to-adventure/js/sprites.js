// Sprites procedurais. Tudo desenhado em offscreen canvases pra render rápido.
// Pixel art "real": cada sprite tem grid lógico pequeno e usa fillRect 1x1.
// Acessado via window.GTA.Sprites.draw(ctx, name, x, y, frame, opts).
(function () {
  const Sprites = {
    ready: false,
    _reg: {},   // name -> { frames: [canvas, ...], w, h }
    _tintCache: {}, // 'name|frame|tint' -> canvas
  };

  // ----------------------------- helpers básicos -----------------------------

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return c;
  }

  function pixel(g, x, y, color) {
    g.fillStyle = color;
    g.fillRect(x | 0, y | 0, 1, 1);
  }

  function pxRect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  // contorno 1px ao redor de retângulo
  function outline(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h);
    g.fillRect(x + w - 1, y, 1, h);
  }

  // círculo cheio em pixel art (Bresenham simples)
  function pxDisc(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  function pxRing(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d <= r * r && d >= (r - 1) * (r - 1)) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  // PRNG determinístico (mulberry32)
  function rngFn(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function reg(name, frames, w, h) {
    Sprites._reg[name] = { frames: Array.isArray(frames) ? frames : [frames], w, h };
  }

  // ============================== TILES ==============================

  function makeGrass(seed, withFlowers) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 0, 0, w, h, '#4a8a3a');
    // padrão xadrez sutil
    for (let y = 0; y < h; y += 2) {
      for (let x = (y % 4 === 0 ? 0 : 1); x < w; x += 2) {
        pixel(g, x, y, '#52963f');
      }
    }
    const r = rngFn(seed);
    // tufos escuros
    for (let i = 0; i < 18; i++) {
      const x = (r() * w) | 0, y = (r() * h) | 0;
      pixel(g, x, y, '#3a6e2c');
      if (r() < 0.5) pixel(g, x + 1, y, '#3a6e2c');
      if (r() < 0.3) pixel(g, x, y + 1, '#326024');
    }
    // pontos claros
    for (let i = 0; i < 10; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#5fa84a');
    }
    if (withFlowers) {
      for (let i = 0; i < 5; i++) {
        const x = 2 + ((r() * (w - 4)) | 0), y = 2 + ((r() * (h - 4)) | 0);
        pixel(g, x, y, '#fde04a');
        pixel(g, x + 1, y, '#fde04a');
        pixel(g, x, y + 1, '#f0a830');
        pixel(g, x + 1, y + 1, '#fde04a');
      }
    }
    return c;
  }

  function makeDirt(seed) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 0, 0, w, h, '#7a5a3a');
    const r = rngFn(seed);
    for (let i = 0; i < 35; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#8e6c46');
    }
    for (let i = 0; i < 25; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#5d4226');
    }
    // pedrinhas
    for (let i = 0; i < 3; i++) {
      const x = (r() * (w - 3)) | 0, y = (r() * (h - 3)) | 0;
      pxRect(g, x, y, 2, 2, '#9a8466');
      pixel(g, x, y, '#b8a282');
    }
    return c;
  }

  function makeSand(seed) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 0, 0, w, h, '#d4b87a');
    const r = rngFn(seed);
    for (let i = 0; i < 40; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#e6cc92');
    }
    for (let i = 0; i < 30; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#bd9d62');
    }
    // ondulações
    for (let i = 0; i < 4; i++) {
      const y = (r() * h) | 0;
      const x = (r() * (w - 8)) | 0;
      for (let k = 0; k < 6; k++) pixel(g, x + k, y, '#b89358');
    }
    return c;
  }

  function makeWaterFrames() {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      pxRect(g, 0, 0, w, h, '#3a6db8');
      // gradiente sutil
      pxRect(g, 0, 0, w, 4, '#4a7dc8');
      pxRect(g, 0, h - 4, w, 4, '#2e5ca0');
      const r = rngFn(100 + f * 13);
      // ondas brancas
      for (let i = 0; i < 6; i++) {
        const x = ((r() * w) + f * 2) % w | 0;
        const y = ((r() * h) + f * 3) % h | 0;
        pxRect(g, x, y, 3, 1, '#bde0ff');
        pixel(g, x + 1, y + 1, '#7aa8e0');
      }
      // brilhos
      for (let i = 0; i < 4; i++) {
        pixel(g, ((r() * w) + f) % w | 0, ((r() * h) + f * 2) % h | 0, '#d8ecff');
      }
      frames.push(c);
    }
    return frames;
  }

  function makeMountain(seed) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // base mais escura, topo claro
    pxRect(g, 0, 0, w, h, '#6e7a8a');
    pxRect(g, 0, 0, w, 8, '#8a96a6');
    pxRect(g, 0, h - 8, w, 8, '#4a5666');
    const r = rngFn(seed);
    for (let i = 0; i < 30; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#828ea0');
    }
    // rachaduras
    for (let i = 0; i < 3; i++) {
      let x = (r() * w) | 0, y = (r() * h) | 0;
      for (let k = 0; k < 5; k++) {
        pixel(g, x, y, '#3a4252');
        x += (r() < 0.5 ? -1 : 1);
        y += 1;
      }
    }
    // pontinhos brancos (neve)
    for (let i = 0; i < 6; i++) {
      pixel(g, (r() * w) | 0, (r() * 6) | 0, '#e0e8f0');
    }
    return c;
  }

  function makeForestFloor(seed) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 0, 0, w, h, '#2e5a22');
    const r = rngFn(seed);
    for (let i = 0; i < 25; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#1f4216');
    }
    for (let i = 0; i < 12; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#3e7030');
    }
    // folhas caídas
    for (let i = 0; i < 4; i++) {
      const x = (r() * (w - 2)) | 0, y = (r() * (h - 2)) | 0;
      pxRect(g, x, y, 2, 1, '#7a4a20');
      pixel(g, x, y + 1, '#5a3a18');
    }
    return c;
  }

  function makePath(seed) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 0, 0, w, h, '#9a9588');
    const r = rngFn(seed);
    for (let i = 0; i < 30; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#aaa595');
    }
    for (let i = 0; i < 20; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#7a7468');
    }
    // pedrinhas maiores
    for (let i = 0; i < 5; i++) {
      const x = (r() * (w - 3)) | 0, y = (r() * (h - 3)) | 0;
      pxRect(g, x, y, 2, 2, '#666058');
      pixel(g, x, y, '#888278');
    }
    return c;
  }

  // ============================== PERSONAGENS ==============================

  // Cada personagem: 32x40 (cabeça sai um pouco acima do tile).
  // 4 dirs (down, up, left, right) x 4 frames = 16 sprites.
  // left = right com flipX (geramos só 3 dirs e usamos flip no draw).
  // Mas pra retornar canvases prontos, geramos os 4.

  function drawHumanoidBase(g, frame, dir, palette) {
    // palette: { skin, skinShade, hair, robeMain, robeShade, robeDark, beltOrTrim, accent, eye }
    const cx = 16; // centro horizontal
    // animação de "step": -1, 0, 1, 0 nas pernas
    const step = [0, -1, 0, 1][frame % 4];
    const bobY = (frame === 1 || frame === 3) ? -1 : 0;

    // sombra
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(cx - 6, 36, 12, 2);
    g.fillRect(cx - 5, 38, 10, 1);

    // pernas (parte de baixo do corpo) - 22..32 Y
    const legY = 28;
    if (dir === 'left' || dir === 'right') {
      // perna frente / traseira alterna
      pxRect(g, cx - 3, legY + bobY, 3, 8 - bobY, palette.robeDark);
      pxRect(g, cx + 0, legY - bobY, 3, 8 + bobY, palette.robeDark);
      pxRect(g, cx - 3, legY + 8, 3, 1, '#222');
      pxRect(g, cx + 0, legY + 8, 3, 1, '#222');
    } else {
      pxRect(g, cx - 4, legY + (step > 0 ? -1 : 0), 3, 9 - (step > 0 ? -1 : 0), palette.robeDark);
      pxRect(g, cx + 1, legY + (step < 0 ? -1 : 0), 3, 9 - (step < 0 ? -1 : 0), palette.robeDark);
      pxRect(g, cx - 4, legY + 8, 3, 1, '#1a1a1a');
      pxRect(g, cx + 1, legY + 8, 3, 1, '#1a1a1a');
    }

    // tronco / robe
    const bodyTop = 18 + bobY;
    pxRect(g, cx - 5, bodyTop, 10, 11, palette.robeMain);
    // sombra lateral
    pxRect(g, cx + 3, bodyTop, 2, 11, palette.robeShade);
    pxRect(g, cx - 5, bodyTop + 9, 10, 2, palette.robeShade);
    // cinto / trim
    if (palette.beltOrTrim) {
      pxRect(g, cx - 5, bodyTop + 7, 10, 1, palette.beltOrTrim);
    }
    // contorno do corpo
    outline(g, cx - 5, bodyTop, 10, 11, '#1a1410');

    // braços
    const armColor = palette.robeMain;
    const armShade = palette.robeShade;
    if (dir === 'down' || dir === 'up') {
      // braços nas laterais, com leve swing
      const swing = (frame % 2 === 0) ? 0 : 1;
      pxRect(g, cx - 7, bodyTop + 1 + swing, 2, 8, armColor);
      pxRect(g, cx + 5, bodyTop + 1 - swing, 2, 8, armColor);
      pixel(g, cx - 7, bodyTop + 8 + swing, armShade);
      pixel(g, cx + 6, bodyTop + 8 - swing, armShade);
      // mãos
      pxRect(g, cx - 7, bodyTop + 8 + swing, 2, 2, palette.skin);
      pxRect(g, cx + 5, bodyTop + 8 - swing, 2, 2, palette.skin);
    } else {
      // perfil: 1 braço visível
      pxRect(g, cx - 1, bodyTop + 2, 2, 7, armColor);
      pxRect(g, cx - 1, bodyTop + 8, 2, 2, palette.skin);
    }

    // cabeça 8x8 acima do tronco
    const headY = bodyTop - 9;
    pxRect(g, cx - 4, headY, 8, 8, palette.skin);
    // sombra inferior
    pxRect(g, cx - 4, headY + 7, 8, 1, palette.skinShade);
    pxRect(g, cx + 3, headY + 1, 1, 6, palette.skinShade);
    outline(g, cx - 4, headY, 8, 8, '#1a1410');

    // cabelo
    if (dir === 'up') {
      pxRect(g, cx - 4, headY, 8, 3, palette.hair);
      pxRect(g, cx - 5, headY + 1, 1, 2, palette.hair);
      pxRect(g, cx + 4, headY + 1, 1, 2, palette.hair);
    } else if (dir === 'down') {
      pxRect(g, cx - 4, headY, 8, 2, palette.hair);
      pxRect(g, cx - 5, headY + 1, 1, 3, palette.hair);
      pxRect(g, cx + 4, headY + 1, 1, 3, palette.hair);
    } else {
      pxRect(g, cx - 4, headY, 8, 2, palette.hair);
      pxRect(g, cx - 4, headY + 2, 2, 2, palette.hair);
    }

    // olhos (só frente e lado)
    if (dir === 'down') {
      pixel(g, cx - 2, headY + 4, palette.eye);
      pixel(g, cx + 1, headY + 4, palette.eye);
    } else if (dir === 'left' || dir === 'right') {
      pixel(g, cx + 1, headY + 4, palette.eye);
    }

    // boca
    if (dir === 'down') pxRect(g, cx - 1, headY + 6, 2, 1, '#5a2a1a');
    return { headY, bodyTop, cx };
  }

  function makeWarriorFrame(dir, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#5a3818', eye: '#2a1a0a',
      robeMain: '#7a8a9e', robeShade: '#56657a', robeDark: '#3e4a5e',
      beltOrTrim: '#2a3040', accent: '#c0c8d4',
    };
    const ref = drawHumanoidBase(g, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // capacete sobre o cabelo
    pxRect(g, cx - 5, headY - 1, 10, 4, '#9aa6b4');
    pxRect(g, cx - 4, headY + 3, 8, 1, '#9aa6b4');
    // crista vermelha
    pxRect(g, cx - 1, headY - 3, 2, 2, '#c43030');
    pxRect(g, cx, headY - 4, 1, 1, '#e85050');
    // viseira
    if (dir === 'down') {
      pxRect(g, cx - 4, headY + 3, 8, 2, '#1a1a22');
      pixel(g, cx - 2, headY + 4, '#ff8030');
      pixel(g, cx + 1, headY + 4, '#ff8030');
    } else if (dir === 'up') {
      pxRect(g, cx - 5, headY + 1, 10, 1, '#56657a');
    } else {
      pxRect(g, cx - 4, headY + 3, 8, 2, '#1a1a22');
      pixel(g, cx + 1, headY + 4, '#ff8030');
    }
    outline(g, cx - 5, headY - 1, 10, 4, '#1a1410');

    // armadura no peito (placa)
    pxRect(g, cx - 4, bodyTop + 1, 8, 6, '#9aa6b4');
    pxRect(g, cx - 4, bodyTop + 7, 8, 1, '#56657a');
    // detalhes
    pixel(g, cx - 1, bodyTop + 3, '#c43030');
    pixel(g, cx, bodyTop + 3, '#c43030');
    pixel(g, cx, bodyTop + 4, '#e85050');

    // espada na mão direita (lado direito do sprite olhando pra baixo)
    if (dir === 'down') {
      pxRect(g, cx + 7, bodyTop + 4, 1, 7, '#d4d8e0'); // lâmina
      pxRect(g, cx + 6, bodyTop + 11, 3, 1, '#5a3818'); // guarda
      pxRect(g, cx + 7, bodyTop + 12, 1, 2, '#3a2410'); // cabo
    } else if (dir === 'up') {
      pxRect(g, cx - 8, bodyTop + 2, 1, 7, '#d4d8e0');
      pxRect(g, cx - 9, bodyTop + 1, 3, 1, '#5a3818');
    } else {
      // lateral: espada à frente
      pxRect(g, cx + 1, bodyTop + 2, 1, 8, '#d4d8e0');
      pxRect(g, cx, bodyTop + 10, 3, 1, '#5a3818');
    }

    return c;
  }

  function makeArcherFrame(dir, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#3a2418', eye: '#1a0a0a',
      robeMain: '#3a7a3a', robeShade: '#285628', robeDark: '#1a3e1a',
      beltOrTrim: '#5a3a18', accent: '#88c060',
    };
    const ref = drawHumanoidBase(g, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // capuz
    pxRect(g, cx - 5, headY - 1, 10, 5, '#3a7a3a');
    pxRect(g, cx - 4, headY, 8, 4, '#56a050');
    pxRect(g, cx - 6, headY + 1, 1, 4, '#285628');
    pxRect(g, cx + 5, headY + 1, 1, 4, '#285628');
    // sombra do capuz no rosto
    if (dir === 'down') {
      pxRect(g, cx - 4, headY + 4, 8, 1, '#3a2818');
      pixel(g, cx - 2, headY + 5, '#88c060');
      pixel(g, cx + 1, headY + 5, '#88c060');
    } else if (dir === 'left' || dir === 'right') {
      pixel(g, cx + 1, headY + 5, '#88c060');
    }
    outline(g, cx - 5, headY - 1, 10, 5, '#142810');

    // arco
    if (dir === 'down') {
      pxRect(g, cx + 6, bodyTop + 1, 1, 11, '#7a4a18');
      pixel(g, cx + 5, bodyTop, '#5a3010');
      pixel(g, cx + 5, bodyTop + 12, '#5a3010');
      // corda
      pxRect(g, cx + 7, bodyTop + 1, 1, 11, '#e0d0a0');
    } else if (dir === 'up') {
      pxRect(g, cx - 7, bodyTop + 1, 1, 11, '#7a4a18');
      pxRect(g, cx - 8, bodyTop + 1, 1, 11, '#e0d0a0');
    } else {
      pxRect(g, cx + 2, bodyTop + 1, 1, 10, '#7a4a18');
      pxRect(g, cx + 3, bodyTop + 2, 1, 8, '#e0d0a0');
    }

    // aljava nas costas (pontos)
    pixel(g, cx - 4, bodyTop + 2, '#5a3a18');
    pixel(g, cx - 3, bodyTop + 1, '#e0d0a0');
    pixel(g, cx - 2, bodyTop + 1, '#e0d0a0');

    return c;
  }

  function makeMageFrame(dir, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#a0a0b0', eye: '#3060c0',
      robeMain: '#6e3ec8', robeShade: '#4a2890', robeDark: '#321862',
      beltOrTrim: '#fcd450', accent: '#a070f8',
    };
    const ref = drawHumanoidBase(g, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // chapéu pontudo
    pxRect(g, cx - 5, headY - 1, 10, 2, '#321862');
    pxRect(g, cx - 4, headY - 3, 8, 2, '#4a2890');
    pxRect(g, cx - 3, headY - 5, 6, 2, '#6e3ec8');
    pxRect(g, cx - 2, headY - 7, 4, 2, '#4a2890');
    pxRect(g, cx - 1, headY - 9, 2, 2, '#321862');
    // estrela amarela
    pixel(g, cx, headY - 8, '#fcd450');
    pixel(g, cx, headY - 5, '#fcd450');
    outline(g, cx - 5, headY - 1, 10, 2, '#10082a');

    // barba branca (só frente e lado)
    if (dir === 'down') {
      pxRect(g, cx - 3, headY + 6, 6, 2, '#e0e0f0');
      pixel(g, cx - 1, headY + 7, '#5a2a1a');
      pixel(g, cx, headY + 7, '#5a2a1a');
    } else if (dir === 'left' || dir === 'right') {
      pxRect(g, cx, headY + 6, 4, 2, '#e0e0f0');
    }

    // cajado
    if (dir === 'down') {
      pxRect(g, cx + 7, bodyTop, 1, 14, '#7a4a18');
      pxDisc(g, cx + 7, bodyTop - 2, 2, '#a070f8');
      pixel(g, cx + 7, bodyTop - 2, '#fff0ff');
    } else if (dir === 'up') {
      pxRect(g, cx - 8, bodyTop, 1, 14, '#7a4a18');
      pxDisc(g, cx - 8, bodyTop - 2, 2, '#a070f8');
    } else {
      pxRect(g, cx + 2, bodyTop - 2, 1, 14, '#7a4a18');
      pxDisc(g, cx + 2, bodyTop - 4, 2, '#a070f8');
    }

    // detalhes do robe — estrelinhas
    pixel(g, cx - 3, bodyTop + 4, '#fcd450');
    pixel(g, cx + 2, bodyTop + 6, '#fcd450');

    return c;
  }

  function makeHealerFrame(dir, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#f0c8a0', skinShade: '#c89878',
      hair: '#fcd470', eye: '#3080c0',
      robeMain: '#f0e8d4', robeShade: '#c8b888', robeDark: '#9a8858',
      beltOrTrim: '#fcd450', accent: '#fff0a0',
    };
    // aura
    g.fillStyle = 'rgba(255,240,160,0.18)';
    g.fillRect(2, 14, 28, 24);
    g.fillRect(4, 12, 24, 2);
    g.fillRect(4, 38, 24, 1);

    const ref = drawHumanoidBase(g, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // capuz dourado
    pxRect(g, cx - 5, headY - 1, 10, 3, '#fcd450');
    pxRect(g, cx - 4, headY - 2, 8, 1, '#ffe890');
    outline(g, cx - 5, headY - 1, 10, 3, '#704818');

    // cruz dourada no peito
    pxRect(g, cx - 1, bodyTop + 2, 2, 5, '#fcd450');
    pxRect(g, cx - 2, bodyTop + 3, 4, 2, '#fcd450');
    pixel(g, cx, bodyTop + 3, '#fff0a0');
    pixel(g, cx, bodyTop + 5, '#a08020');

    // trim dourado nas mangas/barra
    pxRect(g, cx - 5, bodyTop + 10, 10, 1, '#fcd450');
    return c;
  }

  function makeCharacter(makeFn) {
    // retorna objeto { dir: [4 frames] }
    const dirs = ['down', 'up', 'left', 'right'];
    const out = {};
    for (const d of dirs) {
      out[d] = [];
      for (let f = 0; f < 4; f++) {
        out[d].push(makeFn(d, f));
      }
    }
    return out;
  }

  // ============================== MOBS ==============================

  function makeSlimeFrames() {
    const w = 28, h = 24;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      // pulinho: f=0 chão, f=1 esticado, f=2 alto, f=3 esticado descida
      const squish = [0, -2, -3, -1][f];
      const wid = [12, 11, 10, 11][f];
      const hei = [10, 11, 13, 11][f];
      const cx = 14, by = 22 + squish;

      // sombra sempre no chão
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(cx - 7, 22, 14, 2);
      g.fillRect(cx - 6, 24 - 1, 12, 1);

      // corpo (formato de gota / domo)
      const top = by - hei;
      pxRect(g, cx - wid + 1, top + 2, wid * 2 - 2, hei - 2, '#5acc4a');
      pxRect(g, cx - wid + 2, top, wid * 2 - 4, 2, '#5acc4a');
      pxRect(g, cx - wid + 3, top - 1, wid * 2 - 6, 1, '#5acc4a');
      // base
      pxRect(g, cx - wid + 2, by - 2, wid * 2 - 4, 2, '#3aa030');

      // brilho
      pxRect(g, cx - wid + 3, top + 1, 3, 2, '#a8f088');
      pixel(g, cx - wid + 4, top, '#d8ffc0');

      // contorno
      outline(g, cx - wid + 1, top, wid * 2 - 2, hei, '#1a4818');

      // olhos
      pxRect(g, cx - 3, top + 4, 2, 2, '#1a1a1a');
      pxRect(g, cx + 1, top + 4, 2, 2, '#1a1a1a');
      pixel(g, cx - 3, top + 4, '#ffffff');
      pixel(g, cx + 1, top + 4, '#ffffff');

      // boquinha
      pxRect(g, cx - 1, top + 7, 2, 1, '#1a1a1a');
      frames.push(c);
    }
    return frames;
  }

  function makeWolfFrames(dir) {
    // 4 frames de animação. dir 'right' base (left = flip)
    const w = 36, h = 28;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cy = 18;
      // sombra
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(6, 24, 24, 2);

      const stepA = [0, -2, 0, 2][f];
      const stepB = [0, 2, 0, -2][f];

      // patas traseiras
      pxRect(g, 8, cy + stepA, 3, 6, '#3a3a48');
      pxRect(g, 12, cy + stepB, 3, 6, '#3a3a48');
      // patas dianteiras
      pxRect(g, 22, cy + stepB, 3, 6, '#3a3a48');
      pxRect(g, 26, cy + stepA, 3, 6, '#3a3a48');

      // corpo
      pxRect(g, 7, 12, 22, 8, '#6e6e7e');
      pxRect(g, 8, 11, 20, 1, '#7e7e8e');
      pxRect(g, 7, 19, 22, 1, '#48485a');
      // listras escuras nas costas
      pxRect(g, 12, 12, 1, 3, '#48485a');
      pxRect(g, 18, 12, 1, 3, '#48485a');
      pxRect(g, 24, 12, 1, 3, '#48485a');

      // cabeça (lado direito = frente)
      pxRect(g, 27, 9, 7, 8, '#6e6e7e');
      pxRect(g, 28, 8, 5, 1, '#7e7e8e');
      // focinho
      pxRect(g, 33, 12, 2, 3, '#48485a');
      pixel(g, 34, 13, '#1a1a1a');
      // orelhas
      pxRect(g, 27, 7, 2, 2, '#48485a');
      pxRect(g, 31, 7, 2, 2, '#48485a');
      // olho vermelho
      pixel(g, 31, 11, '#ff2a2a');
      pixel(g, 32, 11, '#ff6a6a');

      // cauda
      const tailY = 12 + ([0, -1, 0, 1][f]);
      pxRect(g, 4, tailY, 4, 2, '#6e6e7e');
      pxRect(g, 3, tailY, 1, 2, '#48485a');

      outline(g, 7, 11, 22, 9, '#1a1a22');
      frames.push(c);
    }
    return frames;
  }

  function makeGolemFrames() {
    const w = 40, h = 44;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const bob = [0, -1, -2, -1][f];
      const cx = 20;

      // sombra
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(cx - 10, 40, 20, 3);

      // pernas grossas
      pxRect(g, cx - 8, 30 + bob, 6, 10 - bob, '#6a6a78');
      pxRect(g, cx + 2, 30 + bob, 6, 10 - bob, '#6a6a78');
      pxRect(g, cx - 8, 38, 6, 2, '#3a3a48');
      pxRect(g, cx + 2, 38, 6, 2, '#3a3a48');

      // corpo (gigante)
      pxRect(g, cx - 11, 14 + bob, 22, 18, '#8a8a98');
      pxRect(g, cx - 12, 16 + bob, 1, 14, '#8a8a98');
      pxRect(g, cx + 11, 16 + bob, 1, 14, '#8a8a98');
      // sombras
      pxRect(g, cx - 11, 28 + bob, 22, 4, '#5a5a68');
      pxRect(g, cx + 7, 14 + bob, 4, 18, '#6a6a78');
      // pedras / placas
      pxRect(g, cx - 8, 18 + bob, 4, 3, '#aaaab8');
      pxRect(g, cx + 0, 22 + bob, 5, 3, '#9a9aa8');
      pxRect(g, cx - 6, 26 + bob, 3, 2, '#7a7a88');

      // braços enormes
      pxRect(g, cx - 16, 16 + bob, 5, 14, '#8a8a98');
      pxRect(g, cx + 11, 16 + bob, 5, 14, '#8a8a98');
      pxRect(g, cx - 16, 26 + bob, 5, 4, '#5a5a68');
      pxRect(g, cx + 11, 26 + bob, 5, 4, '#5a5a68');
      // punhos
      pxRect(g, cx - 17, 28 + bob, 7, 6, '#7a7a88');
      pxRect(g, cx + 10, 28 + bob, 7, 6, '#7a7a88');

      // cabeça
      pxRect(g, cx - 6, 4 + bob, 12, 10, '#8a8a98');
      pxRect(g, cx - 7, 6 + bob, 1, 6, '#8a8a98');
      pxRect(g, cx + 6, 6 + bob, 1, 6, '#8a8a98');
      pxRect(g, cx - 6, 12 + bob, 12, 2, '#5a5a68');
      // olhos brilhantes laranja
      pxRect(g, cx - 4, 8 + bob, 2, 2, '#ff8030');
      pxRect(g, cx + 2, 8 + bob, 2, 2, '#ff8030');
      pixel(g, cx - 4, 8 + bob, '#ffe080');
      pixel(g, cx + 2, 8 + bob, '#ffe080');
      // boca
      pxRect(g, cx - 2, 12 + bob, 4, 1, '#1a1a22');

      outline(g, cx - 11, 14 + bob, 22, 18, '#1a1a22');
      outline(g, cx - 6, 4 + bob, 12, 10, '#1a1a22');
      frames.push(c);
    }
    return frames;
  }

  function makeSkeletonFrames() {
    const w = 32, h = 40;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cx = 16;
      const bob = [0, -1, 0, -1][f];
      const step = [0, -1, 0, 1][f];

      // sombra
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(cx - 6, 36, 12, 2);

      // pernas (ossos)
      pxRect(g, cx - 4, 28 + (step > 0 ? -1 : 0), 2, 8, '#e8e4d0');
      pxRect(g, cx + 2, 28 + (step < 0 ? -1 : 0), 2, 8, '#e8e4d0');
      pxRect(g, cx - 4, 36, 3, 1, '#e8e4d0');
      pxRect(g, cx + 1, 36, 3, 1, '#e8e4d0');
      pixel(g, cx - 4, 32, '#a09478');
      pixel(g, cx + 3, 32, '#a09478');

      // costelas
      const ribTop = 16 + bob;
      pxRect(g, cx - 5, ribTop, 10, 10, '#e8e4d0');
      pxRect(g, cx - 5, ribTop + 1, 10, 1, '#1a1a22');
      pxRect(g, cx - 5, ribTop + 4, 10, 1, '#1a1a22');
      pxRect(g, cx - 5, ribTop + 7, 10, 1, '#1a1a22');
      // coluna central
      pxRect(g, cx - 1, ribTop, 2, 10, '#a09478');
      outline(g, cx - 5, ribTop, 10, 10, '#1a1a22');

      // braços
      pxRect(g, cx - 7, ribTop + 1, 2, 8, '#e8e4d0');
      pxRect(g, cx + 5, ribTop + 1, 2, 8, '#e8e4d0');

      // crânio
      const skullY = ribTop - 9;
      pxRect(g, cx - 4, skullY, 8, 8, '#e8e4d0');
      pxRect(g, cx - 4, skullY + 7, 8, 1, '#a09478');
      // olhos pretos cavernosos
      pxRect(g, cx - 3, skullY + 3, 2, 2, '#1a1a22');
      pxRect(g, cx + 1, skullY + 3, 2, 2, '#1a1a22');
      // brilho vermelho dentro
      pixel(g, cx - 3, skullY + 4, '#ff2a2a');
      pixel(g, cx + 1, skullY + 4, '#ff2a2a');
      // dentes
      pxRect(g, cx - 2, skullY + 6, 4, 1, '#1a1a22');
      pixel(g, cx - 1, skullY + 6, '#e8e4d0');
      pixel(g, cx + 1, skullY + 6, '#e8e4d0');
      outline(g, cx - 4, skullY, 8, 8, '#1a1a22');

      // espada vermelha na mão direita
      pxRect(g, cx + 7, ribTop + 2, 1, 8, '#c43030');
      pxRect(g, cx + 7, ribTop + 1, 1, 1, '#ff6060');
      pxRect(g, cx + 6, ribTop + 10, 3, 1, '#5a3818');
      frames.push(c);
    }
    return frames;
  }

  // ============================== RECURSOS ==============================

  function makeTree(damage) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(8, 36, 16, 3);

    // tronco
    pxRect(g, 14, 26, 4, 12, '#5a3a18');
    pxRect(g, 14, 26, 1, 12, '#3a2410');
    pxRect(g, 17, 26, 1, 12, '#7a4a20');
    // raízes
    pxRect(g, 12, 36, 8, 2, '#5a3a18');

    // copa: círculo grande
    pxDisc(g, 16, 14, 11, '#1f4e1a');
    pxDisc(g, 13, 11, 7, '#2e6e22');
    pxDisc(g, 19, 13, 5, '#2e6e22');
    // brilhos
    pxDisc(g, 12, 9, 2, '#5fa84a');
    pixel(g, 11, 8, '#88d060');
    pixel(g, 18, 10, '#5fa84a');
    // contorno
    outline(g, 14, 26, 4, 12, '#1a1410');

    if (damage >= 1) {
      // mostrar machucado: alguns pixels marrons no tronco
      pixel(g, 15, 30, '#3a2410');
      pixel(g, 16, 28, '#3a2410');
    }
    if (damage >= 2) {
      pxRect(g, 13, 32, 2, 1, '#3a2410');
      pxRect(g, 17, 30, 2, 1, '#3a2410');
    }
    if (damage >= 3) {
      pxRect(g, 12, 26, 1, 4, '#1a1410');
      pxRect(g, 19, 28, 1, 4, '#1a1410');
    }
    return c;
  }

  function makeRock(damage) {
    const w = 32, h = 28;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(6, 24, 20, 3);

    // forma de pedra (oval + topo)
    pxRect(g, 8, 14, 16, 10, '#8a8e9a');
    pxRect(g, 6, 16, 2, 6, '#7a7e8a');
    pxRect(g, 24, 16, 2, 6, '#7a7e8a');
    pxRect(g, 10, 12, 12, 2, '#9aa0aa');
    pxRect(g, 12, 10, 8, 2, '#aab0ba');
    // sombra
    pxRect(g, 8, 22, 16, 2, '#5a5e6a');
    pxRect(g, 6, 22, 2, 2, '#3a3e4a');
    pxRect(g, 24, 22, 2, 2, '#3a3e4a');
    // brilho
    pxRect(g, 13, 12, 3, 1, '#cad0da');
    pixel(g, 14, 14, '#cad0da');
    // contorno
    outline(g, 8, 12, 16, 12, '#2a2e3a');
    pixel(g, 6, 16, '#2a2e3a');
    pixel(g, 25, 16, '#2a2e3a');

    if (damage >= 1) pixel(g, 12, 18, '#3a3e4a');
    if (damage >= 2) {
      pxRect(g, 16, 16, 2, 1, '#3a3e4a');
      pixel(g, 19, 19, '#3a3e4a');
    }
    if (damage >= 3) {
      pxRect(g, 11, 17, 3, 1, '#1a1e2a');
      pxRect(g, 18, 20, 4, 1, '#1a1e2a');
    }
    return c;
  }

  function makeIron(damage) {
    const w = 32, h = 32;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(6, 28, 20, 3);

    // pedra base (mais escura)
    pxRect(g, 8, 14, 16, 14, '#5a5e6a');
    pxRect(g, 6, 16, 2, 10, '#4a4e5a');
    pxRect(g, 24, 16, 2, 10, '#4a4e5a');
    pxRect(g, 10, 12, 12, 2, '#6a6e7a');
    pxRect(g, 12, 10, 8, 2, '#7a7e8a');
    pxRect(g, 8, 26, 16, 2, '#3a3e4a');

    // veios prateados
    pxRect(g, 11, 16, 4, 1, '#d8dce8');
    pxRect(g, 12, 17, 2, 1, '#a8acb8');
    pxRect(g, 17, 19, 5, 1, '#d8dce8');
    pxRect(g, 18, 20, 3, 1, '#a8acb8');
    pxRect(g, 13, 22, 3, 1, '#d8dce8');
    pixel(g, 14, 23, '#a8acb8');
    pxRect(g, 19, 24, 2, 1, '#d8dce8');
    // brilhos
    pixel(g, 12, 16, '#ffffff');
    pixel(g, 18, 19, '#ffffff');
    pixel(g, 20, 24, '#ffffff');

    outline(g, 8, 12, 16, 16, '#1a1e2a');

    if (damage >= 1) pixel(g, 13, 14, '#1a1e2a');
    if (damage >= 2) pxRect(g, 16, 13, 2, 1, '#1a1e2a');
    if (damage >= 3) pxRect(g, 11, 24, 4, 1, '#1a1e2a');
    return c;
  }

  // ============================== ITENS DE INVENTÁRIO (24x24) ==============================

  function makeItemWood() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // toras empilhadas
    pxRect(g, 4, 8, 16, 6, '#7a4a20');
    pxRect(g, 4, 14, 16, 6, '#7a4a20');
    // anéis das pontas
    pxRect(g, 4, 8, 4, 6, '#9a6a30');
    pxRect(g, 16, 8, 4, 6, '#9a6a30');
    pxRect(g, 4, 14, 4, 6, '#9a6a30');
    pxRect(g, 16, 14, 4, 6, '#9a6a30');
    // anéis internos
    pxRect(g, 5, 10, 2, 2, '#5a3018');
    pxRect(g, 17, 10, 2, 2, '#5a3018');
    pxRect(g, 5, 16, 2, 2, '#5a3018');
    pxRect(g, 17, 16, 2, 2, '#5a3018');
    pixel(g, 6, 11, '#3a2010');
    pixel(g, 18, 11, '#3a2010');
    // textura
    pxRect(g, 9, 10, 6, 1, '#5a3018');
    pxRect(g, 9, 16, 6, 1, '#5a3018');
    outline(g, 4, 8, 16, 6, '#2a1408');
    outline(g, 4, 14, 16, 6, '#2a1408');
    return c;
  }

  function makeItemStone() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 5, 8, 14, 11, '#8a8e9a');
    pxRect(g, 4, 10, 1, 7, '#7a7e8a');
    pxRect(g, 19, 10, 1, 7, '#7a7e8a');
    pxRect(g, 6, 7, 12, 1, '#9aa0aa');
    pxRect(g, 8, 6, 8, 1, '#aab0ba');
    pxRect(g, 5, 18, 14, 2, '#5a5e6a');
    pxRect(g, 8, 9, 3, 1, '#cad0da');
    pixel(g, 9, 11, '#cad0da');
    outline(g, 5, 7, 14, 12, '#2a2e3a');
    return c;
  }

  function makeItemIron() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 5, 8, 14, 11, '#5a5e6a');
    pxRect(g, 6, 7, 12, 1, '#7a7e8a');
    pxRect(g, 5, 18, 14, 2, '#3a3e4a');
    // veios
    pxRect(g, 7, 10, 4, 1, '#d8dce8');
    pxRect(g, 12, 12, 5, 1, '#d8dce8');
    pxRect(g, 8, 14, 3, 1, '#a8acb8');
    pxRect(g, 13, 16, 4, 1, '#d8dce8');
    pixel(g, 8, 10, '#ffffff');
    pixel(g, 14, 12, '#ffffff');
    outline(g, 5, 7, 14, 12, '#1a1e2a');
    return c;
  }

  function makeItemSword(advanced) {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const blade = advanced ? '#a0e0ff' : '#d4d8e0';
    const bladeSh = advanced ? '#5080a8' : '#7a7e8a';
    // lâmina diagonal
    for (let i = 0; i < 14; i++) {
      pxRect(g, 6 + i, 16 - i, 2, 2, blade);
      pixel(g, 6 + i, 17 - i, bladeSh);
    }
    // ponta
    pixel(g, 19, 4, blade);
    pixel(g, 20, 3, blade);
    // brilho
    pixel(g, 11, 11, '#ffffff');
    pixel(g, 14, 8, '#ffffff');
    // guarda
    pxRect(g, 4, 16, 6, 2, '#fcd450');
    pixel(g, 3, 17, '#fcd450');
    pixel(g, 10, 16, '#a08020');
    // cabo
    pxRect(g, 3, 18, 4, 4, '#5a3a18');
    pixel(g, 3, 21, '#3a2010');
    pixel(g, 6, 21, '#3a2010');
    // pomo
    pxRect(g, 2, 21, 1, 2, '#fcd450');
    if (advanced) {
      // gema
      pixel(g, 5, 20, '#a070ff');
    }
    return c;
  }

  function makeItemBow() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // arco curvo
    pxRect(g, 8, 4, 2, 2, '#7a4a18');
    pxRect(g, 6, 6, 2, 3, '#7a4a18');
    pxRect(g, 5, 9, 1, 6, '#7a4a18');
    pxRect(g, 6, 15, 2, 3, '#7a4a18');
    pxRect(g, 8, 18, 2, 2, '#7a4a18');
    // detalhes mais escuros
    pixel(g, 5, 11, '#5a3010');
    pixel(g, 5, 13, '#5a3010');
    // corda
    pxRect(g, 10, 5, 1, 14, '#e0d0a0');
    // flecha
    pxRect(g, 12, 11, 8, 1, '#9a8060');
    pxRect(g, 19, 10, 1, 3, '#c8c8c8');
    pixel(g, 20, 11, '#e8e8e8');
    pxRect(g, 12, 10, 1, 3, '#7a4030');
    pxRect(g, 11, 11, 1, 1, '#c43030');
    return c;
  }

  function makeItemStaff() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // cajado diagonal
    for (let i = 0; i < 14; i++) {
      pxRect(g, 6 + i, 18 - i, 2, 2, '#7a4a18');
      pixel(g, 6 + i, 19 - i, '#5a3010');
    }
    // gema no topo
    pxDisc(g, 19, 5, 3, '#a070f8');
    pxDisc(g, 19, 5, 2, '#c098ff');
    pixel(g, 18, 4, '#fff0ff');
    pixel(g, 19, 4, '#ffffff');
    // brilho
    pixel(g, 17, 6, '#fff0ff');
    pixel(g, 21, 5, '#fff0ff');
    // pomo
    pxRect(g, 4, 20, 3, 3, '#fcd450');
    return c;
  }

  function makeItemPotion() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // tampa
    pxRect(g, 9, 4, 6, 2, '#5a3a18');
    pxRect(g, 10, 6, 4, 2, '#3a2410');
    // gargalo
    pxRect(g, 10, 8, 4, 3, '#d4d4e0');
    // corpo (vidro)
    pxRect(g, 7, 11, 10, 9, '#d8284a');
    pxRect(g, 6, 13, 1, 5, '#d8284a');
    pxRect(g, 17, 13, 1, 5, '#d8284a');
    pxRect(g, 8, 19, 8, 1, '#a01828');
    // brilho do líquido
    pxRect(g, 8, 12, 2, 5, '#ff6080');
    pixel(g, 9, 12, '#ffc8d0');
    // brilho no vidro
    pxRect(g, 15, 12, 1, 4, '#ffffff');
    outline(g, 7, 11, 10, 9, '#1a0810');
    pixel(g, 6, 13, '#1a0810');
    pixel(g, 17, 13, '#1a0810');
    return c;
  }

  function makeItemArmor(advanced) {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const main = advanced ? '#a0e0ff' : '#9aa6b4';
    const shade = advanced ? '#5080a8' : '#56657a';
    const dark = advanced ? '#304878' : '#3e4a5e';
    // peitoral
    pxRect(g, 6, 7, 12, 12, main);
    pxRect(g, 5, 8, 1, 10, main);
    pxRect(g, 18, 8, 1, 10, main);
    // ombros
    pxRect(g, 4, 7, 3, 4, main);
    pxRect(g, 17, 7, 3, 4, main);
    // sombras
    pxRect(g, 6, 17, 12, 2, shade);
    pxRect(g, 16, 8, 2, 10, shade);
    // cinto
    pxRect(g, 6, 14, 12, 1, dark);
    // gola
    pxRect(g, 9, 5, 6, 3, dark);
    pxRect(g, 10, 4, 4, 1, dark);
    // detalhe central
    if (advanced) {
      pixel(g, 11, 11, '#fcd450');
      pixel(g, 12, 11, '#fcd450');
      pixel(g, 11, 12, '#a08020');
      pixel(g, 12, 12, '#a08020');
    } else {
      pxRect(g, 11, 11, 2, 2, '#c43030');
    }
    outline(g, 6, 7, 12, 12, '#1a1410');
    return c;
  }

  // ============================== EFEITOS (FX) ==============================

  function makeSlashFrames() {
    const w = 36, h = 36;
    const frames = [];
    for (let f = 0; f < 5; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      // arco crescente
      const cx = 18, cy = 18;
      const rOut = 8 + f * 2;
      const rIn = rOut - 3;
      const startAng = -Math.PI * 0.7 + f * 0.15;
      const endAng = -Math.PI * 0.1 + f * 0.15;
      const alpha = [1.0, 1.0, 0.85, 0.6, 0.3][f];
      for (let y = -rOut; y <= rOut; y++) {
        for (let x = -rOut; x <= rOut; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d < rIn || d > rOut) continue;
          const a = Math.atan2(y, x);
          if (a < startAng || a > endAng) continue;
          g.fillStyle = `rgba(255,255,255,${alpha})`;
          g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      // núcleo brilhante
      for (let y = -rOut; y <= rOut; y++) {
        for (let x = -rOut; x <= rOut; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d < rIn + 0.5 || d > rOut - 0.5) continue;
          const a = Math.atan2(y, x);
          if (a < startAng || a > endAng) continue;
          g.fillStyle = `rgba(180,220,255,${alpha * 0.7})`;
          g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      frames.push(c);
    }
    return frames;
  }

  function makeExplosionFrames() {
    const w = 64, h = 64;
    const frames = [];
    for (let f = 0; f < 6; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cx = 32, cy = 32;
      const r = [6, 12, 20, 26, 28, 28][f];
      const alpha = [1.0, 1.0, 1.0, 0.8, 0.5, 0.2][f];
      // anel laranja
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d > r) continue;
          let color;
          if (d > r - 2) color = `rgba(255,80,20,${alpha})`;
          else if (d > r - 5) color = `rgba(255,160,40,${alpha})`;
          else if (d > r - 9) color = `rgba(255,220,80,${alpha})`;
          else color = `rgba(255,255,200,${alpha * 0.9})`;
          g.fillStyle = color;
          g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      // chispas
      const rng = rngFn(50 + f);
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2;
        const dist = r * 0.7 + rng() * 6;
        const px = (cx + Math.cos(a) * dist) | 0;
        const py = (cy + Math.sin(a) * dist) | 0;
        g.fillStyle = `rgba(255,255,180,${alpha})`;
        g.fillRect(px, py, 1, 1);
      }
      frames.push(c);
    }
    return frames;
  }

  function makeHealFrames() {
    const w = 32, h = 40;
    const frames = [];
    for (let f = 0; f < 6; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const rng = rngFn(70 + f);
      // flores de luz subindo
      for (let i = 0; i < 8; i++) {
        const x = 4 + ((rng() * 24) | 0);
        const baseY = 36 - f * 5 - ((rng() * 6) | 0);
        if (baseY < 0 || baseY > 38) continue;
        const alpha = 1 - f / 6;
        // pétalas
        g.fillStyle = `rgba(120,255,140,${alpha})`;
        g.fillRect(x, baseY, 2, 2);
        g.fillStyle = `rgba(220,255,200,${alpha})`;
        g.fillRect(x, baseY, 1, 1);
        g.fillStyle = `rgba(80,200,100,${alpha * 0.8})`;
        g.fillRect(x - 1, baseY + 1, 1, 1);
        g.fillRect(x + 2, baseY, 1, 1);
      }
      // brilho central
      g.fillStyle = `rgba(180,255,200,${0.3 - f * 0.05})`;
      g.fillRect(8, 16, 16, 16);
      frames.push(c);
    }
    return frames;
  }

  function makeArrowRainFrames() {
    const w = 80, h = 80;
    const frames = [];
    for (let f = 0; f < 6; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      // círculo do alvo
      const cx = 40, cy = 40, r = 30;
      g.fillStyle = `rgba(80,200,100,${0.3})`;
      pxRing(g, cx, cy, r, '#5cdc7c');
      pxRing(g, cx, cy, r - 1, '#3aa050');
      // marcadores cardinais
      pxRect(g, cx - 1, cy - r, 2, 3, '#88ffaa');
      pxRect(g, cx - 1, cy + r - 2, 2, 3, '#88ffaa');
      pxRect(g, cx - r, cy - 1, 3, 2, '#88ffaa');
      pxRect(g, cx + r - 2, cy - 1, 3, 2, '#88ffaa');

      // flechas caindo
      const rng = rngFn(90 + f);
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2;
        const dist = rng() * (r - 4);
        const px = (cx + Math.cos(a) * dist) | 0;
        const py = (cy + Math.sin(a) * dist) | 0;
        const fall = (f * 4 + i * 2) % 16 - 16; // de cima vindo
        const ay = py + fall;
        if (ay < -4) continue;
        // haste
        for (let k = 0; k < 6; k++) {
          if (ay - k < 0 || ay - k >= h) continue;
          pixel(g, px, ay - k, '#9a8060');
        }
        // ponta
        if (ay >= 0 && ay < h) pixel(g, px, ay, '#cccccc');
        // emplumar
        if (ay - 5 >= 0) pixel(g, px - 1, ay - 5, '#c43030');
        if (ay - 5 >= 0) pixel(g, px + 1, ay - 5, '#c43030');
      }
      frames.push(c);
    }
    return frames;
  }

  function makeTauntFrames() {
    const w = 80, h = 80;
    const frames = [];
    for (let f = 0; f < 5; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cx = 40, cy = 40;
      const r = 8 + f * 7;
      const alpha = 1 - f * 0.2;
      // anel duplo
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d <= r && d >= r - 3) {
            g.fillStyle = `rgba(255,220,80,${alpha})`;
            g.fillRect(cx + x, cy + y, 1, 1);
          } else if (d <= r - 3 && d >= r - 5) {
            g.fillStyle = `rgba(255,160,40,${alpha * 0.8})`;
            g.fillRect(cx + x, cy + y, 1, 1);
          }
        }
      }
      // exclamações ao redor (raiva)
      if (f < 3) {
        const positions = [[cx, cy - 18], [cx + 16, cy], [cx, cy + 18], [cx - 16, cy]];
        for (const [x, y] of positions) {
          g.fillStyle = `rgba(255,80,40,${alpha})`;
          g.fillRect(x, y, 2, 4);
          g.fillRect(x, y + 5, 2, 2);
        }
      }
      frames.push(c);
    }
    return frames;
  }

  function makeArrowProjectile() {
    // Projétil de flecha apontando pra direita (rotaciona no draw).
    const w = 16, h = 6;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // haste
    pxRect(g, 2, 2, 11, 2, '#9a8060');
    pxRect(g, 2, 2, 11, 1, '#c0a280');
    // ponta metálica
    pxRect(g, 13, 1, 1, 4, '#c8c8c8');
    pxRect(g, 14, 2, 1, 2, '#e8e8e8');
    pixel(g, 15, 2, '#888888');
    // emplumar
    pxRect(g, 0, 0, 2, 1, '#c43030');
    pxRect(g, 0, 5, 2, 1, '#c43030');
    pixel(g, 0, 1, '#ff6060');
    pixel(g, 0, 4, '#ff6060');
    return c;
  }

  function makeBoltProjectile() {
    // esfera mágica roxa pulsante (1 frame, sem rotação)
    const w = 16, h = 16;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    // halo
    pxDisc(g, 8, 8, 7, 'rgba(160,112,248,0.3)');
    pxDisc(g, 8, 8, 5, '#a070f8');
    pxDisc(g, 8, 8, 4, '#c098ff');
    pxDisc(g, 8, 8, 2, '#ffe0ff');
    pixel(g, 8, 8, '#ffffff');
    // chispas
    pixel(g, 2, 8, '#a070f8');
    pixel(g, 14, 8, '#a070f8');
    pixel(g, 8, 2, '#a070f8');
    pixel(g, 8, 14, '#a070f8');
    return c;
  }

  function makeSparkProjectile() {
    // faísca de cura (pequena estrela verde)
    const w = 12, h = 12;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxDisc(g, 6, 6, 4, 'rgba(120,255,140,0.4)');
    pxDisc(g, 6, 6, 3, '#5cdc7c');
    pxDisc(g, 6, 6, 2, '#a8f088');
    pixel(g, 6, 6, '#ffffff');
    // raios
    pixel(g, 1, 6, '#a8f088');
    pixel(g, 10, 6, '#a8f088');
    pixel(g, 6, 1, '#a8f088');
    pixel(g, 6, 10, '#a8f088');
    return c;
  }

  // ============================== INIT ==============================

  function init() {
    if (Sprites.ready) return;

    // Tiles
    reg('tile_grass', makeGrass(101, false), 32, 32);
    reg('tile_grass2', makeGrass(202, true), 32, 32);
    reg('tile_dirt', makeDirt(303), 32, 32);
    reg('tile_sand', makeSand(404), 32, 32);
    reg('tile_water', makeWaterFrames(), 32, 32);
    reg('tile_mountain', makeMountain(505), 32, 32);
    reg('tile_forest_floor', makeForestFloor(606), 32, 32);
    reg('tile_path', makePath(707), 32, 32);

    // Personagens — guarda como objeto { down:[..], up:[..], left:[..], right:[..] }
    // Pra usar com 'frame' linear, expomos também flat-array indexado por dir:
    // mas o draw lê opts.dir e busca o subarray adequado.
    const characters = {
      warrior: makeCharacter(makeWarriorFrame),
      archer: makeCharacter(makeArcherFrame),
      mage: makeCharacter(makeMageFrame),
      healer: makeCharacter(makeHealerFrame),
    };
    for (const name of Object.keys(characters)) {
      // armazenamos diretamente a tabela de direções no _reg
      Sprites._reg[name] = {
        frames: characters[name].down, // default
        dirs: characters[name],        // tabela completa
        w: 32, h: 40,
      };
    }

    // Mobs
    reg('slime', makeSlimeFrames(), 28, 24);
    // Wolf: gera right e usa flip pra left. Up/down é o mesmo right (mobs simples).
    const wolfRight = makeWolfFrames('right');
    Sprites._reg['wolf'] = {
      frames: wolfRight,
      dirs: { down: wolfRight, up: wolfRight, left: wolfRight, right: wolfRight },
      w: 36, h: 28,
      flipForLeft: true,
    };
    reg('golem', makeGolemFrames(), 40, 44);
    reg('skeleton', makeSkeletonFrames(), 32, 40);

    // Recursos: 4 estados de damage (0..3)
    Sprites._reg['tree'] = {
      frames: [makeTree(0), makeTree(1), makeTree(2), makeTree(3)],
      damageFrames: true,
      w: 32, h: 40,
    };
    Sprites._reg['rock'] = {
      frames: [makeRock(0), makeRock(1), makeRock(2), makeRock(3)],
      damageFrames: true,
      w: 32, h: 28,
    };
    Sprites._reg['iron'] = {
      frames: [makeIron(0), makeIron(1), makeIron(2), makeIron(3)],
      damageFrames: true,
      w: 32, h: 32,
    };

    // Itens de inventário
    reg('item_wood', makeItemWood(), 24, 24);
    reg('item_stone', makeItemStone(), 24, 24);
    reg('item_iron', makeItemIron(), 24, 24);
    reg('item_sword', makeItemSword(false), 24, 24);
    reg('item_sword_advanced', makeItemSword(true), 24, 24);
    reg('item_bow', makeItemBow(), 24, 24);
    reg('item_staff', makeItemStaff(), 24, 24);
    reg('item_potion', makeItemPotion(), 24, 24);
    reg('item_armor', makeItemArmor(false), 24, 24);
    reg('item_armor_advanced', makeItemArmor(true), 24, 24);

    // Efeitos
    reg('fx_slash', makeSlashFrames(), 36, 36);
    reg('fx_explosion', makeExplosionFrames(), 64, 64);
    reg('fx_heal', makeHealFrames(), 32, 40);
    reg('fx_arrow_rain', makeArrowRainFrames(), 80, 80);
    reg('fx_taunt', makeTauntFrames(), 80, 80);
    reg('fx_arrow', makeArrowProjectile(), 16, 6);
    reg('fx_bolt', makeBoltProjectile(), 16, 16);
    reg('fx_spark', makeSparkProjectile(), 12, 12);

    Sprites.ready = true;
  }

  // ============================== DRAW / API PÚBLICA ==============================

  // Aplica tint (sobreposição colorida) e devolve canvas. Cacheia.
  function getTinted(srcCanvas, key, tint) {
    if (Sprites._tintCache[key]) return Sprites._tintCache[key];
    const c = makeCanvas(srcCanvas.width, srcCanvas.height);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(srcCanvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.4;
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    Sprites._tintCache[key] = c;
    return c;
  }

  function pickFrame(entry, name, frame, opts) {
    // Personagem com dirs?
    if (entry.dirs) {
      const dir = (opts && opts.dir) || 'down';
      let arr = entry.dirs[dir] || entry.frames;
      // wolf: left = right flipado (não temos canvas left)
      if (entry.flipForLeft && dir === 'left') {
        arr = entry.dirs.right;
        // forçar flipX no draw
        return { canvas: arr[(frame | 0) % arr.length], forceFlip: true };
      }
      return { canvas: arr[(frame | 0) % arr.length], forceFlip: false };
    }
    // Recurso com damageFrames? frame = damage 0..3
    if (entry.damageFrames) {
      const d = Math.max(0, Math.min(3, frame | 0));
      return { canvas: entry.frames[d], forceFlip: false };
    }
    // Sprite normal: frame = índice de animação
    const arr = entry.frames;
    return { canvas: arr[(frame | 0) % arr.length], forceFlip: false };
  }

  function draw(ctx, name, x, y, frame, opts) {
    if (!Sprites.ready) return;
    const entry = Sprites._reg[name];
    if (!entry) return;
    frame = frame | 0;
    opts = opts || {};

    const picked = pickFrame(entry, name, frame, opts);
    let img = picked.canvas;
    let flipX = !!opts.flipX || picked.forceFlip;
    const scale = opts.scale || 1;
    const alpha = (opts.alpha == null) ? 1 : opts.alpha;
    const tint = opts.tint;

    if (tint) {
      // chave de cache: name|dir|frame|tint
      const dir = opts.dir || 'd';
      const idx = entry.dirs ? frame % (entry.dirs[dir] || entry.frames).length : frame % entry.frames.length;
      const key = `${name}|${dir}|${idx}|${tint}`;
      img = getTinted(img, key, tint);
    }

    const w = img.width * scale;
    const h = img.height * scale;
    const prevAlpha = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;

    if (flipX) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      if (scale !== 1) ctx.drawImage(img, 0, 0, w, h);
      else ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else {
      if (scale !== 1) ctx.drawImage(img, x, y, w, h);
      else ctx.drawImage(img, x, y);
    }

    if (alpha !== 1) ctx.globalAlpha = prevAlpha;
  }

  function getFrameCount(name) {
    const e = Sprites._reg[name];
    if (!e) return 0;
    if (e.dirs) return e.dirs.down.length;
    return e.frames.length;
  }

  function getSize(name) {
    const e = Sprites._reg[name];
    if (!e) return { w: 0, h: 0 };
    return { w: e.w, h: e.h };
  }

  // expor
  Sprites.init = init;
  Sprites.draw = draw;
  Sprites.getFrameCount = getFrameCount;
  Sprites.getSize = getSize;

  window.GTA = window.GTA || {};
  window.GTA.Sprites = Sprites;
})();
