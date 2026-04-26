# Cantinho da Família

Pasta de jogos colaborativos entre **Pai, Julia (6) e Pedro (11)**. Antes de tudo, leia o `CLAUDE.md` da raiz.

Diferente de `julia/` e `pedro/`, aqui os jogos podem ser mais ambiciosos e usar ferramentas externas (Tiled, etc.) — o pai participa do desenvolvimento ativamente, então não precisa simplificar tudo pra crianças. Mas o resultado final tem que ser jogável pelas duas crianças.

## Stack permitida nesta pasta

- Phaser 3 via CDN (mesmo padrão do resto do repo)
- JS puro, sem build step (mantém a regra do projeto)
- **Tiled** pra desenhar mapas (formato `.tmj` JSON)
- Tileset principal: schwarnhild "Basic Tileset and Asset Pack 32x32 Pixels" (https://schwarnhild.itch.io/basic-tileset-and-asset-pack-32x32-pixels). Tile size **32x32**. Arquivos em `mundinho/assets/tilesets/`.
- Pode usar tilesets do Kenney também (`shared/assets/sprites/kenney/`) se fizer sentido pra outro jogo da família.
- Futuro (não hoje): servidor WebSocket no Mac mini + Cloudflare Tunnel pra multiplayer real-time

## Workflow de mapas com Tiled

1. Abrir o projeto Tiled: `open familia/mundinho/mundinho.tiled-project`
2. Editar um dos `.tmj` na aba aberta
3. **Salvar (Cmd+S)** — Tiled grava direto como JSON, não precisa exportar nada
4. Refresh no navegador → mapa atualizado

**Convenção de nomes de layers no Tiled:**
- `chao`, `chao 2`, `decoracao`, etc — visual normal, sem colisão. Pode criar quantas quiser.
- Nome começando em `colisao` (`colisao`, `colisao_arvores`, etc) — **bloqueia o player**. Pinte aqui troncos, paredes, água.
- Nome começando em `acima` (`acima`, `acima_arvores`, etc) — **desenha por cima do player**. Use pra topo de árvore, telhado, ponte alta — partes "altas" que o player passa por trás (perspectiva top-down). Truque clássico: tronco da árvore vai em `colisao`, copa vai em `acima`. O player anda atrás da copa.

O código renderiza todas as tile layers na ordem que aparecem no painel do Tiled. Layers de cima no painel ficam visualmente acima das de baixo (mas o prefixo `acima` força acima do player também).

## Mapas (múltiplos mundos)

O jogo carrega o mapa pela URL: `?mapa=<nome>`. Default `inicial`. Mapas:

- `inicial.tmj` — mundo principal compartilhado (era o `mundinho.tmj` antigo).
- `mundojulia.tmj` — espaço da Julia pra brincar/desenhar.
- `mundopedro.tmj` — espaço do Pedro pra brincar/desenhar.
- `test-paredes.tmj` — mapa de teste pequeno (20×10) usado pelos testes automatizados.

Pra criar novos mapas em massa (já com tilesets e layers no padrão), rode:

```bash
cd familia/mundinho
python3 scripts/criar_mapas.py
```

Já cria os 3 mapas acima (idempotente — pula os que já existem).

## Adicionar novos tilesets a um mapa

Os `.tmj` referenciam os tilesets internamente — Tiled só mostra na paleta o que tá declarado lá. Quando baixar pack novo e quiser que apareça no Tiled sem precisar clicar "New Tileset" um por um:

```bash
cd familia/mundinho
python3 scripts/add_tilesets.py \
  --map mundojulia \
  assets/tilesets/caves-dungeons/tiles-all-32x32.png \
  assets/tilesets/beach/beach_tiles.png
```

`--map <nome>` é opcional, default é `inicial`. O script calcula `firstgid`, `columns`, `tilecount` sozinho, pula os já existentes, e usa o nome da pasta-pai como prefixo (ex: `caves-dungeons/tiles-all-32x32.png` → `caves_dungeons_tiles_all_32x32`).

Depois de rodar: feche e reabra o `.tmj` no Tiled (ou `File → Reload`) — os novos aparecem na paleta. PNGs cujas dimensões não dividem por 32 são pulados (provável que não sejam tileset 32x32 — adicione manualmente).

## Tiled em outra máquina (Ubuntu, novo Mac)

Os caminhos no `.tmj` e no `.tiled-project` são **relativos** à pasta do mapa. Então:

1. `git pull` no repo
2. `open familia/mundinho/mundinho.tiled-project` (ou `tiled` na CLI)
3. Tiled acha tilesets e mapas sozinho — sem reconfigurar paths.

O arquivo `*.tiled-session` (estado da última sessão, com paths absolutos) está no `.gitignore`, então cada máquina tem o próprio.

## Testes automatizados

Página de testes: `http://localhost:3000/familia/mundinho/tests.html`

Suítes que rodam:
- **Smoke**: cada `.tmj` carrega e tem layers válidas
- **Convenção de layers**: `chao` e `colisao*` existem
- **Spritesheet do player**: análise pixel-a-pixel do `player_walk.png` valida que linha 0=down, 1=left, 2=up, 3=right (regressão do bug "andar pra direita = costas")
- **Constantes calibradas**: regex no `index.html` confere `LINHA_DIRECAO` e valores do hitbox
- **Colisão in-game**: sobe Phaser headless com `test-paredes.tmj` e empurra o player contra a parede

Quando achar bug novo, adicionar caso novo no `tests.html` antes de consertar — TDD.

## Jogos atuais

- `mundinho/` — primeiro mundo. Mapa do Tiled + player com WASD. Base pro MMORPG.
