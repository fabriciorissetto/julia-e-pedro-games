// Definições das 4 classes do jogador.
// Stats base, range de ataque, skill, sprite key.
(function () {
  const CLASSES = {
    warrior: {
      id: 'warrior',
      name: 'Guerreiro',
      desc: 'HP alto, defesa alta, ataque corpo-a-corpo.',
      color: '#c44',
      maxHp: 140,
      attack: 14,
      defense: 10,
      atkRange: 1.6,         // tiles
      atkSpeed: 750,         // ms
      atkProjectile: null,   // melee = sem projétil
      sprite: 'warrior',
      skill: {
        id: 'taunt',
        name: 'Provocar',
        desc: 'Puxa inimigos próximos e reduz dano em 80% por 5s.',
        cooldown: 10000,
        range: 4,            // tiles
        duration: 5000,
        damageReduction: 0.8,
      },
    },
    archer: {
      id: 'archer',
      name: 'Arqueiro',
      desc: 'Alcance longo, ataque automático.',
      color: '#2a8',
      maxHp: 90,
      attack: 12,
      defense: 6,
      atkRange: 6,           // tiles
      atkSpeed: 700,
      atkProjectile: 'arrow',
      sprite: 'archer',
      skill: {
        id: 'arrowRain',
        name: 'Chuva de Flechas',
        desc: 'Área alvo: dano contínuo + slow 50% por 3s.',
        cooldown: 8000,
        range: 7,
        radius: 2.5,
        duration: 3000,
        dps: 8,
        slow: 0.5,
      },
    },
    mage: {
      id: 'mage',
      name: 'Mago',
      desc: 'HP baixo, dano em área alto.',
      color: '#84f',
      maxHp: 70,
      attack: 10,
      defense: 3,
      atkRange: 5,
      atkSpeed: 900,
      atkProjectile: 'bolt',
      sprite: 'mage',
      skill: {
        id: 'arcane',
        name: 'Explosão Arcana',
        desc: 'Explosão em área ao redor. Dano alto.',
        cooldown: 8000,
        radius: 3.2,
        damageMul: 4.0,
      },
    },
    healer: {
      id: 'healer',
      name: 'Curandeiro',
      desc: 'Suporte. Cura aliados em área.',
      color: '#fc4',
      maxHp: 95,
      attack: 7,
      defense: 5,
      atkRange: 4,
      atkSpeed: 850,
      atkProjectile: 'spark',
      sprite: 'healer',
      skill: {
        id: 'heal',
        name: 'Cura Divina',
        desc: 'Cura 70% do HP em área (você + aliados).',
        cooldown: 15000,
        radius: 4,
        healPct: 0.7,
      },
    },
  };

  function applyClass(player, clsId) {
    const c = CLASSES[clsId] || CLASSES.warrior;
    player.cls = c.id;
    player.maxHp = c.maxHp;
    player.hp = c.maxHp;
    player.attack = c.attack;
    player.defense = c.defense;
    player.atkRange = c.atkRange;
    player.atkSpeed = c.atkSpeed;
    player.atkProjectile = c.atkProjectile;
  }

  // XP curve com diminishing returns: level = floor(sqrt(xp/50)) + 1
  function levelForXp(xp) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  }
  function xpForLevel(level) {
    return ((level - 1) ** 2) * 50;
  }
  function xpForNextLevel(level) {
    return xpForLevel(level + 1);
  }

  // bônus por level — diminishing returns
  function statMultiplier(level) {
    // ~2x em level 10, ~3x em level 25, ~4x em level 50
    return 1 + Math.log2(level) * 0.5;
  }

  window.GTA = window.GTA || {};
  window.GTA.Classes = {
    CLASSES,
    apply: applyClass,
    levelForXp,
    xpForLevel,
    xpForNextLevel,
    statMultiplier,
    list() { return Object.values(CLASSES); },
    get(id) { return CLASSES[id]; },
  };
})();
