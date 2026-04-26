// Net — facade de rede do Go To Adventure (server-authoritative).
// Modo 'local' (default em localhost): nada de WebSocket. Mobs/recursos rodam local.
// Modo 'online': PartyKit é authoritativo sobre mobs/combat/skills/chat.
// Override: ?online=1 força conexão mesmo em localhost; ?online=0 força local.
(function () {
  const PROD_URL = 'wss://gotoadventure.fabriciorissetto.partykit.dev/parties/main/mundo';
  const SEND_INTERVAL_MS = 100;     // 10 envios/seg de "mover"
  const STALE_OTHER_MS = 5000;
  const RECONNECT_DELAY_MS = 5000;
  const MAX_RECONNECT_ATTEMPTS = 3;
  const BUBBLE_MS = 6000;           // duração do balão de chat acima do player

  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let lastSendAt = 0;

  function shouldConnect() {
    const params = new URLSearchParams(location.search || '');
    if (params.get('online') === '1') return true;
    if (params.get('online') === '0') return false;
    const host = (typeof location !== 'undefined' && location.hostname) || '';
    return !(host === 'localhost' || host === '127.0.0.1' || host === '');
  }

  const Net = {
    init() {
      const state = window.GTA.state;
      state.net.connected = false;
      state.net.myServerId = null;
      if (!shouldConnect()) {
        state.net.mode = 'local';
        return;
      }
      state.net.mode = 'online';
      try { Net._connect(); } catch (e) { Net._fallbackLocal(); }
    },

    _connect() {
      const state = window.GTA.state;
      try {
        ws = new WebSocket(PROD_URL);
      } catch (e) {
        Net._scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        reconnectAttempts = 0;
        state.net.connected = true;
        state.net.mode = 'online';
        Net.send({ tipo: 'identificar', nickname: state.player.nickname, cls: state.player.cls });
        if (window.GTA.UI) window.GTA.UI.toast('Conectado ao servidor!', '#5cf78a');
      };
      ws.onmessage = (ev) => {
        let data; try { data = JSON.parse(ev.data); } catch { return; }
        Net._handle(data);
      };
      ws.onclose = () => {
        state.net.connected = false;
        Net._scheduleReconnect();
      };
      ws.onerror = () => { try { ws && ws.close(); } catch {} };
    },

    _handle(msg) {
      const state = window.GTA.state;
      const now = Date.now();
      switch (msg.tipo) {
        case 'boasVindas':
          state.net.myServerId = msg.meuId || null;
          state.others.clear();
          if (Array.isArray(msg.jogadores)) {
            for (const j of msg.jogadores) {
              if (j.id === state.net.myServerId) {
                // server diz quem somos — sincroniza stats iniciais
                Object.assign(state.player, pickJogador(j));
              } else {
                state.others.set(j.id, makeOther(j, now));
              }
            }
          }
          if (Array.isArray(msg.mobs)) {
            state.mobs.clear();
            for (const m of msg.mobs) state.mobs.set(m.id, makeMob(m));
          }
          break;

        case 'estado': {
          if (Array.isArray(msg.jogadores)) {
            const seen = new Set();
            for (const j of msg.jogadores) {
              if (j.id === state.net.myServerId) {
                // só atualiza HP/level/xp do server; posição/cd ficam client-side
                state.player.hp = j.hp; state.player.maxHp = j.maxHp;
                state.player.xp = j.xp; state.player.level = j.level;
                state.player.attack = j.attack; state.player.defense = j.defense;
                state.player.alive = j.alive !== false;
                continue;
              }
              seen.add(j.id);
              const cur = state.others.get(j.id);
              if (cur) {
                cur.x = j.x; cur.y = j.y;
                cur.facing = j.facing || cur.facing;
                cur.nickname = j.nickname || cur.nickname;
                cur.cls = j.cls || cur.cls;
                cur.hp = j.hp; cur.maxHp = j.maxHp;
                cur.level = j.level;
                cur.alive = j.alive !== false;
                cur.lastSeen = now;
                if (j.x !== cur.lastX || j.y !== cur.lastY) {
                  cur.moving = true;
                  cur.animFrame = (cur.animFrame + 0.4) % 4;
                  cur.lastX = j.x; cur.lastY = j.y;
                } else {
                  cur.moving = false;
                }
              } else {
                state.others.set(j.id, makeOther(j, now));
              }
            }
          }
          if (Array.isArray(msg.mobs)) {
            const seen = new Set();
            for (const m of msg.mobs) {
              seen.add(m.id);
              const cur = state.mobs.get(m.id);
              if (cur) {
                cur.x = m.x; cur.y = m.y;
                cur.hp = m.hp; cur.maxHp = m.maxHp;
                cur.alive = m.alive !== false;
                cur.type = m.type || cur.type;
              } else {
                state.mobs.set(m.id, makeMob(m));
              }
            }
            // remove mobs que sumiram do server
            for (const id of state.mobs.keys()) {
              if (!seen.has(id)) state.mobs.delete(id);
            }
          }
          break;
        }

        case 'evento':
          handleEvento(msg);
          break;

        case 'chat':
          if (msg.texto && msg.playerId) {
            state.chat.history.push({ nick: msg.nickname || '?', text: msg.texto, t: now });
            if (state.chat.history.length > 30) state.chat.history.shift();
            state.chat.bubbles.set(msg.playerId, { text: msg.texto, until: now + BUBBLE_MS });
          }
          break;

        case 'saiu':
          if (msg.id) {
            state.others.delete(msg.id);
            state.chat.bubbles.delete(msg.id);
          }
          break;
      }
    },

    _scheduleReconnect() {
      const state = window.GTA.state;
      if (state.net.mode !== 'online') return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) { Net._fallbackLocal(); return; }
      reconnectAttempts++;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        try { Net._connect(); } catch { Net._fallbackLocal(); }
      }, RECONNECT_DELAY_MS);
    },

    _fallbackLocal() {
      const state = window.GTA.state;
      state.net.mode = 'local';
      state.net.connected = false;
      state.net.myServerId = null;
      state.others.clear();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { ws && ws.close(); } catch {}
      ws = null;
      if (window.GTA.UI) window.GTA.UI.toast('Modo offline — single-player.', '#ffd24a');
    },

    send(msg) {
      const state = window.GTA.state;
      if (state.net.mode !== 'online' || !state.net.connected) return false;
      if (!ws || ws.readyState !== 1) return false;
      try { ws.send(JSON.stringify(msg)); return true; } catch { return false; }
    },

    sendAttack(targetId) {
      return Net.send({ tipo: 'ataque', targetId: targetId || null });
    },
    sendSkill(alvoX, alvoY) {
      return Net.send({ tipo: 'skill', alvoX: alvoX, alvoY: alvoY });
    },
    sendChat(texto) {
      const state = window.GTA.state;
      const t = String(texto || '').slice(0, 200).trim();
      if (!t) return;
      // local echo: bolha aparece sobre o próprio player
      const myId = state.net.myServerId || 'me';
      state.chat.bubbles.set(myId, { text: t, until: Date.now() + BUBBLE_MS });
      state.chat.history.push({ nick: state.player.nickname, text: t, t: Date.now() });
      if (state.chat.history.length > 30) state.chat.history.shift();
      Net.send({ tipo: 'chat', texto: t });
    },

    update(_dt) {
      const state = window.GTA.state;
      const now = Date.now();

      // limpa balões expirados
      for (const [id, b] of state.chat.bubbles) {
        if (b.until <= now) state.chat.bubbles.delete(id);
      }
      // limpa jogadores estagnados
      if (state.others.size > 0) {
        for (const [id, o] of state.others) {
          if (now - (o.lastSeen || 0) > STALE_OTHER_MS) state.others.delete(id);
        }
      }
      if (state.net.mode !== 'online' || !state.net.connected) return;
      if (now - lastSendAt >= SEND_INTERVAL_MS) {
        lastSendAt = now;
        const p = state.player;
        Net.send({ tipo: 'mover', x: p.x, y: p.y, facing: p.facing });
      }
    },

    get myId() { return window.GTA.state.net.myServerId; },
  };

  // ---- helpers ----

  function pickJogador(j) {
    return {
      hp: j.hp, maxHp: j.maxHp,
      attack: j.attack, defense: j.defense,
      atkRange: j.atkRange, atkSpeed: j.atkSpeed,
      atkProjectile: j.atkProjectile,
      level: j.level, xp: j.xp,
      alive: j.alive !== false,
    };
  }

  function makeOther(j, now) {
    return {
      id: j.id,
      nickname: j.nickname || 'Hero',
      cls: j.cls || 'warrior',
      x: j.x || 0, y: j.y || 0,
      lastX: j.x || 0, lastY: j.y || 0,
      facing: j.facing || 'down',
      hp: j.hp, maxHp: j.maxHp,
      level: j.level || 1,
      alive: j.alive !== false,
      moving: false,
      animFrame: 0,
      animState: 'idle', animUntil: 0, animActionFrame: 0,
      lastSeen: now,
    };
  }

  function makeMob(m) {
    return {
      id: m.id, type: m.type,
      x: m.x, y: m.y,
      hp: m.hp, maxHp: m.maxHp,
      attack: m.attack || 0, defense: m.defense || 0,
      level: m.level || 1,
      alive: m.alive !== false,
      animFrame: 0,
      lastDmgFlash: 0,
    };
  }

  // Eventos visuais — animação local pra todos verem
  function handleEvento(msg) {
    const state = window.GTA.state;
    const Render = window.GTA.Render;
    const UI = window.GTA.UI;
    const TILE = window.GTA.TILE;
    const k = msg.kind;

    if (k === 'ataqueBasico') {
      // outro player (ou eu) atacou — anima swing nele e (se hit) flash no mob
      const isMe = msg.fromId === state.net.myServerId;
      const fromEntity = isMe ? state.player : state.others.get(msg.fromId);
      if (fromEntity) {
        fromEntity.animState = 'attack';
        fromEntity.animUntil = state.now + 220;
        fromEntity.animActionFrame = 0;
      }
      // efeito visual no alvo
      if (msg.targetId && Render) {
        const mob = state.mobs.get(msg.targetId);
        if (mob) {
          mob.lastDmgFlash = state.now;
          Render.addAoE && Render.addAoE({ x: mob.x, y: mob.y, r: 18, life: 200, color: 'rgba(255,255,255,0.55)', kind: 'slash' });
          for (let i = 0; i < 4; i++) {
            Render.particle && Render.particle({
              x: mob.x, y: mob.y,
              vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140 - 30,
              life: 220, color: '#fff', size: 2, kind: 'spark', gravity: 200,
            });
          }
        }
      }
    } else if (k === 'skill') {
      const isMe = msg.fromId === state.net.myServerId;
      const fromEntity = isMe ? state.player : state.others.get(msg.fromId);
      if (fromEntity) {
        fromEntity.animState = 'cast';
        fromEntity.animUntil = state.now + 380;
        fromEntity.animActionFrame = 0;
      }
      const cx = msg.x, cy = msg.y;
      const r = (msg.raio || 3) * TILE;
      const colors = { taunt: 'rgba(255,210,74,0.32)', arcane: 'rgba(255,140,80,0.4)', heal: 'rgba(80,255,160,0.35)', arrowRain: 'rgba(120,200,255,0.32)' };
      Render && Render.addAoE && Render.addAoE({ x: cx, y: cy, r: r, life: 800, color: colors[msg.skillId] || 'rgba(255,255,255,0.3)', kind: msg.skillId });
      Render && Render.shake && Render.shake(4, 200);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * r;
        Render && Render.particle && Render.particle({
          x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr,
          vx: 0, vy: -60 - Math.random() * 80, life: 500 + Math.random() * 300,
          color: msg.skillId === 'heal' ? '#5cf78a' : (msg.skillId === 'arcane' ? '#ffb84a' : '#ffd24a'),
          size: 2, kind: 'spark', gravity: -40,
        });
      }
    } else if (k === 'dano') {
      // floating text no alvo
      const target = msg.alvoTipo === 'mob' ? state.mobs.get(msg.alvoId) : null;
      if (target) target.lastDmgFlash = state.now;
      if (UI && UI.floatingText) {
        UI.floatingText({ x: msg.x, y: msg.y - 16, text: '-' + msg.dano, color: msg.alvoTipo === 'jogador' ? '#ff5566' : '#ffeecc', size: 11 });
      }
    } else if (k === 'morte') {
      if (msg.alvoTipo === 'mob') {
        const m = state.mobs.get(msg.alvoId);
        if (m) m.alive = false;
        if (Render && Render.particle) {
          for (let i = 0; i < 12; i++) {
            Render.particle({
              x: m ? m.x : 0, y: m ? m.y : 0,
              vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 200 - 40,
              life: 600, color: '#caa', size: 2, kind: 'spark', gravity: 320,
            });
          }
        }
      }
    } else if (k === 'respawn') {
      if (msg.alvoTipo === 'mob') {
        const m = state.mobs.get(msg.alvoId);
        if (m) { m.alive = true; m.hp = m.maxHp; }
      }
    }
  }

  window.GTA = window.GTA || {};
  window.GTA.Net = Net;
})();
