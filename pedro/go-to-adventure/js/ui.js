// UI do "Go To Adventure".
// Responsável por todo o HUD, painéis e overlays do jogo.
// Não decide gameplay — só lê o estado e desenha; consome cliques sobre painéis.
(function () {
  const S = window.GTA.state;

  // ---------- Constantes ----------

  const RECIPES = [
    { id: 'sword',           name: 'Espada',            sprite: 'item_sword',          desc: 'Lâmina balanceada. +5 ATK.',                req: { wood: 5,  iron: 3  }, gives: { type: 'weapon',     attack: 5 } },
    { id: 'sword_advanced',  name: 'Espada Avançada',   sprite: 'item_sword_advanced', desc: 'Espada de mestre. +18 ATK.',                req: { wood: 50, iron: 40 }, gives: { type: 'weapon',     attack: 18 } },
    { id: 'bow',             name: 'Arco',              sprite: 'item_bow',            desc: 'Atira longe. +4 ATK.',                       req: { wood: 8,  stone: 2 }, gives: { type: 'weapon',     attack: 4 } },
    { id: 'staff',           name: 'Cajado',            sprite: 'item_staff',          desc: 'Cajado mágico. +6 ATK.',                     req: { wood: 6,  iron: 1  }, gives: { type: 'weapon',     attack: 6 } },
    { id: 'potion',          name: 'Poção HP',          sprite: 'item_potion',         desc: 'Cura 60 HP ao usar.',                        req: { wood: 1,  stone: 1 }, gives: { type: 'consumable', heal: 60 } },
    { id: 'armor',           name: 'Armadura',          sprite: 'item_armor',          desc: '+5 DEF, +20 HP máx.',                         req: { iron: 8,  stone: 4 }, gives: { type: 'armor',      defense: 5,  maxHp: 20 } },
    { id: 'armor_advanced',  name: 'Armadura Avançada', sprite: 'item_armor_advanced', desc: '+18 DEF, +80 HP máx.',                       req: { iron: 60, stone: 30 }, gives: { type: 'armor',      defense: 18, maxHp: 80 } },
  ];

  // Catálogo de itens conhecidos (raridade, label, descrição) — fallback p/ tooltips.
  const ITEM_INFO = {
    wood:             { label: 'Madeira',            sprite: 'item_wood',           rarity: 'common',    desc: 'Recurso de árvore.' },
    stone:            { label: 'Pedra',              sprite: 'item_stone',          rarity: 'common',    desc: 'Recurso de rocha.' },
    iron:             { label: 'Ferro',              sprite: 'item_iron',           rarity: 'uncommon',  desc: 'Minério raro.' },
    sword:            { label: 'Espada',             sprite: 'item_sword',          rarity: 'uncommon',  desc: 'Arma corpo-a-corpo. +5 ATK.', equipType: 'weapon', attack: 5 },
    sword_advanced:   { label: 'Espada Avançada',    sprite: 'item_sword_advanced', rarity: 'rare',      desc: 'Espada de mestre. +18 ATK.', equipType: 'weapon', attack: 18 },
    bow:              { label: 'Arco',               sprite: 'item_bow',            rarity: 'uncommon',  desc: 'Arma de longo alcance. +4 ATK.', equipType: 'weapon', attack: 4 },
    staff:            { label: 'Cajado',             sprite: 'item_staff',          rarity: 'uncommon',  desc: 'Arma mágica. +6 ATK.', equipType: 'weapon', attack: 6 },
    potion:           { label: 'Poção HP',           sprite: 'item_potion',         rarity: 'common',    desc: 'Cura 60 HP. Clique pra usar.', heal: 60 },
    armor:            { label: 'Armadura',           sprite: 'item_armor',          rarity: 'uncommon',  desc: '+5 DEF, +20 HP máx.', equipType: 'armor', defense: 5, maxHp: 20 },
    armor_advanced:   { label: 'Armadura Avançada',  sprite: 'item_armor_advanced', rarity: 'rare',      desc: '+18 DEF, +80 HP máx.', equipType: 'armor', defense: 18, maxHp: 80 },
  };

  const RARITY_COLOR = {
    common:    '#a8b1c2',
    uncommon:  '#4fdb9b',
    rare:      '#4f9bff',
    epic:      '#9b4fff',
    legendary: '#ffd24a',
  };

  // Layout
  const LAYOUT = {
    hud: { x: 14, y: 0, w: 460, h: 110, pad: 10 },
    skill: { size: 64 },
    hotbar: { slot: 36, gap: 4, count: 6 },
    minimap: { size: 220, pad: 12 },
    inventory: { w: 640, h: 420, slot: 64, gap: 8, cols: 5, rows: 4 },
    crafting: { w: 560, h: 500, rowH: 72, gap: 8 },
  };

  // Bônus aplicados pelo equipamento atual — pra desfazer ao trocar.
  // Mantemos aqui pra evitar mexer em state.js.
  let equippedBonus = { attack: 0, defense: 0, maxHp: 0 };

  // Tutorial inicial
  let tutorialStart = 0;
  const TUTORIAL_MS = 9000;
  let craftingNotified = false; // primeira vez que dá pra craftar uma poção, avisa

  // ---------- Helpers de desenho ----------

  function px(n) { return Math.round(n); }

  function setFont(ctx, size, weight) {
    ctx.font = `${weight || ''} ${size}px "Press Start 2P", monospace`.trim();
  }

  function panel(ctx, x, y, w, h, opts) {
    opts = opts || {};
    const bg     = opts.bg     || 'rgba(14, 20, 36, 0.92)';
    const inner  = opts.inner  || '#4f6fa8';
    const outer  = opts.outer  || '#0a0d14';
    ctx.fillStyle = bg;
    ctx.fillRect(px(x), px(y), px(w), px(h));
    // borda dupla
    ctx.strokeStyle = outer;
    ctx.lineWidth = 1;
    ctx.strokeRect(px(x) + 0.5, px(y) + 0.5, px(w) - 1, px(h) - 1);
    ctx.strokeStyle = inner;
    ctx.strokeRect(px(x) + 2.5, px(y) + 2.5, px(w) - 5, px(h) - 5);
    // cantos brilhantes (efeito 8-bit)
    ctx.fillStyle = '#cfe1ff';
    ctx.fillRect(px(x) + 2, px(y) + 2, 2, 2);
    ctx.fillRect(px(x + w) - 4, px(y) + 2, 2, 2);
    ctx.fillRect(px(x) + 2, px(y + h) - 4, 2, 2);
    ctx.fillRect(px(x + w) - 4, px(y + h) - 4, 2, 2);
  }

  function fillTextShadow(ctx, text, x, y, color, shadow) {
    ctx.fillStyle = shadow || '#000';
    ctx.fillText(text, px(x) + 1, px(y) + 1);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(text, px(x), px(y));
  }

  function gradBar(ctx, x, y, w, h, pct, c1, c2, bg) {
    pct = clamp(pct, 0, 1);
    ctx.fillStyle = bg || '#22182a';
    ctx.fillRect(px(x), px(y), px(w), px(h));
    if (pct > 0) {
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(px(x), px(y), px(w * pct), px(h));
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(px(x) + 0.5, px(y) + 0.5, px(w) - 1, px(h) - 1);
  }

  function segmentedBar(ctx, x, y, w, h, pct, c1, c2) {
    // bar segmentada visualmente — pinta o fundo, depois cobre uma máscara
    // de divisões verticais a cada 8px.
    gradBar(ctx, x, y, w, h, pct, c1, c2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let sx = 8; sx < w; sx += 8) {
      ctx.fillRect(px(x + sx), px(y), 1, px(h));
    }
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function pointInRect(x, y, rx, ry, rw, rh) {
    return x >= rx && y >= ry && x < rx + rw && y < ry + rh;
  }

  // ---------- Inventário helpers ----------

  function findItemSlot(item) {
    for (let i = 0; i < S.inventory.length; i++) {
      if (S.inventory[i] && S.inventory[i].item === item) return i;
    }
    return -1;
  }

  function countItem(item) {
    let total = 0;
    for (let i = 0; i < S.inventory.length; i++) {
      if (S.inventory[i] && S.inventory[i].item === item) total += S.inventory[i].qty;
    }
    return total;
  }

  function addItem(item, qty) {
    if (window.GTA.Combat && typeof window.GTA.Combat.addItem === 'function') {
      return window.GTA.Combat.addItem(item, qty);
    }
    // fallback local
    for (let i = 0; i < S.inventory.length; i++) {
      if (S.inventory[i] && S.inventory[i].item === item) {
        S.inventory[i].qty += qty;
        return true;
      }
    }
    for (let i = 0; i < S.inventory.length; i++) {
      if (!S.inventory[i]) {
        S.inventory[i] = { item, qty };
        return true;
      }
    }
    return false;
  }

  function removeItemQty(item, qty) {
    let need = qty;
    for (let i = 0; i < S.inventory.length && need > 0; i++) {
      const slot = S.inventory[i];
      if (slot && slot.item === item) {
        const take = Math.min(slot.qty, need);
        slot.qty -= take;
        need -= take;
        if (slot.qty <= 0) S.inventory[i] = null;
      }
    }
    return need === 0;
  }

  function firstEmptySlot() {
    for (let i = 0; i < S.inventory.length; i++) {
      if (!S.inventory[i]) return i;
    }
    return -1;
  }

  function getItemInfo(itemId) {
    return ITEM_INFO[itemId] || { label: itemId, sprite: 'item_wood', rarity: 'common', desc: '' };
  }

  // ---------- API pública ----------

  function init() {
    // idempotente — pode ser chamado de novo sem zerar bônus de equipamento existente.
    if (!tutorialStart) tutorialStart = performance.now();
    if (!Array.isArray(S.floatingTexts)) S.floatingTexts = [];
    if (!S.ui) S.ui = {};
    if (!Array.isArray(S.ui.toasts)) S.ui.toasts = [];
    if (typeof S.ui.hoveredSlot !== 'number') S.ui.hoveredSlot = -1;
    if (typeof S.ui.hoveredRecipe !== 'number') S.ui.hoveredRecipe = -1;
  }

  function update(dt) {
    const ms = dt * 1000;

    // ----- toasts -----
    const toasts = S.ui.toasts;
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].life -= ms;
      if (toasts[i].life <= 0) toasts.splice(i, 1);
    }

    // ----- floating texts -----
    const ft = S.floatingTexts;
    for (let i = ft.length - 1; i >= 0; i--) {
      const f = ft[i];
      f.life -= ms;
      f.y += (f.vy || -30) * dt;
      if (f.life <= 0) ft.splice(i, 1);
    }

    // ----- hover state -----
    S.ui.hoveredSlot = -1;
    S.ui.hoveredRecipe = -1;
    S.ui.tooltip = null;

    const mx = S.input.mouseX, my = S.input.mouseY;

    // hover hotbar (sempre visível)
    {
      const r = hotbarRect();
      for (let i = 0; i < LAYOUT.hotbar.count; i++) {
        const sx = r.x + i * (LAYOUT.hotbar.slot + LAYOUT.hotbar.gap);
        if (pointInRect(mx, my, sx, r.y, LAYOUT.hotbar.slot, LAYOUT.hotbar.slot)) {
          S.ui.hoveredSlot = i;
          showSlotTooltip(i, mx, my);
        }
      }
    }

    if (S.ui.inventoryOpen) {
      const r = inventoryRect();
      const gridX = r.x + 18;
      const gridY = r.y + 56;
      for (let i = 0; i < 20; i++) {
        const col = i % LAYOUT.inventory.cols;
        const row = Math.floor(i / LAYOUT.inventory.cols);
        const sx = gridX + col * (LAYOUT.inventory.slot + LAYOUT.inventory.gap);
        const sy = gridY + row * (LAYOUT.inventory.slot + LAYOUT.inventory.gap);
        if (pointInRect(mx, my, sx, sy, LAYOUT.inventory.slot, LAYOUT.inventory.slot)) {
          S.ui.hoveredSlot = i;
          showSlotTooltip(i, mx, my);
        }
      }
    }

    if (S.ui.craftingOpen) {
      const r = craftingRect();
      const listX = r.x + 18;
      const listY = r.y + 56;
      for (let i = 0; i < RECIPES.length; i++) {
        const sy = listY + i * (LAYOUT.crafting.rowH + LAYOUT.crafting.gap);
        if (pointInRect(mx, my, listX, sy, r.w - 36, LAYOUT.crafting.rowH)) {
          S.ui.hoveredRecipe = i;
          showRecipeTooltip(RECIPES[i], mx, my);
        }
      }
    }
  }

  function showSlotTooltip(slotIdx, mx, my) {
    const slot = S.inventory[slotIdx];
    if (!slot) return;
    const info = getItemInfo(slot.item);
    let text = info.desc || '';
    if (info.equipType === 'weapon') text += '\n[Clique pra equipar]';
    else if (info.equipType === 'armor') text += '\n[Clique pra equipar]';
    else if (info.heal) text += '\n[Clique pra usar]';
    S.ui.tooltip = {
      x: mx + 14, y: my + 14,
      title: `${info.label} x${slot.qty}`,
      text: text,
      rarity: info.rarity,
    };
  }

  function showRecipeTooltip(recipe, mx, my) {
    let req = '';
    for (const k in recipe.req) {
      const have = countItem(k);
      const need = recipe.req[k];
      const okClr = have >= need ? '+' : '!';
      req += `\n ${okClr} ${k}: ${have}/${need}`;
    }
    S.ui.tooltip = {
      x: mx + 14, y: my + 14,
      title: recipe.name,
      text: (recipe.desc || '') + '\nMateriais:' + req,
      rarity: 'uncommon',
    };
  }

  // ---------- Layout helpers ----------

  function hudRect() {
    const W = S.canvasW, H = S.canvasH;
    return { x: 14, y: H - 124, w: 460, h: 110 };
  }

  function skillRect() {
    const W = S.canvasW, H = S.canvasH;
    return { x: Math.floor(W / 2) - 32, y: H - 90, w: 64, h: 64 };
  }

  function hotbarRect() {
    const W = S.canvasW, H = S.canvasH;
    const w = LAYOUT.hotbar.count * (LAYOUT.hotbar.slot + LAYOUT.hotbar.gap) - LAYOUT.hotbar.gap;
    return { x: W - 14 - w, y: H - 70, w, h: LAYOUT.hotbar.slot };
  }

  function minimapRect() {
    const W = S.canvasW;
    return { x: W - LAYOUT.minimap.size - LAYOUT.minimap.pad, y: LAYOUT.minimap.pad, w: LAYOUT.minimap.size, h: LAYOUT.minimap.size };
  }

  function inventoryRect() {
    const W = S.canvasW, H = S.canvasH;
    const w = LAYOUT.inventory.w, h = LAYOUT.inventory.h;
    return { x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), w, h };
  }

  function craftingRect() {
    const W = S.canvasW, H = S.canvasH;
    const w = LAYOUT.crafting.w, h = LAYOUT.crafting.h;
    return { x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), w, h };
  }

  function closeBtnRect(panelR) {
    return { x: panelR.x + panelR.w - 32, y: panelR.y + 8, w: 24, h: 24 };
  }

  // ---------- Draw principal ----------

  function draw(ctx) {
    if (S.screen !== 'play' && S.screen !== 'dead') return;

    S.canvasW = ctx.canvas.width;
    S.canvasH = ctx.canvas.height;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';

    drawHUD(ctx);
    drawSkillIcon(ctx);
    drawHotbar(ctx);
    drawMinimap(ctx);
    drawCompass(ctx);
    drawToasts(ctx);

    if (S.ui.inventoryOpen) drawInventoryPanel(ctx);
    if (S.ui.craftingOpen)  drawCraftingPanel(ctx);

    drawTutorial(ctx);
    drawContextHint(ctx);

    if (S.ui.help) drawHelpOverlay(ctx);

    if (S.screen === 'dead') drawDeathOverlay(ctx);

    if (S.ui.tooltip) drawTooltip(ctx, S.ui.tooltip);

    ctx.restore();
  }

  // ---------- HUD bottom-left ----------

  function drawHUD(ctx) {
    const r = hudRect();
    panel(ctx, r.x, r.y, r.w, r.h);

    const p = S.player;
    const cls = (window.GTA.Classes && window.GTA.Classes.get(p.cls)) || { name: '?', color: '#888' };

    // avatar
    const avSize = 64;
    const avX = r.x + 12, avY = r.y + 22;
    // moldura
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(avX, avY, avSize, avSize);
    ctx.strokeStyle = cls.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(avX + 0.5, avY + 0.5, avSize - 1, avSize - 1);
    // sprite
    if (window.GTA.Sprites && window.GTA.Sprites.draw) {
      const Sprites = window.GTA.Sprites;
      const sz = Sprites.getSize ? Sprites.getSize(cls.sprite || p.cls) : { w: 32, h: 48 };
      ctx.save();
      // centraliza dentro do quadrado, escalando 1.5x
      const scl = Math.min(avSize / sz.w, avSize / sz.h) * 0.95;
      const drawW = sz.w * scl, drawH = sz.h * scl;
      ctx.translate(avX + (avSize - drawW) / 2, avY + (avSize - drawH) / 2);
      ctx.scale(scl, scl);
      Sprites.draw(ctx, cls.sprite || p.cls, 0, 0, 0, { dir: 'down' });
      ctx.restore();
    }

    // nickname + classe
    setFont(ctx, 10);
    fillTextShadow(ctx, p.nickname || 'Hero', r.x + 86, r.y + 12, '#fff');
    setFont(ctx, 8);
    fillTextShadow(ctx, cls.name || '?', r.x + 86, r.y + 26, cls.color || '#aaa');

    // HP bar
    const barX = r.x + 86, barW = r.w - 100;
    const hpY = r.y + 44;
    segmentedBar(ctx, barX, hpY, barW, 16, p.hp / Math.max(1, p.maxHp), '#ff4f6f', '#c2410c');
    setFont(ctx, 8);
    const hpTxt = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    const tw = ctx.measureText(hpTxt).width;
    fillTextShadow(ctx, hpTxt, barX + (barW - tw) / 2, hpY + 4, '#fff');

    // XP bar
    const xpY = r.y + 70;
    const lvl = p.level || 1;
    const Classes = window.GTA.Classes;
    const xpCur = (Classes && Classes.xpForLevel) ? Classes.xpForLevel(lvl) : 0;
    const xpNext = (Classes && Classes.xpForNextLevel) ? Classes.xpForNextLevel(lvl) : (xpCur + 50);
    const span = Math.max(1, xpNext - xpCur);
    const pct = clamp((p.xp - xpCur) / span, 0, 1);
    gradBar(ctx, barX, xpY, barW, 12, pct, '#4f9bff', '#ffd24a');
    setFont(ctx, 7);
    const xpTxt = `Lv ${lvl} · ${p.xp}/${xpNext} XP`;
    const xtw = ctx.measureText(xpTxt).width;
    fillTextShadow(ctx, xpTxt, barX + (barW - xtw) / 2, xpY + 3, '#fff');
  }

  // ---------- Skill icon ----------

  function drawSkillIcon(ctx) {
    const r = skillRect();
    const p = S.player;
    const cls = (window.GTA.Classes && window.GTA.Classes.get(p.cls)) || null;
    if (!cls) return;
    const cd = Math.max(0, p.skillCooldown || 0);
    const total = (cls.skill && cls.skill.cooldown) || 1;
    const ready = cd <= 0;

    // fundo
    panel(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, {
      bg: 'rgba(14,20,36,0.85)',
      inner: ready ? '#ffd24a' : '#5b6a8a',
    });

    // ícone (quadrado colorido com inicial da skill, pra não exigir asset)
    ctx.fillStyle = ready ? cls.color : '#1c2436';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // brilho leve
    if (ready) {
      const glow = (Math.sin(S.now / 240) + 1) / 2;
      ctx.fillStyle = `rgba(255, 210, 74, ${0.15 + glow * 0.25})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // glyph: inicial do nome
    setFont(ctx, 22);
    const glyph = (cls.skill && cls.skill.name) ? cls.skill.name[0] : '?';
    const gw = ctx.measureText(glyph).width;
    fillTextShadow(ctx, glyph, r.x + (r.w - gw) / 2, r.y + 18, '#fff');

    // overlay radial de cooldown
    if (!ready) {
      const frac = clamp(cd / total, 0, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2);
      const start = -Math.PI / 2;
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.85, start, start + frac * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fill();
      ctx.restore();

      // texto cd em segundos
      setFont(ctx, 10);
      const t = (cd / 1000).toFixed(1);
      const tw = ctx.measureText(t).width;
      fillTextShadow(ctx, t, r.x + (r.w - tw) / 2, r.y + r.h / 2 - 4, '#fff');
    }

    // tecla
    setFont(ctx, 8);
    const key = '[1]';
    const kw = ctx.measureText(key).width;
    fillTextShadow(ctx, key, r.x + (r.w - kw) / 2, r.y + r.h + 6, ready ? '#ffd24a' : '#8a96b0');
  }

  // ---------- Hotbar ----------

  function drawHotbar(ctx) {
    const r = hotbarRect();
    panel(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 28, { bg: 'rgba(14,20,36,0.78)' });

    for (let i = 0; i < LAYOUT.hotbar.count; i++) {
      const sx = r.x + i * (LAYOUT.hotbar.slot + LAYOUT.hotbar.gap);
      const slot = S.inventory[i];
      drawSlot(ctx, sx, r.y, LAYOUT.hotbar.slot, slot, S.ui.hoveredSlot === i);
      // numerinho do slot
      setFont(ctx, 6);
      fillTextShadow(ctx, String(i + 1), sx + 2, r.y + 2, '#cfe1ff');
    }
    setFont(ctx, 7);
    fillTextShadow(ctx, '[I] Inventário · [C] Receitas', r.x, r.y + r.h + 8, '#a8b1c2');
  }

  function drawSlot(ctx, sx, sy, size, slot, hovered) {
    // fundo
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(sx, sy, size, size);
    let border = '#2a3553';
    if (slot) {
      const info = getItemInfo(slot.item);
      border = RARITY_COLOR[info.rarity] || border;
    }
    if (hovered) border = '#ffd24a';
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, size - 2, size - 2);

    if (slot) {
      const info = getItemInfo(slot.item);
      // sprite
      if (window.GTA.Sprites && window.GTA.Sprites.draw) {
        const Sprites = window.GTA.Sprites;
        const sz = Sprites.getSize ? Sprites.getSize(info.sprite) : { w: 16, h: 16 };
        const scl = Math.min((size - 8) / sz.w, (size - 8) / sz.h);
        ctx.save();
        const dW = sz.w * scl, dH = sz.h * scl;
        ctx.translate(sx + (size - dW) / 2, sy + (size - dH) / 2);
        ctx.scale(scl, scl);
        Sprites.draw(ctx, info.sprite, 0, 0, 0, {});
        ctx.restore();
      }
      // qty
      if (slot.qty > 1) {
        setFont(ctx, 7);
        const t = String(slot.qty);
        const tw = ctx.measureText(t).width;
        fillTextShadow(ctx, t, sx + size - tw - 4, sy + size - 10, '#fff');
      }
      // marcador de equipado
      if (S.equipped.weapon === slot.item || S.equipped.armor === slot.item) {
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(sx + 3, sy + 3, 6, 2);
        ctx.fillRect(sx + 3, sy + 3, 2, 6);
      }
    }
  }

  // ---------- Mini-mapa ----------

  function drawMinimap(ctx) {
    const r = minimapRect();
    panel(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, { bg: 'rgba(8,12,22,0.85)' });

    const W = window.GTA.WORLD_W, H = window.GTA.WORLD_H;
    const TILE = window.GTA.TILE;
    const sx = r.w / W, sy = r.h / H;

    // tiles
    const tiles = S.world && S.world.tiles;
    if (tiles) {
      // pinta um background de "grass" antes pra preencher caso não tenhamos varrido
      ctx.fillStyle = '#1f3d28';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          const t = tiles[ty * W + tx];
          let col = null;
          // 0 GRASS, 1 GRASS2, 2 DIRT, 3 SAND, 4 WATER, 5 MOUNTAIN, 6 FOREST_FLOOR, 7 PATH
          if (t === 0 || t === 1) col = (t === 1) ? '#264a30' : '#1f3d28';
          else if (t === 2) col = '#5a4030';
          else if (t === 3) col = '#c9b074';
          else if (t === 4) col = '#1b3550';
          else if (t === 5) col = '#5b6275';
          else if (t === 6) col = '#15321d';
          else if (t === 7) col = '#7a6240';
          if (col) {
            ctx.fillStyle = col;
            ctx.fillRect(px(r.x + tx * sx), px(r.y + ty * sy), Math.max(1, Math.ceil(sx)), Math.max(1, Math.ceil(sy)));
          }
        }
      }
    }

    // recursos (pontos pequenos)
    if (S.resources && S.resources.size) {
      S.resources.forEach((res) => {
        if (!res || res.respawnAt > S.now) return;
        let col = '#7ad17a';
        if (res.type === 'rock') col = '#cfd3d8';
        else if (res.type === 'iron') col = '#5fd4d2';
        const mx = r.x + (res.x / TILE) * sx;
        const my = r.y + (res.y / TILE) * sy;
        ctx.fillStyle = col;
        ctx.fillRect(px(mx) - 1, px(my) - 1, 2, 2);
      });
    }

    // mobs
    if (S.mobs && S.mobs.size) {
      S.mobs.forEach((m) => {
        if (!m || (m.deadAt && m.deadAt > S.now)) return;
        const mx = r.x + (m.x / TILE) * sx;
        const my = r.y + (m.y / TILE) * sy;
        ctx.fillStyle = '#ff4f6f';
        ctx.fillRect(px(mx) - 1, px(my) - 1, 2, 2);
      });
    }

    // outros jogadores
    if (S.others && S.others.size) {
      S.others.forEach((o) => {
        const mx = r.x + (o.x / TILE) * sx;
        const my = r.y + (o.y / TILE) * sy;
        ctx.fillStyle = '#9b4fff';
        ctx.fillRect(px(mx) - 1, px(my) - 1, 2, 2);
      });
    }

    // player (piscando)
    const pulse = (Math.sin(S.now / 200) + 1) / 2;
    const pmx = r.x + (S.player.x / TILE) * sx;
    const pmy = r.y + (S.player.y / TILE) * sy;
    ctx.fillStyle = pulse > 0.5 ? '#ffd24a' : '#fff5b0';
    ctx.fillRect(px(pmx) - 1, px(pmy) - 1, 3, 3);
    // borda escura no minimap
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }

  // ---------- Compass ----------

  function drawCompass(ctx) {
    const W = S.canvasW;
    const TILE = window.GTA.TILE;
    let zone = 'safe';
    if (window.GTA.World && window.GTA.World.getZone) {
      zone = window.GTA.World.getZone(Math.floor(S.player.x / TILE), Math.floor(S.player.y / TILE));
    }
    const labels = { safe: 'SEGURA', mid: 'MÉDIA', outer: 'PERIGO' };
    const colors = { safe: '#4fdb9b', mid: '#ffd24a', outer: '#ff4f6f' };
    const txt = `ZONA ${labels[zone] || '?'}`;
    setFont(ctx, 10);
    const tw = ctx.measureText(txt).width;
    const x = Math.floor(W / 2 - (tw + 28) / 2);
    panel(ctx, x, 10, tw + 28, 28, { bg: 'rgba(14,20,36,0.85)' });
    fillTextShadow(ctx, txt, x + 14, 19, colors[zone] || '#fff');
  }

  // ---------- Toasts ----------

  function drawToasts(ctx) {
    const W = S.canvasW;
    let y = 50;
    const list = S.ui.toasts || [];
    setFont(ctx, 9);
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const fade = clamp(t.life / 500, 0, 1); // fade nos últimos 500ms
      const slide = (1 - clamp(t.life / Math.min(500, t.maxLife), 0, 1)) * -4;
      const tw = ctx.measureText(t.text).width;
      const w = tw + 28, h = 26;
      const x = Math.floor(W / 2 - w / 2);
      ctx.globalAlpha = fade;
      panel(ctx, x, y + slide, w, h, { bg: 'rgba(20,28,46,0.92)' });
      fillTextShadow(ctx, t.text, x + 14, y + slide + 8, t.color || '#ffd24a');
      ctx.globalAlpha = 1;
      y += h + 6;
    }
  }

  // ---------- Inventário ----------

  function drawInventoryPanel(ctx) {
    const r = inventoryRect();
    panel(ctx, r.x, r.y, r.w, r.h);
    setFont(ctx, 12);
    fillTextShadow(ctx, 'INVENTÁRIO', r.x + 18, r.y + 18, '#ffd24a');

    // botão X
    drawCloseButton(ctx, r);

    // grid
    const gridX = r.x + 18;
    const gridY = r.y + 56;
    const slotSize = LAYOUT.inventory.slot;
    const gap = LAYOUT.inventory.gap;
    for (let i = 0; i < 20; i++) {
      const col = i % LAYOUT.inventory.cols;
      const row = Math.floor(i / LAYOUT.inventory.cols);
      const sx = gridX + col * (slotSize + gap);
      const sy = gridY + row * (slotSize + gap);
      drawSlot(ctx, sx, sy, slotSize, S.inventory[i], S.ui.hoveredSlot === i);
    }

    // painel lateral de stats
    const sX = gridX + LAYOUT.inventory.cols * (slotSize + gap) + 6;
    const sY = gridY;
    const sW = r.w - (sX - r.x) - 18;
    drawStatsPanel(ctx, sX, sY, sW);
  }

  function drawStatsPanel(ctx, x, y, w) {
    const p = S.player;
    const padX = 12;
    panel(ctx, x, y, w, 320, { bg: 'rgba(8,12,22,0.7)' });
    setFont(ctx, 9);
    let yy = y + 14;
    fillTextShadow(ctx, 'ATRIBUTOS', x + padX, yy, '#ffd24a'); yy += 20;
    setFont(ctx, 8);
    const lines = [
      ['HP',       `${Math.ceil(p.hp)}/${p.maxHp}`],
      ['ATAQUE',   String(p.attack)],
      ['DEFESA',   String(p.defense)],
      ['ALCANCE',  String(p.atkRange)],
      ['VEL ATQ',  String(p.atkSpeed)],
      ['NÍVEL',    String(p.level)],
      ['XP',       String(p.xp)],
    ];
    for (const [k, v] of lines) {
      fillTextShadow(ctx, k, x + padX, yy, '#a8b1c2');
      const vw = ctx.measureText(v).width;
      fillTextShadow(ctx, v, x + w - vw - padX, yy, '#fff');
      yy += 14;
    }
    yy += 10;
    setFont(ctx, 9);
    fillTextShadow(ctx, 'EQUIPADO', x + padX, yy, '#ffd24a'); yy += 18;
    setFont(ctx, 8);
    const wInfo = S.equipped.weapon ? getItemInfo(S.equipped.weapon) : null;
    const aInfo = S.equipped.armor  ? getItemInfo(S.equipped.armor)  : null;
    fillTextShadow(ctx, 'Arma: '     + (wInfo ? wInfo.label : '—'), x + padX, yy, wInfo ? RARITY_COLOR[wInfo.rarity] : '#888'); yy += 13;
    fillTextShadow(ctx, 'Armadura: ' + (aInfo ? aInfo.label : '—'), x + padX, yy, aInfo ? RARITY_COLOR[aInfo.rarity] : '#888'); yy += 13;
  }

  // ---------- Crafting ----------

  function drawCraftingPanel(ctx) {
    const r = craftingRect();
    panel(ctx, r.x, r.y, r.w, r.h);
    setFont(ctx, 12);
    fillTextShadow(ctx, 'RECEITAS', r.x + 18, r.y + 18, '#ffd24a');
    drawCloseButton(ctx, r);

    const listX = r.x + 18;
    const listY = r.y + 56;
    const rowH = LAYOUT.crafting.rowH;
    const rowW = r.w - 36;
    for (let i = 0; i < RECIPES.length; i++) {
      const rec = RECIPES[i];
      const sy = listY + i * (rowH + LAYOUT.crafting.gap);
      drawRecipeRow(ctx, listX, sy, rowW, rowH, rec, S.ui.hoveredRecipe === i);
    }
  }

  function drawRecipeRow(ctx, x, y, w, h, rec, hovered) {
    panel(ctx, x, y, w, h, { bg: hovered ? 'rgba(40,52,80,0.85)' : 'rgba(20,28,46,0.85)', inner: hovered ? '#ffd24a' : '#4f6fa8' });

    // sprite resultado
    const iconSize = 48;
    const ix = x + 12, iy = y + (h - iconSize) / 2;
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(ix, iy, iconSize, iconSize);
    if (window.GTA.Sprites && window.GTA.Sprites.draw) {
      const Sprites = window.GTA.Sprites;
      const sz = Sprites.getSize ? Sprites.getSize(rec.sprite) : { w: 16, h: 16 };
      const scl = Math.min((iconSize - 6) / sz.w, (iconSize - 6) / sz.h);
      ctx.save();
      ctx.translate(ix + (iconSize - sz.w * scl) / 2, iy + (iconSize - sz.h * scl) / 2);
      ctx.scale(scl, scl);
      Sprites.draw(ctx, rec.sprite, 0, 0, 0, {});
      ctx.restore();
    }
    ctx.strokeStyle = '#4f6fa8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, iy + 0.5, iconSize - 1, iconSize - 1);

    // nome + materiais
    setFont(ctx, 9);
    fillTextShadow(ctx, rec.name, ix + iconSize + 12, y + 10, '#fff');
    setFont(ctx, 7);
    let mx = ix + iconSize + 12;
    let my = y + 28;
    let canCraft = true;
    for (const k in rec.req) {
      const have = countItem(k);
      const need = rec.req[k];
      const ok = have >= need;
      if (!ok) canCraft = false;
      const txt = `${k}: ${have}/${need}`;
      fillTextShadow(ctx, txt, mx, my, ok ? '#4fdb9b' : '#ff8a8a');
      my += 11;
      if (my > y + h - 12) { my = y + 28; mx += 110; }
    }

    // botão CRAFT
    const btnW = 84, btnH = 28;
    const bx = x + w - btnW - 12, by = y + (h - btnH) / 2;
    ctx.fillStyle = canCraft ? '#4f9bff' : '#2a3553';
    ctx.fillRect(bx, by, btnW, btnH);
    ctx.strokeStyle = canCraft ? '#ffd24a' : '#4f6fa8';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, btnW - 2, btnH - 2);
    setFont(ctx, 9);
    const lbl = 'CRAFT';
    const lw = ctx.measureText(lbl).width;
    fillTextShadow(ctx, lbl, bx + (btnW - lw) / 2, by + (btnH - 9) / 2, canCraft ? '#fff' : '#7a8095');
  }

  function drawCloseButton(ctx, r) {
    const cb = closeBtnRect(r);
    ctx.fillStyle = '#ff4f6f';
    ctx.fillRect(cb.x, cb.y, cb.w, cb.h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(cb.x + 0.5, cb.y + 0.5, cb.w - 1, cb.h - 1);
    setFont(ctx, 11);
    const tw = ctx.measureText('X').width;
    fillTextShadow(ctx, 'X', cb.x + (cb.w - tw) / 2, cb.y + 6, '#fff');
  }

  // ---------- Tooltip ----------

  function drawTooltip(ctx, tip) {
    const lines = (tip.text || '').split('\n');
    setFont(ctx, 8);
    let maxW = ctx.measureText(tip.title || '').width;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const w = Math.min(280, maxW + 20);
    const h = 22 + lines.length * 12;
    let x = tip.x, y = tip.y;
    if (x + w > S.canvasW - 4) x = S.canvasW - w - 4;
    if (y + h > S.canvasH - 4) y = S.canvasH - h - 4;
    panel(ctx, x, y, w, h, { bg: 'rgba(8,12,22,0.95)' });
    setFont(ctx, 9);
    fillTextShadow(ctx, tip.title || '', x + 10, y + 8, RARITY_COLOR[tip.rarity] || '#ffd24a');
    setFont(ctx, 7);
    let yy = y + 22;
    for (const l of lines) {
      fillTextShadow(ctx, l, x + 10, yy, '#cfe1ff');
      yy += 12;
    }
  }

  // ---------- Help overlay ----------

  function drawHelpOverlay(ctx) {
    const W = S.canvasW, H = S.canvasH;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const w = 420, h = 280;
    const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    panel(ctx, x, y, w, h);
    setFont(ctx, 12);
    fillTextShadow(ctx, 'CONTROLES', x + 18, y + 18, '#ffd24a');

    const lines = [
      ['WASD / Setas',  'Mover'],
      ['ESPAÇO',        'Ataque básico (auto-mira mais próximo)'],
      ['1',             'Habilidade da classe'],
      ['ENTER',         'Abrir chat (balão sobre o personagem)'],
      ['Botão esq.',    'Selecionar alvo / coletar / menus'],
      ['I / B',         'Inventário'],
      ['C',             'Receitas (crafting)'],
      ['H / F1',        'Esta ajuda'],
      ['~',             'Modo debug'],
      ['ESC',           'Fechar painéis / chat'],
    ];
    setFont(ctx, 8);
    let yy = y + 50;
    for (const [k, v] of lines) {
      fillTextShadow(ctx, k, x + 26, yy, '#4f9bff');
      fillTextShadow(ctx, v, x + 200, yy, '#cfe1ff');
      yy += 18;
    }
    setFont(ctx, 7);
    fillTextShadow(ctx, '[H] pra fechar', x + (w - 80) / 2, y + h - 22, '#a8b1c2');
  }

  // ---------- Death overlay ----------

  function drawDeathOverlay(ctx) {
    const W = S.canvasW, H = S.canvasH;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    setFont(ctx, 24);
    const t1 = 'VOCÊ FOI DERROTADO';
    const tw1 = ctx.measureText(t1).width;
    fillTextShadow(ctx, t1, (W - tw1) / 2, H / 2 - 30, '#ff4f6f');
    setFont(ctx, 12);
    const sec = Math.max(0, Math.ceil((S.player.respawnIn || 0) / 1000));
    const t2 = `Renascendo em ${sec}s`;
    const tw2 = ctx.measureText(t2).width;
    fillTextShadow(ctx, t2, (W - tw2) / 2, H / 2 + 8, '#ffd24a');
  }

  // ---------- Tutorial ----------

  function drawTutorial(ctx) {
    const elapsed = performance.now() - tutorialStart;
    if (elapsed > TUTORIAL_MS) return;
    const fade = clamp((TUTORIAL_MS - elapsed) / 600, 0, 1);
    const W = S.canvasW, H = S.canvasH;
    const w = 700, h = 50;
    const x = Math.floor((W - w) / 2), y = H - 200;
    ctx.globalAlpha = fade;
    panel(ctx, x, y, w, h, { bg: 'rgba(14,20,36,0.92)' });
    setFont(ctx, 8);
    const lines = [
      'WASD mover  ·  ESPAÇO ataca o inimigo mais próximo (auto-mira)',
      '1 usa habilidade da classe  ·  Clique pra escolher alvo / coletar',
      'ENTER abre chat  ·  I inv  ·  C receitas  ·  H ajuda',
    ];
    for (let i = 0; i < lines.length; i++) {
      const tw = ctx.measureText(lines[i]).width;
      fillTextShadow(ctx, lines[i], x + (w - tw) / 2, y + 8 + i * 12, '#ffd24a');
    }
    ctx.globalAlpha = 1;
  }

  // Hint contextual no rodape: aparece quando player esta perto de um recurso
  // ou quando tem materiais pra craftar pelo menos 1 receita.
  function drawContextHint(ctx) {
    if (S.ui.inventoryOpen || S.ui.craftingOpen || S.ui.help) return;
    const W = S.canvasW, H = S.canvasH;
    const p = S.player;
    const hintY = H - 230;

    // 1) recurso proximo
    let nearestRes = null, nd = Infinity;
    const range = (p.atkRange || 1.6) * 32 + 28;
    if (window.GTA.World && S.resources) {
      S.resources.forEach(function (r) {
        if (r.respawnAt > S.now) return;
        if (r.hits >= r.maxHits) return;
        const d = Math.hypot(r.x - p.x, r.y - p.y);
        if (d < range && d < nd) { nd = d; nearestRes = r; }
      });
    }
    if (nearestRes) {
      const labels = { tree: 'Madeira', rock: 'Pedra', iron: 'Ferro' };
      const label = labels[nearestRes.type] || nearestRes.type;
      const t = 'Clique pra coletar ' + label;
      drawHintLabel(ctx, t, W / 2, hintY, '#5cf78a');
      return;
    }

    // 2) tem materiais pra craftar?
    let craftableName = null;
    for (let i = 0; i < RECIPES.length; i++) {
      const rec = RECIPES[i];
      let ok = true;
      for (const k in rec.req) {
        if (countItem(k) < rec.req[k]) { ok = false; break; }
      }
      if (ok) { craftableName = rec.name; break; }
    }
    if (craftableName) {
      // toast unico na primeira vez
      if (!craftingNotified) {
        craftingNotified = true;
        toast('Materiais OK! Aperte C pra craftar.', '#ffd24a');
      }
      const t = 'C: craftar ' + craftableName;
      drawHintLabel(ctx, t, W / 2, hintY, '#ffd24a');
    }
  }

  function drawHintLabel(ctx, text, cx, cy, color) {
    setFont(ctx, 9);
    const padX = 14, padY = 8;
    const tw = ctx.measureText(text).width;
    const w = tw + padX * 2, h = 22;
    const x = Math.floor(cx - w / 2), y = Math.floor(cy);
    panel(ctx, x, y, w, h, { bg: 'rgba(14,20,36,0.88)' });
    fillTextShadow(ctx, text, x + padX, y + padY, color);
  }

  // ---------- Crafting / equip / use ----------

  function craft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    // checa requirements
    for (const k in recipe.req) {
      if (countItem(k) < recipe.req[k]) {
        toast('Faltam materiais!', '#ff8a8a');
        return false;
      }
    }
    // deduz
    for (const k in recipe.req) removeItemQty(k, recipe.req[k]);
    // adiciona resultado
    addItem(recipe.id, 1);
    toast('Craftado: ' + recipe.name, '#4fdb9b');
    // auto-equipa se nada equipado
    if (recipe.gives.type === 'weapon' && !S.equipped.weapon) {
      const idx = findItemSlot(recipe.id);
      if (idx >= 0) equipItem(idx);
    } else if (recipe.gives.type === 'armor' && !S.equipped.armor) {
      const idx = findItemSlot(recipe.id);
      if (idx >= 0) equipItem(idx);
    }
    return true;
  }

  function equipItem(slotIdx) {
    const slot = S.inventory[slotIdx];
    if (!slot) return false;
    const info = getItemInfo(slot.item);
    if (info.equipType !== 'weapon' && info.equipType !== 'armor') return false;

    const slotKind = info.equipType; // 'weapon' | 'armor'
    const cur = S.equipped[slotKind];

    // se é o mesmo item, faz unequip
    if (cur === slot.item) {
      unequipKind(slotKind);
      toast('Desequipado: ' + info.label, '#a8b1c2');
      return true;
    }

    // aplica delta: tira bônus do antigo, soma do novo
    if (cur) {
      const old = getItemInfo(cur);
      removeBonus(old);
      // devolve antigo pra inventário
      const empty = firstEmptySlot();
      if (empty >= 0) S.inventory[empty] = { item: cur, qty: 1 };
      else addItem(cur, 1);
    }
    addBonus(info);
    S.equipped[slotKind] = slot.item;
    // remove do inventário (1 unidade)
    slot.qty -= 1;
    if (slot.qty <= 0) S.inventory[slotIdx] = null;
    toast('Equipado: ' + info.label, '#ffd24a');
    return true;
  }

  function unequipKind(kind) {
    const cur = S.equipped[kind];
    if (!cur) return;
    const info = getItemInfo(cur);
    removeBonus(info);
    addItem(cur, 1);
    S.equipped[kind] = null;
  }

  function addBonus(info) {
    if (typeof info.attack === 'number') { S.player.attack += info.attack; equippedBonus.attack += info.attack; }
    if (typeof info.defense === 'number') { S.player.defense += info.defense; equippedBonus.defense += info.defense; }
    if (typeof info.maxHp === 'number') { S.player.maxHp += info.maxHp; S.player.hp = Math.min(S.player.maxHp, S.player.hp + info.maxHp); equippedBonus.maxHp += info.maxHp; }
  }

  function removeBonus(info) {
    if (typeof info.attack === 'number') { S.player.attack -= info.attack; equippedBonus.attack -= info.attack; }
    if (typeof info.defense === 'number') { S.player.defense -= info.defense; equippedBonus.defense -= info.defense; }
    if (typeof info.maxHp === 'number') {
      S.player.maxHp = Math.max(1, S.player.maxHp - info.maxHp);
      S.player.hp = Math.min(S.player.hp, S.player.maxHp);
      equippedBonus.maxHp -= info.maxHp;
    }
  }

  function useItem(slotIdx) {
    const slot = S.inventory[slotIdx];
    if (!slot) return false;
    const info = getItemInfo(slot.item);
    if (!info.heal) return false;
    // cura
    const before = S.player.hp;
    if (window.GTA.Player && window.GTA.Player.heal) {
      window.GTA.Player.heal(info.heal);
    } else {
      S.player.hp = Math.min(S.player.maxHp, S.player.hp + info.heal);
    }
    const healed = Math.round(S.player.hp - before);
    floatingText({ x: S.player.x, y: S.player.y - 24, text: `+${healed || info.heal}`, color: '#4fdb9b', size: 12 });
    slot.qty -= 1;
    if (slot.qty <= 0) S.inventory[slotIdx] = null;
    toast('Usou poção (+' + info.heal + ' HP)', '#4fdb9b');
    return true;
  }

  // ---------- Click handling ----------

  function handleClick(mx, my, button) {
    // help → qualquer clique fecha
    if (S.ui.help) { S.ui.help = false; return true; }

    if (S.screen === 'dead') return false;

    // close buttons primeiro
    if (S.ui.inventoryOpen) {
      const cb = closeBtnRect(inventoryRect());
      if (pointInRect(mx, my, cb.x, cb.y, cb.w, cb.h)) {
        S.ui.inventoryOpen = false;
        return true;
      }
    }
    if (S.ui.craftingOpen) {
      const cb = closeBtnRect(craftingRect());
      if (pointInRect(mx, my, cb.x, cb.y, cb.w, cb.h)) {
        S.ui.craftingOpen = false;
        return true;
      }
    }

    // hotbar (sempre visível)
    {
      const r = hotbarRect();
      for (let i = 0; i < LAYOUT.hotbar.count; i++) {
        const sx = r.x + i * (LAYOUT.hotbar.slot + LAYOUT.hotbar.gap);
        if (pointInRect(mx, my, sx, r.y, LAYOUT.hotbar.slot, LAYOUT.hotbar.slot)) {
          handleSlotClick(i);
          return true;
        }
      }
    }

    // crafting rows
    if (S.ui.craftingOpen) {
      const r = craftingRect();
      const listX = r.x + 18;
      const listY = r.y + 56;
      const rowH = LAYOUT.crafting.rowH;
      const rowW = r.w - 36;
      for (let i = 0; i < RECIPES.length; i++) {
        const sy = listY + i * (rowH + LAYOUT.crafting.gap);
        // clique no botão CRAFT (à direita) ou na linha toda
        if (pointInRect(mx, my, listX, sy, rowW, rowH)) {
          craft(RECIPES[i].id);
          return true;
        }
      }
      // clique dentro do painel mesmo se não pegou linha
      if (pointInRect(mx, my, r.x, r.y, r.w, r.h)) return true;
    }

    // inventário slots
    if (S.ui.inventoryOpen) {
      const r = inventoryRect();
      const gridX = r.x + 18;
      const gridY = r.y + 56;
      const slotSize = LAYOUT.inventory.slot;
      const gap = LAYOUT.inventory.gap;
      for (let i = 0; i < 20; i++) {
        const col = i % LAYOUT.inventory.cols;
        const row = Math.floor(i / LAYOUT.inventory.cols);
        const sx = gridX + col * (slotSize + gap);
        const sy = gridY + row * (slotSize + gap);
        if (pointInRect(mx, my, sx, sy, slotSize, slotSize)) {
          handleSlotClick(i);
          return true;
        }
      }
      // clique dentro do painel mesmo se não pegou slot
      if (pointInRect(mx, my, r.x, r.y, r.w, r.h)) return true;
    }

    return false;
  }

  function handleSlotClick(slotIdx) {
    const slot = S.inventory[slotIdx];
    if (!slot) return;
    const info = getItemInfo(slot.item);
    if (info.equipType === 'weapon' || info.equipType === 'armor') {
      equipItem(slotIdx);
    } else if (info.heal) {
      useItem(slotIdx);
    }
  }

  function handleKey(/* code */) {
    // input.js já trata I/C/H/Esc/`. Reservado pra futuro.
  }

  // ---------- Toast / floating text ----------

  function toast(text, color) {
    S.ui.toasts.push({ text, life: 3000, maxLife: 3000, color: color || '#ffd24a' });
  }

  function floatingText(opts) {
    if (!Array.isArray(S.floatingTexts)) S.floatingTexts = [];
    S.floatingTexts.push({
      x: opts.x,
      y: opts.y,
      vy: opts.vy != null ? opts.vy : -30,
      life: 1000,
      maxLife: 1000,
      text: opts.text,
      color: opts.color || '#fff',
      size: opts.size || 10,
    });
  }

  // ---------- Export ----------

  window.GTA = window.GTA || {};
  window.GTA.UI = {
    init,
    update,
    draw,
    craft,
    equipItem,
    useItem,
    handleClick,
    handleKey,
    toast,
    floatingText,
    RECIPES,
    ITEM_INFO,
  };
})();
