# Assets compartilhados

Sprites e sons grátis pra usar em qualquer jogo da Julia ou do Pedro.

**Tudo aqui é CC0** (domínio público, do [Kenney.nl](https://kenney.nl)) — pode usar em qualquer jogo, comercial ou não, sem precisar dar crédito. Mesmo assim, a gente cita o Kenney no `LICENSE.md` por gratidão.

## Atalho visual

Abra **`/shared/assets/preview.html`** no navegador (rodando `vercel dev`, fica em `http://localhost:3000/shared/assets/preview.html`). Mostra todos os sprites em galeria e tem botão de play pra cada som. **Esse é o jeito mais fácil pra Julia escolher** — ela vê e ouve, e fala "quero esse aqui".

## O que tem

### Sprites (`sprites/kenney/`)

| Pasta | O que é | Bom pra |
|---|---|---|
| `animals/` | 10 bichos (elephant, giraffe, hippo, monkey, panda, parrot, penguin, pig, rabbit, snake) em 8 estilos (round/square × com/sem detalhe × com/sem outline) | Jogos de bicho, mascotes, personagens |
| `platformer/Base pack/` | Plataforma clássico — 2 personagens (p1, p2) com animações, tiles de chão, inimigos, itens, HUD | Jogos de pulo estilo Mario |
| `platformer/Candy expansion/`, `Ice expansion/`, `Mushroom expansion/` | Tiles de cenários doce, gelo e cogumelo | Variar fases do platformer |
| `particles/PNG/` | 200 efeitos: fogo, fumaça, faíscas, círculos, estrelas, magia | Explosão, rastro, partícula de moeda, mágica |
| `ui/PNG/` | Botões, painéis, ícones, barras de vida — em azul, verde, vermelho, cinza | Menus, HUD, telas de game over |
| `1bit/` | Tilesheet 16×16 monocromático (1078 tiles: dungeon, RPG, urbano, fantasia) | Estética retrô minimalista |

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
../../shared/assets/sprites/kenney/animals/PNG/Round/elephant.png
../../shared/assets/sounds/kenney/interface/Audio/click_001.ogg
```

### Carregar e usar um sprite

```js
function preload() {
  this.load.image(
    'elephant',
    '../../shared/assets/sprites/kenney/animals/PNG/Round/elephant.png'
  );
}

function create() {
  this.add.image(400, 300, 'elephant');
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

### Animação de personagem (platformer base pack)

A pasta `platformer/Base pack/Player/p1_walk/` já vem com 11 frames de caminhada (`PNG/p1_walk01.png` ... `p1_walk11.png`). Pra usar:

```js
function preload() {
  for (let i = 1; i <= 11; i++) {
    const n = String(i).padStart(2, '0');
    this.load.image(`p1_walk_${n}`, `../../shared/assets/sprites/kenney/platformer/Base pack/Player/p1_walk/PNG/p1_walk${n}.png`);
  }
}

function create() {
  this.anims.create({
    key: 'walk',
    frames: Array.from({length: 11}, (_, i) => ({ key: `p1_walk_${String(i+1).padStart(2,'0')}` })),
    frameRate: 12,
    repeat: -1,
  });
  this.add.sprite(400, 300, 'p1_walk_01').play('walk');
}
```

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

