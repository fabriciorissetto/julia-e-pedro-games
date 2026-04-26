// ═══════════════════════════════════════════════════════════════════════════
// 🎨  ATLAS DE SPRITES KENNEY — mapeamento de nome → posição na tilemap
// ═══════════════════════════════════════════════════════════════════════════
//
// Pra cada nome de sprite que o jogo conhece (warrior, slime, etc), aqui está
// a coordenada (col, row) dentro do tilemap PNG do Kenney.
//
// Cada tilemap tem 12 colunas × 11 linhas, tiles de 16×16 pixels.
// Renderizamos 2× (32×32 px) pra combinar com o TILE = 32 do mundo.
//
// Tilemaps disponíveis: 'dungeon' (Tiny Dungeon), 'town' (Tiny Town).
// ═══════════════════════════════════════════════════════════════════════════

(function () {

  // helpers pra calcular linha/coluna a partir do índice linear (12 colunas)
  function td(idx) { return { sheet: 'dungeon', col: idx % 12, row: Math.floor(idx / 12), w: 32, h: 32 }; }
  function tt(idx) { return { sheet: 'town',    col: idx % 12, row: Math.floor(idx / 12), w: 32, h: 32 }; }

  const ATLAS = {
    // ─── Personagens (Tiny Dungeon) ────────────────────────────────────────
    warrior:  td(96),    // knight de armadura cinza
    archer:   td(85),    // arqueiro marrom
    mage:     td(84),    // mago roxo de chapéu pontudo
    healer:   td(100),   // monk encapuzado branco/preto

    // ─── Mobs (Tiny Dungeon — improvisando substitutos) ────────────────────
    slime:    td(122),   // aranha (faz papel de slime)
    wolf:     td(120),   // morcego
    skeleton: td(123),   // caveira pequena
    golem:    td(87),    // knight cinza armadurão (fica como golem)
    dragon:   td(110),   // imp vermelho (demônio)

    // ─── Itens ─────────────────────────────────────────────────────────────
    item_sword:           td(104),   // espada cinza
    item_sword_advanced:  td(103),   // espada vermelha
    item_bow:             td(106),   // arco
    item_staff:           td(117),   // martelo (substituto pra cajado)
    item_potion:          td(115),   // poção vermelha
    item_armor:           td(118),   // machado (substituto pra armadura)
    item_armor_advanced:  td(91),    // baú azul (substituto)
    item_wood:            td(89),    // baú fechado
    item_stone:           td(101),   // pedra cinza
    item_iron:            td(102),   // pedra escura

    // ─── Tiles do mundo (Tiny Town) ────────────────────────────────────────
    tile_grass:         tt(0),    // grama lisa verde
    tile_grass2:        tt(1),    // grama com tufos
    tile_dirt:          tt(36),   // terra (precisa testar)
    tile_sand:          tt(2),    // grama com flores (placeholder até testar)
    tile_water:         tt(13),   // água (precisa testar)
    tile_mountain:      tt(24),   // pedra (precisa testar)
    tile_forest_floor:  tt(0),    // só grama mesmo
    tile_path:          tt(36),   // caminho de terra
  };

  window.GTA = window.GTA || {};
  window.GTA.Atlas = ATLAS;

})();
