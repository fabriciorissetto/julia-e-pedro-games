# Cantinho do Marcelo

Pasta de jogos do **Marcelo**. Antes de tudo, leia o `CLAUDE.md` da raiz para regras gerais (stack, isolamento por pasta, commits/push automáticos, privacidade).

## Perfil

Perfil do Marcelo ainda a definir junto com o pai (idade, se lê/escreve, se entrada é por voz ou texto, calibragem de jogos). **Antes de começar a primeira sessão de código aqui, perguntar ao pai:**

- Quantos anos o Marcelo tem?
- Ele lê e escreve bem? Conversa por voz ou por texto?
- Tem afinidade com videogame? Que tipo de jogo curte?
- Está estudando programação ou não?

Quando souber, atualizar este arquivo seguindo o padrão de `julia/CLAUDE.md` ou `pedro/CLAUDE.md` (escolher o que for mais próximo do perfil dele).

## Estrutura de cada jogo

- `marcelo/<slug>/index.html` — autocontido, Phaser via CDN.
- Atualizar `marcelo/games.js` para o jogo aparecer no hub.

## Exemplo de entrada em games.js

```js
window.GAMES = [
  {
    slug: "exemplo",
    title: "Jogo de Exemplo",
    emoji: "⭐",
    color: "#ff9f45",
    description: "Descrição curta"
  },
];
```
