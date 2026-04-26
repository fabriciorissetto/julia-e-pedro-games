// Server PartyKit do Go To Adventure — server-authoritative.
// Sala única "mundo". Servidor é dono de:
//   - jogadores (posição, hp, xp, level, buffs, cooldowns)
//   - mobs (AI, hp, respawn)
//   - combate (basic attack, skills, dano)
//   - chat
// Cliente só envia inputs (mover/atacar/skill/chat) e recebe estado + eventos.
// Deploy: `npx partykit deploy --name gotoadventure --main party/server.ts`

import type * as Party from "partykit/server";

// =============================================================================
// Constantes do mundo / tick
// =============================================================================

const TILE = 32;
const WORLD_W_TILES = 100;
const WORLD_H_TILES = 100;
const WORLD_W_PX = WORLD_W_TILES * TILE; // 3200
const WORLD_H_PX = WORLD_H_TILES * TILE; // 3200
const CENTER_X = (WORLD_W_TILES / 2) * TILE; // 1600
const CENTER_Y = (WORLD_H_TILES / 2) * TILE; // 1600

const TICK_MS = 100;            // 10 Hz
const IDLE_TIMEOUT_MS = 60_000; // 60s
const RESPAWN_MOB_MS = 10_000;
const RESPAWN_PLAYER_MS = 4_000;

// =============================================================================
// Tipagens
// =============================================================================

type Classe = "warrior" | "archer" | "mage" | "healer";
type AlvoTipo = "mob" | "jogador";
type MobType = "slime" | "wolf" | "golem" | "skeleton" | "dragon";
type Zone = "safe" | "mid" | "outer";

type TauntBuff = { until: number; reduction: number };

type Jogador = {
  id: string;
  nickname: string;
  cls: Classe;
  x: number; y: number;
  facing: string;
  hp: number; maxHp: number;
  xp: number; level: number;
  attack: number; defense: number;
  atkRange: number; atkSpeed: number;
  atkProjectile: string | null;
  atkCdUntil: number;
  skillCdUntil: number;
  skill2CdUntil: number;
  buffs: { taunt?: TauntBuff };
  alive: boolean;
  respawnAt: number;
  ultimoInput: number;
};

type Mob = {
  id: string;
  type: MobType;
  x: number; y: number;
  hp: number; maxHp: number;
  attack: number; defense: number;
  speed: number;
  attackRange: number; sightRange: number;
  attackCdMs: number;
  xpReward: number;
  targetId: string | null;
  attackCdUntil: number;
  alive: boolean;
  deadAt: number;
  spawnX: number; spawnY: number;
  zone: Zone;
  slowUntil: number;
  stunUntil: number;
};

// =============================================================================
// Stats das classes (espelho de classes.js)
// =============================================================================

type Skill1Def =
    | { id: "taunt"; cooldown: number; range: number; duration: number; damageReduction: number }
    | { id: "arrowRain"; cooldown: number; range: number; radius: number; duration: number; dps: number; slow: number }
    | { id: "arcane"; cooldown: number; radius: number; damageMul: number }
    | { id: "heal"; cooldown: number; radius: number; healPct: number };

type Skill2Def =
    | { id: "whirlwind"; cooldown: number; radius: number; damageMul: number }
    | { id: "piercingShot"; cooldown: number; length: number; widthTiles: number; damageMul: number }
    | { id: "fireLine"; cooldown: number; length: number; widthTiles: number; damageMul: number }
    | { id: "stunLock"; cooldown: number; duration: number };

type ClassDef = {
  maxHp: number; attack: number; defense: number;
  atkRange: number; atkSpeed: number; atkProjectile: string | null;
  skill: Skill1Def;
  skill2: Skill2Def;
};

