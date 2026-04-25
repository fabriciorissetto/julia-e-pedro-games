# Assets compartilhados

Sprites e sons grátis pra usar em qualquer jogo da Julia ou do Pedro.

**Tudo aqui é CC0** (domínio público, do [Kenney.nl](https://kenney.nl)) — pode usar em qualquer jogo, comercial ou não, sem precisar dar crédito. Mesmo assim, a gente cita o Kenney no `LICENSE.md` por gratidão.

## Atalho visual

Abra **`/shared/assets/preview.html`** no navegador (rodando `vercel dev`, fica em `http://localhost:3000/shared/assets/preview.html`). Mostra todos os sprites em galeria e tem botão de play pra cada som. **Esse é o jeito mais fácil pra Julia escolher** — ela vê e ouve, e fala "quero esse aqui".

## O que tem

### Sprites — Pixel Frog (`sprites/pixelfrog/`)

⭐ **Pixel art animado de altíssima qualidade.** O melhor visual do repo.

| Pasta | O que é | Bom pra |
|---|---|---|
| `pixel-adventure-1/Main Characters/` | 4 personagens (Pink Man, Mask Dude, Ninja Frog, Virtual Guy) com 7 animações cada (idle, run, jump, double jump, fall, hit, wall jump) | Plataforma estilo Celeste/Super Meat Boy |
| `pixel-adventure-1/Enemies/` | 21 inimigos animados (AngryPig, Bat, Bee, Bunny, Chicken, Mushroom, Skull, Slime, Trunk, Turtle, Plant, Radish, Rino, Ghost...) | Inimigos pra jogo de plataforma |
| `pixel-adventure-1/Traps/` | Saw, Spike, Fire, Trampoline, Falling Platform, Spiked Ball, Rock Head, Arrow | Obstáculos e armadilhas |
| `pixel-adventure-1/Items/Fruits/` | Apple, Bananas, Cherries, Kiwi, Melon, Orange, Pineapple, Strawberry, Collected | Coletáveis |
| `pixel-adventure-1/Background/` | 8 backgrounds tileable em cores diferentes | Fundos de fase |
| `pixel-adventure-1/Terrain/` | Tile de chão único com paleta verde/marrom | Plataformas |

### Sprites — Kenney (`sprites/kenney/`)

Estilo "vector flat" — limpo, geométrico, ótimo pra protótipo. Mais minimalista que o Pixel Frog.

| Pasta | O que é | Bom pra |
|---|---|---|
| `tiny-dungeon/` | ⭐ Pixel art 16×16 RPG fofo (heróis, monstros, paredes de dungeon, baús) | RPG top-down minimalista |
| `tiny-town/` | ⭐ Pixel art 16×16 cidade (casas, árvores, NPCs, animais) | Top-down de exploração |
| `toon-characters/` | 4 personagens 3D-cartoon (Female adventurer, Female person, Male adventurer, Male person) com várias poses | Personagens cartoon estilizados |
| `pirate/` | Tema pirata (navios, baús, mapa, papagaio, esqueletos) | Jogo de aventura pirata |
| `roguelike-modern-city/` | Tiles modernos (ruas, prédios, carros, pessoas) | Jogo top-down urbano |
| `platformer-characters/` | Personagens de plataforma (alien em várias cores) | Variantes pra platformer |
| `platformer/Base pack/` | Plataforma clássico — 2 personagens (p1, p2) com animações, tiles de chão, inimigos, itens, HUD | Jogos de pulo estilo Mario |
| `platformer/Candy expansion/`, `Ice expansion/`, `Mushroom expansion/` | Tiles de cenários doce, gelo e cogumelo | Variar fases do platformer |
| `animals/` | 10 bichos (elephant, giraffe, hippo, monkey, panda, parrot, penguin, pig, rabbit, snake) em 8 estilos | Jogos de bicho, mascotes |
| `particles/PNG/` | 200 efeitos: fogo, fumaça, faíscas, estrelas, magia | Explosão, rastro, partícula de moeda |
| `ui/PNG/` | Botões, painéis, ícones, barras de vida — em azul, verde, vermelho, cinza, amarelo | Menus, HUD, telas de game over |
| `1bit/` | Tilesheet 16×16 monocromático (1078 tiles) | Estética retrô minimalista |

### Sons (`sounds/kenney/`)

Todos em `.ogg` (formato leve que toca em qualquer navegador).

| Pasta | O que é | Exemplos de arquivo |
|---|---|---|
| `interface/Audio/` | 100 sons de menu | `click_001.ogg`, `back_001.ogg`, `bong_001.ogg`, `select_001.ogg` |
| `impact/Audio/` | 130 sons físicos | `footstep_carpet_001.ogg`, `impactGlass_heavy_002.ogg`, `impactWood_medium_001.ogg` |
| `digital/Audio/` | 60 sons sci-fi/8-bit | `laser1.ogg`, `phaserUp1.ogg`, `pepSound1.ogg`, `powerUp1.ogg` |
| `rpg/Audio/` | 50 sons foley | `metalPot1.ogg`, `cloth1.ogg`, `bookFlip1.ogg`, `swing.ogg` |

## Como usar no Phaser

Caminho dos jogos (ex: `julia/cobrinha/index.html`) até os assets:

```
../../shared/assets/sprites/pixelfrog/pixel-adventure-1/Main Characters/Ninja Frog/Idle (32x32).png
../../shared/assets/sounds/kenney/interface/Audio/click_001.ogg
```

### Carregar e usar um sprite

```js
function preload() {
  // sprite simples (1 frame)
  this.load.image(
    'frog',
    '../../shared/assets/sprites/pixelfrog/pixel-adventure-1/Main Characters/Ninja Frog/Jump (32x32).png'
  );
}

function create() {
  this.add.image(400, 300, 'frog').setScale(2);
}
```

### Tocar som

```js
function preload() {
  this.load.audio(
    'click',
    '../../shared/assets/sounds/kenney/interface/Audio/click_001.ogg'
  );
}

function create() {
  this.input.on('pointerdown', () => {
    this.sound.play('click');
  });
}
```

### Animação de personagem (Pixel Adventure)

Os sprites do Pixel Frog vêm como **spritesheets horizontais**: ex. `Run (32x32).png` tem todos os frames de 32×32 lado a lado. Phaser carrega isso direto com `load.spritesheet`:

```js
function preload() {
  this.load.spritesheet('frog_run',
    '../../shared/assets/sprites/pixelfrog/pixel-adventure-1/Main Characters/Ninja Frog/Run (32x32).png',
    { frameWidth: 32, frameHeight: 32 }
  );
  this.load.spritesheet('frog_idle',
    '../../shared/assets/sprites/pixelfrog/pixel-adventure-1/Main Characters/Ninja Frog/Idle (32x32).png',
    { frameWidth: 32, frameHeight: 32 }
  );
}

function create() {
  this.anims.create({
    key: 'run',
    frames: this.anims.generateFrameNumbers('frog_run'),
    frameRate: 20, // Pixel Frog recomenda 20 FPS (50ms)
    repeat: -1,
  });
  this.anims.create({
    key: 'idle',
    frames: this.anims.generateFrameNumbers('frog_idle'),
    frameRate: 20,
    repeat: -1,
  });
  this.add.sprite(400, 300, 'frog_idle').setScale(3).play('idle');
}
```

Tamanho dos frames por categoria:
- **Personagens principais**: `32x32`
- **Inimigos**: variável — está no nome do arquivo, ex. `Run (34x28).png`
- **Frutas**: `32x32`
- **Backgrounds**: `64x64` (tileable — usar `tileSprite`)

## Quando precisar de mais assets

1. **Achar mais coisa do Kenney**: https://kenney.nl/assets — tem MUITO mais (carros, espaço, RPG isométrico, comida, dinheiro). Tudo CC0.
2. **Som específico que não tem**: gerar com [jsfxr](https://sfxr.me/) (8-bit retrô, instantâneo) ou baixar de [Pixabay](https://pixabay.com/sound-effects/) ou [Mixkit](https://mixkit.co/free-sound-effects/).
3. **Pixel art mais charmosa**: [itch.io free assets](https://itch.io/game-assets/free) (Pixel Frog, LimeZu) — checar a licença de cada um.

Pra adicionar: baixar, jogar na pasta certa (`sprites/kenney/<novo>/` ou `sounds/<fonte>/<novo>/`) e rodar `./regen-manifest.sh` pra galeria reconhecer.

## Estrutura

```
shared/assets/
├── README.md              ← este arquivo
├── LICENSE.md             ← créditos do Kenney
├── preview.html           ← galeria visual (abrir no browser)
├── manifest.json          ← lista de todos os arquivos (alimenta preview.html)
├── regen-manifest.sh      ← regerar manifest após adicionar/remover assets
├── sprites/kenney/        ← animals, platformer, ui, particles, 1bit
└── sounds/
    ├── kenney/            ← interface, impact, digital, rpg
    ├── sfx/               ← (vazio) pra sons gerados no jsfxr ou avulsos
    └── music/             ← (vazio) pra músicas de fundo
```

