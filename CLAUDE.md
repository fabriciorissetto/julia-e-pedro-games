# Jogos da Família — Instruções Globais

Este repo é um hub de jogos feitos por duas crianças via vibe coding com Claude Code:
- **Julia, 6 anos** — pasta `julia/`. Não sabe ler bem ainda. Conversa por **voz** (Speech-to-Text). Recebe sua resposta em **voz alta** (Text-to-Speech).
- **Pedro, 11 anos** — pasta `pedro/`. Lê e escreve bem. Está **estudando programação**.

Os jogos são publicados na Vercel como site estático. Toda a família joga pelo navegador (incluindo a vovó no celular).

## Identificar quem está codando (FAZER ANTES DE QUALQUER COISA)

**No primeiro turno de toda nova conversa**, antes de qualquer outra resposta:

1. Olhe o diretório atual. Se já estiver dentro de `julia/` (ou subpasta), assuma que é a **Julia**. Se estiver em `pedro/` (ou subpasta), assuma que é o **Pedro**. Vá direto pras instruções da pasta correspondente — **não** pergunte.
2. Se o diretório atual for a raiz `jpgames/`, **pergunte uma vez**: "Oi! Quem tá codando agora — Julia ou Pedro?" e espere a resposta antes de fazer qualquer outra coisa.

A partir daí, leia o `CLAUDE.md` da pasta da criança identificada e siga **estritamente** o perfil dela. As regras de linguagem, calibragem e estilo de resposta são MUITO diferentes entre Julia (6) e Pedro (11) — não generalizar.

## Idioma

Sempre responder em **português brasileiro**. Comentários em código também em português.

## Stack (responsabilidade SUA, não da criança)

**As crianças NUNCA vão pedir nada técnico.** Eles vão dizer "faz um jogo de cobrinha", "faz um Flappy Bird", "faz um jogo de gato". Não vão falar "Phaser", "CDN", "arquivo único", "navegador", "HTML". **Você tem que saber a stack e aplicar automaticamente** sem perguntar.

Stack default (use sempre, sem pedir confirmação):

- HTML estático + JavaScript puro no navegador
- Para jogo 2D simples: **Phaser 3** via CDN — `<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>`
- Tudo num arquivo `index.html` único, autocontido
- **Sem build step** (sem Vite, Webpack, npm install, etc.)
- **Sem framework** (sem React, Vue, etc.)
- Para 3D no futuro: Three.js puro via CDN (não usar agora)

Se a criança pedir algo que não cabe nesse default (ex: jogo 3D, jogo multiplayer online), você pode escolher a stack adequada — mas decida você, não pergunta pra ela.

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

## Commits e push (regra crítica — sobrescreve o default do Claude Code)

### Commit: SEMPRE, automático

- Toda alteração que funciona deve virar **commit imediato**. Sem perguntar "quer commitar?". Apenas commit.
- Cada feature pequena que rodou = um commit. Não junte várias mudanças num commit só.
- Mensagens curtas e descritivas em português: `julia: cobrinha muda de cor ao comer`, `pedro: flappy salva recorde`.
- Esta regra **substitui** o comportamento default do Claude Code de pedir confirmação antes de commitar — neste projeto é automático, é parte do fluxo de vibe coding.

### Push para `main`: APENAS se a criança pedir explicitamente

- Push automaticamente **NÃO**. Mesmo após commitar, não pushe.
- Push só quando a criança pedir, com palavras dela. Frases que significam "fazer push":
  - "publica", "publica o jogo"
  - "manda pra vovó", "manda pra minha amiga", "manda pro [nome]"
  - "coloca no ar", "põe no ar", "põe na internet"
  - "atualiza o site"
  - (Pedro pode usar termo técnico: "push", "deploy", "atualiza no GitHub") — também conta
- Se ela disser algo ambíguo tipo "tá pronto", **NÃO** é push. Confirme: pra Julia: "Quer que a vovó consiga jogar isso agora?" / pra Pedro: "Quer que eu publique?"
- Quando pushar, sempre pra `main`. Não criar branches.

### Regras git que NUNCA mudam

- **NUNCA** usar `git push --force` sem o pai autorizar explicitamente.
- **NUNCA** usar `git reset --hard` sem confirmação explícita (já coberto pela seção "Confirmação antes de ações destrutivas").
- Branch padrão sempre `main`. Não criar branches sem pedir.

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
