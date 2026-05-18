// Committen renderer
// v0.1.2: 单 ⚙ 按钮 + 弹出菜单(Reset / Open config / Quit)
// v0.2 P1: sprite-pack 抽象 — 等主进程下发 pack 后再注入 CSS 并启动入场动画

(function () {
  const sprite = document.getElementById('catSprite');
  const hungerEl = document.getElementById('catHunger');
  const hungerFill = document.getElementById('hungerFill');
  const hungerNum = document.getElementById('hungerNum');

  const btnMenu = document.getElementById('btnMenu');
  const menuEl = document.getElementById('catMenu');
  const menuReset = document.getElementById('menuReset');
  const menuConfig = document.getElementById('menuConfig');
  const menuQuit = document.getElementById('menuQuit');

  // ============ 状态机(sprite) ============
  const STATES = ['idle', 'walk', 'eat', 'sleep', 'attack'];
  let currentState = 'idle';
  let activePack = null;

  function setState(name) {
    if (!STATES.includes(name)) {
      console.warn('[Committen] unknown state:', name);
      return;
    }
    if (name === currentState) return;
    sprite.classList.remove(`cat-sprite--${currentState}`);
    sprite.classList.add(`cat-sprite--${name}`);
    currentState = name;
    console.log('[Committen] state →', name);
  }

  // ============ Pack 注入 ============
  function injectPackStyles(pack) {
    const { manifest, imageUrls } = pack;
    const { frameSize, displayScale, type, states } = manifest;

    const root = document.documentElement;
    root.style.setProperty('--frame-w', `${frameSize.w}px`);
    root.style.setProperty('--frame-h', `${frameSize.h}px`);
    if (Number.isFinite(displayScale)) {
      root.style.setProperty('--display-scale', String(displayScale));
    }

    if (type !== 'multi-frame') {
      // P2 会接 procedural 渲染。P1 只支持 multi-frame(default-cat 走这条)
      console.warn('[Committen] pack type', type, 'not yet rendered (P2)');
      return;
    }

    const parts = [];
    for (const state of STATES) {
      const s = states[state];
      if (!s) continue;
      const url = imageUrls[state];
      const totalOffsetPx = s.frames * frameSize.w;
      const kfName = `sprite-${state}-${manifest.id}`;
      parts.push(
        `.cat-sprite--${state} {\n` +
        `  background-image: url("${url}");\n` +
        `  animation: ${kfName} ${s.duration} steps(${s.frames}) infinite;\n` +
        `}\n` +
        `@keyframes ${kfName} {\n` +
        `  from { background-position: 0 0; }\n` +
        `  to   { background-position: -${totalOffsetPx}px 0; }\n` +
        `}`
      );
    }

    let styleEl = document.getElementById('cat-pack-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cat-pack-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = parts.join('\n\n');
    console.log(`[Committen] pack loaded: ${manifest.displayName} (${manifest.id})`);
  }

  window.committen.onPack((pack) => {
    activePack = pack;
    injectPackStyles(pack);
    // 注入后再次应用 currentState,确保 background-image 立刻生效
    sprite.classList.add(`cat-sprite--${currentState}`);
    // 入场动画延迟到 pack 就位后再播,避免"空 sprite 弹一下又出图"的瞬闪
    document.body.classList.add('cat--intro');
    setTimeout(() => document.body.classList.remove('cat--intro'), 5000);
  });

  // 主进程通知方向变化(走到边缘要转身)
  // dir = 1 表示向右,-1 表示向左
  // 素材默认朝向是"左",所以向右走 (dir=1) 时要翻转
  window.committen.onDirection((dir) => {
    document.body.classList.toggle('cat-flipped', dir === 1);
  });

  window.committen.onSetState((state) => {
    setState(state);
  });

  // ============ 饱腹感 ============
  let lastHunger = null;

  function levelFor(value) {
    if (value >= 80) return 'full';
    if (value >= 50) return 'normal';
    if (value >= 20) return 'hungry';
    return 'starving';
  }

  function updateHunger(value) {
    if (!Number.isFinite(value)) return;
    const v = Math.max(0, Math.min(100, Math.round(value)));

    document.body.classList.add('cat-hunger-ready');

    if (lastHunger !== null && v !== lastHunger) {
      const delta = v - lastHunger;
      spawnHungerPopup(delta);
    }
    lastHunger = v;

    hungerFill.style.width = `${v}%`;
    hungerNum.textContent = String(v);
    hungerEl.dataset.level = levelFor(v);
  }

  function spawnHungerPopup(delta) {
    if (!delta) return;
    const popup = document.createElement('div');
    popup.className = 'cat-hunger-popup ' + (delta > 0 ? 'is-up' : 'is-down');
    popup.textContent = (delta > 0 ? '+' : '') + delta;
    hungerEl.appendChild(popup);
    setTimeout(() => popup.remove(), 1300);
  }

  window.committen.onHunger((value) => {
    updateHunger(value);
  });

  // ============ 调试入口 ============
  window.committenDebug = {
    setState,
    getState: () => currentState,
    getHunger: () => lastHunger,
    getSTATES: () => STATES.slice(),
  };

  // ============ 首次启动 ============
  // (入场动画移到 onPack 回调里,等 pack 注入后再播)

  // ============ 菜单交互 ============
  function openMenu() {
    menuEl.hidden = false;
  }
  function closeMenu() {
    menuEl.hidden = true;
  }
  function toggleMenu() {
    if (menuEl.hidden) openMenu();
    else closeMenu();
  }

  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // 点菜单外面任意位置 → 关闭菜单
  document.addEventListener('click', (e) => {
    if (menuEl.hidden) return;
    if (menuEl.contains(e.target) || btnMenu.contains(e.target)) return;
    closeMenu();
  });

  // Esc 也关菜单
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menuEl.hidden) closeMenu();
  });

  // 菜单项点击
  menuReset.addEventListener('click', () => {
    window.committen.resetPosition();
    closeMenu();
  });

  menuConfig.addEventListener('click', () => {
    window.committen.openConfig();
    closeMenu();
  });

  menuQuit.addEventListener('click', () => {
    closeMenu();
    if (confirm("Quit Committen? (She'll starve.)")) {
      window.committen.quit();
    }
  });

  console.log('[Committen] renderer ready');
  console.log('[Committen] Debug: window.committenDebug.setState("attack") / .getHunger()');
})();
