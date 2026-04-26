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

1. Abrir o projeto Tiled: `open familia/mundinho/maps/mundinho.tiled-project`
2. Editar o `.tmj` na aba aberta
3. **Salvar (Cmd+S)** — Tiled grava direto como JSON, não precisa exportar nada
4. Refresh no navegador → mapa atualizado

**Convenção de nomes de layers no Tiled:**
- `chao`, `chao 2`, `decoracao`, etc — visual normal, sem colisão. Pode criar quantas quiser.
- Nome começando em `colisao` (`colisao`, `colisao_arvores`, etc) — **bloqueia o player**. Pinte aqui troncos, paredes, água.
- Nome começando em `acima` (`acima`, `acima_arvores`, etc) — **desenha por cima do player**. Use pra topo de árvore, telhado, ponte alta — partes "altas" que o player passa por trás (perspectiva top-down). Truque clássico: tronco da árvore vai em `colisao`, copa vai em `acima`. O player anda atrás da copa.

O código renderiza todas as tile layers na ordem que aparecem no painel do Tiled. Layers de cima no painel ficam visualmente acima das de baixo (mas o prefixo `acima` força acima do player também).

## Jogos atuais

- `mundinho/` — primeiro mundo. Mapa do Tiled + player com WASD. Base pro MMORPG.
