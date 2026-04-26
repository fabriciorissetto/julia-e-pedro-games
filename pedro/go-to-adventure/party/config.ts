// ═══════════════════════════════════════════════════════════════════════════
// 🎮  CONFIGURAÇÕES DO SERVIDOR  —  MEXA AQUI PRA AJUSTAR STATS!
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️  IMPORTANTE:
// Esse arquivo é uma CÓPIA do js/config.js (que roda no navegador).
// Quando mexer aqui, mexa OS MESMOS valores no js/config.js.
// Senão o servidor calcula uma coisa e o cliente outra.
//
// Depois de mexer aqui, rode no terminal:
//   npx partykit deploy
// Pra o servidor pegar os novos valores.
// ═══════════════════════════════════════════════════════════════════════════

export type Classe = "warrior" | "archer" | "mage" | "healer";
export type MobType = "slime" | "wolf" | "golem" | "skeleton" | "dragon";

export type ClassStats = {
  maxHp: number;
  attack: number;
  defense: number;
  atkRange: number;
  atkSpeed: number;
};

export type MobStats = {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  sightRange: number;
  attackCdMs: number;
  xpReward: number;
};

// ─── Classes ──────────────────────────────────────────────────────────────

export const CLASS_STATS: Record<Classe, ClassStats> = {
  warrior: {
    maxHp:    140,
    attack:   14,
    defense:  10,
    atkRange: 1.6,
    atkSpeed: 750,
  },
  archer: {
    maxHp:    90,
    attack:   12,
    defense:  6,
    atkRange: 20,
    atkSpeed: 700,
  },
  mage: {
    maxHp:    70,
    attack:   10,
    defense:  3,
    atkRange: 5,
    atkSpeed: 900,
  },
  healer: {
    maxHp:    95,
    attack:   7,
    defense:  5,
    atkRange: 4,
    atkSpeed: 850,
  },
};

// ─── Monstros ─────────────────────────────────────────────────────────────

export const MOB_STATS: Record<MobType, MobStats> = {
  slime: {
    maxHp:       30,
    attack:      6,
    defense:     0,
    speed:       60,
    attackRange: 1.0,
    sightRange:  5,
    attackCdMs:  1500,
    xpReward:    100,
  },
  wolf: {
    maxHp:       55,
    attack:      11,
    defense:     2,
    speed:       120,
    attackRange: 1.0,
    sightRange:  7,
    attackCdMs:  900,
    xpReward:    250,
  },
  golem: {
    maxHp:       180,
    attack:      18,
    defense:     8,
    speed:       35,
    attackRange: 1.2,
    sightRange:  5,
    attackCdMs:  1800,
    xpReward:    800,
  },
  skeleton: {
    maxHp:       90,
    attack:      24,
    defense:     4,
    speed:       90,
    attackRange: 1.2,
    sightRange:  8,
    attackCdMs:  1100,
    xpReward:    900,
  },
  dragon: {
    maxHp:       300,
    attack:      360,
    defense:     12,
    speed:       70,
    attackRange: 1.5,
    sightRange:  9,
    attackCdMs:  1300,
    xpReward:    5000,
  },
};
