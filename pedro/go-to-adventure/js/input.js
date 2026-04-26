// Captura input do teclado e mouse, atualiza GTA.state.input.
// Não decide nada de gameplay — só preenche o estado.
(function () {
  const S = window.GTA.state;
  const TILE = window.GTA.TILE;

  let canvas = null;

  function init(canvasEl) {
    canvas = canvasEl;
    setupChatInput();

    window.addEventListener('keydown', (e) => {
      if (S.screen !== 'play') return;
      // chat aberto: deixa o input HTML processar; só Esc volta pro jogo
      if (S.chat && S.chat.open) {
        if (e.code === 'Escape') closeChat(false);
        return;
      }
      // bloqueia scroll de espaço/setas
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      // Enter abre chat (não captura no input geral)
      if (e.code === 'Enter') {
        e.preventDefault();
        openChat();
        return;
      }
      S.input.keys.add(e.code);
      // ignora auto-repeat pra toggles/skill — só age na 1ª pressão
      if (e.repeat) return;

      // toggles
      if (e.code === 'KeyI' || e.code === 'KeyB') {
        S.ui.inventoryOpen = !S.ui.inventoryOpen;
        if (window.GTA.Audio) window.GTA.Audio.play(S.ui.inventoryOpen ? 'openPanel' : 'closePanel');
      }
      if (e.code === 'KeyC') {
        S.ui.craftingOpen = !S.ui.craftingOpen;
        if (window.GTA.Audio) window.GTA.Audio.play(S.ui.craftingOpen ? 'openPanel' : 'closePanel');
      }
      if (e.code === 'KeyH' || e.code === 'F1') {
        S.ui.help = !S.ui.help;
        if (window.GTA.Audio) window.GTA.Audio.play(S.ui.help ? 'openPanel' : 'closePanel');
      }
      if (e.code === 'Escape') {
        const wasOpen = S.ui.inventoryOpen || S.ui.craftingOpen || S.ui.help;
        S.ui.inventoryOpen = false;
        S.ui.craftingOpen = false;
        S.ui.help = false;
        if (wasOpen && window.GTA.Audio) window.GTA.Audio.play('closePanel');
      }
      if (e.code === 'Backquote') {
        S.debug.enabled = !S.debug.enabled;
      }
      // ataque básico (espaço): auto-targeta mob mais perto se nada selecionado
      if (e.code === 'Space') {
        if (window.GTA.Combat) window.GTA.Combat.basicAttack();
      }
      // habilidade da classe
      if (e.code === 'Digit1') {
        if (window.GTA.Combat) window.GTA.Combat.castSkill();
      }
      if (e.code === 'Digit2') {
        if (window.GTA.Combat) window.GTA.Combat.castSkill2();
      }
      // meteoro fogo+gelo do pedro (cd 0)
      if (e.code === 'KeyZ') {
        if (window.GTA.Combat && window.GTA.Combat.pedroMeteor) {
          window.GTA.Combat.pedroMeteor();
        }
      }
      // tecla 5: pedro ganha +100 levels
      if (e.code === 'Digit5') {
        if (window.GTA.Combat && window.GTA.Combat.pedroLevelUp) {
          window.GTA.Combat.pedroLevelUp(100);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      S.input.keys.delete(e.code);
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      S.input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      S.input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
      // converter pra mundo (compensando zoom da câmera)
      const z = (S.camera && S.camera.zoom) || 1;
      S.input.mouseWorldX = S.camera.x + S.input.mouseX / z;
      S.input.mouseWorldY = S.camera.y + S.input.mouseY / z;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (S.screen !== 'play') return;
      S.input.mouseDown = true;
      S.input.clicked = true;
      if (window.GTA.Audio) window.GTA.Audio.play('click');

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
    // chat aberto: zera movimento
    if (S.chat && S.chat.open) { S.input.moveX = 0; S.input.moveY = 0; return; }
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

  function setupChatInput() {
    const box = document.getElementById('chatBox');
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if (!input || !box) return;
    let lastHistoryLen = 0;

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        const txt = input.value.trim();
        if (txt && window.GTA.Net) window.GTA.Net.sendChat(txt);
        closeChat(false);
      } else if (e.code === 'Escape') {
        closeChat(false);
      }
    });

    // re-render historico do chat quando muda
    setInterval(() => {
      const list = (S.chat && S.chat.history) || [];
      if (list.length === lastHistoryLen) return;
      lastHistoryLen = list.length;
      // mostra só os 8 últimos
      const recent = list.slice(-8);
      history.innerHTML = '';
      // ordem reversa pq column-reverse no CSS
      for (let i = recent.length - 1; i >= 0; i--) {
        const m = recent[i];
        const div = document.createElement('div');
        div.className = 'chat-line';
        const safe = (s) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
        div.innerHTML = `<span class="nick">${safe(m.nick)}:</span>${safe(m.text)}`;
        history.appendChild(div);
      }
    }, 200);
  }

  function openChat() {
    if (!S.chat) S.chat = { open: false, text: '', history: [], bubbles: new Map() };
    S.chat.open = true;
    const box = document.getElementById('chatBox');
    const input = document.getElementById('chatInput');
    if (box) box.classList.add('open');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 10); }
    // libera teclas presas (pra player não continuar andando)
    S.input.keys.clear();
  }

  function closeChat(_send) {
    if (S.chat) S.chat.open = false;
    const box = document.getElementById('chatBox');
    const input = document.getElementById('chatInput');
    if (box) box.classList.remove('open');
    if (input) { input.blur(); input.value = ''; }
  }

  function clearFrame() {
    S.input.clicked = false;
  }

  window.GTA = window.GTA || {};
  window.GTA.Input = { init, update, clearFrame };
})();
