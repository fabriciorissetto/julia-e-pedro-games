// Bootstrap do jogo: tela de criação → mundo, game loop, FPS counter.
(function () {
  const S = window.GTA.state;

  let canvas, ctx;
  let lastT = 0;
  let frames = 0;
  let fpsLastT = 0;

  function startGame(nickname, cls) {
    S.player.nickname = nickname;
    window.GTA.Classes.apply(S.player, cls);

    // gerar mundo
    window.GTA.World.generate(S.world.seed);
    // posicionar player no centro de área caminhável
    const cx = window.GTA.WORLD_W / 2 * window.GTA.TILE + window.GTA.TILE / 2;
    const cy = window.GTA.WORLD_H / 2 * window.GTA.TILE + window.GTA.TILE / 2;
    S.player.x = cx;
    S.player.y = cy;

    window.GTA.Sprites.init();
    window.GTA.Render.init(canvas);
    window.GTA.UI.init();
    // Net antes de Combat: define se vai online (server controla mobs) ou local
    window.GTA.Net.init();
    window.GTA.Combat.init();

    // inventário inicial: dá uns recursos pra craftar logo
    addStarter(S);

    document.getElementById('menu').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    S.screen = 'play';

    if (!lastT) {
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function addStarter(S) {
    // 3 wood + 2 stone pra começar (faz craftar logo)
    addItem(S, 'wood', 3);
    addItem(S, 'stone', 2);
  }

  function addItem(S, item, qty) {
    // tenta empilhar
    for (let i = 0; i < S.inventory.length; i++) {
      if (S.inventory[i] && S.inventory[i].item === item) {
        S.inventory[i].qty += qty;
        return true;
      }
    }
    // novo slot
    for (let i = 0; i < S.inventory.length; i++) {
      if (!S.inventory[i]) {
        S.inventory[i] = { item, qty };
        return true;
      }
    }
    return false;
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); // cap dt
    lastT = t;
    S.now = t;
    S.dt = dt;
    S.frame++;

    // FPS contador
    frames++;
    if (t - fpsLastT > 500) {
      S.fps = Math.round(frames * 1000 / (t - fpsLastT));
      S.debug.fps = S.fps;
      frames = 0;
      fpsLastT = t;
    }

    // update
    window.GTA.Input.update();
    window.GTA.Player.update(dt);
    window.GTA.Combat.update(dt);
    window.GTA.Net.update(dt);
    window.GTA.UI.update(dt);

    // render
    window.GTA.Render.draw(S);

    window.GTA.Input.clearFrame();
    requestAnimationFrame(loop);
  }

  // ----- tela de criação -----
  function setupMenu() {
    const grid = document.getElementById('classGrid');
    const list = window.GTA.Classes.list();
    let chosen = 'warrior';

    list.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card' + (cls.id === chosen ? ' selected' : '');
      card.dataset.cls = cls.id;
      card.style.borderColor = cls.color;

      // sprite preview canvas
      const previewC = document.createElement('canvas');
      previewC.width = 64; previewC.height = 64;
      previewC.style.imageRendering = 'pixelated';
      previewC.className = 'class-preview';

      card.innerHTML = `
        <div class="class-color" style="background:${cls.color}"></div>
        <h3>${cls.name}</h3>
        <p class="class-desc">${cls.desc}</p>
        <div class="class-stats">
          <span>HP ${cls.maxHp}</span>
          <span>ATK ${cls.attack}</span>
          <span>DEF ${cls.defense}</span>
          <span>RNG ${cls.atkRange}</span>
        </div>
        <div class="class-skill">
          <strong>${cls.skill.name}</strong>
          <em>${cls.skill.desc}</em>
        </div>
      `;
      card.prepend(previewC);

      card.addEventListener('click', () => {
        document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        chosen = cls.id;
        if (window.GTA.Audio) window.GTA.Audio.play('click');
      });
      card.addEventListener('mouseenter', () => {
        if (window.GTA.Audio) window.GTA.Audio.play('hover');
      });

      grid.appendChild(card);
    });

    // Renderiza previews depois que sprites carregar
    function renderPreviews() {
      if (!window.GTA.Sprites || !window.GTA.Sprites.draw) {
        setTimeout(renderPreviews, 50);
        return;
      }
      window.GTA.Sprites.init();
      document.querySelectorAll('.class-card').forEach(card => {
        const cls = card.dataset.cls;
        const cv = card.querySelector('canvas.class-preview');
        if (cv) {
          const cx = cv.getContext('2d');
          cx.imageSmoothingEnabled = false;
          cx.clearRect(0, 0, 64, 64);
          // desenha o personagem 2x escalado
          cx.save();
          cx.scale(2, 2);
          window.GTA.Sprites.draw(cx, cls, 0, 0, 0, { dir: 'down' });
          cx.restore();
        }
      });
    }
    renderPreviews();

    document.getElementById('confirmBtn').addEventListener('click', () => {
      const nickEl = document.getElementById('nickInput');
      let nick = nickEl.value.trim();
      if (nick.length < 3 || nick.length > 16) {
        nickEl.classList.add('err');
        nickEl.focus();
        setTimeout(() => nickEl.classList.remove('err'), 1500);
        return;
      }
      if (window.GTA.Audio) {
        window.GTA.Audio.unlock();
        window.GTA.Audio.play('levelUp'); // som triunfal de início
        window.GTA.Audio.startMusic();    // garante música tocando (já chamado no init)
      }
      startGame(nick, chosen);
    });

    // enter no input
    document.getElementById('nickInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('confirmBtn').click();
    });
  }

  function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    window.GTA.Input.init(canvas);
    setupMenu();
    // foca o input
    document.getElementById('nickInput').focus();
    // música de fundo já no menu (browser pode bloquear até 1º gesto;
    // startMusic() retenta automaticamente em qualquer interação)
    if (window.GTA.Audio) window.GTA.Audio.startMusic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
