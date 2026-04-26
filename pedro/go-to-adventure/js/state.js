// Estado global do jogo. Singleton em window.GTA.state.
// Todos os módulos leem/escrevem aqui. Mantém serialização simples.
(function () {
  const TILE = 32;
  const WORLD_W = 100;
  const WORLD_H = 100;

  const state = {
    // tempo
    now: 0,
    dt: 0,
    fps: 60,
    frame: 0,

    // tela
    screen: 'menu', // 'menu' | 'play' | 'dead'
    canvasW: 1280,
    canvasH: 720,

    // mundo
    world: {
      w: WORLD_W,
      h: WORLD_H,
      tile: TILE,
      tiles: null,        // Uint8Array (preenchido por World.generate)
      seed: 12345,
      centerX: WORLD_W / 2,
      centerY: WORLD_H / 2,
    },

    // jogador local
    player: {
      id: 'me',
      nickname: 'Hero',
      cls: 'warrior',
      x: WORLD_W / 2 * TILE + TILE / 2,
      y: WORLD_H / 2 * TILE + TILE / 2,
      vx: 0, vy: 0,
      facing: 'down', // 'up'|'down'|'left'|'right'
      moving: false,
      animFrame: 0,
      animState: 'idle', // 'idle'|'walk'|'attack'|'cast'
      animUntil: 0,      // ms — quando 'attack'/'cast' expira voltando pra 'idle'/'walk'
      animActionFrame: 0, // 0..N-1 dentro da action de attack/cast
      hp: 100, maxHp: 100,
      xp: 0,
      level: 1,
      attack: 10,
      defense: 5,
      atkRange: 1.4,      // tiles (warrior melee)
      atkCooldown: 0,     // ms
      atkSpeed: 800,      // ms entre ataques
      skillCooldown: 0,   // ms
      target: null,       // id do alvo (mob)
      alive: true,
      respawnIn: 0,
      lastDmgFlash: 0,
      buffs: {},          // ex: taunt:{until,reduction}
    },

    // entidades
    mobs: new Map(),       // id -> { id,type,x,y,hp,maxHp,attack,xpReward,target,attackCd,deadAt,spawnX,spawnY,zone,stunUntil,slowUntil }
    resources: new Map(),  // id -> { id,type,x,y,hits,maxHits,respawnAt }
    overlays: new Map(),   // chave (tx*10000+ty) -> { id, type, tx, ty, x, y, block }
    others: new Map(),     // outros jogadores (multiplayer)

    // inventário (20 slots)
    inventory: new Array(20).fill(null), // {item, qty}
    equipped: { weapon: null, armor: null }, // ids de item

    // efeitos visuais
    particles: [],         // {x,y,vx,vy,life,maxLife,color,size,kind}
    floatingTexts: [],     // {x,y,vy,life,maxLife,text,color,size}
    aoeIndicators: [],     // {x,y,r,life,maxLife,color,kind}
    projectiles: [],       // {x,y,tx,ty,speed,kind,fromId,target,damage,life}
    shake: { mag: 0, until: 0 },

    // câmera (zoom 1.25 = um pouco mais perto do player)
    camera: { x: 0, y: 0, zoom: 1.25 },

    // input
    input: {
      keys: new Set(),     // 'KeyW', 'KeyA', etc
      mouseX: 0,
      mouseY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
      mouseDown: false,
      clicked: false,      // single-frame flag
    },

    // UI flags
    ui: {
      inventoryOpen: false,
      craftingOpen: false,
      tooltip: null,       // {x,y,title,text}
      toasts: [],          // {text,life,maxLife,color}
      hoveredSlot: -1,
      hoveredRecipe: -1,
      help: false,
    },

    // network
    net: {
      mode: 'local',       // 'local' | 'online'
      connected: false,
      myServerId: null,    // id que o server me deu
    },

    // chat
    chat: {
      open: false,         // input aberto?
      text: '',            // texto sendo digitado
      history: [],         // {nick, text, t} — feed lateral
      bubbles: new Map(),  // playerId -> { text, until }
    },

    // áudio (placeholder)
    audio: { muted: false },

    // debug
    debug: { enabled: false, mobsAlive: 0, fps: 0 },
  };

  window.GTA = window.GTA || {};
  window.GTA.state = state;
  window.GTA.TILE = TILE;
  window.GTA.WORLD_W = WORLD_W;
  window.GTA.WORLD_H = WORLD_H;

  // utilitários partilhados
  window.GTA.util = {
    dist(ax, ay, bx, by) {
      const dx = ax - bx, dy = ay - by;
      return Math.hypot(dx, dy);
    },
    distTiles(ax, ay, bx, by) {
      return Math.hypot(ax - bx, ay - by) / TILE;
    },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(seed) {
      // mulberry32
      let s = seed >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    uid() {
      return Math.random().toString(36).slice(2, 10);
    },
  };
})();
