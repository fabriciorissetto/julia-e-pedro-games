// Render: câmera, tiles, entidades, FX, overlays. Tudo em canvas 2D pixel-perfect.
(function () {
  const TILE = 32;

  let canvas = null;
  let ctx = null;
  let lastFpsT = 0;
  let fpsAccum = 0;
  let fpsCount = 0;

  const Render = {};

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function classColor(cls) {
    const C = window.GTA.Classes && window.GTA.Classes.get(cls);
    return (C && C.color) || '#fff';
  }

  function hpColor(pct) {
    if (pct > 0.6) return '#3c3';
    if (pct > 0.3) return '#dd3';
    return '#d33';
  }

  // chunky text com sombra preta
  function drawText(text, x, y, color, size, align) {
    ctx.font = 'bold ' + (size || 11) + 'px monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(text, x, y);
  }

  function drawHpBar(x, y, w, h, pct) {
    pct = clamp(pct, 0, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hpColor(pct);
    ctx.fillRect(x, y, Math.floor(w * pct), h);
  }

  function tileSpriteName(code) {
    const T = window.GTA.World && window.GTA.World.TILE;
    if (!T) return 'tile_grass';
    switch (code) {
      case T.GRASS: return 'tile_grass';
      case T.GRASS2: return 'tile_grass2';
      case T.DIRT: return 'tile_dirt';
      case T.SAND: return 'tile_sand';
      case T.WATER: return 'tile_water';
      case T.MOUNTAIN: return 'tile_mountain';
      case T.FOREST_FLOOR: return 'tile_forest_floor';
      case T.PATH: return 'tile_path';
      default: return 'tile_grass';
    }
  }

  function resourceSpriteName(type) {
    if (type === 'tree') return 'tree';
    if (type === 'rock') return 'rock';
    if (type === 'iron') return 'iron';
    return type || 'tree';
  }

  function mobSpriteName(type) {
    return type || 'slime';
  }

  // ---------- init ----------
  Render.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
      const s = window.GTA.state;
      s.canvasW = canvas.width;
      s.canvasH = canvas.height;
    }
    window.addEventListener('resize', resize);
    resize();

    if (window.GTA.Sprites && window.GTA.Sprites.init) {
      window.GTA.Sprites.init();
    }
  };

  // ---------- shake / particles / aoe / projetil ----------
  Render.shake = function (mag, dur) {
    const s = window.GTA.state;
    s.shake = { mag: mag, until: s.now + dur };
  };

  Render.particle = function (p) {
    const s = window.GTA.state;
    const part = {
      x: p.x, y: p.y,
      vx: p.vx || 0, vy: p.vy || 0,
      life: p.life || 500,
      maxLife: p.life || 500,
      color: p.color || '#fff',
      size: p.size || 2,
      kind: p.kind || 'square',
      gravity: p.gravity || 0,
    };
    s.particles.push(part);
  };

  Render.addAoE = function (a) {
    const s = window.GTA.state;
    s.aoeIndicators.push({
      x: a.x, y: a.y, r: a.r,
      life: a.life || 500,
      maxLife: a.life || 500,
      color: a.color || '#fff',
      kind: a.kind || 'circle',
    });
  };

  Render.addProjectile = function (p) {
    const s = window.GTA.state;
    s.projectiles.push({
      x: p.x, y: p.y,
      tx: p.tx, ty: p.ty,
      speed: p.speed || 400,
      kind: p.kind || 'arrow',
      fromId: p.fromId,
      target: p.target,
      damage: p.damage || 0,
      life: p.life || 2000,
      maxLife: p.life || 2000,
    });
  };

  // ---------- update helpers ----------
  function updateParticles(s, dt) {
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1000;
      if (p.life <= 0) s.particles.splice(i, 1);
    }
  }

  function updateFloatingTexts(s, dt) {
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const t = s.floatingTexts[i];
      t.y += (t.vy || -30) * dt;
      t.life -= dt * 1000;
      if (t.life <= 0) s.floatingTexts.splice(i, 1);
    }
  }

  function updateAoE(s, dt) {
    for (let i = s.aoeIndicators.length - 1; i >= 0; i--) {
      const a = s.aoeIndicators[i];
      a.life -= dt * 1000;
      if (a.life <= 0) s.aoeIndicators.splice(i, 1);
    }
  }

  function updateProjectiles(s, dt) {
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const p = s.projectiles[i];
      // se tem alvo vivo, mira nele em runtime (homing leve)
      if (p.target) {
        const mob = s.mobs.get(p.target);
        if (mob && mob.hp > 0) { p.tx = mob.x; p.ty = mob.y; }
      }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || p.life <= 0) {
        s.projectiles.splice(i, 1);
        continue;
      }
      const step = p.speed * dt;
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.life -= dt * 1000;
    }
  }

  // ---------- draw ----------
  Render.draw = function (state) {
    if (!ctx) return;
    const dt = state.dt || 0.016;
    const cw = state.canvasW;
    const ch = state.canvasH;
    const player = state.player;

    // FPS counter
    fpsAccum += dt;
    fpsCount++;
    if (fpsAccum >= 0.5) {
      state.debug.fps = Math.round(fpsCount / fpsAccum);
      fpsAccum = 0;
      fpsCount = 0;
    }

    // (a) câmera com lerp + clamp ao mundo. zoom 1.25x via scale.
    const zoom = (state.camera && state.camera.zoom) || 1.25;
    const vw = cw / zoom;
    const vh = ch / zoom;
    const targetX = player.x - vw / 2;
    const targetY = player.y - vh / 2;
    state.camera.x = lerp(state.camera.x, targetX, 0.15);
    state.camera.y = lerp(state.camera.y, targetY, 0.15);
    const worldPxW = state.world.w * TILE;
    const worldPxH = state.world.h * TILE;
    state.camera.x = clamp(state.camera.x, 0, Math.max(0, worldPxW - vw));
    state.camera.y = clamp(state.camera.y, 0, Math.max(0, worldPxH - vh));

    // (b) screen shake
    let shakeX = 0, shakeY = 0;
    if (state.shake.until > state.now) {
      const m = state.shake.mag;
      shakeX = (Math.random() * 2 - 1) * m;
      shakeY = (Math.random() * 2 - 1) * m;
    }
    const camX = Math.floor(state.camera.x + shakeX);
    const camY = Math.floor(state.camera.y + shakeY);

    // (c) clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, cw, ch);

    const Sprites = window.GTA.Sprites;
    const World = window.GTA.World;
    if (!Sprites || !World) {
      drawText('Aguardando módulos...', 10, 10, '#fff', 12);
      return;
    }

    // mundo+entidades em espaço escalado; UI fica fora pra manter tamanho real
    ctx.save();
    ctx.scale(zoom, zoom);

    // (d) tiles visíveis
    const waterFrame = Math.floor(state.now / 200) % 4;
    const rect = World.getTilesPxRect(camX, camY, vw, vh);
    for (let ty = rect.ty0; ty <= rect.ty1; ty++) {
      for (let tx = rect.tx0; tx <= rect.tx1; tx++) {
        const code = World.tileAt(tx, ty);
        const name = tileSpriteName(code);
        let frame = 0;
        if (name === 'tile_water') frame = waterFrame;
        else {
          // variação determinística pra evitar tiling visual
          frame = ((tx * 73856093) ^ (ty * 19349663)) & 3;
          const fc = Sprites.getFrameCount ? (Sprites.getFrameCount(name) || 1) : 1;
          frame = frame % Math.max(1, fc);
        }
        // drawW/H = TILE+1 pra cobrir gaps de 1px que aparecem por causa do
        // scale fracionário (zoom 1.25). 1px de overdraw é invisível.
        Sprites.draw(ctx, name, tx * TILE - camX, ty * TILE - camY, frame, { drawW: TILE + 1, drawH: TILE + 1 });
      }
    }

    // ---------- coletar entidades visíveis pra ordenar por Y ----------
    const margin = TILE * 2;
    const viewL = camX - margin;
    const viewT = camY - margin;
    const viewR = camX + vw + margin;
    const viewB = camY + vh + margin;

    const drawables = [];

    // recursos
    state.resources.forEach(function (r) {
      if (r.respawnAt > state.now) return;
      if (r.hits >= r.maxHits) return;
      if (r.x < viewL || r.x > viewR || r.y < viewT || r.y > viewB) return;
      drawables.push({ kind: 'resource', y: r.y, ref: r });
    });

    // overlays decorativos (casas, arbustos, frutíferas, pedrinhas)
    if (state.overlays && state.overlays.size > 0) {
      state.overlays.forEach(function (o) {
        if (o.x < viewL || o.x > viewR || o.y < viewT || o.y > viewB) return;
        drawables.push({ kind: 'overlay', y: o.y, ref: o });
      });
    }

    // mobs vivos
    state.mobs.forEach(function (m) {
      if (m.hp <= 0) return;
      if (m.x < viewL || m.x > viewR || m.y < viewT || m.y > viewB) return;
      drawables.push({ kind: 'mob', y: m.y, ref: m });
    });

    // outros jogadores
    state.others.forEach(function (o) {
      if (o.x < viewL || o.x > viewR || o.y < viewT || o.y > viewB) return;
      drawables.push({ kind: 'other', y: o.y, ref: o });
    });

    // player local
    drawables.push({ kind: 'player', y: player.y, ref: player });

    drawables.sort(function (a, b) { return a.y - b.y; });

    // ---------- desenhar entidades ordenadas ----------
    for (let i = 0; i < drawables.length; i++) {
      const d = drawables[i];
      if (d.kind === 'resource') {
        drawResource(d.ref, camX, camY);
      } else if (d.kind === 'overlay') {
        drawOverlay(d.ref, camX, camY);
      } else if (d.kind === 'mob') {
        drawMob(d.ref, state, camX, camY);
      } else if (d.kind === 'other') {
        drawOther(d.ref, state, camX, camY);
      } else if (d.kind === 'player') {
        drawPlayer(d.ref, state, camX, camY);
      }
    }

    // (i,j) nameplates por cima de TODAS as entidades (passe extra)
    state.mobs.forEach(function (m) {
      if (m.hp <= 0) return;
      if (m.x < viewL || m.x > viewR || m.y < viewT || m.y > viewB) return;
      drawMobNameplate(m, camX, camY);
    });
    state.others.forEach(function (o) {
      if (o.x < viewL || o.x > viewR || o.y < viewT || o.y > viewB) return;
      drawPlayerNameplate(o, camX, camY);
    });
    drawPlayerNameplate(player, camX, camY);

    // (k) projéteis (update + draw)
    updateProjectiles(state, dt);
    for (let i = 0; i < state.projectiles.length; i++) {
      drawProjectile(state.projectiles[i], camX, camY);
    }

    // (l) AoE indicators (update + draw)
    updateAoE(state, dt);
    for (let i = 0; i < state.aoeIndicators.length; i++) {
      drawAoE(state.aoeIndicators[i], state, camX, camY);
    }

    // (m) partículas (update + draw)
    updateParticles(state, dt);
    for (let i = 0; i < state.particles.length; i++) {
      drawParticle(state.particles[i], camX, camY);
    }

    // (n) floating texts (update + draw)
    updateFloatingTexts(state, dt);
    for (let i = 0; i < state.floatingTexts.length; i++) {
      const t = state.floatingTexts[i];
      const alpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      drawText(t.text, Math.floor(t.x - camX), Math.floor(t.y - camY), t.color || '#fff', t.size || 12, 'center');
      ctx.globalAlpha = 1;
    }

    // sai do espaço escalado: UI desenha em coords reais
    ctx.restore();

    // (o) UI/HUD
    if (window.GTA.UI && window.GTA.UI.draw) {
      window.GTA.UI.draw(ctx);
    }

    // (p) overlay morte
    if (state.screen === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, cw, ch);
      const secs = Math.max(0, Math.ceil((state.player.respawnIn || 0) / 1000));
      drawText('VOCÊ MORREU', cw / 2, ch / 2 - 20, '#f44', 28, 'center');
      drawText('renascendo em ' + secs + 's', cw / 2, ch / 2 + 20, '#fff', 14, 'center');
    }

    // (q) debug
    if (state.debug.enabled) {
      const lines = [
        'FPS: ' + state.debug.fps,
        'Mobs: ' + state.mobs.size,
        'Pos: ' + Math.floor(player.x / TILE) + ',' + Math.floor(player.y / TILE),
        'Particles: ' + state.particles.length,
        'Projectiles: ' + state.projectiles.length,
      ];
      for (let i = 0; i < lines.length; i++) {
        drawText(lines[i], cw - 10, 10 + i * 14, '#0f0', 11, 'right');
      }
    }
  };

  // ---------- entidades ----------
  function drawResource(r, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const name = resourceSpriteName(r.type);
    const sz = Sprites.getSize ? Sprites.getSize(name) : { w: 32, h: 48 };
    const w = (sz && sz.w) || 32;
    const h = (sz && sz.h) || 48;
    // base no centro do tile, sprite pra cima
    const px = Math.floor(r.x - camX - w / 2);
    const py = Math.floor(r.y - camY - h + 16);
    Sprites.draw(ctx, name, px, py, 0, {});
  }

  function drawOverlay(o, camX, camY) {
    const Sprites = window.GTA.Sprites;
    // 'bed_right' é só pra colisão — sprite real é desenhado pelo tile 'bed' à esquerda
    if (o.type === 'bed_right') return;
    // 'nightstand_lamp' = criado-mudo + abajur por cima na mesma célula
    if (o.type === 'nightstand_lamp') {
      drawSprite('nightstand', o.x, o.y, camX, camY, 0);
      drawSprite('lamp',       o.x, o.y - 6, camX, camY, 0); // levemente acima
      return;
    }
    drawSprite(o.type, o.x, o.y, camX, camY, 0);
  }

  function drawSprite(name, wx, wy, camX, camY, frame) {
    const Sprites = window.GTA.Sprites;
    const sz = Sprites.getSize ? Sprites.getSize(name) : { w: 32, h: 32 };
    const w = (sz && sz.w) || 32;
    const h = (sz && sz.h) || 32;
    // tiles fixos (wall, floor) ancoram no canto top-left do tile.
    if (name === 'wall' || name === 'floor') {
      const TILE = 32;
      const tileX = Math.floor(wx / TILE) * TILE;
      const tileY = Math.floor(wy / TILE) * TILE;
      const px = Math.floor(tileX - camX);
      const py = Math.floor(tileY - camY);
      Sprites.draw(ctx, name, px, py, frame || 0, {});
      return;
    }
    // cama: ancora no canto top-left do tile esquerdo, sprite cobre 2 tiles
    if (name === 'bed') {
      const TILE = 32;
      const tileX = Math.floor(wx / TILE) * TILE;
      const tileY = Math.floor(wy / TILE) * TILE;
      Sprites.draw(ctx, name, Math.floor(tileX - camX), Math.floor(tileY - camY), frame || 0, {});
      return;
    }
    // criado-mudo, abajur, móveis 1x1: âncora no tile (top-left)
    if (name === 'nightstand' || name === 'lamp') {
      const TILE = 32;
      const tileX = Math.floor(wx / TILE) * TILE;
      const tileY = Math.floor(wy / TILE) * TILE;
      Sprites.draw(ctx, name, Math.floor(tileX - camX), Math.floor(tileY - camY), frame || 0, {});
      return;
    }
    // ancora no centro horizontal, base do sprite no tile
    const px = Math.floor(wx - camX - w / 2);
    const py = Math.floor(wy - camY - h + 16);
    Sprites.draw(ctx, name, px, py, frame || 0, {});
  }

  function dirIndex(facing) {
    // ordem comum: down=0, left=1, right=2, up=3
    switch (facing) {
      case 'down': return 0;
      case 'left': return 1;
      case 'right': return 2;
      case 'up': return 3;
      default: return 0;
    }
  }

  // Escala do personagem por classe.
  // +50% pra todos; warrior leva +20% extra (= 1.5 * 1.2 = 1.8).
  function playerScale(cls) {
    return cls === 'warrior' ? 1.8 : 1.5;
  }

  function drawPlayerSprite(p, state, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const name = (window.GTA.Classes.get(p.cls) || {}).sprite || 'warrior';
    const sz = Sprites.getSize ? Sprites.getSize(name) : { w: 32, h: 48 };
    const baseW = (sz && sz.w) || 32;
    const baseH = (sz && sz.h) || 48;
    const sc = playerScale(p.cls);
    const w = Math.round(baseW * sc);
    const h = Math.round(baseH * sc);
    const dir = dirIndex(p.facing);

    // animState expira sozinho pra outros players (player local é cuidado em player.js)
    let action = p.animState || 'idle';
    if (p.animUntil && p.animUntil <= state.now) {
      action = p.moving ? 'walk' : 'idle';
      p.animState = action;
      p.animActionFrame = 0;
    } else if (action === 'attack' || action === 'cast') {
      const total = action === 'attack' ? 220 : 380;
      const left = Math.max(0, p.animUntil - state.now);
      const elapsed = total - left;
      p.animActionFrame = Math.min(3, Math.floor(elapsed / total * 4));
    } else {
      action = p.moving ? 'walk' : 'idle';
    }

    const frame = (action === 'attack' || action === 'cast')
      ? (p.animActionFrame | 0)
      : (p.moving ? (p.animFrame | 0) : 0);
    // ancora os pés mesmo com escala — `+ 16` original era margem do sprite
    const px = Math.floor(p.x - camX - w / 2);
    const py = Math.floor(p.y - camY - h + Math.round(16 * sc));
    const opts = { dir: dir, action: action, scale: sc };
    if (p.lastDmgFlash && p.lastDmgFlash > state.now - 200) {
      opts.tint = '#f44';
    }
    Sprites.draw(ctx, name, px, py, frame, opts);
  }

  function drawPlayer(p, state, camX, camY) {
    drawPlayerSprite(p, state, camX, camY);
  }

  function drawOther(o, state, camX, camY) {
    drawPlayerSprite(o, state, camX, camY);
  }

  function drawMob(m, state, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const name = mobSpriteName(m.type);
    const sz = Sprites.getSize ? Sprites.getSize(name) : { w: 32, h: 32 };
    const w = (sz && sz.w) || 32;
    const h = (sz && sz.h) || 32;
    const frame = Math.floor(state.now / 150) % 4;
    const px = Math.floor(m.x - camX - w / 2);
    const py = Math.floor(m.y - camY - h + 16);

    // aro pulsante embaixo se for o alvo do player
    if (state.player && state.player.target === m.id) {
      const pulse = (Math.sin(state.now / 180) + 1) * 0.5;
      const baseY = py + h - 4;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 79, 111, ' + (0.55 + pulse * 0.4) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px + w / 2, baseY, 14 + pulse * 3, 5 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const opts = {};
    if (m.lastDmgFlash && m.lastDmgFlash > state.now - 150) opts.tint = '#fff';
    if (m.stunUntil && m.stunUntil > state.now) opts.tint = '#ff0';
    Sprites.draw(ctx, name, px, py, frame, opts);
  }

  function drawMobNameplate(m, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const sz = Sprites.getSize ? Sprites.getSize(mobSpriteName(m.type)) : { w: 32, h: 32 };
    const h = (sz && sz.h) || 32;
    const cx = Math.floor(m.x - camX);
    const top = Math.floor(m.y - camY - h + 8);
    const lvl = m.level || 1;
    const label = (m.type || 'mob').charAt(0).toUpperCase() + (m.type || 'mob').slice(1) + ' Lv ' + lvl;
    drawText(label, cx, top - 18, '#fff', 10, 'center');
    drawHpBar(cx - 18, top - 6, 36, 4, m.hp / Math.max(1, m.maxHp));
  }

  function drawPlayerNameplate(p, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const sz = Sprites.getSize ? Sprites.getSize((window.GTA.Classes.get(p.cls) || {}).sprite || 'warrior') : { w: 32, h: 48 };
    const sc = playerScale(p.cls);
    const h = ((sz && sz.h) || 48) * sc;
    const cx = Math.floor(p.x - camX);
    const top = Math.floor(p.y - camY - h + Math.round(8 * sc));
    const name = p.nickname || 'Hero';
    const lvl = 'Lv ' + (p.level || 1);
    drawText(lvl, cx, top - 32, '#ffd24a', 9, 'center');
    drawText(name, cx, top - 22, classColor(p.cls), 11, 'center');
    drawHpBar(cx - 22, top - 8, 44, 5, p.hp / Math.max(1, p.maxHp));

    // balão de chat (se houver mensagem ativa)
    drawChatBubble(p, cx, top - 44);
  }

  function drawChatBubble(p, cx, baseY) {
    const S = window.GTA.state;
    if (!S.chat || !S.chat.bubbles) return;
    // o player local pode não ter um id de servidor (modo offline) — usa 'me'
    const myId = S.net.myServerId;
    const bubbleId = (p === S.player) ? (myId || 'me') : p.id;
    const b = S.chat.bubbles.get(bubbleId);
    if (!b) return;
    const now = Date.now();
    if (b.until <= now) return;

    // configura fonte e mede texto antes do layout
    const FONT_SIZE = 11;
    const LINE_H = FONT_SIZE + 4;
    ctx.font = 'bold ' + FONT_SIZE + 'px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const lines = wrapText(b.text, 26);
    let tw = 0;
    for (const line of lines) tw = Math.max(tw, Math.ceil(ctx.measureText(line).width));

    const padX = 10, padY = 8;
    const w = tw + padX * 2;
    const h = lines.length * LINE_H + padY * 2;
    const x = Math.floor(cx - w / 2);
    const y = Math.floor(baseY - h - 6);

    // fade nos últimos 800ms
    const left = b.until - now;
    const alpha = Math.min(1, left / 800);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;

    // balão pixel art: fundo + borda + bico
    ctx.fillStyle = '#0e1424';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#4f9bff';
    ctx.fillRect(x - 1, y - 1, w + 2, 1);
    ctx.fillRect(x - 1, y + h, w + 2, 1);
    ctx.fillRect(x - 1, y, 1, h);
    ctx.fillRect(x + w, y, 1, h);
    // bico no meio embaixo
    const bx = Math.floor(cx);
    ctx.fillStyle = '#0e1424';
    ctx.fillRect(bx - 3, y + h, 6, 1);
    ctx.fillRect(bx - 2, y + h + 1, 4, 1);
    ctx.fillRect(bx - 1, y + h + 2, 2, 1);
    ctx.fillStyle = '#4f9bff';
    ctx.fillRect(bx - 4, y + h, 1, 1);
    ctx.fillRect(bx + 3, y + h, 1, 1);
    ctx.fillRect(bx - 3, y + h + 1, 1, 1);
    ctx.fillRect(bx + 2, y + h + 1, 1, 1);
    ctx.fillRect(bx - 2, y + h + 2, 1, 1);
    ctx.fillRect(bx + 1, y + h + 2, 1, 1);

    // texto centralizado vertical (baseline middle)
    ctx.fillStyle = '#cfe1ff';
    for (let i = 0; i < lines.length; i++) {
      const lw = Math.ceil(ctx.measureText(lines[i]).width);
      const tx = Math.floor(x + (w - lw) / 2);
      const ty = y + padY + i * LINE_H + LINE_H / 2;
      ctx.fillText(lines[i], tx, ty);
    }
    // restaura defaults pros próximos draws
    ctx.textBaseline = 'top';
    ctx.globalAlpha = prev;
  }

  function wrapText(text, maxChars) {
    // quebra por palavras, mas força quebra dentro de palavras maiores que maxChars
    // (senão um "asdfghjklasdfghjkl" sem espaço estoura o balão)
    if (text.length <= maxChars) return [text];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    const pushChunkedWord = (word) => {
      while (word.length > maxChars) {
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      cur = word;
    };
    for (let w of words) {
      if (w.length > maxChars) {
        if (cur) { lines.push(cur); cur = ''; }
        pushChunkedWord(w);
        continue;
      }
      if ((cur + ' ' + w).trim().length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3); // máx 3 linhas
  }

  // ---------- projéteis ----------
  function drawProjectile(p, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const x = Math.floor(p.x - camX);
    const y = Math.floor(p.y - camY);
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const ang = Math.atan2(dy, dx);
    let name = 'fx_arrow';
    if (p.kind === 'bolt') name = 'fx_bolt';
    else if (p.kind === 'spark') name = 'fx_spark';
    else if (p.kind === 'arrow') name = 'fx_arrow';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (Sprites && Sprites.draw) {
      const sz = Sprites.getSize ? Sprites.getSize(name) : { w: 16, h: 8 };
      const w = (sz && sz.w) || 16;
      const h = (sz && sz.h) || 8;
      Sprites.draw(ctx, name, -Math.floor(w / 2), -Math.floor(h / 2), 0, {});
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -1, 8, 2);
    }
    ctx.restore();
  }

  // ---------- AoE ----------
  function drawAoE(a, state, camX, camY) {
    const Sprites = window.GTA.Sprites;
    const x = Math.floor(a.x - camX);
    const y = Math.floor(a.y - camY);
    const t = clamp(1 - a.life / a.maxLife, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(state.now / 100);

    // VFX em linha (fire-line, pierce-line) — desenha faixa entre (a.x,a.y) e (a.toX,a.toY)
    if ((a.kind === 'fire-line' || a.kind === 'pierce-line') && a.toX != null) {
      const x2 = Math.floor(a.toX - camX);
      const y2 = Math.floor(a.toY - camY);
      const lifeT = a.life / a.maxLife;
      ctx.save();
      ctx.globalAlpha = lifeT;
      ctx.strokeStyle = a.color || '#fff';
      ctx.lineWidth = a.r * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // núcleo brilhante mais fino por cima
      ctx.globalAlpha = lifeT * 0.9;
      ctx.strokeStyle = a.kind === 'fire-line' ? 'rgba(255,255,180,0.85)' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, a.r * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    // VFX especial pros kinds de fogo do mago — múltiplas camadas borradas e ondulantes
    if (a.kind === 'fire' || a.kind === 'fire-core') {
      const lifeT = a.life / a.maxLife;
      ctx.save();
      // anel externo: laranja borrado, ondula com tempo
      const wobble = Math.sin(state.now / 50) * 3;
      const layers = a.kind === 'fire-core'
        ? [{ r: a.r * 0.6, c: 'rgba(255,255,180,0.85)' }, { r: a.r * 0.85, c: 'rgba(255,200,80,0.6)' }, { r: a.r, c: 'rgba(255,140,40,0.4)' }]
        : [{ r: a.r * 0.5, c: 'rgba(255,180,60,0.55)' }, { r: a.r * 0.8, c: 'rgba(255,90,30,0.45)' }, { r: a.r, c: 'rgba(180,30,10,0.35)' }];
      for (const l of layers) {
        ctx.globalAlpha = lifeT * (l.c.includes('0.85') ? 0.85 : 0.7);
        ctx.fillStyle = l.c;
        ctx.beginPath();
        ctx.arc(x, y, l.r + wobble, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (a.kind === 'burn') {
      // marca queimada no chão — escura, sem pulso
      ctx.save();
      ctx.globalAlpha = (a.life / a.maxLife) * 0.5;
      ctx.fillStyle = a.color || 'rgba(40,15,5,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, a.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // círculo translúcido pulsante (indicador)
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.2 * pulse;
    ctx.fillStyle = a.color || '#fff';
    ctx.beginPath();
    ctx.arc(x, y, a.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = a.color || '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, a.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // sprite de efeito (anima conforme progresso)
    let fxName = null;
    if (a.kind === 'explosion') fxName = 'fx_explosion';
    else if (a.kind === 'heal') fxName = 'fx_heal';
    else if (a.kind === 'arrowRain') fxName = 'fx_arrow_rain';
    else if (a.kind === 'taunt') fxName = 'fx_taunt';
    else if (a.kind === 'slash') fxName = 'fx_slash';

    if (fxName && Sprites && Sprites.draw) {
      const fc = Sprites.getFrameCount ? (Sprites.getFrameCount(fxName) || 1) : 1;
      const frame = Math.min(fc - 1, Math.floor(t * fc));
      const sz = Sprites.getSize ? Sprites.getSize(fxName) : { w: 64, h: 64 };
      const w = (sz && sz.w) || 64;
      const h = (sz && sz.h) || 64;
      Sprites.draw(ctx, fxName, x - Math.floor(w / 2), y - Math.floor(h / 2), frame, {});
    }
  }

  // ---------- partículas ----------
  function drawParticle(p, camX, camY) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    const x = Math.floor(p.x - camX - p.size / 2);
    const y = Math.floor(p.y - camY - p.size / 2);
    ctx.fillRect(x, y, p.size, p.size);
    ctx.globalAlpha = 1;
  }

  // ---------- export ----------
  window.GTA = window.GTA || {};
  window.GTA.Render = Render;
})();
