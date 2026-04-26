// Sprites procedurais. Tudo desenhado em offscreen canvases pra render rápido.
// Pixel art "real": cada sprite tem grid lógico pequeno e usa fillRect 1x1.
// Acessado via window.GTA.Sprites.draw(ctx, name, x, y, frame, opts).
//
// opts.dir pode ser:
//   - número: 0=down, 1=left, 2=right, 3=up (formato do render.js)
//   - string: 'down' | 'left' | 'right' | 'up' (compat antiga)
// opts.action pode ser: 'idle' | 'walk' | 'attack' | 'cast' (default: 'walk')
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

  // círculo cheio em pixel art
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

  // elipse achatada — útil pra sombras na base do sprite
  function pxEllipseFilled(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        // (x/rx)^2 + (y/ry)^2 <= 1
        if ((x * x) * (ry * ry) + (y * y) * (rx * rx) <= (rx * rx) * (ry * ry)) {
          g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  }

  // sombra elíptica com alpha — pra base de árvores, pedras, etc.
  function shadowEllipse(g, cx, cy, rx, ry, alpha) {
    const prev = g.globalAlpha;
    g.globalAlpha = alpha;
    pxEllipseFilled(g, cx, cy, rx, ry, '#000');
    g.globalAlpha = prev;
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
  // Cada tile tem 4 variações (frames 0..3). O render espalha pelo mapa
  // com hash determinístico em (tx,ty).

  function grassBase(g, w, h, seed) {
    const r = rngFn(seed);
    pxRect(g, 0, 0, w, h, '#4a8a3a');
    // padrão xadrez sutil — começa em (1,1) e para em (w-2,h-2) pra não tocar
    // as bordas, evitando linhas verticais/horizontais entre tiles adjacentes
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if ((x + y) % 2 === 0) pixel(g, x, y, '#52963f');
      }
    }
    // tons variados pra evitar uniformidade
    for (let i = 0; i < 22; i++) {
      pixel(g, (r() * w) | 0, (r() * h) | 0, '#3a6e2c');
    }
    for (let i = 0; i < 14; i++) {
      const x = (r() * w) | 0, y = (r() * h) | 0;
      pixel(g, x, y, '#5fa84a');
      if (r() < 0.4) pixel(g, x + 1, y, '#5fa84a');
    }
    // micropedrinhas cinza claro
    for (let i = 0; i < 4; i++) {
      const x = (r() * (w - 1)) | 0, y = (r() * (h - 1)) | 0;
      pixel(g, x, y, '#b8a888');
    }
    return r;
  }

  function grassTuft(g, x, y, palette) {
    // tufo de grama 3-4 px de altura
    pixel(g, x, y, palette[0]);
    pixel(g, x, y - 1, palette[1]);
    pixel(g, x - 1, y - 1, palette[0]);
    pixel(g, x + 1, y - 1, palette[0]);
    pixel(g, x, y - 2, palette[1]);
    pixel(g, x - 1, y - 2, palette[2]);
    pixel(g, x + 1, y - 2, palette[2]);
    if ((x + y) % 2 === 0) pixel(g, x, y - 3, palette[2]);
  }

  function makeGrassFrames(seedBase, withFlowers) {
    const w = 32, h = 32;
    const tuftPal = ['#3a6e2c', '#52963f', '#7ac060'];
    const flowerKinds = [
      { center: '#fde04a', petal: '#f0a830' },
      { center: '#ffffff', petal: '#dcdcdc' },
      { center: '#ff80a8', petal: '#d04880' },
      { center: '#a0d8ff', petal: '#5098d8' },
    ];
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = grassBase(g, w, h, seedBase + f * 17);
      // tufos espalhados (posições diferentes por frame)
      const nTufts = 4 + ((r() * 3) | 0);
      for (let i = 0; i < nTufts; i++) {
        const x = 2 + ((r() * (w - 4)) | 0);
        const y = 4 + ((r() * (h - 6)) | 0);
        grassTuft(g, x, y, tuftPal);
      }
      if (withFlowers) {
        // 1-2 flores por tile, kinds diferentes por frame
        const nFlowers = 1 + ((r() * 2) | 0);
        for (let i = 0; i < nFlowers; i++) {
          const kind = flowerKinds[(f + i) % flowerKinds.length];
          const fx = 3 + ((r() * (w - 6)) | 0);
          const fy = 3 + ((r() * (h - 6)) | 0);
          // pétalas em cruz
          pixel(g, fx, fy - 1, kind.petal);
          pixel(g, fx, fy + 1, kind.petal);
          pixel(g, fx - 1, fy, kind.petal);
          pixel(g, fx + 1, fy, kind.petal);
          // miolo
          pixel(g, fx, fy, kind.center);
          // caule
          pixel(g, fx, fy + 2, '#3a6e2c');
        }
      }
      frames.push(c);
    }
    return frames;
  }

  function makeDirtFrames(seedBase) {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = rngFn(seedBase + f * 23);
      // base
      pxRect(g, 0, 0, w, h, '#7a5a3a');
      // ruído de tons
      for (let i = 0; i < 50; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#8e6c46');
      }
      for (let i = 0; i < 38; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#5d4226');
      }
      for (let i = 0; i < 12; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#a88058');
      }
      // sulcos (linhas pequenas marrom escuro — terra batida)
      for (let i = 0; i < 3; i++) {
        const sx = (r() * (w - 6)) | 0;
        const sy = 2 + ((r() * (h - 4)) | 0);
        const len = 3 + ((r() * 4) | 0);
        const horiz = r() < 0.5;
        for (let k = 0; k < len; k++) {
          if (horiz) pixel(g, sx + k, sy, '#4a3220');
          else pixel(g, sx, sy + k, '#4a3220');
        }
      }
      // pedrinhas com leve highlight
      for (let i = 0; i < 4; i++) {
        const x = (r() * (w - 3)) | 0, y = (r() * (h - 3)) | 0;
        pxRect(g, x, y, 2, 2, '#9a8466');
        pixel(g, x, y, '#b8a282');
        pixel(g, x + 1, y + 1, '#604220');
      }
      // pontinhos de musgo sutil
      for (let i = 0; i < 2; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#5a6a30');
      }
      frames.push(c);
    }
    return frames;
  }

  function makeSandFrames(seedBase) {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = rngFn(seedBase + f * 31);
      pxRect(g, 0, 0, w, h, '#d4b87a');
      for (let i = 0; i < 50; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#e6cc92');
      }
      for (let i = 0; i < 38; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#bd9d62');
      }
      // dunas onduladas (linhas curvas mais claras)
      for (let i = 0; i < 3; i++) {
        const baseY = 4 + ((r() * (h - 8)) | 0);
        const startX = (r() * (w - 12)) | 0;
        const len = 8 + ((r() * 8) | 0);
        for (let k = 0; k < len; k++) {
          const dy = Math.round(Math.sin(k * 0.6) * 1.2);
          pixel(g, startX + k, baseY + dy, '#f0d8a0');
          pixel(g, startX + k, baseY + dy + 1, '#b89358');
        }
      }
      // ocasional concha (frame 1) ou pedrinha (frame 3)
      if (f === 1) {
        const sx = 6 + ((r() * 20) | 0), sy = 6 + ((r() * 20) | 0);
        // mini concha rosada
        pxRect(g, sx, sy, 3, 2, '#f0c8d0');
        pixel(g, sx + 1, sy + 1, '#d09098');
        pixel(g, sx, sy + 2, '#a06070');
        pixel(g, sx + 2, sy + 2, '#a06070');
      }
      if (f === 3) {
        const sx = 4 + ((r() * 22) | 0), sy = 4 + ((r() * 22) | 0);
        pxRect(g, sx, sy, 2, 2, '#8a7250');
        pixel(g, sx, sy, '#b09870');
      }
      // brilhinhos esparsos (areia molhada)
      for (let i = 0; i < 3; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#fff2c8');
      }
      frames.push(c);
    }
    return frames;
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
      // reflexos extras (pixels mais claros)
      for (let i = 0; i < 8; i++) {
        const x = ((r() * w) + f) % w | 0;
        const y = ((r() * h) + f * 2) % h | 0;
        pixel(g, x, y, '#d8ecff');
        if (r() < 0.4) pixel(g, x + 1, y, '#a8c8e8');
      }
      // ondas concentricas pequenas
      for (let i = 0; i < 2; i++) {
        const cx = 4 + ((r() * (w - 8)) | 0);
        const cy = 4 + ((r() * (h - 8)) | 0);
        pxRing(g, cx, cy, 2, '#bde0ff');
      }
      // alga ocasional (frame 2 só)
      if (f === 2) {
        const ax = 4 + ((r() * (w - 8)) | 0);
        const ay = 4 + ((r() * (h - 12)) | 0);
        pixel(g, ax, ay, '#3a8a4a');
        pixel(g, ax, ay + 1, '#3a8a4a');
        pixel(g, ax - 1, ay + 1, '#2e6e3a');
        pixel(g, ax + 1, ay + 2, '#2e6e3a');
        pixel(g, ax, ay + 2, '#3a8a4a');
      }
      frames.push(c);
    }
    return frames;
  }

  function makeMountainFrames(seedBase) {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = rngFn(seedBase + f * 41);
      // base mais escura, topo claro
      pxRect(g, 0, 0, w, h, '#6e7a8a');
      pxRect(g, 0, 0, w, 8, '#8a96a6');
      pxRect(g, 0, h - 8, w, 8, '#4a5666');
      // sombra mais profunda nos cantos
      pxRect(g, 0, h - 4, 4, 4, '#3a4252');
      pxRect(g, w - 4, h - 4, 4, 4, '#3a4252');
      // pontinhos de granulação
      for (let i = 0; i < 40; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#828ea0');
      }
      for (let i = 0; i < 22; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#5a6678');
      }
      // cracks (rachaduras zigzag)
      for (let i = 0; i < 4; i++) {
        let x = 2 + ((r() * (w - 4)) | 0);
        let y = (r() * h) | 0;
        const len = 4 + ((r() * 6) | 0);
        for (let k = 0; k < len; k++) {
          pixel(g, x, y, '#2a3242');
          pixel(g, x, y + 1, '#3a4252');
          x += (r() < 0.5 ? -1 : 1);
          y += 1;
          if (y >= h) break;
        }
      }
      // pontinhos brancos (neve no topo)
      for (let i = 0; i < 6; i++) {
        pixel(g, (r() * w) | 0, (r() * 6) | 0, '#e0e8f0');
      }
      // musgo verde sutil em cantos baixos
      for (let i = 0; i < 3; i++) {
        const mx = (r() * w) | 0;
        const my = h - 6 + ((r() * 5) | 0);
        if (my < h) {
          pixel(g, mx, my, '#4a6a32');
          if (r() < 0.5) pixel(g, mx + 1, my, '#3a5a22');
        }
      }
      frames.push(c);
    }
    return frames;
  }

  function makeForestFloorFrames(seedBase) {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = rngFn(seedBase + f * 37);
      pxRect(g, 0, 0, w, h, '#2e5a22');
      for (let i = 0; i < 30; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#1f4216');
      }
      for (let i = 0; i < 16; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#3e7030');
      }
      // folhas caídas (mais variadas)
      for (let i = 0; i < 5; i++) {
        const x = (r() * (w - 3)) | 0, y = (r() * (h - 2)) | 0;
        const c1 = ['#7a4a20', '#a06030', '#c08030', '#8a3818'][(i + f) % 4];
        const c2 = ['#5a3a18', '#7a4020', '#8a5020', '#5a2810'][(i + f) % 4];
        pxRect(g, x, y, 2, 1, c1);
        pixel(g, x, y + 1, c2);
        if (r() < 0.4) pixel(g, x + 2, y, c2);
      }
      // gravetos
      for (let i = 0; i < 2; i++) {
        const sx = (r() * (w - 4)) | 0, sy = (r() * (h - 1)) | 0;
        const horiz = r() < 0.5;
        for (let k = 0; k < 4; k++) {
          if (horiz) pixel(g, sx + k, sy, '#4a3018');
          else pixel(g, sx, sy + k, '#4a3018');
        }
      }
      // cogumelo ocasional (frame 0 e 2)
      if (f === 0 || f === 2) {
        const mx = 6 + ((r() * (w - 12)) | 0);
        const my = 8 + ((r() * (h - 16)) | 0);
        // chapéu vermelho com bolinhas brancas
        pxRect(g, mx - 1, my, 4, 2, '#c43030');
        pxRect(g, mx, my - 1, 2, 1, '#c43030');
        pixel(g, mx, my, '#ffffff');
        pixel(g, mx + 2, my + 1, '#ffffff');
        // talo
        pxRect(g, mx, my + 2, 2, 2, '#f0e8d0');
        pixel(g, mx, my + 3, '#c8b888');
      }
      frames.push(c);
    }
    return frames;
  }

  function makePathFrames(seedBase) {
    const w = 32, h = 32;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const r = rngFn(seedBase + f * 19);
      pxRect(g, 0, 0, w, h, '#9a9588');
      for (let i = 0; i < 40; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#aaa595');
      }
      for (let i = 0; i < 26; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#7a7468');
      }
      // pedrinhas semi-uniformes mas variadas
      const nStones = 5 + ((r() * 3) | 0);
      for (let i = 0; i < nStones; i++) {
        const x = (r() * (w - 4)) | 0, y = (r() * (h - 3)) | 0;
        const sw = 2 + ((r() * 2) | 0);
        const sh = 2;
        pxRect(g, x, y, sw, sh, '#666058');
        pixel(g, x, y, '#888278');
        pixel(g, x + sw - 1, y + sh - 1, '#3a3830');
      }
      // pedras maiores ocasionais
      if (f === 1 || f === 3) {
        const x = 8 + ((r() * 16) | 0), y = 8 + ((r() * 16) | 0);
        pxRect(g, x, y, 4, 3, '#5a544a');
        pxRect(g, x, y, 4, 1, '#7a7468');
        pixel(g, x, y, '#9a9488');
        pixel(g, x + 3, y + 2, '#2a2820');
      }
      // graozinhos brilhantes
      for (let i = 0; i < 3; i++) {
        pixel(g, (r() * w) | 0, (r() * h) | 0, '#d8d0c0');
      }
      frames.push(c);
    }
    return frames;
  }

  // ============================== PERSONAGENS ==============================

  // Cada personagem: 32x40. 4 dirs × 4 actions × 4 frames.
  // dirs: 'down', 'left', 'right', 'up'
  // actions: 'idle', 'walk', 'attack', 'cast'
  //
  // O draw recebe opts.dir (numero ou string) e opts.action.

  // ---------- base humanoide ----------
  // Desenha o corpo base com pernas/braços parametrizados pela action+frame.
  // Retorna { headY, bodyTop, cx } pra cada classe sobrepor cabelo, armas, etc.

  function drawHumanoidBase(g, action, frame, dir, palette) {
    const cx = 16;

    // bobble vertical (corpo "respira" no walk)
    let bobY = 0;
    if (action === 'walk') bobY = (frame === 1 || frame === 3) ? -1 : 0;
    else if (action === 'cast') bobY = (frame === 1 || frame === 2) ? -1 : 0;

    // sombra na base — sempre presente
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(cx - 6, 36, 12, 2);
    g.fillRect(cx - 5, 38, 10, 1);

    const legY = 28;

    // ---------- pernas ----------
    if (action === 'walk') {
      // walk: pernas alternam claramente entre frames
      // frame 0 e 2 = neutro; frame 1 = perna esquerda à frente; frame 3 = perna direita à frente
      let legL_dy = 0, legR_dy = 0;
      let legL_h = 9, legR_h = 9;
      if (frame === 1) { legL_dy = -1; legL_h = 10; legR_dy = 1; legR_h = 8; }
      else if (frame === 3) { legL_dy = 1; legL_h = 8; legR_dy = -1; legR_h = 10; }

      if (dir === 'left' || dir === 'right') {
        pxRect(g, cx - 3, legY + bobY + legL_dy, 3, legL_h - bobY, palette.robeDark);
        pxRect(g, cx + 0, legY + bobY + legR_dy, 3, legR_h - bobY, palette.robeDark);
        pxRect(g, cx - 3, legY + 8, 3, 1, '#222');
        pxRect(g, cx + 0, legY + 8, 3, 1, '#222');
      } else {
        pxRect(g, cx - 4, legY + legL_dy, 3, legL_h, palette.robeDark);
        pxRect(g, cx + 1, legY + legR_dy, 3, legR_h, palette.robeDark);
        pxRect(g, cx - 4, legY + 8, 3, 1, '#1a1a1a');
        pxRect(g, cx + 1, legY + 8, 3, 1, '#1a1a1a');
      }
    } else {
      // idle / attack / cast: postura neutra
      if (dir === 'left' || dir === 'right') {
        pxRect(g, cx - 3, legY + bobY, 3, 9 - bobY, palette.robeDark);
        pxRect(g, cx + 0, legY + bobY, 3, 9 - bobY, palette.robeDark);
        pxRect(g, cx - 3, legY + 8, 3, 1, '#222');
        pxRect(g, cx + 0, legY + 8, 3, 1, '#222');
      } else {
        pxRect(g, cx - 4, legY, 3, 9, palette.robeDark);
        pxRect(g, cx + 1, legY, 3, 9, palette.robeDark);
        pxRect(g, cx - 4, legY + 8, 3, 1, '#1a1a1a');
        pxRect(g, cx + 1, legY + 8, 3, 1, '#1a1a1a');
      }
    }

    // ---------- tronco / robe ----------
    const bodyTop = 18 + bobY;
    pxRect(g, cx - 5, bodyTop, 10, 11, palette.robeMain);
    pxRect(g, cx + 3, bodyTop, 2, 11, palette.robeShade);
    pxRect(g, cx - 5, bodyTop + 9, 10, 2, palette.robeShade);
    if (palette.beltOrTrim) {
      pxRect(g, cx - 5, bodyTop + 7, 10, 1, palette.beltOrTrim);
    }
    outline(g, cx - 5, bodyTop, 10, 11, '#1a1410');

    // ---------- braços ----------
    const armColor = palette.robeMain;
    const armShade = palette.robeShade;

    if (action === 'cast') {
      // braços levantados acima da cabeça (ambos)
      // braço esquerdo
      pxRect(g, cx - 7, bodyTop - 6, 2, 8, armColor);
      pxRect(g, cx - 7, bodyTop - 7, 2, 2, palette.skin); // mão
      // braço direito
      pxRect(g, cx + 5, bodyTop - 6, 2, 8, armColor);
      pxRect(g, cx + 5, bodyTop - 7, 2, 2, palette.skin); // mão
      // sombra leve
      pixel(g, cx - 7, bodyTop, armShade);
      pixel(g, cx + 6, bodyTop, armShade);
    } else if (action === 'attack') {
      // braço direito faz swing pra frente nos frames 0..3
      // frame 0: arma trás; 1: meio; 2: frente (extendido); 3: recuo leve
      const swingPhase = frame % 4;
      if (dir === 'down') {
        // braço esquerdo recuado (lado esquerdo do sprite)
        pxRect(g, cx - 7, bodyTop + 2, 2, 7, armColor);
        pxRect(g, cx - 7, bodyTop + 8, 2, 2, palette.skin);
        // braço direito muda com o swing
        if (swingPhase === 0) {
          // arma trás: braço pra trás/cima (parcial)
          pxRect(g, cx + 5, bodyTop, 2, 6, armColor);
          pxRect(g, cx + 5, bodyTop - 1, 2, 2, palette.skin);
        } else if (swingPhase === 1) {
          // meio: braço lateral
          pxRect(g, cx + 5, bodyTop + 1, 2, 6, armColor);
          pxRect(g, cx + 5, bodyTop + 6, 2, 2, palette.skin);
        } else if (swingPhase === 2) {
          // frente: braço extendido (mais comprido)
          pxRect(g, cx + 5, bodyTop + 4, 2, 8, armColor);
          pxRect(g, cx + 5, bodyTop + 11, 2, 2, palette.skin);
        } else {
          // recuo
          pxRect(g, cx + 5, bodyTop + 2, 2, 7, armColor);
          pxRect(g, cx + 5, bodyTop + 8, 2, 2, palette.skin);
        }
      } else if (dir === 'up') {
        // mesma lógica espelhada — braço atacante do lado esquerdo do sprite
        pxRect(g, cx + 5, bodyTop + 2, 2, 7, armColor);
        pxRect(g, cx + 5, bodyTop + 8, 2, 2, palette.skin);
        if (swingPhase === 0) {
          pxRect(g, cx - 7, bodyTop, 2, 6, armColor);
          pxRect(g, cx - 7, bodyTop - 1, 2, 2, palette.skin);
        } else if (swingPhase === 1) {
          pxRect(g, cx - 7, bodyTop + 1, 2, 6, armColor);
          pxRect(g, cx - 7, bodyTop + 6, 2, 2, palette.skin);
        } else if (swingPhase === 2) {
          pxRect(g, cx - 7, bodyTop + 4, 2, 8, armColor);
          pxRect(g, cx - 7, bodyTop + 11, 2, 2, palette.skin);
        } else {
          pxRect(g, cx - 7, bodyTop + 2, 2, 7, armColor);
          pxRect(g, cx - 7, bodyTop + 8, 2, 2, palette.skin);
        }
      } else {
        // left/right: 1 braço visível, estende pra frente
        if (swingPhase === 0) {
          pxRect(g, cx - 1, bodyTop + 1, 2, 7, armColor);
          pxRect(g, cx - 1, bodyTop + 7, 2, 2, palette.skin);
        } else if (swingPhase === 1) {
          pxRect(g, cx - 1, bodyTop + 2, 2, 8, armColor);
          pxRect(g, cx - 1, bodyTop + 9, 2, 2, palette.skin);
        } else if (swingPhase === 2) {
          // estendido pra frente
          pxRect(g, cx - 1, bodyTop + 3, 4, 3, armColor);
          pxRect(g, cx + 2, bodyTop + 3, 2, 3, palette.skin);
        } else {
          pxRect(g, cx - 1, bodyTop + 2, 2, 7, armColor);
          pxRect(g, cx - 1, bodyTop + 8, 2, 2, palette.skin);
        }
      }
    } else if (action === 'walk') {
      // walk: braços laterais com swing oposto às pernas
      if (dir === 'down' || dir === 'up') {
        const swing = (frame % 2 === 0) ? 0 : 1;
        pxRect(g, cx - 7, bodyTop + 1 + swing, 2, 8, armColor);
        pxRect(g, cx + 5, bodyTop + 1 - swing, 2, 8, armColor);
        pixel(g, cx - 7, bodyTop + 8 + swing, armShade);
        pixel(g, cx + 6, bodyTop + 8 - swing, armShade);
        pxRect(g, cx - 7, bodyTop + 8 + swing, 2, 2, palette.skin);
        pxRect(g, cx + 5, bodyTop + 8 - swing, 2, 2, palette.skin);
      } else {
        const swing = (frame === 1) ? -1 : (frame === 3) ? 1 : 0;
        pxRect(g, cx - 1, bodyTop + 2 + swing, 2, 7, armColor);
        pxRect(g, cx - 1, bodyTop + 8 + swing, 2, 2, palette.skin);
      }
    } else {
      // idle: braços parados nas laterais
      if (dir === 'down' || dir === 'up') {
        pxRect(g, cx - 7, bodyTop + 1, 2, 8, armColor);
        pxRect(g, cx + 5, bodyTop + 1, 2, 8, armColor);
        pxRect(g, cx - 7, bodyTop + 8, 2, 2, palette.skin);
        pxRect(g, cx + 5, bodyTop + 8, 2, 2, palette.skin);
      } else {
        pxRect(g, cx - 1, bodyTop + 2, 2, 7, armColor);
        pxRect(g, cx - 1, bodyTop + 8, 2, 2, palette.skin);
      }
    }

    // ---------- cabeça 8x8 ----------
    const headY = bodyTop - 9;
    pxRect(g, cx - 4, headY, 8, 8, palette.skin);
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

    // olhos
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

  // ---------- aura/fx pra cast ----------
  function drawCastAura(g, frame, color, alpha) {
    // aura piscando ao redor do corpo. frames pares = mais forte
    const a = (frame % 2 === 0) ? alpha : alpha * 0.55;
    g.globalAlpha = a;
    g.fillStyle = color;
    // ring grande ao redor do personagem
    g.fillRect(2, 14, 28, 24);
    g.fillRect(4, 12, 24, 2);
    g.fillRect(4, 38, 24, 1);
    g.globalAlpha = 1;
    // chispas extras nos cantos (aleatórias por frame)
    const r = rngFn(700 + frame * 13);
    g.fillStyle = color;
    g.globalAlpha = a;
    for (let i = 0; i < 5; i++) {
      const x = 2 + ((r() * 28) | 0);
      const y = 4 + ((r() * 30) | 0);
      g.fillRect(x, y, 1, 1);
    }
    g.globalAlpha = 1;
  }

  // ---------- WARRIOR ----------
  function makeWarriorFrame(dir, action, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#5a3818', eye: '#2a1a0a',
      robeMain: '#7a8a9e', robeShade: '#56657a', robeDark: '#3e4a5e',
      beltOrTrim: '#2a3040', accent: '#c0c8d4',
    };

    // aura (cast)
    if (action === 'cast') drawCastAura(g, frame, '#fcd450', 0.32);

    const ref = drawHumanoidBase(g, action, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // ---------- capacete ----------
    pxRect(g, cx - 5, headY - 1, 10, 4, '#9aa6b4');
    pxRect(g, cx - 4, headY + 3, 8, 1, '#9aa6b4');
    // crista vermelha
    pxRect(g, cx - 1, headY - 3, 2, 2, '#c43030');
    pxRect(g, cx, headY - 4, 1, 1, '#e85050');
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

    // ---------- armadura no peito ----------
    pxRect(g, cx - 4, bodyTop + 1, 8, 6, '#9aa6b4');
    pxRect(g, cx - 4, bodyTop + 7, 8, 1, '#56657a');
    pixel(g, cx - 1, bodyTop + 3, '#c43030');
    pixel(g, cx, bodyTop + 3, '#c43030');
    pixel(g, cx, bodyTop + 4, '#e85050');

    // ---------- espada ----------
    // varia de posição com action+frame.
    if (action === 'attack') {
      drawWarriorSwordAttack(g, dir, frame, cx, bodyTop);
    } else if (action === 'cast') {
      // espada nas costas / lateral, parada
      drawWarriorSwordIdle(g, dir, cx, bodyTop);
    } else {
      // walk / idle
      drawWarriorSwordIdle(g, dir, cx, bodyTop);
    }

    return c;
  }

  function drawWarriorSwordIdle(g, dir, cx, bodyTop) {
    if (dir === 'down') {
      pxRect(g, cx + 7, bodyTop + 4, 1, 7, '#d4d8e0');
      pxRect(g, cx + 6, bodyTop + 11, 3, 1, '#5a3818');
      pxRect(g, cx + 7, bodyTop + 12, 1, 2, '#3a2410');
    } else if (dir === 'up') {
      pxRect(g, cx - 8, bodyTop + 2, 1, 7, '#d4d8e0');
      pxRect(g, cx - 9, bodyTop + 1, 3, 1, '#5a3818');
    } else {
      pxRect(g, cx + 1, bodyTop + 2, 1, 8, '#d4d8e0');
      pxRect(g, cx, bodyTop + 10, 3, 1, '#5a3818');
    }
  }

  function drawWarriorSwordAttack(g, dir, frame, cx, bodyTop) {
    // espada faz arco do "trás" pra "frente" do personagem ao longo dos 4 frames.
    // Ainda pintamos uma faixa branca translúcida atrás da arma como motion blur.
    const ph = frame % 4;
    if (dir === 'down') {
      if (ph === 0) {
        // arma erguida (atrás/pra cima)
        pxRect(g, cx + 6, bodyTop - 4, 1, 8, '#d4d8e0');
        pxRect(g, cx + 5, bodyTop + 4, 3, 1, '#5a3818');
      } else if (ph === 1) {
        // meio caminho — diagonal lateral
        pxRect(g, cx + 8, bodyTop + 2, 4, 1, '#d4d8e0');
        pxRect(g, cx + 7, bodyTop + 3, 2, 1, '#5a3818');
        // motion blur (faixa translúcida)
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(cx + 6, bodyTop + 3, 6, 1);
      } else if (ph === 2) {
        // arma à frente (em baixo) — ataque "concluído"
        pxRect(g, cx - 2, bodyTop + 11, 10, 1, '#d4d8e0');
        pxRect(g, cx + 6, bodyTop + 12, 2, 1, '#d4d8e0');
        pxRect(g, cx - 2, bodyTop + 12, 1, 1, '#5a3818');
        // motion blur arco
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(cx - 4, bodyTop + 10, 14, 1);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(cx - 4, bodyTop + 9, 14, 1);
      } else {
        // recuo — arma quase no idle
        pxRect(g, cx + 7, bodyTop + 6, 1, 6, '#d4d8e0');
        pxRect(g, cx + 6, bodyTop + 12, 3, 1, '#5a3818');
      }
    } else if (dir === 'up') {
      if (ph === 0) {
        pxRect(g, cx - 7, bodyTop - 4, 1, 8, '#d4d8e0');
        pxRect(g, cx - 8, bodyTop + 4, 3, 1, '#5a3818');
      } else if (ph === 1) {
        pxRect(g, cx - 11, bodyTop, 4, 1, '#d4d8e0');
        pxRect(g, cx - 9, bodyTop + 1, 2, 1, '#5a3818');
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(cx - 11, bodyTop + 1, 6, 1);
      } else if (ph === 2) {
        // arma estendida pra cima (à frente do personagem)
        pxRect(g, cx - 1, bodyTop - 10, 1, 10, '#d4d8e0');
        pxRect(g, cx - 2, bodyTop, 3, 1, '#5a3818');
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(cx, bodyTop - 10, 1, 10);
      } else {
        pxRect(g, cx - 8, bodyTop + 4, 1, 6, '#d4d8e0');
        pxRect(g, cx - 9, bodyTop + 1, 3, 1, '#5a3818');
      }
    } else {
      // left/right
      if (ph === 0) {
        pxRect(g, cx + 1, bodyTop - 4, 1, 8, '#d4d8e0');
        pxRect(g, cx, bodyTop + 4, 3, 1, '#5a3818');
      } else if (ph === 1) {
        pxRect(g, cx + 3, bodyTop + 2, 4, 1, '#d4d8e0');
        pxRect(g, cx + 2, bodyTop + 3, 2, 1, '#5a3818');
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(cx + 2, bodyTop + 3, 5, 1);
      } else if (ph === 2) {
        // arma à frente, mais comprida e com vibração
        pxRect(g, cx + 4, bodyTop + 4, 8, 1, '#d4d8e0');
        pixel(g, cx + 12, bodyTop + 4, '#ffffff');
        pxRect(g, cx + 3, bodyTop + 5, 2, 1, '#5a3818');
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(cx + 4, bodyTop + 3, 8, 1);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(cx + 4, bodyTop + 5, 8, 1);
      } else {
        pxRect(g, cx + 1, bodyTop + 6, 1, 6, '#d4d8e0');
        pxRect(g, cx, bodyTop + 12, 3, 1, '#5a3818');
      }
    }
  }

  // ---------- ARCHER ----------
  function makeArcherFrame(dir, action, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#3a2418', eye: '#1a0a0a',
      robeMain: '#3a7a3a', robeShade: '#285628', robeDark: '#1a3e1a',
      beltOrTrim: '#5a3a18', accent: '#88c060',
    };

    if (action === 'cast') drawCastAura(g, frame, '#5cdc7c', 0.35);

    const ref = drawHumanoidBase(g, action, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // capuz
    pxRect(g, cx - 5, headY - 1, 10, 5, '#3a7a3a');
    pxRect(g, cx - 4, headY, 8, 4, '#56a050');
    pxRect(g, cx - 6, headY + 1, 1, 4, '#285628');
    pxRect(g, cx + 5, headY + 1, 1, 4, '#285628');
    if (dir === 'down') {
      pxRect(g, cx - 4, headY + 4, 8, 1, '#3a2818');
      pixel(g, cx - 2, headY + 5, '#88c060');
      pixel(g, cx + 1, headY + 5, '#88c060');
    } else if (dir === 'left' || dir === 'right') {
      pixel(g, cx + 1, headY + 5, '#88c060');
    }
    outline(g, cx - 5, headY - 1, 10, 5, '#142810');

    // aljava nas costas
    pixel(g, cx - 4, bodyTop + 2, '#5a3a18');
    pixel(g, cx - 3, bodyTop + 1, '#e0d0a0');
    pixel(g, cx - 2, bodyTop + 1, '#e0d0a0');

    // arco
    if (action === 'attack') {
      drawArcherBowAttack(g, dir, frame, cx, bodyTop);
    } else {
      drawArcherBowIdle(g, dir, cx, bodyTop);
    }

    return c;
  }

  function drawArcherBowIdle(g, dir, cx, bodyTop) {
    if (dir === 'down') {
      pxRect(g, cx + 6, bodyTop + 1, 1, 11, '#7a4a18');
      pixel(g, cx + 5, bodyTop, '#5a3010');
      pixel(g, cx + 5, bodyTop + 12, '#5a3010');
      pxRect(g, cx + 7, bodyTop + 1, 1, 11, '#e0d0a0');
    } else if (dir === 'up') {
      pxRect(g, cx - 7, bodyTop + 1, 1, 11, '#7a4a18');
      pxRect(g, cx - 8, bodyTop + 1, 1, 11, '#e0d0a0');
    } else {
      pxRect(g, cx + 2, bodyTop + 1, 1, 10, '#7a4a18');
      pxRect(g, cx + 3, bodyTop + 2, 1, 8, '#e0d0a0');
    }
  }

  function drawArcherBowAttack(g, dir, frame, cx, bodyTop) {
    // ataque: braço estende pra frente segurando arco; arco vibra no último frame
    const ph = frame % 4;
    const vibrate = (ph === 3) ? (frame % 2 === 0 ? -1 : 1) : 0;

    if (dir === 'down') {
      // arco erguido na frente; corda puxada no frame 1
      const bx = cx + (ph === 2 ? 8 : 6);
      pxRect(g, bx, bodyTop + 1 + vibrate, 1, 11, '#7a4a18');
      pxRect(g, bx + 1, bodyTop + 1 + vibrate, 1, 11, '#e0d0a0');
      // corda puxada
      if (ph === 1) {
        pxRect(g, bx - 2, bodyTop + 5, 3, 1, '#e0d0a0');
        pxRect(g, bx - 3, bodyTop + 6, 1, 1, '#9a8060');
      }
      // disparo (frame 2)
      if (ph === 2) {
        pxRect(g, bx + 3, bodyTop + 6, 4, 1, '#9a8060');
        pixel(g, bx + 7, bodyTop + 6, '#cccccc');
      }
    } else if (dir === 'up') {
      const bx = cx - (ph === 2 ? 9 : 7);
      pxRect(g, bx, bodyTop + 1 + vibrate, 1, 11, '#7a4a18');
      pxRect(g, bx - 1, bodyTop + 1 + vibrate, 1, 11, '#e0d0a0');
      if (ph === 1) {
        pxRect(g, bx + 1, bodyTop + 5, 3, 1, '#e0d0a0');
      }
      if (ph === 2) {
        pxRect(g, bx - 5, bodyTop + 6, 4, 1, '#9a8060');
        pixel(g, bx - 6, bodyTop + 6, '#cccccc');
      }
    } else {
      // left/right
      const bx = cx + (ph === 2 ? 4 : 2);
      pxRect(g, bx, bodyTop + (ph === 2 ? -1 : 0) + vibrate, 1, 10, '#7a4a18');
      pxRect(g, bx + 1, bodyTop + 1, 1, 8, '#e0d0a0');
      if (ph === 1) {
        pxRect(g, bx - 2, bodyTop + 4, 3, 1, '#e0d0a0');
      }
      if (ph === 2) {
        // disparo: flecha se afastando
        pxRect(g, bx + 3, bodyTop + 4, 5, 1, '#9a8060');
        pixel(g, bx + 8, bodyTop + 4, '#cccccc');
      }
    }
  }

  // ---------- MAGE ----------
  function makeMageFrame(dir, action, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#e8b890', skinShade: '#b88860',
      hair: '#a0a0b0', eye: '#3060c0',
      robeMain: '#6e3ec8', robeShade: '#4a2890', robeDark: '#321862',
      beltOrTrim: '#fcd450', accent: '#a070f8',
    };

    if (action === 'cast') drawCastAura(g, frame, '#a070f8', 0.42);

    const ref = drawHumanoidBase(g, action, frame, dir, palette);
    const cx = ref.cx, bodyTop = ref.bodyTop, headY = ref.headY;

    // chapéu pontudo
    pxRect(g, cx - 5, headY - 1, 10, 2, '#321862');
    pxRect(g, cx - 4, headY - 3, 8, 2, '#4a2890');
    pxRect(g, cx - 3, headY - 5, 6, 2, '#6e3ec8');
    pxRect(g, cx - 2, headY - 7, 4, 2, '#4a2890');
    pxRect(g, cx - 1, headY - 9, 2, 2, '#321862');
    pixel(g, cx, headY - 8, '#fcd450');
    pixel(g, cx, headY - 5, '#fcd450');
    outline(g, cx - 5, headY - 1, 10, 2, '#10082a');

    // barba branca
    if (dir === 'down') {
      pxRect(g, cx - 3, headY + 6, 6, 2, '#e0e0f0');
      pixel(g, cx - 1, headY + 7, '#5a2a1a');
      pixel(g, cx, headY + 7, '#5a2a1a');
    } else if (dir === 'left' || dir === 'right') {
      pxRect(g, cx, headY + 6, 4, 2, '#e0e0f0');
    }

    // detalhes do robe
    pixel(g, cx - 3, bodyTop + 4, '#fcd450');
    pixel(g, cx + 2, bodyTop + 6, '#fcd450');

    // cajado
    if (action === 'attack') {
      drawMageStaffAttack(g, dir, frame, cx, bodyTop);
    } else {
      drawMageStaffIdle(g, dir, cx, bodyTop);
    }

    return c;
  }

  function drawMageStaffIdle(g, dir, cx, bodyTop) {
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
  }

  function drawMageStaffAttack(g, dir, frame, cx, bodyTop) {
    const ph = frame % 4;
    // cajado se ergue, gema brilha mais, no frame 2 a gema "explode" (raios extras)
    const gemBoost = (ph === 2);
    const gemColor = gemBoost ? '#ffe0ff' : '#a070f8';

    if (dir === 'down') {
      // braço estendido: cajado pra frente
      const sx = cx + (ph === 2 ? 9 : 7);
      const sy = bodyTop + (ph === 2 ? -3 : -2);
      pxRect(g, sx, bodyTop + (ph === 2 ? -1 : 0), 1, 14, '#7a4a18');
      pxDisc(g, sx, sy, 2, gemColor);
      if (gemBoost) {
        pxDisc(g, sx, sy, 3, 'rgba(160,112,248,0.5)');
        pixel(g, sx - 3, sy, '#fff0ff');
        pixel(g, sx + 3, sy, '#fff0ff');
        pixel(g, sx, sy - 3, '#fff0ff');
      }
      pixel(g, sx, sy, '#ffffff');
    } else if (dir === 'up') {
      const sx = cx - (ph === 2 ? 10 : 8);
      const sy = bodyTop + (ph === 2 ? -3 : -2);
      pxRect(g, sx, bodyTop + (ph === 2 ? -1 : 0), 1, 14, '#7a4a18');
      pxDisc(g, sx, sy, 2, gemColor);
      if (gemBoost) {
        pxDisc(g, sx, sy, 3, 'rgba(160,112,248,0.5)');
        pixel(g, sx - 3, sy, '#fff0ff');
        pixel(g, sx + 3, sy, '#fff0ff');
      }
    } else {
      const sx = cx + (ph === 2 ? 4 : 2);
      const sy = bodyTop + (ph === 2 ? -5 : -4);
      pxRect(g, sx, bodyTop - 2, 1, 14, '#7a4a18');
      pxDisc(g, sx, sy, 2, gemColor);
      if (gemBoost) {
        pxDisc(g, sx, sy, 3, 'rgba(160,112,248,0.5)');
        pixel(g, sx - 3, sy, '#fff0ff');
        pixel(g, sx + 3, sy, '#fff0ff');
        pixel(g, sx, sy + 3, '#fff0ff');
      }
      pixel(g, sx, sy, '#ffffff');
    }
  }

  // ---------- HEALER ----------
  function makeHealerFrame(dir, action, frame) {
    const w = 32, h = 40;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const palette = {
      skin: '#f0c8a0', skinShade: '#c89878',
      hair: '#fcd470', eye: '#3080c0',
      robeMain: '#f0e8d4', robeShade: '#c8b888', robeDark: '#9a8858',
      beltOrTrim: '#fcd450', accent: '#fff0a0',
    };
    // aura permanente sutil
    g.fillStyle = 'rgba(255,240,160,0.18)';
    g.fillRect(2, 14, 28, 24);
    g.fillRect(4, 12, 24, 2);
    g.fillRect(4, 38, 24, 1);

    // cast: aura dourada/branca piscando mais forte
    if (action === 'cast') drawCastAura(g, frame, '#fff0a0', 0.5);

    const ref = drawHumanoidBase(g, action, frame, dir, palette);
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

    // trim dourado
    pxRect(g, cx - 5, bodyTop + 10, 10, 1, '#fcd450');

    // cajado de cura simples (semelhante ao mage mas branco/dourado)
    if (action === 'attack') {
      drawHealerWandAttack(g, dir, frame, cx, bodyTop);
    } else {
      drawHealerWandIdle(g, dir, cx, bodyTop);
    }

    return c;
  }

  function drawHealerWandIdle(g, dir, cx, bodyTop) {
    if (dir === 'down') {
      pxRect(g, cx + 7, bodyTop, 1, 12, '#9a7028');
      pxDisc(g, cx + 7, bodyTop - 2, 2, '#fff0a0');
      pixel(g, cx + 7, bodyTop - 2, '#ffffff');
    } else if (dir === 'up') {
      pxRect(g, cx - 8, bodyTop, 1, 12, '#9a7028');
      pxDisc(g, cx - 8, bodyTop - 2, 2, '#fff0a0');
    } else {
      pxRect(g, cx + 2, bodyTop - 1, 1, 12, '#9a7028');
      pxDisc(g, cx + 2, bodyTop - 3, 2, '#fff0a0');
    }
  }

  function drawHealerWandAttack(g, dir, frame, cx, bodyTop) {
    const ph = frame % 4;
    const gemColor = (ph === 2) ? '#ffffff' : '#fff0a0';
    if (dir === 'down') {
      const sx = cx + (ph === 2 ? 9 : 7);
      pxRect(g, sx, bodyTop + (ph === 2 ? -1 : 0), 1, 12, '#9a7028');
      pxDisc(g, sx, bodyTop + (ph === 2 ? -3 : -2), 2, gemColor);
      if (ph === 2) {
        pxDisc(g, sx, bodyTop - 3, 3, 'rgba(255,240,160,0.5)');
      }
    } else if (dir === 'up') {
      const sx = cx - (ph === 2 ? 10 : 8);
      pxRect(g, sx, bodyTop + (ph === 2 ? -1 : 0), 1, 12, '#9a7028');
      pxDisc(g, sx, bodyTop + (ph === 2 ? -3 : -2), 2, gemColor);
      if (ph === 2) {
        pxDisc(g, sx, bodyTop - 3, 3, 'rgba(255,240,160,0.5)');
      }
    } else {
      const sx = cx + (ph === 2 ? 4 : 2);
      pxRect(g, sx, bodyTop - 1, 1, 12, '#9a7028');
      pxDisc(g, sx, bodyTop + (ph === 2 ? -5 : -3), 2, gemColor);
      if (ph === 2) {
        pxDisc(g, sx, bodyTop - 5, 3, 'rgba(255,240,160,0.5)');
      }
    }
  }

  // ---------- gerador completo de personagem ----------
  function makeCharacter(makeFn) {
    // retorna { dir: { action: [4 frames] } }
    const dirs = ['down', 'left', 'right', 'up'];
    const actions = ['idle', 'walk', 'attack', 'cast'];
    const out = {};
    for (const d of dirs) {
      out[d] = {};
      for (const a of actions) {
        out[d][a] = [];
        for (let f = 0; f < 4; f++) {
          out[d][a].push(makeFn(d, a, f));
        }
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
      const squish = [0, -2, -3, -1][f];
      const wid = [12, 11, 10, 11][f];
      const hei = [10, 11, 13, 11][f];
      const cx = 14, by = 22 + squish;

      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(cx - 7, 22, 14, 2);
      g.fillRect(cx - 6, 24 - 1, 12, 1);

      const top = by - hei;
      pxRect(g, cx - wid + 1, top + 2, wid * 2 - 2, hei - 2, '#5acc4a');
      pxRect(g, cx - wid + 2, top, wid * 2 - 4, 2, '#5acc4a');
      pxRect(g, cx - wid + 3, top - 1, wid * 2 - 6, 1, '#5acc4a');
      pxRect(g, cx - wid + 2, by - 2, wid * 2 - 4, 2, '#3aa030');

      pxRect(g, cx - wid + 3, top + 1, 3, 2, '#a8f088');
      pixel(g, cx - wid + 4, top, '#d8ffc0');

      outline(g, cx - wid + 1, top, wid * 2 - 2, hei, '#1a4818');

      pxRect(g, cx - 3, top + 4, 2, 2, '#1a1a1a');
      pxRect(g, cx + 1, top + 4, 2, 2, '#1a1a1a');
      pixel(g, cx - 3, top + 4, '#ffffff');
      pixel(g, cx + 1, top + 4, '#ffffff');

      pxRect(g, cx - 1, top + 7, 2, 1, '#1a1a1a');
      frames.push(c);
    }
    return frames;
  }

  function makeWolfFrames(dir) {
    const w = 36, h = 28;
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      const cy = 18;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(6, 24, 24, 2);

      const stepA = [0, -2, 0, 2][f];
      const stepB = [0, 2, 0, -2][f];

      pxRect(g, 8, cy + stepA, 3, 6, '#3a3a48');
      pxRect(g, 12, cy + stepB, 3, 6, '#3a3a48');
      pxRect(g, 22, cy + stepB, 3, 6, '#3a3a48');
      pxRect(g, 26, cy + stepA, 3, 6, '#3a3a48');

      pxRect(g, 7, 12, 22, 8, '#6e6e7e');
      pxRect(g, 8, 11, 20, 1, '#7e7e8e');
      pxRect(g, 7, 19, 22, 1, '#48485a');
      pxRect(g, 12, 12, 1, 3, '#48485a');
      pxRect(g, 18, 12, 1, 3, '#48485a');
      pxRect(g, 24, 12, 1, 3, '#48485a');

      pxRect(g, 27, 9, 7, 8, '#6e6e7e');
      pxRect(g, 28, 8, 5, 1, '#7e7e8e');
      pxRect(g, 33, 12, 2, 3, '#48485a');
      pixel(g, 34, 13, '#1a1a1a');
      pxRect(g, 27, 7, 2, 2, '#48485a');
      pxRect(g, 31, 7, 2, 2, '#48485a');
      pixel(g, 31, 11, '#ff2a2a');
      pixel(g, 32, 11, '#ff6a6a');

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

      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(cx - 10, 40, 20, 3);

      pxRect(g, cx - 8, 30 + bob, 6, 10 - bob, '#6a6a78');
      pxRect(g, cx + 2, 30 + bob, 6, 10 - bob, '#6a6a78');
      pxRect(g, cx - 8, 38, 6, 2, '#3a3a48');
      pxRect(g, cx + 2, 38, 6, 2, '#3a3a48');

      pxRect(g, cx - 11, 14 + bob, 22, 18, '#8a8a98');
      pxRect(g, cx - 12, 16 + bob, 1, 14, '#8a8a98');
      pxRect(g, cx + 11, 16 + bob, 1, 14, '#8a8a98');
      pxRect(g, cx - 11, 28 + bob, 22, 4, '#5a5a68');
      pxRect(g, cx + 7, 14 + bob, 4, 18, '#6a6a78');
      pxRect(g, cx - 8, 18 + bob, 4, 3, '#aaaab8');
      pxRect(g, cx + 0, 22 + bob, 5, 3, '#9a9aa8');
      pxRect(g, cx - 6, 26 + bob, 3, 2, '#7a7a88');

      pxRect(g, cx - 16, 16 + bob, 5, 14, '#8a8a98');
      pxRect(g, cx + 11, 16 + bob, 5, 14, '#8a8a98');
      pxRect(g, cx - 16, 26 + bob, 5, 4, '#5a5a68');
      pxRect(g, cx + 11, 26 + bob, 5, 4, '#5a5a68');
      pxRect(g, cx - 17, 28 + bob, 7, 6, '#7a7a88');
      pxRect(g, cx + 10, 28 + bob, 7, 6, '#7a7a88');

      pxRect(g, cx - 6, 4 + bob, 12, 10, '#8a8a98');
      pxRect(g, cx - 7, 6 + bob, 1, 6, '#8a8a98');
      pxRect(g, cx + 6, 6 + bob, 1, 6, '#8a8a98');
      pxRect(g, cx - 6, 12 + bob, 12, 2, '#5a5a68');
      pxRect(g, cx - 4, 8 + bob, 2, 2, '#ff8030');
      pxRect(g, cx + 2, 8 + bob, 2, 2, '#ff8030');
      pixel(g, cx - 4, 8 + bob, '#ffe080');
      pixel(g, cx + 2, 8 + bob, '#ffe080');
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

      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(cx - 6, 36, 12, 2);

      pxRect(g, cx - 4, 28 + (step > 0 ? -1 : 0), 2, 8, '#e8e4d0');
      pxRect(g, cx + 2, 28 + (step < 0 ? -1 : 0), 2, 8, '#e8e4d0');
      pxRect(g, cx - 4, 36, 3, 1, '#e8e4d0');
      pxRect(g, cx + 1, 36, 3, 1, '#e8e4d0');
      pixel(g, cx - 4, 32, '#a09478');
      pixel(g, cx + 3, 32, '#a09478');

      const ribTop = 16 + bob;
      pxRect(g, cx - 5, ribTop, 10, 10, '#e8e4d0');
      pxRect(g, cx - 5, ribTop + 1, 10, 1, '#1a1a22');
      pxRect(g, cx - 5, ribTop + 4, 10, 1, '#1a1a22');
      pxRect(g, cx - 5, ribTop + 7, 10, 1, '#1a1a22');
      pxRect(g, cx - 1, ribTop, 2, 10, '#a09478');
      outline(g, cx - 5, ribTop, 10, 10, '#1a1a22');

      pxRect(g, cx - 7, ribTop + 1, 2, 8, '#e8e4d0');
      pxRect(g, cx + 5, ribTop + 1, 2, 8, '#e8e4d0');

      const skullY = ribTop - 9;
      pxRect(g, cx - 4, skullY, 8, 8, '#e8e4d0');
      pxRect(g, cx - 4, skullY + 7, 8, 1, '#a09478');
      pxRect(g, cx - 3, skullY + 3, 2, 2, '#1a1a22');
      pxRect(g, cx + 1, skullY + 3, 2, 2, '#1a1a22');
      pixel(g, cx - 3, skullY + 4, '#ff2a2a');
      pixel(g, cx + 1, skullY + 4, '#ff2a2a');
      pxRect(g, cx - 2, skullY + 6, 4, 1, '#1a1a22');
      pixel(g, cx - 1, skullY + 6, '#e8e4d0');
      pixel(g, cx + 1, skullY + 6, '#e8e4d0');
      outline(g, cx - 4, skullY, 8, 8, '#1a1a22');

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

    // sombra elíptica achatada na base
    shadowEllipse(g, 16, 38, 10, 2, 0.4);

    // raízes pequenas espalhando da base do tronco
    pxRect(g, 11, 36, 3, 2, '#3a2410');
    pxRect(g, 18, 36, 3, 2, '#3a2410');
    pixel(g, 10, 37, '#5a3a18');
    pixel(g, 21, 37, '#5a3a18');
    pixel(g, 13, 38, '#2a1408');
    pixel(g, 18, 38, '#2a1408');

    // tronco com casca (linhas verticais marrom escuro)
    pxRect(g, 14, 26, 4, 12, '#5a3a18');
    pxRect(g, 14, 26, 1, 12, '#3a2410'); // sombra esquerda
    pxRect(g, 17, 26, 1, 12, '#7a4a20'); // luz direita
    // textura de casca
    pixel(g, 15, 28, '#3a2410');
    pixel(g, 16, 30, '#3a2410');
    pixel(g, 15, 33, '#3a2410');
    pixel(g, 16, 35, '#3a2410');
    pixel(g, 15, 31, '#7a4a20');

    // copa: 3 tons de verde, com folhas individuais visíveis
    // base escura
    pxDisc(g, 16, 14, 11, '#1f4e1a');
    // tom médio
    pxDisc(g, 13, 11, 7, '#2e6e22');
    pxDisc(g, 19, 13, 5, '#2e6e22');
    pxDisc(g, 15, 17, 5, '#2e6e22');
    // tom claro (highlights)
    pxDisc(g, 12, 9, 3, '#5fa84a');
    pxDisc(g, 18, 11, 2, '#5fa84a');
    pxDisc(g, 14, 14, 2, '#5fa84a');
    // folhas individuais (pixels claros pontuais)
    pixel(g, 11, 8, '#88d060');
    pixel(g, 18, 10, '#88d060');
    pixel(g, 9, 12, '#88d060');
    pixel(g, 22, 14, '#88d060');
    pixel(g, 14, 6, '#88d060');
    pixel(g, 16, 18, '#88d060');
    pixel(g, 20, 9, '#a8e070');
    pixel(g, 12, 16, '#a8e070');
    pixel(g, 17, 7, '#a8e070');
    // pontos escuros (sombras entre folhas)
    pixel(g, 13, 13, '#1a3a14');
    pixel(g, 17, 15, '#1a3a14');
    pixel(g, 21, 11, '#1a3a14');
    pixel(g, 10, 14, '#1a3a14');

    // contorno do tronco
    outline(g, 14, 26, 4, 12, '#1a1410');

    if (damage >= 1) {
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

    // sombra elíptica achatada na base — substitui o retangulo antigo
    shadowEllipse(g, 16, 25, 11, 2, 0.4);

    pxRect(g, 8, 14, 16, 10, '#8a8e9a');
    pxRect(g, 6, 16, 2, 6, '#7a7e8a');
    pxRect(g, 24, 16, 2, 6, '#7a7e8a');
    pxRect(g, 10, 12, 12, 2, '#9aa0aa');
    pxRect(g, 12, 10, 8, 2, '#aab0ba');
    pxRect(g, 8, 22, 16, 2, '#5a5e6a');
    pxRect(g, 6, 22, 2, 2, '#3a3e4a');
    pxRect(g, 24, 22, 2, 2, '#3a3e4a');
    pxRect(g, 13, 12, 3, 1, '#cad0da');
    pixel(g, 14, 14, '#cad0da');
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

    // sombra elíptica achatada na base
    shadowEllipse(g, 16, 29, 11, 2, 0.4);

    pxRect(g, 8, 14, 16, 14, '#5a5e6a');
    pxRect(g, 6, 16, 2, 10, '#4a4e5a');
    pxRect(g, 24, 16, 2, 10, '#4a4e5a');
    pxRect(g, 10, 12, 12, 2, '#6a6e7a');
    pxRect(g, 12, 10, 8, 2, '#7a7e8a');
    pxRect(g, 8, 26, 16, 2, '#3a3e4a');

    pxRect(g, 11, 16, 4, 1, '#d8dce8');
    pxRect(g, 12, 17, 2, 1, '#a8acb8');
    pxRect(g, 17, 19, 5, 1, '#d8dce8');
    pxRect(g, 18, 20, 3, 1, '#a8acb8');
    pxRect(g, 13, 22, 3, 1, '#d8dce8');
    pixel(g, 14, 23, '#a8acb8');
    pxRect(g, 19, 24, 2, 1, '#d8dce8');
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
    pxRect(g, 4, 8, 16, 6, '#7a4a20');
    pxRect(g, 4, 14, 16, 6, '#7a4a20');
    pxRect(g, 4, 8, 4, 6, '#9a6a30');
    pxRect(g, 16, 8, 4, 6, '#9a6a30');
    pxRect(g, 4, 14, 4, 6, '#9a6a30');
    pxRect(g, 16, 14, 4, 6, '#9a6a30');
    pxRect(g, 5, 10, 2, 2, '#5a3018');
    pxRect(g, 17, 10, 2, 2, '#5a3018');
    pxRect(g, 5, 16, 2, 2, '#5a3018');
    pxRect(g, 17, 16, 2, 2, '#5a3018');
    pixel(g, 6, 11, '#3a2010');
    pixel(g, 18, 11, '#3a2010');
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
    for (let i = 0; i < 14; i++) {
      pxRect(g, 6 + i, 16 - i, 2, 2, blade);
      pixel(g, 6 + i, 17 - i, bladeSh);
    }
    pixel(g, 19, 4, blade);
    pixel(g, 20, 3, blade);
    pixel(g, 11, 11, '#ffffff');
    pixel(g, 14, 8, '#ffffff');
    pxRect(g, 4, 16, 6, 2, '#fcd450');
    pixel(g, 3, 17, '#fcd450');
    pixel(g, 10, 16, '#a08020');
    pxRect(g, 3, 18, 4, 4, '#5a3a18');
    pixel(g, 3, 21, '#3a2010');
    pixel(g, 6, 21, '#3a2010');
    pxRect(g, 2, 21, 1, 2, '#fcd450');
    if (advanced) {
      pixel(g, 5, 20, '#a070ff');
    }
    return c;
  }

  function makeItemBow() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 8, 4, 2, 2, '#7a4a18');
    pxRect(g, 6, 6, 2, 3, '#7a4a18');
    pxRect(g, 5, 9, 1, 6, '#7a4a18');
    pxRect(g, 6, 15, 2, 3, '#7a4a18');
    pxRect(g, 8, 18, 2, 2, '#7a4a18');
    pixel(g, 5, 11, '#5a3010');
    pixel(g, 5, 13, '#5a3010');
    pxRect(g, 10, 5, 1, 14, '#e0d0a0');
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
    for (let i = 0; i < 14; i++) {
      pxRect(g, 6 + i, 18 - i, 2, 2, '#7a4a18');
      pixel(g, 6 + i, 19 - i, '#5a3010');
    }
    pxDisc(g, 19, 5, 3, '#a070f8');
    pxDisc(g, 19, 5, 2, '#c098ff');
    pixel(g, 18, 4, '#fff0ff');
    pixel(g, 19, 4, '#ffffff');
    pixel(g, 17, 6, '#fff0ff');
    pixel(g, 21, 5, '#fff0ff');
    pxRect(g, 4, 20, 3, 3, '#fcd450');
    return c;
  }

  function makeItemPotion() {
    const w = 24, h = 24;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 9, 4, 6, 2, '#5a3a18');
    pxRect(g, 10, 6, 4, 2, '#3a2410');
    pxRect(g, 10, 8, 4, 3, '#d4d4e0');
    pxRect(g, 7, 11, 10, 9, '#d8284a');
    pxRect(g, 6, 13, 1, 5, '#d8284a');
    pxRect(g, 17, 13, 1, 5, '#d8284a');
    pxRect(g, 8, 19, 8, 1, '#a01828');
    pxRect(g, 8, 12, 2, 5, '#ff6080');
    pixel(g, 9, 12, '#ffc8d0');
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
    pxRect(g, 6, 7, 12, 12, main);
    pxRect(g, 5, 8, 1, 10, main);
    pxRect(g, 18, 8, 1, 10, main);
    pxRect(g, 4, 7, 3, 4, main);
    pxRect(g, 17, 7, 3, 4, main);
    pxRect(g, 6, 17, 12, 2, shade);
    pxRect(g, 16, 8, 2, 10, shade);
    pxRect(g, 6, 14, 12, 1, dark);
    pxRect(g, 9, 5, 6, 3, dark);
    pxRect(g, 10, 4, 4, 1, dark);
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
      for (let i = 0; i < 8; i++) {
        const x = 4 + ((rng() * 24) | 0);
        const baseY = 36 - f * 5 - ((rng() * 6) | 0);
        if (baseY < 0 || baseY > 38) continue;
        const alpha = 1 - f / 6;
        g.fillStyle = `rgba(120,255,140,${alpha})`;
        g.fillRect(x, baseY, 2, 2);
        g.fillStyle = `rgba(220,255,200,${alpha})`;
        g.fillRect(x, baseY, 1, 1);
        g.fillStyle = `rgba(80,200,100,${alpha * 0.8})`;
        g.fillRect(x - 1, baseY + 1, 1, 1);
        g.fillRect(x + 2, baseY, 1, 1);
      }
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
      const cx = 40, cy = 40, r = 30;
      g.fillStyle = `rgba(80,200,100,${0.3})`;
      pxRing(g, cx, cy, r, '#5cdc7c');
      pxRing(g, cx, cy, r - 1, '#3aa050');
      pxRect(g, cx - 1, cy - r, 2, 3, '#88ffaa');
      pxRect(g, cx - 1, cy + r - 2, 2, 3, '#88ffaa');
      pxRect(g, cx - r, cy - 1, 3, 2, '#88ffaa');
      pxRect(g, cx + r - 2, cy - 1, 3, 2, '#88ffaa');

      const rng = rngFn(90 + f);
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2;
        const dist = rng() * (r - 4);
        const px = (cx + Math.cos(a) * dist) | 0;
        const py = (cy + Math.sin(a) * dist) | 0;
        const fall = (f * 4 + i * 2) % 16 - 16;
        const ay = py + fall;
        if (ay < -4) continue;
        for (let k = 0; k < 6; k++) {
          if (ay - k < 0 || ay - k >= h) continue;
          pixel(g, px, ay - k, '#9a8060');
        }
        if (ay >= 0 && ay < h) pixel(g, px, ay, '#cccccc');
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
    const w = 16, h = 6;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxRect(g, 2, 2, 11, 2, '#9a8060');
    pxRect(g, 2, 2, 11, 1, '#c0a280');
    pxRect(g, 13, 1, 1, 4, '#c8c8c8');
    pxRect(g, 14, 2, 1, 2, '#e8e8e8');
    pixel(g, 15, 2, '#888888');
    pxRect(g, 0, 0, 2, 1, '#c43030');
    pxRect(g, 0, 5, 2, 1, '#c43030');
    pixel(g, 0, 1, '#ff6060');
    pixel(g, 0, 4, '#ff6060');
    return c;
  }

  function makeBoltProjectile() {
    const w = 16, h = 16;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxDisc(g, 8, 8, 7, 'rgba(160,112,248,0.3)');
    pxDisc(g, 8, 8, 5, '#a070f8');
    pxDisc(g, 8, 8, 4, '#c098ff');
    pxDisc(g, 8, 8, 2, '#ffe0ff');
    pixel(g, 8, 8, '#ffffff');
    pixel(g, 2, 8, '#a070f8');
    pixel(g, 14, 8, '#a070f8');
    pixel(g, 8, 2, '#a070f8');
    pixel(g, 8, 14, '#a070f8');
    return c;
  }

  function makeSparkProjectile() {
    const w = 12, h = 12;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    pxDisc(g, 6, 6, 4, 'rgba(120,255,140,0.4)');
    pxDisc(g, 6, 6, 3, '#5cdc7c');
    pxDisc(g, 6, 6, 2, '#a8f088');
    pixel(g, 6, 6, '#ffffff');
    pixel(g, 1, 6, '#a8f088');
    pixel(g, 10, 6, '#a8f088');
    pixel(g, 6, 1, '#a8f088');
    pixel(g, 6, 10, '#a8f088');
    return c;
  }

  // ============================== INIT ==============================

  function init() {
    if (Sprites.ready) return;

    // Tiles — 4 variações por tipo. Render escolhe variação determinística por (tx,ty).
    Sprites._reg['tile_grass'] = { frames: makeGrassFrames(101, false), w: 32, h: 32 };
    Sprites._reg['tile_grass2'] = { frames: makeGrassFrames(202, true), w: 32, h: 32 };
    Sprites._reg['tile_dirt'] = { frames: makeDirtFrames(303), w: 32, h: 32 };
    Sprites._reg['tile_sand'] = { frames: makeSandFrames(404), w: 32, h: 32 };
    Sprites._reg['tile_water'] = { frames: makeWaterFrames(), w: 32, h: 32 };
    Sprites._reg['tile_mountain'] = { frames: makeMountainFrames(505), w: 32, h: 32 };
    Sprites._reg['tile_forest_floor'] = { frames: makeForestFloorFrames(606), w: 32, h: 32 };
    Sprites._reg['tile_path'] = { frames: makePathFrames(707), w: 32, h: 32 };

    // Personagens — 4 dirs × 4 actions × 4 frames cada.
    const characters = {
      warrior: makeCharacter(makeWarriorFrame),
      archer: makeCharacter(makeArcherFrame),
      mage: makeCharacter(makeMageFrame),
      healer: makeCharacter(makeHealerFrame),
    };
    for (const name of Object.keys(characters)) {
      Sprites._reg[name] = {
        // frames default = walk down (fallback se opts não vier)
        frames: characters[name].down.walk,
        actions: characters[name],
        w: 32, h: 40,
      };
    }

    // Mobs
    reg('slime', makeSlimeFrames(), 28, 24);
    const wolfRight = makeWolfFrames('right');
    Sprites._reg['wolf'] = {
      frames: wolfRight,
      dirs: { down: wolfRight, up: wolfRight, left: wolfRight, right: wolfRight },
      w: 36, h: 28,
      flipForLeft: true,
    };
    reg('golem', makeGolemFrames(), 40, 44);
    reg('skeleton', makeSkeletonFrames(), 32, 40);

    // Recursos: 4 estados de damage
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

    // Itens
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

  // Converte opts.dir (numero ou string) pra string interna 'down'|'left'|'right'|'up'
  function normalizeDir(dirOpt) {
    if (typeof dirOpt === 'number') {
      // 0=down, 1=left, 2=right, 3=up
      return ['down', 'left', 'right', 'up'][dirOpt | 0] || 'down';
    }
    if (typeof dirOpt === 'string') return dirOpt;
    return 'down';
  }

  function pickFrame(entry, name, frame, opts) {
    // Personagem com actions (4 dirs × 4 actions)?
    if (entry.actions) {
      const dir = normalizeDir(opts && opts.dir);
      const action = (opts && opts.action) || 'walk';
      const dirTable = entry.actions[dir] || entry.actions.down;
      const arr = dirTable[action] || dirTable.walk || dirTable.idle;
      return { canvas: arr[(frame | 0) % arr.length], forceFlip: false };
    }
    // Mob com dirs (sem actions)?
    if (entry.dirs) {
      const dir = normalizeDir(opts && opts.dir);
      let arr = entry.dirs[dir] || entry.frames;
      if (entry.flipForLeft && dir === 'left') {
        arr = entry.dirs.right;
        return { canvas: arr[(frame | 0) % arr.length], forceFlip: true };
      }
      return { canvas: arr[(frame | 0) % arr.length], forceFlip: false };
    }
    // Recurso com damageFrames? frame = damage 0..3
    if (entry.damageFrames) {
      const d = Math.max(0, Math.min(3, frame | 0));
      return { canvas: entry.frames[d], forceFlip: false };
    }
    // Sprite normal (tile, item, fx): frame = índice
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
      const dir = normalizeDir(opts.dir);
      const action = opts.action || 'walk';
      let len;
      if (entry.actions) {
        const dirTable = entry.actions[dir] || entry.actions.down;
        const arr = dirTable[action] || dirTable.walk;
        len = arr.length;
      } else if (entry.dirs) {
        len = (entry.dirs[dir] || entry.frames).length;
      } else {
        len = entry.frames.length;
      }
      const idx = frame % len;
      const key = `${name}|${dir}|${action}|${idx}|${tint}`;
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
    if (e.actions) return e.actions.down.walk.length;
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
