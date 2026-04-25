# Jogos da Família

Hub de jogos feitos pelas crianças via vibe coding com Claude Code.

- **Julia** → `julia/`
- **Pedro** → `pedro/`

## Rodar localmente

```bash
vercel dev
```

Abre `http://localhost:3000`. Replica o ambiente de produção (roteamento, trailing slashes, etc.).

Sem Vercel CLI? `npx serve` funciona também.

## Adicionar um jogo novo

1. Criar pasta `julia/<slug>/` ou `pedro/<slug>/` com um `index.html`.
2. Adicionar entrada no `games.js` da pasta correspondente.

## Deploy

Push pra `main` → Vercel publica automaticamente.
