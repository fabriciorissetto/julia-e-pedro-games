// ═══════════════════════════════════════════════════════════════════════════
// 🎮  CONFIGURAÇÕES DO JOGO  —  MEXA AQUI PRA AJUSTAR STATS!
// ═══════════════════════════════════════════════════════════════════════════
//
// Esse é o arquivo pra você (Pedro) editar quando quiser mudar:
//   • vida, ataque, defesa das 4 classes (guerreiro, arqueiro, mago, curandeiro)
//   • vida, ataque, defesa, XP dos monstros (slime, lobo, golem, esqueleto, dragão)
//
// ⚠️  IMPORTANTE: Tem um arquivo igual no servidor: party/config.ts
//     Quando você mudar valores aqui, mude OS MESMOS valores lá também!
//     (Senão o servidor não fica sabendo da mudança.)
//
// COMO MEXER: troque só o número depois do `:`. Não apague vírgulas!
//
// Exemplos:
//   maxHp: 140,       ← isso é o HP máximo. Suba pra 200 pra ficar mais resistente.
//   attack: 14,       ← dano por ataque. Quanto maior, mais machuca.
//   defense: 10,      ← defesa. Reduz dano recebido. (defesa 100 = quase invencível)
//   xpReward: 100,    ← XP que o mob dá quando morre.
// ═══════════════════════════════════════════════════════════════════════════

(function () {

  // ────────────────────────────────────────────────────────────────────────
  //   ⚔️  CLASSES DOS JOGADORES
  // ────────────────────────────────────────────────────────────────────────

  const CLASSES = {

    warrior: {
      // Guerreiro: tank de melee. Forte e duro de matar.
      maxHp:    140,    // HP máximo
      attack:   14,     // dano base
      defense:  10,     // defesa
      atkRange: 1.6,    // alcance do ataque (em "quadradinhos" — 1 quadrado = 1 tile)
      atkSpeed: 750,    // tempo entre ataques (ms — quanto MENOR, mais rápido)
    },

    archer: {
      // Arqueiro: alcance enorme, atira a tela inteira.
      maxHp:    90,
      attack:   12,
      defense:  6,
      atkRange: 20,     // 20 tiles = praticamente a tela inteira
      atkSpeed: 700,
    },

    mage: {
      // Mago: HP baixo, dano grande em área (skill 1 explode em volta).
      maxHp:    70,
      attack:   10,
      defense:  3,
      atkRange: 5,
      atkSpeed: 900,
    },

    healer: {
      // Curandeiro: suporte. Cura aliados.
      maxHp:    95,
      attack:   7,
      defense:  5,
      atkRange: 4,
      atkSpeed: 850,
    },
  };

  // ────────────────────────────────────────────────────────────────────────
  //   👹  MONSTROS (mobs)
  // ────────────────────────────────────────────────────────────────────────
  //
  // xpReward = quantos XP o jogador ganha quando MATA o mob.
  // speed = velocidade que o mob anda (px/segundo). 60 é devagarzinho, 120 é correndo.
  // attackRange / sightRange em quadradinhos (tiles).

  const MOBS = {

    slime: {
      // Slime: o mais fraco. Aparece na safe zone e no meio.
      maxHp:        30,
      attack:       6,
      defense:      0,
      speed:        60,
      attackRange:  1.0,
      sightRange:   5,    // distância pra ele ver e perseguir o jogador
      attackCdMs:   1500, // ms entre ataques
      xpReward:     100,
    },

    wolf: {
      // Lobo: rápido e morde forte.
      maxHp:        55,
      attack:       11,
      defense:      2,
      speed:        120,
      attackRange:  1.0,
      sightRange:   7,
      attackCdMs:   900,
      xpReward:     250,
    },

    golem: {
      // Golem de pedra: muito vida, lento, dano alto.
      maxHp:        180,
      attack:       18,
      defense:      8,
      speed:        35,
      attackRange:  1.2,
      sightRange:   5,
      attackCdMs:   1800,
      xpReward:     800,
    },

    skeleton: {
      // Esqueleto: dano altíssimo, tem que tomar cuidado!
      maxHp:        90,
      attack:       24,
      defense:      4,
      speed:        90,
      attackRange:  1.2,
      sightRange:   8,
      attackCdMs:   1100,
      xpReward:     900,
    },

    dragon: {
      // Dragão: chefe da zona de perigo. Cuidado!
      maxHp:        300,
      attack:       360,  // 15x mais que o esqueleto
      defense:      12,
      speed:        70,
      attackRange:  1.5,
      sightRange:   9,
      attackCdMs:   1300,
      xpReward:     5000, // dá MUITO XP
    },
  };

  // ────────────────────────────────────────────────────────────────────────
  //   📜  EXPONDO PRO RESTO DO JOGO  —  não precisa mexer nessa parte
  // ────────────────────────────────────────────────────────────────────────

  window.GTA = window.GTA || {};
  window.GTA.Config = { CLASSES, MOBS };

})();
