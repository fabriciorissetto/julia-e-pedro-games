// Definições das 4 classes do jogador.
// Stats base vêm de js/config.js (edite lá!). Aqui ficam só skills, cores e sprites.
(function () {
  // pega stats do config — cliente carrega config.js antes deste
  const CFG = (window.GTA && window.GTA.Config && window.GTA.Config.CLASSES) || {};

  const CLASSES = {
    warrior: {
      id: 'warrior',
      name: 'Guerreiro',
      desc: 'HP alto, defesa alta, ataque corpo-a-corpo.',
      color: '#c44',
      maxHp: CFG.warrior.maxHp,
      attack: CFG.warrior.attack,
      defense: CFG.warrior.defense,
      atkRange: CFG.warrior.atkRange,
      atkSpeed: CFG.warrior.atkSpeed,
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
      skill2: {
        id: 'whirlwind',
        name: 'Redemoinho',
        desc: 'Ataque devastador nos 8 quadrados ao redor.',
        cooldown: 12000,
        radius: 1.5,         // ~9 boxes (3x3)
        damageMul: 6.0,
      },
    },
    archer: {
      id: 'archer',
      name: 'Arqueiro',
      desc: 'Alcance enorme — atira a tela inteira.',
      color: '#2a8',
      maxHp: CFG.archer.maxHp,
      attack: CFG.archer.attack,
      defense: CFG.archer.defense,
      atkRange: CFG.archer.atkRange,
      atkSpeed: CFG.archer.atkSpeed,
      atkProjectile: 'arrow',
      sprite: 'archer',
      skill: {
        id: 'arrowRain',
        name: 'Chuva de Flechas',
        desc: 'Área alvo: dano contínuo + slow 50% por 3s.',
        cooldown: 8000,
        range: 7,
        radius: 5,
        duration: 3000,
        dps: 8,
        slow: 0.5,
      },
      skill2: {
        id: 'piercingShot',
        name: 'Tiro Perfurante',
        desc: 'Linha reta de 16 tiles à frente. Atravessa inimigos.',
        cooldown: 10000,
        length: 16,          // tiles
        widthTiles: 1.2,
        damageMul: 4.0,
      },
    },
    mage: {
      id: 'mage',
      name: 'Mago',
      desc: 'HP baixo, dano em área alto.',
      color: '#84f',
      maxHp: CFG.mage.maxHp,
      attack: CFG.mage.attack,
      defense: CFG.mage.defense,
      atkRange: CFG.mage.atkRange,
      atkSpeed: CFG.mage.atkSpeed,
      atkProjectile: 'bolt',
      sprite: 'mage',
      skill: {
        id: 'arcane',
        name: 'Explosão Arcana',
        desc: 'Explosão em área (raio 9). Dano alto.',
        cooldown: 8000,
        radius: 9,
        damageMul: 4.0,
      },
      skill2: {
        id: 'fireLine',
        name: 'Linha de Fogo',
        desc: 'Lança fogo 5 tiles à frente.',
        cooldown: 10000,
        length: 5,
        widthTiles: 1.4,
        damageMul: 4.0,
      },
    },
    healer: {
      id: 'healer',
      name: 'Curandeiro',
      desc: 'Suporte. Cura aliados em área.',
      color: '#fc4',
      maxHp: CFG.healer.maxHp,
      attack: CFG.healer.attack,
      defense: CFG.healer.defense,
      atkRange: CFG.healer.atkRange,
      atkSpeed: CFG.healer.atkSpeed,
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
      skill2: {
        id: 'stunLock',
        name: 'Paralisia Sagrada',
        desc: 'Stuna 100% o alvo focado por 5 segundos.',
        cooldown: 12000,
        duration: 5000,
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
