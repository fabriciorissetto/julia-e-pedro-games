// ═══════════════════════════════════════════════════════════════════════════
// 🎨  ATLAS DE SPRITES KENNEY — mapeamento de nome → posição na tilemap
// ═══════════════════════════════════════════════════════════════════════════
//
// Pra cada nome de sprite que o jogo conhece (warrior, slime, etc), aqui está
// a coordenada (col, row) dentro do tilemap PNG do Kenney.
//
// Cada tilemap tem 12 colunas × 11 linhas, tiles de 16×16 pixels.
// Renderizamos em cima do TILE = 32 do mundo, com escala via opts.scale.
//
// Tilemaps disponíveis: 'dungeon' (Tiny Dungeon), 'town' (Tiny Town).
//
// Pra inspecionar índice → sprite, abrir /atlas-debug.html no navegador.
// ═══════════════════════════════════════════════════════════════════════════

(function () {

  // helpers pra calcular linha/coluna a partir do índice linear (12 colunas)
  function td(idx) { return { sheet: 'dungeon', col: idx % 12, row: Math.floor(idx / 12), w: 32, h: 32 }; }
  function tt(idx) { return { sheet: 'town',    col: idx % 12, row: Math.floor(idx / 12), w: 32, h: 32 }; }

  const ATLAS = {
    // ─── Personagens (Tiny Dungeon) ────────────────────────────────────────
    warrior:  td(96),    // knight cinza com armadura
    archer:   td(99),    // arqueiro com arco em pose
    mage:     td(84),    // mago roxo com chapéu pontudo
    healer:   td(100),   // paladino dourado / cleric

    // ─── Mobs (Tiny Dungeon) ───────────────────────────────────────────────
    slime:    td(108),   // slime verde clássico
    wolf:     td(109),   // goblin laranja (substituto pra lobo)
    skeleton: td(113),   // esqueleto branco
    golem:    td(112),   // orc grande verde-acastanhado
    dragon:   td(110),   // demônio vermelho

    // ─── Itens ─────────────────────────────────────────────────────────────
    item_sword:           td(104),   // espada cinza
    item_sword_advanced:  td(103),   // espada vermelha
    item_bow:             td(106),   // arco
    item_staff:           td(105),   // martelo (substituto)
    item_potion:          td(115),   // poção vermelha
    item_armor:           td(107),   // escudo
    item_armor_advanced:  td(118),   // escudo dourado
    item_wood:            td(83),    // barril (substituto pra wood)
    item_stone:           td(101),   // saco/pedra
    item_iron:            td(102),   // pergaminho (substituto)

    // ─── Tiles do mundo (Tiny Town) ────────────────────────────────────────
    tile_grass:         tt(0),    // grama verde lisa
    tile_grass2:        tt(1),    // grama com tuft
    tile_dirt:          tt(24),   // terra batida
    tile_sand:          tt(36),   // terra clara
    tile_water:         tt(13),   // azul (provisório)
    tile_mountain:      tt(67),   // pedra cinza
    tile_forest_floor:  tt(0),    // grama
    tile_path:          tt(36),   // caminho de terra
  };

  window.GTA = window.GTA || {};
  window.GTA.Atlas = ATLAS;

})();
