# Jogos da Família — Instruções Globais

Este repo é um hub de jogos feitos por duas crianças via vibe coding com Claude Code:
- **Julia, 6 anos** — pasta `julia/`
- **Pedro, 11 anos** — pasta `pedro/`

Os jogos são publicados na Vercel como site estático. Toda a família joga pelo navegador (incluindo a vovó no celular).

## Idioma

Sempre responder em **português brasileiro**. Comentários em código também em português.

## Stack (não mudar sem pedir)

- HTML estático + JavaScript puro no navegador
- **Phaser 3** carregado via CDN: `<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>`
- **Sem build step** (sem Vite, Webpack, npm install, etc.)
- **Sem framework** (sem React, Vue, etc.)
- Para 3D no futuro: Three.js puro via CDN (não usar agora)

## Estrutura de pastas

```
jpgames/
├── index.html          # home (NÃO mexer sem pedir)
├── shared/style.css    # CSS dos hubs (NÃO mexer sem pedir)
├── julia/
│   ├── index.html      # hub da Julia (renderiza games.js)
│   ├── games.js        # lista dos jogos da Julia
│   └── <slug>/         # cada jogo em sua pasta
│       └── index.html
└── pedro/
    ├── index.html      # hub do Pedro
    ├── games.js
    └── <slug>/
        └── index.html
```

## Regra de ouro: ISOLAMENTO POR PASTA

- Quando estiver trabalhando em `julia/`, **NUNCA** mexer em `pedro/` (e vice-versa).
- **NUNCA** alterar `index.html` da raiz nem `shared/style.css` sem o pai pedir explicitamente.
- Cada filho tem seu cantinho — respeitar isso é essencial para evitar conflitos quando os dois estão programando ao mesmo tempo.

## Como criar um novo jogo

1. Criar pasta `<crianca>/<slug>/` (ex: `julia/gatinho-pulador/`).
2. Dentro, criar um `index.html` autocontido com Phaser via CDN.
3. Adicionar entrada em `<crianca>/games.js` no array `window.GAMES` com `slug`, `title`, `emoji`, `color` (opcional `description`).
4. Testar localmente que o jogo abre.
5. Fazer commit (ver abaixo).

## Convenção de commit

- **Commitar sempre que algo funciona.** Cada feature pequena que rodou = um commit.
- Mensagens curtas e descritivas em português: `julia: adiciona pulo do gato`, `pedro: pong com bola mais rápida`.
- **NUNCA** usar `git push --force` sem o pai autorizar.
- Branch padrão: `main`. Não criar branches sem pedir.

## Quando o jogo quebra

Se uma mudança quebrar o jogo:

1. **1ª tentativa**: tentar consertar.
2. **2ª tentativa**: se não consertou, tentar abordagem diferente.
3. **3ª tentativa falhou**: parar e sugerir reverter ao último commit funcional.
   - Mostrar pro usuário: "Não consegui consertar em 3 tentativas. Quer voltar pra versão de antes? Posso rodar `git reset --hard HEAD` (ou `git reset --hard HEAD~1` se for o commit atual que quebrou)."
   - **NUNCA** rodar comandos destrutivos sem confirmação.

## Confirmação antes de ações destrutivas

Sempre pedir confirmação antes de:
- Deletar arquivos ou pastas
- `git reset --hard`, `git clean -fd`, `rm -rf`
- Sobrescrever um jogo existente
- Mudar `games.js` removendo entradas

## Privacidade

- **NUNCA** colocar nome completo, sobrenome, idade exata, escola, foto ou qualquer dado pessoal nos jogos ou commits.
- Apenas primeiros nomes (Julia, Pedro) já constam no repo público — é o limite.
- Se a criança pedir pra colocar foto/nome de amigo, recusar gentilmente e sugerir um avatar/personagem fictício.

## Performance e compatibilidade

- Os jogos rodam no navegador da vovó (celular Android/iPhone). Manter:
  - Tamanho de canvas responsivo (Phaser scale mode `Phaser.Scale.FIT`).
  - Sem dependências pesadas além do Phaser.
  - Controles touch-friendly quando possível (não só teclado).

## Servir localmente

Os jogos rodam no navegador, mas precisam ser servidos via HTTP (`file://` quebra Phaser e `fetch`). Use o Vercel CLI — replica exatamente o ambiente de produção:

```
vercel dev
```

Abre `http://localhost:3000`. Hot reload incluso.

Alternativa sem Vercel CLI: `npx serve` (baixa na hora, sem instalar global).
