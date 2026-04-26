// Captura input do teclado e mouse, atualiza GTA.state.input.
// Não decide nada de gameplay — só preenche o estado.
(function () {
  const S = window.GTA.state;
  const TILE = window.GTA.TILE;

  let canvas = null;

  function init(canvasEl) {
    canvas = canvasEl;

    window.addEventListener('keydown', (e) => {
      if (S.screen !== 'play') return;
      // bloqueia scroll de espaço/setas
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      S.input.keys.add(e.code);

      // toggles
      if (e.code === 'KeyI' || e.code === 'KeyB') {
        S.ui.inventoryOpen = !S.ui.inventoryOpen;
      }
      if (e.code === 'KeyC') {
        S.ui.craftingOpen = !S.ui.craftingOpen;
      }
      if (e.code === 'KeyH' || e.code === 'F1') {
        S.ui.help = !S.ui.help;
      }
      if (e.code === 'Escape') {
        S.ui.inventoryOpen = false;
        S.ui.craftingOpen = false;
        S.ui.help = false;
      }
      if (e.code === 'Backquote') {
        S.debug.enabled = !S.debug.enabled;
      }
      // skill
      if (e.code === 'Space' || e.code === 'Digit1') {
        if (window.GTA.Combat) window.GTA.Combat.castSkill();
      }
    });

    window.addEventListener('keyup', (e) => {
      S.input.keys.delete(e.code);
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      S.input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      S.input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
      // converter pra mundo
      S.input.mouseWorldX = S.input.mouseX + S.camera.x;
      S.input.mouseWorldY = S.input.mouseY + S.camera.y;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (S.screen !== 'play') return;
      S.input.mouseDown = true;
      S.input.clicked = true;

      // primeiro: UI consome clique?
      if (window.GTA.UI && window.GTA.UI.handleClick(S.input.mouseX, S.input.mouseY, e.button)) {
        return;
      }

      // senão: clique no mundo — tenta selecionar mob ou coletar recurso
      if (e.button === 0) {
        if (window.GTA.Combat) {
          window.GTA.Combat.handleWorldClick(S.input.mouseWorldX, S.input.mouseWorldY);
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      S.input.mouseDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function update() {
    // movimento — desabilita se UI principal aberta? Vamos permitir, pra não travar.
    const k = S.input.keys;
    let dx = 0, dy = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    S.input.moveX = dx;
    S.input.moveY = dy;
  }

  function clearFrame() {
    S.input.clicked = false;
  }

  window.GTA = window.GTA || {};
  window.GTA.Input = { init, update, clearFrame };
})();
