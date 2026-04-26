// Módulo Combat: AI de mobs, auto-attack do player, projéteis, skills e respawn.
(function () {
  const S = window.GTA.state;
  const TILE = window.GTA.TILE;
  const U = window.GTA.util;

  // Tipos base de mob
  const MOB_TYPES = {
    slime:    { name: 'Slime',     maxHp: 30,  attack: 6,  defense: 0, speed: 60,  attackRange: 1.0, sightRange: 5, attackCd: 1500, xpReward: 10, sprite: 'slime' },
    wolf:     { name: 'Lobo',      maxHp: 55,  attack: 11, defense: 2, speed: 120, attackRange: 1.0, sightRange: 7, attackCd: 900,  xpReward: 25, sprite: 'wolf' },
    golem:    { name: 'Golem',     maxHp: 180, attack: 18, defense: 8, speed: 35,  attackRange: 1.2, sightRange: 5, attackCd: 1800, xpReward: 80, sprite: 'golem' },
    skeleton: { name: 'Esqueleto', maxHp: 90,  attack: 24, defense: 4, speed: 90,  attackRange: 1.2, sightRange: 8, attackCd: 1100, xpReward: 60, sprite: 'skeleton' },
  };

  // Caps por zona e composição
  const ZONE_CFG = {
    safe:  { cap: 6,  mix: [['slime', 1.0]] },
    mid:   { cap: 12, mix: [['slime', 0.5], ['wolf', 0.5]] },
    outer: { cap: 16, mix: [['wolf', 0.5], ['golem', 0.3], ['skeleton', 0.2]] },
  };

  // Multiplicadores de stats por zona
  const ZONE_MUL = { safe: 0.8, mid: 1.0, outer: 1.2 };

  // AoEs ativas com lógica de DoT/slow (ex: Arrow Rain)
  const _activeAoEs = [];

  // controle de respawn timer
  let _spawnTimer = 0;

  let ready = false;

  // ----- helpers ------------------------------------------------------------

  function pickType(mix, rng) {
    const r = rng();
    let acc = 0;
    for (const [t, w] of mix) {
      acc += w;
      if (r <= acc) return t;
    }
    return mix[mix.length - 1][0];
  }

  function countMobsByZone(zone) {
    let n = 0;
    for (const m of S.mobs.values()) {
      if (m.zone === zone && m.hp > 0) n++;
    }
    return n;
  }

  function spawnMob(type, x, y, zone) {
    const base = MOB_TYPES[type];
    if (!base) return null;
    const mul = ZONE_MUL[zone] || 1.0;
    const maxHp = Math.floor(base.maxHp * mul);
    const attack = Math.floor(base.attack * mul);
    const defense = Math.floor(base.defense * mul);
    const xpReward = Math.floor(base.xpReward * mul);
    const id = U.uid();
    const mob = {
      id, type,
      x, y,
      spawnX: x, spawnY: y,
      zone,
      hp: maxHp, maxHp,
      attack, defense,
      speed: base.speed,
      attackRange: base.attackRange,
      sightRange: base.sightRange,
      attackCdMax: base.attackCd,
      xpReward,
      target: null,
      attackCd: 0,
      deadAt: 0,
      stunUntil: 0,
      slowUntil: 0,
      animFrame: 0,
      facing: 'down',
    };
    S.mobs.set(id, mob);
    return mob;
  }

  function spawnMobsInZones() {
    if (!window.GTA.World || !window.GTA.World.getMobSpawnPoints) return;
    const rng = Math.random;
    for (const zone of Object.keys(ZONE_CFG)) {
      const cfg = ZONE_CFG[zone];
      const alive = countMobsByZone(zone);
      const need = cfg.cap - alive;
      if (need <= 0) continue;
      const points = window.GTA.World.getMobSpawnPoints(zone, need) || [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const t = pickType(cfg.mix, rng);
        // pontos podem vir em tiles ou pixels — normaliza pra pixels
        let px = p.x, py = p.y;
        if (px < S.world.w && py < S.world.h) {
          // está em tiles
          px = px * TILE + TILE / 2;
          py = py * TILE + TILE / 2;
        }
        spawnMob(t, px, py, zone);
      }
    }
  }

  // inventário: empilha em slot existente ou usa primeiro vazio
  function addItem(item, qty) {
    qty = qty || 1;
    if (!item) return false;
    // tenta empilhar
    for (let i = 0; i < S.inventory.length; i++) {
      const slot = S.inventory[i];
      if (slot && slot.item === item) {
        slot.qty += qty;
        return true;
      }
    }
    // usa primeiro vazio
    for (let i = 0; i < S.inventory.length; i++) {
      if (!S.inventory[i]) {
        S.inventory[i] = { item, qty };
        return true;
      }
    }
    if (window.GTA.UI) window.GTA.UI.toast('Inventário cheio!', '#ff4f6f');
    return false;
  }

  // ----- AI dos mobs --------------------------------------------------------

  function updateMobs(dt) {
    const now = S.now;
    const p = S.player;
    const tauntActive = p.alive && p.buffs && p.buffs.taunt && p.buffs.taunt.until > now;
    const tauntRangePx = tauntActive ? 4 * TILE : 0;

    for (const m of S.mobs.values()) {
      // morto: aguarda respawn
      if (m.hp <= 0) {
        if (m.deadAt && now - m.deadAt >= 10000) {
          // respawn
          m.hp = m.maxHp;
          m.x = m.spawnX || m.x;
          m.y = m.spawnY || m.y;
          m.target = null;
          m.attackCd = 0;
          m.deadAt = 0;
          m.stunUntil = 0;
          m.slowUntil = 0;
        }
        continue;
      }

      if (m.attackCd > 0) m.attackCd = Math.max(0, m.attackCd - dt * 1000);

      // stun
      if (m.stunUntil && m.stunUntil > now) {
        continue;
      }

      if (!p.alive) continue;

      const distToPlayer = U.dist(m.x, m.y, p.x, p.y);
      const sightPx = m.sightRange * TILE;
      const atkRangePx = m.attackRange * TILE;

      const inTaunt = tauntActive && distToPlayer <= tauntRangePx;
      const detected = distToPlayer <= sightPx || inTaunt;

      if (!detected) {
        m.target = null;
        // animação parada
        m.animFrame = 0;
        continue;
      }

      m.target = p.id;

      // dentro do range de ataque?
      if (distToPlayer <= atkRangePx) {
        if (m.attackCd <= 0 && window.GTA.Player) {
          window.GTA.Player.takeDamage(m.attack, m.id);
          m.attackCd = m.attackCdMax;
          m.animFrame = 2; // frame "ataque"
        }
        // ainda assim, se em taunt, dá empurrãozinho na direção do player
        if (inTaunt && distToPlayer > 4) {
          const dx = (p.x - m.x) / distToPlayer;
          const dy = (p.y - m.y) / distToPlayer;
          const push = 20 * dt; // pequeno empurrão
          tryMove(m, dx * push, dy * push);
        }
      } else {
        // chase
        const dx = (p.x - m.x) / distToPlayer;
        const dy = (p.y - m.y) / distToPlayer;
        let spd = m.speed;
        if (m.slowUntil && m.slowUntil > now) spd *= 0.5;
        if (inTaunt) spd *= 1.15; // pequeno boost por taunt
        const step = spd * dt;
        tryMove(m, dx * step, dy * step);

        if (Math.abs(dx) > Math.abs(dy)) m.facing = dx > 0 ? 'right' : 'left';
        else m.facing = dy > 0 ? 'down' : 'up';
        m.animFrame = (m.animFrame + dt * 6) % 4;
      }
    }
  }

  // tenta mover separando eixos pra dar slide em parede
  function tryMove(m, dx, dy) {
    const W = window.GTA.World;
    if (!W || !W.isWalkablePx) {
      m.x += dx; m.y += dy;
      return;
    }
    const nx = m.x + dx;
    const ny = m.y + dy;
    if (W.isWalkablePx(nx, m.y)) m.x = nx;
    if (W.isWalkablePx(m.x, ny)) m.y = ny;
  }

  // ----- Player auto-attack -------------------------------------------------

  function updatePlayerAttack(dt) {
    const p = S.player;
    if (!p.alive) return;
    if (!p.target) return;
    const mob = S.mobs.get(p.target);
    if (!mob || mob.hp <= 0) {
      p.target = null;
      return;
    }
    const d = U.dist(p.x, p.y, mob.x, mob.y);
    const rangePx = (p.atkRange || 1.4) * TILE;
    // se muito longe, perde alvo
    if (d > rangePx + 10 * TILE) {
      p.target = null;
      return;
    }
    if (d > rangePx) return; // espera ficar em range
    if (p.atkCooldown > 0) return;

    const cls = window.GTA.Classes.get(p.cls);
    p.atkCooldown = p.atkSpeed;
    p.animState = 'attack';
    p.animUntil = S.now + 220;

    if (!cls.atkProjectile) {
      // melee — hit instantâneo
      hitMob(mob, p.attack, '#ffffff');
      if (window.GTA.Render) {
        window.GTA.Render.shake(2, 100);
        window.GTA.Render.addAoE({
          x: mob.x, y: mob.y, r: 18, life: 200,
          color: 'rgba(255,255,255,0.6)', kind: 'slash',
        });
        for (let i = 0; i < 6; i++) {
          window.GTA.Render.particle({
            x: mob.x, y: mob.y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160 - 40,
            life: 250 + Math.random() * 150,
            color: '#fff', size: 2, kind: 'spark', gravity: 200,
          });
        }
      }
    } else {
      // ranged — projétil
      if (window.GTA.Render && window.GTA.Render.addProjectile) {
        window.GTA.Render.addProjectile({
          x: p.x, y: p.y - 12,
          tx: mob.x, ty: mob.y - 12,
          speed: 600,
          kind: cls.atkProjectile,
          fromId: 'me',
          target: mob.id,
          damage: p.attack,
          life: 1000,
        });
      } else {
        // fallback: empurra direto no array
        S.projectiles.push({
          x: p.x, y: p.y - 12,
          tx: mob.x, ty: mob.y - 12,
          speed: 600,
          kind: cls.atkProjectile,
          fromId: 'me',
          target: mob.id,
          damage: p.attack,
          life: 1000,
        });
      }
    }
  }

  // aplica dano num mob (com defense), floating text + partículas, XP se morrer
  function hitMob(mob, rawDmg, color) {
    if (!mob || mob.hp <= 0) return;
    const dmg = Math.max(1, Math.floor(rawDmg - (mob.defense || 0)));
    mob.hp -= dmg;
    if (window.GTA.UI) {
      window.GTA.UI.floatingText({
        x: mob.x, y: mob.y - 24,
        text: '-' + dmg, color: color || '#ffd24a', size: 12,
      });
    }
    if (window.GTA.Render) {
      for (let i = 0; i < 5; i++) {
        window.GTA.Render.particle({
          x: mob.x, y: mob.y,
          vx: (Math.random() - 0.5) * 140,
          vy: -Math.random() * 140 - 40,
          life: 350 + Math.random() * 200,
          color: '#c33', size: 2, kind: 'blood', gravity: 320,
        });
      }
    }
    if (mob.hp <= 0) {
      mob.hp = 0;
      mob.deadAt = S.now;
      if (window.GTA.Player) window.GTA.Player.gainXp(mob.xpReward);
      // limpa target do player se for esse mob
      if (S.player.target === mob.id) S.player.target = null;
      if (window.GTA.Render) {
        for (let i = 0; i < 14; i++) {
          window.GTA.Render.particle({
            x: mob.x, y: mob.y,
            vx: (Math.random() - 0.5) * 240,
            vy: -Math.random() * 220 - 60,
            life: 500 + Math.random() * 300,
            color: '#a44', size: 3, kind: 'blood', gravity: 360,
          });
        }
      }
    }
  }

  // ----- Projéteis ----------------------------------------------------------

  function updateProjectiles(dt) {
    if (!S.projectiles || !S.projectiles.length) return;
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i];
      pr.life -= dt * 1000;
      // se tem alvo vivo, atualiza tx/ty pra perseguir
      let mob = null;
      if (pr.target) {
        mob = S.mobs.get(pr.target);
        if (mob && mob.hp > 0) {
          pr.tx = mob.x;
          pr.ty = mob.y - 12;
        }
      }
      const dx = pr.tx - pr.x;
      const dy = pr.ty - pr.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = pr.speed * dt;
      if (d <= 8 || pr.life <= 0 || step >= d) {
        // colidiu / expirou
        if (mob && mob.hp > 0) {
          hitMob(mob, pr.damage, '#9bd');
        }
        S.projectiles.splice(i, 1);
        continue;
      }
      pr.x += (dx / d) * step;
      pr.y += (dy / d) * step;
    }
  }

  // ----- AoEs ativas (Arrow Rain DoT/slow) ----------------------------------

  function updateActiveAoEs(dt) {
    if (!_activeAoEs.length) return;
    const now = S.now;
    for (let i = _activeAoEs.length - 1; i >= 0; i--) {
      const a = _activeAoEs[i];
      a.life -= dt * 1000;
      // tick a cada 250ms
      a.tickCd = (a.tickCd || 0) - dt * 1000;
      if (a.tickCd <= 0) {
        a.tickCd = 250;
        const dmgPerTick = (a.dps || 0) * 0.25;
        const rPx = a.r;
        for (const m of S.mobs.values()) {
          if (m.hp <= 0) continue;
          if (U.dist(m.x, m.y, a.x, a.y) <= rPx) {
            if (dmgPerTick > 0) hitMob(m, dmgPerTick, '#9bd');
            if (a.slowMs) m.slowUntil = Math.max(m.slowUntil || 0, now + a.slowMs);
          }
        }
      }
      if (a.life <= 0) _activeAoEs.splice(i, 1);
    }
  }

  // ----- Skills -------------------------------------------------------------

  function castSkill() {
    const p = S.player;
    if (!p.alive) return;
    if (p.skillCooldown > 0) {
      if (window.GTA.UI) window.GTA.UI.toast('Skill em recarga!', '#ff4f6f');
      return;
    }
    const cls = window.GTA.Classes.get(p.cls);
    if (!cls || !cls.skill) return;
    const sk = cls.skill;

    p.animState = 'cast';
    p.animUntil = S.now + 380;

    // Modo online: delega ao server
    if (S.net.mode === 'online' && S.net.connected) {
      const ax = (sk.id === 'arrowRain') ? S.input.mouseWorldX : p.x;
      const ay = (sk.id === 'arrowRain') ? S.input.mouseWorldY : p.y;
      if (window.GTA.Audio) window.GTA.Audio.play(sk.id === 'arcane' ? 'skillFire' : 'skillCast');
      window.GTA.Net.sendSkill(ax, ay);
      p.skillCooldown = sk.cooldown; // otimismo local
      return;
    }

    if (sk.id === 'taunt') {
      p.buffs.taunt = { until: S.now + sk.duration, reduction: sk.damageReduction };
      if (window.GTA.Render) {
        window.GTA.Render.addAoE({
          x: p.x, y: p.y, r: sk.range * TILE, life: sk.duration,
          color: 'rgba(255,210,74,0.25)', kind: 'taunt',
        });
        for (let i = 0; i < 24; i++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * sk.range * TILE;
          window.GTA.Render.particle({
            x: p.x + Math.cos(ang) * r,
            y: p.y + Math.sin(ang) * r,
            vx: 0, vy: -40 - Math.random() * 60,
            life: 500 + Math.random() * 300,
            color: '#ffd24a', size: 3, kind: 'spark', gravity: 0,
          });
        }
      }
    } else if (sk.id === 'arcane') {
      const rPx = sk.radius * TILE;
      for (const m of S.mobs.values()) {
        if (m.hp <= 0) continue;
        if (U.dist(m.x, m.y, p.x, p.y) <= rPx) {
          hitMob(m, p.attack * sk.damageMul, '#c8a2ff');
        }
      }
      if (window.GTA.Render) {
        window.GTA.Render.addAoE({
          x: p.x, y: p.y, r: rPx, life: 600,
          color: 'rgba(255,140,40,0.45)', kind: 'arcane',
        });
        for (let i = 0; i < 40; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 120 + Math.random() * 220;
          window.GTA.Render.particle({
            x: p.x, y: p.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            life: 500 + Math.random() * 300,
            color: i % 2 ? '#ff8a3a' : '#c8a2ff',
            size: 3, kind: 'spark', gravity: 0,
          });
        }
      }
    } else if (sk.id === 'heal') {
      const healAmt = Math.floor(p.maxHp * sk.healPct);
      if (window.GTA.Player) window.GTA.Player.heal(healAmt);
      // outros players próximos (placeholder pra futuro)
      if (S.others && S.others.size) {
        for (const o of S.others.values()) {
          if (o.x == null) continue;
          if (U.dist(o.x, o.y, p.x, p.y) <= sk.radius * TILE) {
            o.hp = Math.min(o.maxHp || 100, (o.hp || 0) + healAmt);
          }
        }
      }
      if (window.GTA.Render) {
        window.GTA.Render.addAoE({
          x: p.x, y: p.y, r: sk.radius * TILE, life: 800,
          color: 'rgba(92,247,138,0.3)', kind: 'heal',
        });
        for (let i = 0; i < 30; i++) {
          window.GTA.Render.particle({
            x: p.x + (Math.random() - 0.5) * sk.radius * TILE,
            y: p.y + (Math.random() - 0.5) * sk.radius * TILE,
            vx: 0, vy: -60 - Math.random() * 80,
            life: 700 + Math.random() * 300,
            color: '#5cf78a', size: 3, kind: 'spark', gravity: -20,
          });
        }
      }
    } else if (sk.id === 'arrowRain') {
      const tx = (S.input && S.input.mouseWorldX != null) ? S.input.mouseWorldX : p.x;
      const ty = (S.input && S.input.mouseWorldY != null) ? S.input.mouseWorldY : p.y;
      const rPx = sk.radius * TILE;
      const aoe = {
        x: tx, y: ty, r: rPx,
        life: sk.duration, maxLife: sk.duration,
        dps: sk.dps, slowMs: 3000,
        tickCd: 0,
      };
      _activeAoEs.push(aoe);
      // indicador visual via Render
      if (window.GTA.Render) {
        window.GTA.Render.addAoE({
          x: tx, y: ty, r: rPx, life: sk.duration,
          color: 'rgba(120,200,255,0.25)', kind: 'arrowRain',
        });
        for (let i = 0; i < 16; i++) {
          window.GTA.Render.particle({
            x: tx + (Math.random() - 0.5) * rPx,
            y: ty - 200 - Math.random() * 100,
            vx: 0, vy: 400 + Math.random() * 200,
            life: 400 + Math.random() * 300,
            color: '#9bd', size: 2, kind: 'spark', gravity: 0,
          });
        }
      }
    }

    p.skillCooldown = sk.cooldown;
    if (window.GTA.Render) window.GTA.Render.shake(6, 200);
    if (window.GTA.UI) window.GTA.UI.toast(sk.name + '!', '#fc4');
  }

  // ----- Click handler ------------------------------------------------------

  function handleWorldClick(worldX, worldY) {
    const p = S.player;
    if (!p.alive) return;

    // 1) procura mob mais próximo dentro de 32px do clique
    let best = null;
    let bestD = 32;
    for (const m of S.mobs.values()) {
      if (m.hp <= 0) continue;
      const d = U.dist(m.x, m.y, worldX, worldY);
      if (d <= bestD) { bestD = d; best = m; }
    }
    if (best) {
      p.target = best.id;
      // dispara ataque imediato (em online o server valida cd/range; offline o basicAttack
      // checa tudo localmente). Antes só selecionava o alvo, exigindo apertar ESPAÇO.
      basicAttack();
      return;
    }

    // 2) procura recurso próximo do clique e dentro de range
    if (S.resources && S.resources.size) {
      let bestR = null;
      let bestRD = 32;
      for (const r of S.resources.values()) {
        if (r.respawnAt && r.respawnAt > S.now) continue;
        const d = U.dist(r.x, r.y, worldX, worldY);
        if (d <= bestRD) { bestRD = d; bestR = r; }
      }
      if (bestR) {
        const rangePx = (p.atkRange || 1.4) * TILE + 16;
        const dp = U.dist(bestR.x, bestR.y, p.x, p.y);
        if (dp <= rangePx) {
          if (p.atkCooldown > 0) return; // swing em andamento
          p.atkCooldown = p.atkSpeed;
          if (window.GTA.World && window.GTA.World.harvestResource) {
            const res = window.GTA.World.harvestResource(bestR.id);
            if (window.GTA.Audio) window.GTA.Audio.play('harvest');
            if (res && res.drop) {
              if (window.GTA.Audio) window.GTA.Audio.play('pickup');
              addItem(res.drop.item, res.drop.qty || 1);
              if (window.GTA.UI) {
                window.GTA.UI.floatingText({
                  x: bestR.x, y: bestR.y - 16,
                  text: '+' + (res.drop.qty || 1) + ' ' + res.drop.item,
                  color: '#bdd', size: 11,
                });
              }
            }
            if (window.GTA.Render) {
              for (let i = 0; i < 6; i++) {
                window.GTA.Render.particle({
                  x: bestR.x, y: bestR.y,
                  vx: (Math.random() - 0.5) * 120,
                  vy: -Math.random() * 120 - 30,
                  life: 400 + Math.random() * 200,
                  color: '#caa', size: 2, kind: 'chip', gravity: 320,
                });
              }
            }
          }
          return;
        } else {
          if (window.GTA.UI) window.GTA.UI.toast('Muito longe!', '#ffaa44');
          return;
        }
      }
    }

    // 3) nada — limpa target
    p.target = null;
  }

  // explicitamente atacar um id (também usado externamente)
  function attackTarget(targetId) {
    const mob = S.mobs.get(targetId);
    if (!mob || mob.hp <= 0) return;
    S.player.target = targetId;
  }

  // Ataque básico via espaço: auto-targeta o mob mais perto dentro do range de
  // detecção (1.5x range da classe, mín 4 tiles). Vira pra ele e ataca já se
  // estiver em range; se cd ainda ativo, ao menos vira/seleciona/anima swing.
  function basicAttack() {
    const p = S.player;
    if (!p.alive) return;
    const cls = window.GTA.Classes.get(p.cls) || {};
    const rangePx = (p.atkRange || 1.4) * TILE;
    const detectPx = Math.max(4 * TILE, rangePx * 1.5);

    // 1) tenta usar target atual se ainda válido e perto
    let mob = p.target ? S.mobs.get(p.target) : null;
    if (!mob || (mob.hp <= 0 && !mob.alive) || U.dist(p.x, p.y, mob.x, mob.y) > detectPx) {
      mob = null;
      // 2) auto-targeta mob mais perto
      let nd = Infinity;
      S.mobs.forEach(function (m) {
        if (m.hp <= 0 || m.alive === false) return;
        const d = U.dist(p.x, p.y, m.x, m.y);
        if (d < nd && d <= detectPx) { nd = d; mob = m; }
      });
      if (mob) p.target = mob.id;
    }

    // 3) vira pra direção do alvo (se houver)
    if (mob) {
      const dx = mob.x - p.x, dy = mob.y - p.y;
      if (Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left';
      else p.facing = dy > 0 ? 'down' : 'up';
    }

    // Modo online: delega ao server. Server valida cd/range e responde com evento.
    if (S.net.mode === 'online' && S.net.connected) {
      // animação local imediata pra feedback
      p.animState = 'attack';
      p.animUntil = S.now + 220;
      if (window.GTA.Audio) window.GTA.Audio.play('attack');
      window.GTA.Net.sendAttack(mob ? mob.id : null);
      return;
    }

    // 4) swing visual sempre — feedback instantâneo
    p.animState = 'attack';
    p.animUntil = S.now + 220;

    // 5) se cd ativo ou alvo fora de range, só anima e sai (auto-attack pega depois)
    if (p.atkCooldown > 0) return;
    if (!mob) return;
    const d = U.dist(p.x, p.y, mob.x, mob.y);
    if (d > rangePx) return; // alvo selecionado mas fora de range — chega perto que o auto-attack pega

    // 6) executa o ataque imediatamente — reaproveita o caminho do auto-attack
    updatePlayerAttack(0);
  }

  // ----- Update principal ---------------------------------------------------

  function update(dt) {
    if (S.screen !== 'play') return;

    // Modo online: server cuida de mobs/AI/respawn. Cliente só anima.
    if (S.net.mode === 'online') {
      // ainda atualiza cd local pra UX (server tem cd próprio também)
      if (S.player.atkCooldown > 0) S.player.atkCooldown = Math.max(0, S.player.atkCooldown - dt * 1000);
      if (S.player.skillCooldown > 0) S.player.skillCooldown = Math.max(0, S.player.skillCooldown - dt * 1000);
      if (S.player.skill2Cooldown > 0) S.player.skill2Cooldown = Math.max(0, S.player.skill2Cooldown - dt * 1000);
      updateActiveAoEs(dt);
      return;
    }

    // respawn timer global a cada 5s
    _spawnTimer += dt * 1000;
    if (_spawnTimer >= 5000) {
      _spawnTimer = 0;
      spawnMobsInZones();
    }

    updateMobs(dt);
    updatePlayerAttack(dt);
    updateProjectiles(dt);
    updateActiveAoEs(dt);

    // métrica debug
    let alive = 0;
    for (const m of S.mobs.values()) if (m.hp > 0) alive++;
    S.debug.mobsAlive = alive;
  }

  // Skill 2 — sempre delegada ao server (online). Em offline pula (não implementado local).
  function castSkill2() {
    const p = S.player;
    if (!p.alive) return;
    if (p.skill2Cooldown > 0) {
      if (window.GTA.UI) window.GTA.UI.toast('Skill 2 em recarga!', '#ff4f6f');
      return;
    }
    const cls = window.GTA.Classes.get(p.cls);
    if (!cls || !cls.skill2) return;
    const sk2 = cls.skill2;

    p.animState = 'cast';
    p.animUntil = S.now + 380;

    if (S.net.mode === 'online' && S.net.connected) {
      // pra healer (stunLock) o alvo é o mob focado; pros outros, posição/facing do player
      const targetId = (sk2.id === 'stunLock') ? p.target : null;
      const ax = S.input.mouseWorldX, ay = S.input.mouseWorldY;
      if (window.GTA.Audio) {
        window.GTA.Audio.play(sk2.id === 'fireLine' ? 'skillFire' : 'skillCast');
      }
      window.GTA.Net.sendSkill2(ax, ay, targetId);
      p.skill2Cooldown = sk2.cooldown;
      return;
    }

    if (window.GTA.UI) window.GTA.UI.toast('Skill 2 só funciona online por enquanto', '#ffaa44');
  }

  function init() {
    // só spawna mobs locais se NÃO estiver online
    if (S.net.mode !== 'online') spawnMobsInZones();
    ready = true;
    Combat.ready = true;
  }

  const Combat = {
    init,
    update,
    MOB_TYPES,
    spawnMob,
    spawnMobsInZones,
    handleWorldClick,
    attackTarget,
    basicAttack,
    castSkill,
    castSkill2,
    addItem,
    ready: false,
  };

  window.GTA = window.GTA || {};
  window.GTA.Combat = Combat;
})();
