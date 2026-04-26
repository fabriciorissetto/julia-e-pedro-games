// Mundo: geração procedural, tiles, recursos colhíveis e respawn.
// Layout em 3 anéis a partir do centro: safe (0-15), mid (15-35), outer (35-50).
(function () {
  const TILE = {
    GRASS: 0,
    GRASS2: 1,
    DIRT: 2,
    SAND: 3,
    WATER: 4,      // bloqueia
    MOUNTAIN: 5,   // bloqueia
    FOREST_FLOOR: 6,
    PATH: 7,
  };

  const RES_BLOCK = { tree: true, rock: true, iron: true };

  // chave "tx,ty" -> id de recurso. Reconstruído no generate(); evita scan da Map.
  let resByTile = new Map();

  function key(tx, ty) { return tx * 10000 + ty; }

  // Ruído determinístico baseado em hash. Suave o bastante pra dar formas orgânicas.
  function makeNoise2D(seed) {
    const rng = window.GTA.util.rand(seed);
    // grade de valores aleatórios (16x16) interpolada bilinearmente
    const N = 16;
    const grid = new Float32Array(N * N);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    return function (x, y) {
      // x,y em [0..1) idealmente — usamos repeat
      const fx = ((x % 1) + 1) % 1 * (N - 1);
      const fy = ((y % 1) + 1) % 1 * (N - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
      const tx = fx - x0, ty = fy - y0;
      const a = grid[y0 * N + x0];
      const b = grid[y0 * N + x1];
      const c = grid[y1 * N + x0];
      const d = grid[y1 * N + x1];
      // smoothstep
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const ab = a + (b - a) * sx;
      const cd = c + (d - c) * sx;
      return ab + (cd - ab) * sy;
    };
  }

  function fbm(noise, x, y) {
    // octaves sumadas pra ruído mais natural
    return (
      noise(x * 1, y * 1) * 0.55 +
      noise(x * 2.1, y * 2.1) * 0.30 +
      noise(x * 4.3, y * 4.3) * 0.15
    );
  }

  function distToCenter(tx, ty) {
    const cx = window.GTA.WORLD_W / 2;
    const cy = window.GTA.WORLD_H / 2;
    return Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
  }

  function getZone(tx, ty) {
    const d = distToCenter(tx, ty);
    if (d <= 15) return 'safe';
    if (d <= 35) return 'mid';
    return 'outer';
  }

  function tileAt(tx, ty) {
    const s = window.GTA.state;
    const w = s.world.w, h = s.world.h;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return TILE.MOUNTAIN;
    return s.world.tiles[ty * w + tx];
  }

  function isResourceBlock(tx, ty) {
    const s = window.GTA.state;
    const id = resByTile.get(key(tx, ty));
    if (!id) return false;
    const r = s.resources.get(id);
    if (!r) return false;
    return r.hits < r.maxHits;
  }

  function isWalkable(tx, ty) {
    const t = tileAt(tx, ty);
    if (t === TILE.WATER || t === TILE.MOUNTAIN) return false;
    if (isResourceBlock(tx, ty)) return false;
    return true;
  }

  function isWalkablePx(px, py) {
    const T = window.GTA.state.world.tile;
    return isWalkable(Math.floor(px / T), Math.floor(py / T));
  }

  function getTilesPxRect(camX, camY, w, h) {
    const s = window.GTA.state;
    const T = s.world.tile;
    let tx0 = Math.floor(camX / T) - 1;
    let ty0 = Math.floor(camY / T) - 1;
    let tx1 = Math.ceil((camX + w) / T) + 1;
    let ty1 = Math.ceil((camY + h) / T) + 1;
    const clamp = window.GTA.util.clamp;
    tx0 = clamp(tx0, 0, s.world.w - 1);
    ty0 = clamp(ty0, 0, s.world.h - 1);
    tx1 = clamp(tx1, 0, s.world.w - 1);
    ty1 = clamp(ty1, 0, s.world.h - 1);
    return { tx0, ty0, tx1, ty1 };
  }

  function generate(seed) {
    const s = window.GTA.state;
    s.world.seed = seed >>> 0;
    const W = s.world.w, H = s.world.h;
    const tiles = new Uint8Array(W * H);
    s.world.tiles = tiles;
    s.resources = new Map();
    resByTile = new Map();

    const rng = window.GTA.util.rand(seed);
    const noiseA = makeNoise2D((seed ^ 0xA53C) >>> 0);
    const noiseB = makeNoise2D((seed ^ 0x71F3) >>> 0);

    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(cx, cy);

    // 1) terreno base
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const d = Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
        const zone = d <= 15 ? 'safe' : (d <= 35 ? 'mid' : 'outer');

        // bordas inacessíveis
        if (tx <= 1 || ty <= 1 || tx >= W - 2 || ty >= H - 2) {
          tiles[ty * W + tx] = TILE.MOUNTAIN;
          continue;
        }

        const nx = tx / W, ny = ty / H;
        const elev = fbm(noiseA, nx * 3, ny * 3);   // 0..1
        const moist = fbm(noiseB, nx * 4, ny * 4);  // 0..1

        let t = TILE.GRASS;

        if (zone === 'safe') {
          // praticamente tudo grama; pequeno lago raro no extremo da safe
          if (d > 12 && elev < 0.18) t = TILE.WATER;
          else if (elev > 0.7 && moist < 0.3) t = TILE.DIRT;
          else if (rng() < 0.12) t = TILE.GRASS2;
          else t = TILE.GRASS;
        } else if (zone === 'mid') {
          if (elev < 0.30) t = TILE.WATER;
          else if (elev > 0.78 && moist < 0.45) t = TILE.MOUNTAIN;
          else if (moist > 0.55) t = TILE.GRASS2; // floresta-ish
          else if (elev > 0.65) t = TILE.DIRT;
          else t = TILE.GRASS;
        } else {
          // outer hostil
          if (elev < 0.32) t = TILE.WATER;
          else if (elev > 0.55) t = TILE.MOUNTAIN;
          else if (moist < 0.30) t = TILE.SAND;
          else if (moist > 0.6) t = TILE.GRASS2;
          else if (elev > 0.45) t = TILE.DIRT;
          else t = TILE.GRASS;
        }

        tiles[ty * W + tx] = t;
      }
    }

    // 2) hub central: pequena clareira de PATH
    const hubR = 3;
    for (let dy = -hubR; dy <= hubR; dy++) {
      for (let dx = -hubR; dx <= hubR; dx++) {
        const tx = Math.floor(cx) + dx;
        const ty = Math.floor(cy) + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        if (Math.hypot(dx, dy) <= hubR) {
          tiles[ty * W + tx] = TILE.PATH;
        }
      }
    }

    // 3) recursos
    function tryPlace(type, maxHits, tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
      const t = tiles[ty * W + tx];
      if (t === TILE.WATER || t === TILE.MOUNTAIN || t === TILE.PATH) return false;
      const k = key(tx, ty);
      if (resByTile.has(k)) return false;
      const id = window.GTA.util.uid();
      const T = s.world.tile;
      const r = {
        id, type,
        x: tx * T + T / 2,
        y: ty * T + T / 2,
        tx, ty,
        hits: 0,
        maxHits,
        respawnAt: 0,
      };
      s.resources.set(id, r);
      resByTile.set(k, id);
      // forest floor cosmético embaixo de árvores em zonas com floresta
      if (type === 'tree' && (t === TILE.GRASS || t === TILE.GRASS2)) {
        tiles[ty * W + tx] = TILE.FOREST_FLOOR;
      }
      return true;
    }

    function spawnInZone(type, maxHits, count, zoneFilter) {
      let placed = 0, tries = 0;
      const cap = count * 50;
      while (placed < count && tries < cap) {
        tries++;
        const tx = 2 + Math.floor(rng() * (W - 4));
        const ty = 2 + Math.floor(rng() * (H - 4));
        const z = getZone(tx, ty);
        if (!zoneFilter(z)) continue;
        // densidade extra em áreas úmidas pra árvores (clusters de floresta)
        if (type === 'tree') {
          const m = fbm(noiseB, tx / W * 4, ty / H * 4);
          if (m < 0.45 && rng() > 0.2) continue;
        }
        if (tryPlace(type, maxHits, tx, ty)) placed++;
      }
    }

    // árvores: mid + outer (densas)
    spawnInZone('tree', 3, 120, (z) => z === 'mid' || z === 'outer');
    // pedras: mid + outer
    spawnInZone('rock', 4, 55, (z) => z === 'mid' || z === 'outer');
    // ferro: só outer
    spawnInZone('iron', 6, 28, (z) => z === 'outer');

    // garante que o hub central fica caminhável (sem recurso)
    for (let dy = -hubR - 1; dy <= hubR + 1; dy++) {
      for (let dx = -hubR - 1; dx <= hubR + 1; dx++) {
        const tx = Math.floor(cx) + dx;
        const ty = Math.floor(cy) + dy;
        const k = key(tx, ty);
        const id = resByTile.get(k);
        if (id) {
          s.resources.delete(id);
          resByTile.delete(k);
        }
      }
    }
  }

  function harvestResource(id) {
    const s = window.GTA.state;
    const r = s.resources.get(id);
    if (!r) return { depleted: false, drop: null };
    if (r.hits >= r.maxHits) return { depleted: true, drop: null };

    r.hits++;
    if (r.hits < r.maxHits) {
      return { depleted: false, drop: null };
    }

    // esgotou: agenda respawn entre 30s e 60s e calcula drop
    r.respawnAt = s.now + 30000 + Math.floor(Math.random() * 30000);
    let drop = null;
    if (r.type === 'tree') {
      drop = { item: 'wood', qty: 1 + (Math.random() < 0.5 ? 1 : 0) };
    } else if (r.type === 'rock') {
      drop = { item: 'stone', qty: 1 };
    } else if (r.type === 'iron') {
      drop = { item: 'iron', qty: 1 };
    }
    return { depleted: true, drop };
  }

  function update(now) {
    const s = window.GTA.state;
    // varre só recursos esgotados que já podem voltar
    s.resources.forEach((r) => {
      if (r.hits >= r.maxHits && r.respawnAt > 0 && r.respawnAt <= now) {
        r.hits = 0;
        r.respawnAt = 0;
      }
    });
  }

  function getMobSpawnPoints(zone, count) {
    const s = window.GTA.state;
    const W = s.world.w, H = s.world.h, T = s.world.tile;
    const out = [];
    let tries = 0;
    const cap = count * 80;
    const rng = Math.random;
    while (out.length < count && tries < cap) {
      tries++;
      const tx = 2 + Math.floor(rng() * (W - 4));
      const ty = 2 + Math.floor(rng() * (H - 4));
      if (getZone(tx, ty) !== zone) continue;
      if (!isWalkable(tx, ty)) continue;
      out.push({ x: tx * T + T / 2, y: ty * T + T / 2 });
    }
    return out;
  }

  window.GTA = window.GTA || {};
  window.GTA.World = {
    TILE,
    generate,
    tileAt,
    isWalkable,
    isWalkablePx,
    isResourceBlock,
    getZone,
    getTilesPxRect,
    harvestResource,
    update,
    getMobSpawnPoints,
  };
})();