const CLASSES: Record<Classe, ClassDef> = {
  warrior: {
    maxHp: 140, attack: 14, defense: 10,
    atkRange: 1.6, atkSpeed: 750, atkProjectile: null,
    skill: { id: "taunt", cooldown: 10000, range: 4, duration: 5000, damageReduction: 0.8 },
    skill2: { id: "whirlwind", cooldown: 12000, radius: 1.5, damageMul: 6.0 },
  },
  archer: {
    maxHp: 90, attack: 12, defense: 6,
    atkRange: 6, atkSpeed: 700, atkProjectile: "arrow",
    skill: { id: "arrowRain", cooldown: 8000, range: 7, radius: 5, duration: 3000, dps: 8, slow: 0.5 },
    skill2: { id: "piercingShot", cooldown: 10000, length: 16, widthTiles: 1.2, damageMul: 4.0 },
  },
  mage: {
    maxHp: 70, attack: 10, defense: 3,
    atkRange: 5, atkSpeed: 900, atkProjectile: "bolt",
    skill: { id: "arcane", cooldown: 8000, radius: 9, damageMul: 4.0 },
    skill2: { id: "fireLine", cooldown: 10000, length: 5, widthTiles: 1.4, damageMul: 4.0 },
  },
  healer: {
    maxHp: 95, attack: 7, defense: 5,
    atkRange: 4, atkSpeed: 850, atkProjectile: "spark",
    skill: { id: "heal", cooldown: 15000, radius: 4, healPct: 0.7 },
    skill2: { id: "stunLock", cooldown: 12000, duration: 5000 },
  },
};

// =============================================================================
// Stats dos mobs (espelho de combat.js)
// =============================================================================

type MobBase = {
  maxHp: number; attack: number; defense: number;
  speed: number; attackRange: number; sightRange: number;
  attackCdMs: number; xpReward: number;
};

// XP base 10x do antigo a pedido do Pedro. Skeleton 15x (era 60 → 900).
// Dragão: HP > golem (300 vs 180); attack 15x skeleton (24 * 15 = 360).
const MOB_TYPES: Record<MobType, MobBase> = {
  slime:    { maxHp: 30,  attack: 6,  defense: 0, speed: 60,  attackRange: 1.0, sightRange: 5, attackCdMs: 1500, xpReward: 100 },
  wolf:     { maxHp: 55,  attack: 11, defense: 2, speed: 120, attackRange: 1.0, sightRange: 7, attackCdMs: 900,  xpReward: 250 },
  golem:    { maxHp: 180, attack: 18, defense: 8, speed: 35,  attackRange: 1.2, sightRange: 5, attackCdMs: 1800, xpReward: 800 },
  skeleton: { maxHp: 90,  attack: 24, defense: 4, speed: 90,  attackRange: 1.2, sightRange: 8, attackCdMs: 1100, xpReward: 900 },
  dragon:   { maxHp: 300, attack: 360, defense: 12, speed: 70, attackRange: 1.5, sightRange: 9, attackCdMs: 1300, xpReward: 5000 },
};

const ZONE_MUL: Record<Zone, number> = { safe: 0.8, mid: 1.0, outer: 1.2 };

// caps + composição por zona — dragão é raro, só na outer
const ZONE_CFG: Record<Zone, { cap: number; mix: Array<[MobType, number]>; rMin: number; rMax: number }> = {
  safe:  { cap: 6,  mix: [["slime", 1.0]],                                                       rMin: 4,  rMax: 15 },
  mid:   { cap: 12, mix: [["slime", 0.5], ["wolf", 0.5]],                                        rMin: 15, rMax: 35 },
  outer: { cap: 18, mix: [["wolf", 0.4], ["golem", 0.25], ["skeleton", 0.25], ["dragon", 0.1]], rMin: 35, rMax: 50 },
};

// =============================================================================
// Helpers
// =============================================================================

const CLASSES_VALIDAS: Classe[] = ["warrior", "archer", "mage", "healer"];
const FACINGS = new Set(["up", "down", "left", "right"]);

