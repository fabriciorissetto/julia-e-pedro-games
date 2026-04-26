// Movimento do jogador local + colisão com tiles bloqueados.
(function () {
  const S = window.GTA.state;
  const TILE = window.GTA.TILE;

  const SPEED = 180; // pixels por segundo

  function update(dt) {
    if (S.screen !== 'play' && S.screen !== 'dead') return;
    const p = S.player;

    // online: server controla vida/respawn. Quando server respawnar, alive volta.
    if (S.net.mode === 'online') {
      if (!p.alive) {
        if (S.screen !== 'dead') S.screen = 'dead';
        return;
      } else if (S.screen === 'dead') {
        S.screen = 'play';
      }
    }

    if (S.screen !== 'play') return;

    if (!p.alive) {
      p.respawnIn = Math.max(0, p.respawnIn - dt * 1000);
      if (p.respawnIn <= 0) {
        respawn();
      }
      return;
    }

    const mx = S.input.moveX || 0;
    const my = S.input.moveY || 0;
    const moving = mx !== 0 || my !== 0;
    p.moving = moving;

    if (moving) {
      // facing
      if (Math.abs(mx) > Math.abs(my)) p.facing = mx > 0 ? 'right' : 'left';
      else p.facing = my > 0 ? 'down' : 'up';

      const nx = p.x + mx * SPEED * dt;
      const ny = p.y + my * SPEED * dt;
      // colisão tile a tile (separar eixos pra slide)
      if (canStand(nx, p.y)) p.x = nx;
      if (canStand(p.x, ny)) p.y = ny;

      // animação
      p.animFrame = (p.animFrame + dt * 8) % 4;
    } else {
      p.animFrame = 0;
    }

    // animState: attack/cast têm prioridade sobre walk/idle até expirar
    if (p.animUntil > S.now) {
      const total = p.animState === 'attack' ? 220 : 380;
      const elapsed = total - (p.animUntil - S.now);
      p.animActionFrame = window.GTA.util.clamp(Math.floor(elapsed / total * 4), 0, 3);
    } else {
      p.animState = moving ? 'walk' : 'idle';
      p.animActionFrame = 0;
    }

    // limita ao mundo
    p.x = window.GTA.util.clamp(p.x, TILE * 0.5, (window.GTA.WORLD_W - 0.5) * TILE);
    p.y = window.GTA.util.clamp(p.y, TILE * 0.5, (window.GTA.WORLD_H - 0.5) * TILE);

    // cooldowns
    if (p.atkCooldown > 0) p.atkCooldown = Math.max(0, p.atkCooldown - dt * 1000);
    if (p.skillCooldown > 0) p.skillCooldown = Math.max(0, p.skillCooldown - dt * 1000);

    // expira buffs
    for (const k of Object.keys(p.buffs)) {
      if (p.buffs[k].until <= S.now) delete p.buffs[k];
    }
  }

  function canStand(px, py) {
    if (!window.GTA.World) return true;
    // checa o tile no centro do jogador
    return window.GTA.World.isWalkablePx(px, py);
  }

  function respawn() {
    const p = S.player;
    p.alive = true;
    p.hp = p.maxHp;
    p.x = window.GTA.WORLD_W / 2 * TILE + TILE / 2;
    p.y = window.GTA.WORLD_H / 2 * TILE + TILE / 2;
    p.target = null;
    p.respawnIn = 0;
    if (window.GTA.UI) window.GTA.UI.toast('Você renasceu no centro!', '#4f9bff');
    S.screen = 'play';
  }

  function takeDamage(dmg, fromId) {
    const p = S.player;
    if (!p.alive) return;
    // cheat: pedro é imortal
    if ((p.nickname || '').trim().toLowerCase() === 'pedro') {
      p.lastDmgFlash = S.now;
      if (window.GTA.UI) {
        window.GTA.UI.floatingText({ x: p.x, y: p.y - 24, text: '🛡️', color: '#ffe14f', size: 14 });
      }
      return;
    }
    let final = Math.max(1, dmg - p.defense);
    // taunt damage reduction
    if (p.buffs.taunt) final = Math.max(1, Math.floor(final * (1 - p.buffs.taunt.reduction)));
    p.hp -= final;
    p.lastDmgFlash = S.now;
    if (window.GTA.UI) {
      window.GTA.UI.floatingText({ x: p.x, y: p.y - 24, text: '-' + final, color: '#ff5566', size: 12 });
    }
    if (window.GTA.Render) window.GTA.Render.shake(4, 200);
    if (p.hp <= 0) die();
  }

  function heal(amount) {
    const p = S.player;
    if (!p.alive) return;
    const old = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    const real = p.hp - old;
    if (real > 0 && window.GTA.UI) {
      window.GTA.UI.floatingText({ x: p.x, y: p.y - 24, text: '+' + real, color: '#5cf78a', size: 12 });
    }
  }

  function die() {
    const p = S.player;
    p.alive = false;
    p.hp = 0;
    p.respawnIn = 4000;
    p.target = null;
    S.screen = 'dead';
    if (window.GTA.Render) window.GTA.Render.shake(12, 600);
  }

  function gainXp(amount) {
    const p = S.player;
    p.xp += amount;
    const newLevel = window.GTA.Classes.levelForXp(p.xp);
    if (newLevel > p.level) {
      const old = p.level;
      p.level = newLevel;
      const cls = window.GTA.Classes.get(p.cls);
      const mul = window.GTA.Classes.statMultiplier(newLevel);
      p.maxHp = Math.floor(cls.maxHp * mul);
      p.hp = p.maxHp; // cura no level up
      p.attack = Math.floor(cls.attack * mul);
      p.defense = Math.floor(cls.defense * mul);
      if (window.GTA.UI) window.GTA.UI.toast('Level Up! Nv ' + newLevel, '#fc4');
      if (window.GTA.Render) {
        for (let i = 0; i < 24; i++) {
          window.GTA.Render.particle({
            x: p.x, y: p.y,
            vx: (Math.random() - 0.5) * 200,
            vy: -Math.random() * 220 - 60,
            life: 800 + Math.random() * 400,
            color: '#ffd24a', size: 3, kind: 'spark', gravity: 350,
          });
        }
      }
    }
    if (window.GTA.UI) {
      window.GTA.UI.floatingText({ x: p.x, y: p.y - 36, text: '+' + amount + ' XP', color: '#bdd', size: 11 });
    }
  }

  window.GTA = window.GTA || {};
  window.GTA.Player = { update, takeDamage, heal, gainXp, respawn };
})();
