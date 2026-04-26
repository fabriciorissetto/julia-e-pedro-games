// Net — facade de rede do Go To Adventure.
// Modo 'local' (default): nada de WebSocket. Outros jogadores não existem.
// Modo 'online': tenta conectar ao deployment PartyKit. Se falhar 3x, cai pra local.
// O jogo single-player funciona perfeitamente sem rede.
(function () {
  const PROD_URL = 'wss://gotoadventure.fabriciorissetto.partykit.dev/parties/main/mundo';
  const SEND_INTERVAL_MS = 100;     // 10 envios/seg de "mover"
  const STALE_OTHER_MS = 5000;      // remove outro jogador sem update há >5s
  const RECONNECT_DELAY_MS = 5000;
  const MAX_RECONNECT_ATTEMPTS = 3;

  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let lastSendAt = 0;
  let myServerId = null;

  const Net = {
    init() {
      const state = window.GTA.state;
      const host = (typeof location !== 'undefined' && location.hostname) || '';
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
      if (isLocal) {
        state.net.mode = 'local';
        state.net.connected = false;
        return;
      }
      state.net.mode = 'online';
      state.net.connected = false;
      try {
        Net._connect();
      } catch (e) {
        // qualquer falha → continua em local sem travar o jogo
        Net._fallbackLocal();
      }
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
        // identifica logo de cara
        Net.send({
          tipo: 'identificar',
          nickname: state.player.nickname,
          cls: state.player.cls,
        });
      };

      ws.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        Net._handle(data);
      };

      ws.onclose = () => {
        state.net.connected = false;
        Net._scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose costuma vir logo depois; não duplica reconnect aqui
        try { ws && ws.close(); } catch {}
      };
    },

    _handle(msg) {
      const state = window.GTA.state;
      const now = Date.now();
      if (msg.tipo === 'boasVindas') {
        myServerId = msg.meuId || null;
        state.others.clear();
        if (Array.isArray(msg.jogadores)) {
          for (const j of msg.jogadores) {
            if (j.id === myServerId) continue;
            state.others.set(j.id, {
              id: j.id,
              nickname: j.nickname || 'Hero',
              cls: j.cls || 'warrior',
              x: j.x || 0,
              y: j.y || 0,
              facing: j.facing || 'down',
              animFrame: 0,
              lastSeen: now,
            });
          }
        }
      } else if (msg.tipo === 'estado') {
        if (!Array.isArray(msg.jogadores)) return;
        for (const j of msg.jogadores) {
          if (j.id === myServerId) continue;
          const cur = state.others.get(j.id);
          if (cur) {
            cur.x = j.x;
            cur.y = j.y;
            cur.facing = j.facing || cur.facing;
            cur.nickname = j.nickname || cur.nickname;
            cur.cls = j.cls || cur.cls;
            cur.lastSeen = now;
          } else {
            state.others.set(j.id, {
              id: j.id,
              nickname: j.nickname || 'Hero',
              cls: j.cls || 'warrior',
              x: j.x || 0,
              y: j.y || 0,
              facing: j.facing || 'down',
              animFrame: 0,
              lastSeen: now,
            });
          }
        }
      } else if (msg.tipo === 'saiu') {
        if (msg.id) state.others.delete(msg.id);
      }
    },

    _scheduleReconnect() {
      const state = window.GTA.state;
      if (state.net.mode !== 'online') return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        Net._fallbackLocal();
        return;
      }
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
      myServerId = null;
      state.others.clear();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try { ws && ws.close(); } catch {}
      ws = null;
      const UI = window.GTA && window.GTA.UI;
      if (UI && typeof UI.toast === 'function') {
        UI.toast('Modo offline — single-player.', '#ffd24a');
      }
    },

    send(msg) {
      const state = window.GTA.state;
      if (state.net.mode !== 'online' || !state.net.connected) return;
      if (!ws || ws.readyState !== 1 /* OPEN */) return;
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // falha silenciosa — o onclose cuida do reconnect
      }
    },

    update(_dt) {
      const state = window.GTA.state;
      const now = Date.now();

      // limpa jogadores estagnados (qualquer modo, por segurança)
      if (state.others && state.others.size > 0) {
        for (const [id, o] of state.others) {
          if (now - (o.lastSeen || 0) > STALE_OTHER_MS) {
            state.others.delete(id);
          }
        }
      }

      if (state.net.mode !== 'online' || !state.net.connected) return;

      if (now - lastSendAt >= SEND_INTERVAL_MS) {
        lastSendAt = now;
        const p = state.player;
        Net.send({
          tipo: 'mover',
          x: p.x,
          y: p.y,
          facing: p.facing,
        });
      }
    },

    // exposto pra debug/uso externo
    get myId() { return myServerId; },
  };

  window.GTA = window.GTA || {};
  window.GTA.Net = Net;
})();