function sanitizaNickname(raw: any): string {
  const s = String(raw ?? "").trim();
  if (s.length < 3) return "Visitante";
  // alfanumérico + espaço/_/-
  const limpo = s.replace(/[^A-Za-z0-9 _-]/g, "");
  const final = limpo.slice(0, 16);
  return final.length >= 3 ? final : "Visitante";
}

function sanitizaClasse(raw: any): Classe {
  return CLASSES_VALIDAS.includes(raw) ? (raw as Classe) : "warrior";
}

function sanitizaFacing(raw: any): string {
  const f = String(raw ?? "down");
  return FACINGS.has(f) ? f : "down";
}

function sanitizaTexto(raw: any, max: number): string {
  const s = String(raw ?? "").replace(/[<>]/g, "").trim();
  return s.slice(0, max);
}

function clampX(n: number): number {
  if (!Number.isFinite(n)) return CENTER_X;
  if (n < 0) return 0;
  if (n > WORLD_W_PX) return WORLD_W_PX;
  return n;
}

function clampY(n: number): number {
  if (!Number.isFinite(n)) return CENTER_Y;
  if (n < 0) return 0;
  if (n > WORLD_H_PX) return WORLD_H_PX;
  return n;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Testa se ponto (px, py) está dentro do retângulo definido pelo segmento (ax,ay)→(bx,by)
// engrossado por `halfW` em direção perpendicular. Usado pra skills lineares.
function pontoNoRetangulo(px: number, py: number, ax: number, ay: number, bx: number, by: number, halfW: number): boolean {
  const ex = bx - ax, ey = by - ay;
  const len2 = ex * ex + ey * ey;
  if (len2 === 0) return false;
  const t = ((px - ax) * ex + (py - ay) * ey) / len2;
  if (t < 0 || t > 1) return false;
  // distância perpendicular do ponto à linha
  const projX = ax + ex * t, projY = ay + ey * t;
  const dx = px - projX, dy = py - projY;
  return Math.sqrt(dx * dx + dy * dy) <= halfW;
}

function pickType(mix: Array<[MobType, number]>, rng: () => number): MobType {
  const r = rng();
  let acc = 0;
  for (const [t, w] of mix) {
    acc += w;
    if (r <= acc) return t;
  }
  return mix[mix.length - 1][0];
}

function uid(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// XP curve (idêntica ao classes.js cliente)
function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
function statMultiplier(level: number): number {
  return 1 + Math.log2(Math.max(1, level)) * 0.5;
}

// =============================================================================
// Server
// =============================================================================

type MsgIdentificar = { tipo: "identificar"; nickname: string; cls: string };
type MsgMover = { tipo: "mover"; x: number; y: number; facing: string };
type MsgAtaque = { tipo: "ataque"; targetId?: string };
type MsgSkill = { tipo: "skill"; alvoX?: number; alvoY?: number };
type MsgSkill2 = { tipo: "skill2"; alvoX?: number; alvoY?: number; targetId?: string | null; facing?: string };
type MsgChat = { tipo: "chat"; texto: string };
type MsgEntrada = MsgIdentificar | MsgMover | MsgAtaque | MsgSkill | MsgSkill2 | MsgChat;

export default class GoToAdventureServer implements Party.Server {
  jogadores = new Map<string, Jogador>();
  mobs = new Map<string, Mob>();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.spawnInitialMobs();
    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }

  // ---------------------------------------------------------------------------
  // Spawns
  // ---------------------------------------------------------------------------

  private spawnInitialMobs() {
    for (const zoneKey of Object.keys(ZONE_CFG) as Zone[]) {
      const cfg = ZONE_CFG[zoneKey];
      const need = cfg.cap;
      for (let i = 0; i < need; i++) {
        const pos = this.randomPosInRing(cfg.rMin, cfg.rMax);
        const t = pickType(cfg.mix, Math.random);
        this.spawnMob(t, pos.x, pos.y, zoneKey);
      }
    }
  }

  private randomPosInRing(rMinTiles: number, rMaxTiles: number): { x: number; y: number } {
    // amostragem uniforme por área num anel
    const rMin = rMinTiles * TILE;
    const rMax = rMaxTiles * TILE;
    const u = Math.random();
    const r = Math.sqrt(u * (rMax * rMax - rMin * rMin) + rMin * rMin);
    const ang = Math.random() * Math.PI * 2;
    const x = clampX(CENTER_X + Math.cos(ang) * r);
    const y = clampY(CENTER_Y + Math.sin(ang) * r);
    return { x, y };
  }

  private spawnMob(type: MobType, x: number, y: number, zone: Zone): Mob {
    const base = MOB_TYPES[type];
    const mul = ZONE_MUL[zone];
    const maxHp = Math.floor(base.maxHp * mul);
    const attack = Math.floor(base.attack * mul);
    const defense = Math.floor(base.defense * mul);
    const xpReward = Math.floor(base.xpReward * mul);
    const id = uid("m");
    const mob: Mob = {
      id, type,
      x, y,
      hp: maxHp, maxHp,
      attack, defense,
      speed: base.speed,
      attackRange: base.attackRange,
      sightRange: base.sightRange,
      attackCdMs: base.attackCdMs,
      xpReward,
      targetId: null,
      attackCdUntil: 0,
      alive: true,
      deadAt: 0,
      spawnX: x, spawnY: y,
      zone,
      slowUntil: 0,
      stunUntil: 0,
    };
    this.mobs.set(id, mob);
    return mob;
  }

  // ---------------------------------------------------------------------------
  // Conexão
  // ---------------------------------------------------------------------------

  onConnect(conn: Party.Connection) {
    const def = CLASSES.warrior;
    const novo: Jogador = {
      id: conn.id,
      nickname: "Visitante",
      cls: "warrior",
      x: CENTER_X, y: CENTER_Y,
      facing: "down",
      hp: def.maxHp, maxHp: def.maxHp,
      xp: 0, level: 1,
      attack: def.attack, defense: def.defense,
      atkRange: def.atkRange, atkSpeed: def.atkSpeed,
      atkProjectile: def.atkProjectile,
      atkCdUntil: 0, skillCdUntil: 0, skill2CdUntil: 0,
      buffs: {},
      alive: true,
      respawnAt: 0,
      ultimoInput: Date.now(),
    };
    this.jogadores.set(conn.id, novo);

    conn.send(JSON.stringify({
      tipo: "boasVindas",
      meuId: conn.id,
      jogadores: Array.from(this.jogadores.values()),
      mobs: Array.from(this.mobs.values()),
    }));
  }

  onClose(conn: Party.Connection) {
    if (this.jogadores.delete(conn.id)) {
      this.room.broadcast(JSON.stringify({ tipo: "saiu", id: conn.id }));
    }
  }

  onError(_conn: Party.Connection, _err: Error) {
    // PartyKit já loga
  }

  // ---------------------------------------------------------------------------
  // Mensagens do cliente
  // ---------------------------------------------------------------------------

  onMessage(raw: string, sender: Party.Connection) {
    let data: MsgEntrada;
    try { data = JSON.parse(raw); } catch { return; }

    const j = this.jogadores.get(sender.id);
    if (!j) return;

    j.ultimoInput = Date.now();

    if (data.tipo === "identificar") {
      this.handleIdentificar(j, data);
    } else if (data.tipo === "mover") {
      this.handleMover(j, data);
    } else if (data.tipo === "ataque") {
      this.handleAtaque(j, data);
    } else if (data.tipo === "skill") {
      this.handleSkill(j, data);
    } else if (data.tipo === "skill2") {
      this.handleSkill2(j, data);
    } else if (data.tipo === "chat") {
      this.handleChat(j, data);
    }
  }

  private handleIdentificar(j: Jogador, data: MsgIdentificar) {
    j.nickname = sanitizaNickname(data.nickname);
    const novaCls = sanitizaClasse(data.cls);
    if (novaCls !== j.cls) {
      // troca de classe: reaplica stats base e cura
      j.cls = novaCls;
      const def = CLASSES[novaCls];
      const mul = statMultiplier(j.level);
      j.maxHp = Math.floor(def.maxHp * mul);
      j.attack = Math.floor(def.attack * mul);
      j.defense = Math.floor(def.defense * mul);
      j.atkRange = def.atkRange;
      j.atkSpeed = def.atkSpeed;
      j.atkProjectile = def.atkProjectile;
      j.hp = j.maxHp;
    }
  }

  private handleMover(j: Jogador, data: MsgMover) {
    if (!j.alive) return;
    const nx = clampX(Number(data.x));
    const ny = clampY(Number(data.y));
    j.x = nx;
    j.y = ny;
    j.facing = sanitizaFacing(data.facing);
  }

  private handleAtaque(j: Jogador, data: MsgAtaque) {
    if (!j.alive) return;
    const now = Date.now();
    if (now < j.atkCdUntil) return;

    const rangePx = j.atkRange * TILE;
    const detectPx = Math.max(4 * TILE, rangePx * 1.5);

    // resolve alvo
    let alvo: Mob | null = null;
    if (data.targetId) {
      const m = this.mobs.get(String(data.targetId));
      if (m && m.alive) alvo = m;
    }
    if (!alvo) {
      // auto-aim: mob mais próximo dentro de detectPx
      let bestD = Infinity;
      for (const m of this.mobs.values()) {
        if (!m.alive) continue;
        const d = dist(j.x, j.y, m.x, m.y);
        if (d < bestD && d <= detectPx) { bestD = d; alvo = m; }
      }
    }

    j.atkCdUntil = now + j.atkSpeed;

    // sempre broadcast do swing — feedback visual
    this.broadcast({
      tipo: "evento", kind: "ataqueBasico",
      fromId: j.id,
      targetId: alvo ? alvo.id : undefined,
      x: j.x, y: j.y,
    });

    if (!alvo) return;

    const d = dist(j.x, j.y, alvo.x, alvo.y);
    if (d > rangePx) return; // selecionou alvo mas tá longe — ataque erra

    this.aplicaDanoEmMob(j, alvo, j.attack);
  }

  private handleSkill(j: Jogador, data: MsgSkill) {
    if (!j.alive) return;
    const now = Date.now();
    if (now < j.skillCdUntil) return;

    const def = CLASSES[j.cls];
    const sk = def.skill;

    if (sk.id === "taunt") {
      j.buffs.taunt = { until: now + sk.duration, reduction: sk.damageReduction };
      this.broadcast({
        tipo: "evento", kind: "skill",
        fromId: j.id, skillId: "taunt",
        x: j.x, y: j.y, raio: sk.range * TILE,
      });
    } else if (sk.id === "arcane") {
      const rPx = sk.radius * TILE;
      this.broadcast({
        tipo: "evento", kind: "skill",
        fromId: j.id, skillId: "arcane",
        x: j.x, y: j.y, raio: rPx,
      });
      for (const m of this.mobs.values()) {
        if (!m.alive) continue;
        if (dist(m.x, m.y, j.x, j.y) <= rPx) {
          this.aplicaDanoEmMob(j, m, j.attack * sk.damageMul);
        }
      }
    } else if (sk.id === "heal") {
      const heal = Math.floor(j.maxHp * sk.healPct);
      j.hp = Math.min(j.maxHp, j.hp + heal);
      const rPx = sk.radius * TILE;
      this.broadcast({
        tipo: "evento", kind: "skill",
        fromId: j.id, skillId: "heal",
        x: j.x, y: j.y, raio: rPx,
      });
      // cura outros players próximos
      for (const o of this.jogadores.values()) {
        if (o.id === j.id || !o.alive) continue;
        if (dist(o.x, o.y, j.x, j.y) <= rPx) {
          o.hp = Math.min(o.maxHp, o.hp + heal);
        }
      }
    } else if (sk.id === "arrowRain") {
      // alvoX/Y vêm do cliente (cursor); fallback: posição do player
      let tx = clampX(Number(data.alvoX));
      let ty = clampY(Number(data.alvoY));
      if (!Number.isFinite(Number(data.alvoX))) tx = j.x;
      if (!Number.isFinite(Number(data.alvoY))) ty = j.y;
      const rPx = sk.radius * TILE;
      this.broadcast({
        tipo: "evento", kind: "skill",
        fromId: j.id, skillId: "arrowRain",
        x: tx, y: ty, raio: rPx,
      });
      // MVP: aplica dano "agregado" instantaneamente (40% do total) + slow
      const totalDmg = sk.dps * (sk.duration / 1000) * 0.4;
      const slowMs = 3000;
      for (const m of this.mobs.values()) {
        if (!m.alive) continue;
        if (dist(m.x, m.y, tx, ty) <= rPx) {
          m.slowUntil = Math.max(m.slowUntil, now + slowMs);
          this.aplicaDanoEmMob(j, m, totalDmg);
        }
      }
    }

    j.skillCdUntil = now + sk.cooldown;
  }

  // Skill 2 — handler genérico para as 4 classes.
  private handleSkill2(j: Jogador, data: MsgSkill2) {
    if (!j.alive) return;
    const now = Date.now();
    if (now < j.skill2CdUntil) return;

    const def = CLASSES[j.cls];
    const sk = def.skill2;

    // facing → vetor unitário; client manda mas validamos via j.facing também
    const facing = (data.facing && ["up", "down", "left", "right"].includes(data.facing)) ? data.facing : j.facing;
    const dir = facing === "up" ? { dx: 0, dy: -1 }
              : facing === "down" ? { dx: 0, dy: 1 }
              : facing === "left" ? { dx: -1, dy: 0 }
              : { dx: 1, dy: 0 };

    if (sk.id === "whirlwind") {
      const rPx = sk.radius * TILE;
      this.broadcast({
        tipo: "evento", kind: "skill2",
        fromId: j.id, skillId: "whirlwind",
        x: j.x, y: j.y, raio: rPx,
      });
      for (const m of this.mobs.values()) {
        if (!m.alive) continue;
        if (dist(m.x, m.y, j.x, j.y) <= rPx) {
          this.aplicaDanoEmMob(j, m, j.attack * sk.damageMul);
        }
      }
    } else if (sk.id === "fireLine" || sk.id === "piercingShot") {
      // linha à frente — projetada num retângulo de comprimento `length` e largura `widthTiles`
      const lenPx = sk.length * TILE;
      const halfW = (sk.widthTiles * TILE) / 2;
      const startX = j.x;
      const startY = j.y;
      const endX = j.x + dir.dx * lenPx;
      const endY = j.y + dir.dy * lenPx;
      this.broadcast({
        tipo: "evento", kind: "skill2",
        fromId: j.id, skillId: sk.id,
        x: startX, y: startY,
        toX: endX, toY: endY,
        raio: halfW,
      });
      for (const m of this.mobs.values()) {
        if (!m.alive) continue;
        if (pontoNoRetangulo(m.x, m.y, startX, startY, endX, endY, halfW)) {
          this.aplicaDanoEmMob(j, m, j.attack * sk.damageMul);
        }
      }
    } else if (sk.id === "stunLock") {
      // stuna o mob que o player tem como alvo (cliente envia targetId)
      const targetId = data.targetId ? String(data.targetId) : null;
      if (!targetId) return;
      const target = this.mobs.get(targetId);
      if (!target || !target.alive) return;
      target.stunUntil = now + sk.duration;
      this.broadcast({
        tipo: "evento", kind: "skill2",
        fromId: j.id, skillId: "stunLock",
        x: target.x, y: target.y, raio: 24,
        targetId,
      });
    }

    j.skill2CdUntil = now + sk.cooldown;
  }

  private handleChat(j: Jogador, data: MsgChat) {
    const texto = sanitizaTexto(data.texto, 200);
    if (!texto) return;
    this.broadcast({
      tipo: "chat",
      playerId: j.id,
      nickname: j.nickname,
      texto,
      t: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Combate (dano em mob / em jogador)
  // ---------------------------------------------------------------------------

  private aplicaDanoEmMob(from: Jogador, mob: Mob, rawDmg: number) {
    if (!mob.alive) return;
    const dmg = Math.max(1, Math.floor(rawDmg - mob.defense));
    mob.hp -= dmg;

    this.broadcast({
      tipo: "evento", kind: "dano",
      alvoTipo: "mob", alvoId: mob.id,
      dano: dmg, x: mob.x, y: mob.y,
    });

    if (mob.hp <= 0) {
      mob.hp = 0;
      mob.alive = false;
      mob.deadAt = Date.now();
      mob.targetId = null;
      this.broadcast({
        tipo: "evento", kind: "morte",
        alvoTipo: "mob", alvoId: mob.id,
      });
      this.daXp(from, mob.xpReward);
    }
  }

  private aplicaDanoEmJogador(mob: Mob, j: Jogador) {
    if (!j.alive) return;
    let raw = mob.attack - j.defense;
    // taunt reduz dano
    const now = Date.now();
    if (j.buffs.taunt && j.buffs.taunt.until > now) {
      raw = raw * (1 - j.buffs.taunt.reduction);
    }
    const dmg = Math.max(1, Math.floor(raw));
    j.hp -= dmg;

    this.broadcast({
      tipo: "evento", kind: "dano",
      alvoTipo: "jogador", alvoId: j.id,
      dano: dmg, x: j.x, y: j.y,
    });

    if (j.hp <= 0) {
      j.hp = 0;
      j.alive = false;
      j.respawnAt = now + RESPAWN_PLAYER_MS;
      j.buffs = {};
      this.broadcast({
        tipo: "evento", kind: "morte",
        alvoTipo: "jogador", alvoId: j.id,
      });
    }
  }

  private daXp(j: Jogador, amount: number) {
    j.xp += amount;
    const novoLevel = levelForXp(j.xp);
    if (novoLevel > j.level) {
      j.level = novoLevel;
      // recalcula stats com base no level
      const def = CLASSES[j.cls];
      const mul = statMultiplier(j.level);
      const novoMax = Math.floor(def.maxHp * mul);
      // mantém razão de hp atual quando upa
      const ratio = j.maxHp > 0 ? j.hp / j.maxHp : 1;
      j.maxHp = novoMax;
      j.hp = Math.min(j.maxHp, Math.max(1, Math.floor(novoMax * ratio)));
      j.attack = Math.floor(def.attack * mul);
      j.defense = Math.floor(def.defense * mul);
    }
  }

  // ---------------------------------------------------------------------------
  // Tick: AI dos mobs + respawns
  // ---------------------------------------------------------------------------

  async onAlarm() {
    const agora = Date.now();
    const dt = TICK_MS / 1000;

    // 1) idle players → remove
    for (const [id, j] of this.jogadores) {
      if (agora - j.ultimoInput > IDLE_TIMEOUT_MS) {
        this.jogadores.delete(id);
        this.room.broadcast(JSON.stringify({ tipo: "saiu", id }));
      }
    }

    // 2) respawn de jogadores
    for (const j of this.jogadores.values()) {
      if (!j.alive && agora >= j.respawnAt) {
        j.alive = true;
        j.hp = j.maxHp;
        j.x = CENTER_X;
        j.y = CENTER_Y;
        j.atkCdUntil = 0;
        j.skillCdUntil = 0;
        this.broadcast({
          tipo: "evento", kind: "respawn",
          alvoTipo: "jogador", alvoId: j.id,
        });
      }
    }

    // 3) AI dos mobs + respawn
    this.tickMobs(agora, dt);

    // 4) broadcast estado
    if (this.jogadores.size > 0) {
      this.room.broadcast(JSON.stringify({
        tipo: "estado",
        t: agora,
        jogadores: Array.from(this.jogadores.values()),
        mobs: Array.from(this.mobs.values()),
      }));
    }

    await this.room.storage.setAlarm(Date.now() + TICK_MS);
  }

  private tickMobs(now: number, dt: number) {
    // pré-computa lista de jogadores vivos
    const playersVivos: Jogador[] = [];
    for (const j of this.jogadores.values()) if (j.alive) playersVivos.push(j);

    for (const m of this.mobs.values()) {
      // morto: respawn após delay
      if (!m.alive) {
        if (m.deadAt && now - m.deadAt >= RESPAWN_MOB_MS) {
          m.hp = m.maxHp;
          m.x = m.spawnX;
          m.y = m.spawnY;
          m.targetId = null;
          m.attackCdUntil = 0;
          m.alive = true;
          m.deadAt = 0;
          m.slowUntil = 0;
          m.stunUntil = 0;
          this.broadcast({
            tipo: "evento", kind: "respawn",
            alvoTipo: "mob", alvoId: m.id,
          });
        }
        continue;
      }

      // mob stunado: não move nem ataca
      if (m.stunUntil > now) {
        continue;
      }

      if (playersVivos.length === 0) {
        m.targetId = null;
        continue;
      }

      // 1) procura alvo: jogador mais próximo dentro do sight
      const sightPx = m.sightRange * TILE;
      let alvo: Jogador | null = null;
      let alvoD = Infinity;
      for (const p of playersVivos) {
        const d = dist(m.x, m.y, p.x, p.y);
        if (d < alvoD && d <= sightPx) { alvoD = d; alvo = p; }
      }

      // 2) taunt: se algum jogador taunto está dentro de 4 tiles, força ele
      const tauntPx = 4 * TILE;
      let alvoTaunt: Jogador | null = null;
      let alvoTauntD = Infinity;
      for (const p of playersVivos) {
        const t = p.buffs.taunt;
        if (!t || t.until <= now) continue;
        const d = dist(m.x, m.y, p.x, p.y);
        if (d <= tauntPx && d < alvoTauntD) { alvoTauntD = d; alvoTaunt = p; }
      }
      if (alvoTaunt) { alvo = alvoTaunt; alvoD = alvoTauntD; }

      if (!alvo) {
        m.targetId = null;
        continue;
      }

      m.targetId = alvo.id;
      const atkRangePx = m.attackRange * TILE;

      if (alvoD <= atkRangePx) {
        // ataca se cd ok
        if (now >= m.attackCdUntil) {
          m.attackCdUntil = now + m.attackCdMs;
          this.broadcast({
            tipo: "evento", kind: "ataqueBasico",
            fromId: m.id,
            targetId: alvo.id,
            x: m.x, y: m.y,
          });
          this.aplicaDanoEmJogador(m, alvo);
        }
      } else {
        // chase
        let speed = m.speed;
        if (m.slowUntil > now) speed *= 0.5;
        const dx = (alvo.x - m.x) / alvoD;
        const dy = (alvo.y - m.y) / alvoD;
        const step = speed * dt;
        m.x = clampX(m.x + dx * step);
        m.y = clampY(m.y + dy * step);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast helper
  // ---------------------------------------------------------------------------

  private broadcast(msg: any) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

GoToAdventureServer satisfies Party.Worker;
