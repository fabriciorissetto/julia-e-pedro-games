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
    if (overlayBlocks(tx, ty)) return false;
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
    // Distribuição alvo: 55% grama, 30% terra, 10% água (concentrada em lagos),
    // 5% pedra (MOUNTAIN). Calibrado por thresholds em ruído fbm.
    // Safe zone (centro 0-15): sem pedra/água — sempre caminhável.
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const d = Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
        const zone = d <= 15 ? 'safe' : (d <= 35 ? 'mid' : 'outer');

        // bordas inacessíveis (anel fino)
        if (tx <= 1 || ty <= 1 || tx >= W - 2 || ty >= H - 2) {
          tiles[ty * W + tx] = TILE.MOUNTAIN;
          continue;
        }

        const nx = tx / W, ny = ty / H;
        const elev = fbm(noiseA, nx * 3, ny * 3);   // 0..1
        const moist = fbm(noiseB, nx * 4, ny * 4);  // 0..1

        let t = TILE.GRASS;

        if (zone === 'safe') {
          // grama 95%, terra 5% — sem água/pedra, área de descanso 100% caminhável
          if (moist < 0.30) t = TILE.DIRT;
          else if (rng() < 0.18) t = TILE.GRASS2;
          else t = TILE.GRASS;
        } else {
          // mid + outer compartilham distribuição global. Diferença é só nos overlays/recursos.
          if (elev < 0.20) t = TILE.WATER;             // ~10% — lagos concentrados
          else if (elev > 0.85) t = TILE.MOUNTAIN;     // ~5% — picos isolados (zona de perigo navegável!)
          else if (moist < 0.32) t = TILE.DIRT;        // ~30% — terra seca
          else if (moist > 0.72) t = TILE.GRASS2;      // grama densa (parte do 55%)
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
    // pedras: bem reduzidas, espalhadas — antes eram 55 e travavam o caminho na zona de perigo
    spawnInZone('rock', 4, 25, (z) => z === 'mid' || z === 'outer');
    // ferro: só outer
    spawnInZone('iron', 6, 28, (z) => z === 'outer');

    // 4) overlays decorativos (não-coletáveis)
    s.overlays = new Map();
    spawnOverlays(s, rng, W, H);

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

  // Spawna overlays decorativos. `block: true` impede o jogador de pisar no tile.
  // Casas e árvores frutíferas bloqueiam; arbustos e pedrinhas são transponíveis.
  function spawnOverlays(s, rng, W, H) {
    const T = s.world.tile;

    function placeOverlay(type, tx, ty, block) {
      if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) return false;
      const t = s.world.tiles[ty * W + tx];
      if (t === TILE.WATER || t === TILE.MOUNTAIN || t === TILE.PATH) return false;
      const k = key(tx, ty);
      if (resByTile.has(k)) return false; // recurso lá
      if (s.overlays.has(k)) return false; // overlay lá
      const id = window.GTA.util.uid();
      s.overlays.set(k, { id, type, tx, ty, x: tx * T + T / 2, y: ty * T + T / 2, block: !!block });
      return true;
    }

    function spawn(type, count, opts) {
      const block = !!(opts && opts.block);
      const zoneFilter = (opts && opts.zoneFilter) || (() => true);
      let placed = 0, tries = 0;
      const cap = count * 60;
      while (placed < count && tries < cap) {
        tries++;
        const tx = 2 + Math.floor(rng() * (W - 4));
        const ty = 2 + Math.floor(rng() * (H - 4));
        if (!zoneFilter(getZone(tx, ty))) continue;
        if (placeOverlay(type, tx, ty, block)) placed++;
      }
    }

    // arbustos espalhados (transponíveis) — verde mais comum, marrom em zonas secas
    spawn('bush_green', 80, {});
    spawn('bush_brown', 30, { zoneFilter: (z) => z !== 'safe' });
    spawn('bush_blue',  15, {});
    // pedrinhas decorativas
    spawn('pebble', 60, {});
    // árvores frutíferas (bloqueiam) — mid + outer
    spawn('fruit_tree', 35, { block: true, zoneFilter: (z) => z !== 'safe' });

    // casas formando uma vilazinha em volta do centro
    // cada casa = 5x5 tiles com paredes em volta, porta de 1 tile aberta apontando pro
    // hub central, piso interno, cama (2x1) e criado-mudo + lustre no canto.
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    const houseSpots = [
      // [dx, dy do canto top-left, doorSide('S','N','E','W')]
      [-13, -10, 'S'],
      [ 8,  -10, 'S'],
      [-15,  -2, 'E'],
      [ 11,  -2, 'W'],
      [-13,   8, 'N'],
      [ 8,    8, 'N'],
    ];
    for (const [dx, dy, doorSide] of houseSpots) {
      placeHouse5x5(s, cx + dx, cy + dy, doorSide);
    }
  }

  // Constrói uma casa 5x5 começando em (x0, y0).
  // doorSide ∈ 'N'|'S'|'E'|'W' → posição da porta (tile aberto na parede).
  function placeHouse5x5(s, x0, y0, doorSide) {
    const W = s.world.w, H = s.world.h, T = s.world.tile;

    function setTile(tx, ty, type, block) {
      if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) return;
      const k = key(tx, ty);
      // remove qualquer overlay antigo
      s.overlays.delete(k);
      // remove recurso eventual
      const rid = resByTile.get(k);
      if (rid) { s.resources.delete(rid); resByTile.delete(k); }
      const id = window.GTA.util.uid();
      s.overlays.set(k, { id, type, tx, ty, x: tx * T + T / 2, y: ty * T + T / 2, block: !!block });
    }

    // tile da porta dentro do perímetro 5x5 (índices 0..4):
    // norte=topo: (2,0); sul=base: (2,4); leste=direita: (4,2); oeste=esquerda: (0,2)
    const door = { N: [2, 0], S: [2, 4], E: [4, 2], W: [0, 2] }[doorSide] || [2, 4];

    // 1) piso interno (3x3 dentro) — não bloqueia. Renderer trata 'floor' como
    //    background, sempre desenhado abaixo do jogador.
    for (let dy = 1; dy <= 3; dy++) {
      for (let dx = 1; dx <= 3; dx++) {
        setTile(x0 + dx, y0 + dy, 'floor', false);
      }
    }
    // 2) paredes no perímetro (exceto onde está a porta — fica vazio)
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const isPerimeter = dx === 0 || dx === 4 || dy === 0 || dy === 4;
        if (!isPerimeter) continue;
        if (dx === door[0] && dy === door[1]) continue; // porta = aberto
        setTile(x0 + dx, y0 + dy, 'wall', true);
      }
    }
    // (sem mobília no MVP — Pedro pediu pra tirar cama e criado-mudo)
  }

  function overlayBlocks(tx, ty) {
    const s = window.GTA.state;
    if (!s.overlays) return false;
    const o = s.overlays.get(key(tx, ty));
    return !!(o && o.block);
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
    overlayBlocks,
    getZone,
    getTilesPxRect,
    harvestResource,
    update,
    getMobSpawnPoints,
  };
})();
