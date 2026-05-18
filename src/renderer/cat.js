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
  const menuHatch = document.getElementById('menuHatch');
  const menuPets = document.getElementById('menuPets');
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
    // v0.2.1:把当前状态写到 body[data-cat-state] 上,供 .cat-shadow 这种
    // 非 sprite 子节点的 selector 用(sprite 的兄弟选择器够不到)
    document.body.dataset.catState = name;
    currentState = name;
    console.log('[Committen] state →', name);

    // 进入 eat / attack 时触发对应的 fx 元素(每次进入只弹一次)
    if (name === 'eat') spawnFoodPopup();
    else if (name === 'attack') spawnAttackFx();
  }

  // v0.2.1:食物 emoji popup — 每次进 eat 弹一个,1.4s 后自清理
  const FOOD_EMOJIS = ['🍣', '🍪', '🥩', '🍰', '🍤', '🐟', '🧀', '🍙', '🥟', '🍡'];
  function spawnFoodPopup() {
    const wrapper = sprite?.closest('.cat-sprite-wrapper');
    if (!wrapper) return;
    const popup = document.createElement('div');
    popup.className = 'cat-food-popup';
    popup.textContent = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
    popup.style.setProperty('--off-x', `${Math.round((Math.random() - 0.5) * 30)}px`);
    wrapper.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
  }

  // v0.2.1:attack 爪痕 — 3 道斜向白光(::before + ::after + <span>),0.5s 自清理
  function spawnAttackFx() {
    const wrapper = sprite?.closest('.cat-sprite-wrapper');
    if (!wrapper) return;
    const fx = document.createElement('div');
    fx.className = 'cat-attack-fx';
    fx.appendChild(document.createElement('span'));
    wrapper.appendChild(fx);
    setTimeout(() => fx.remove(), 650);
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

    let cssParts;
    if (type === 'multi-frame') {
      cssParts = buildMultiFrameCSS(manifest, imageUrls);
    } else if (type === 'procedural') {
      cssParts = buildProceduralCSS(manifest, imageUrls);
    } else {
      console.warn('[Committen] unknown pack type:', type);
      cssParts = [];
    }

    let styleEl = document.getElementById('cat-pack-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cat-pack-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = cssParts.join('\n\n');
    console.log(`[Committen] pack loaded: ${manifest.displayName} (${manifest.id}, ${type})`);
  }

  function buildMultiFrameCSS(manifest, imageUrls) {
    const { frameSize, states } = manifest;
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
    return parts;
  }

  // procedural pet:单 baseImage 跨所有 5 状态,每状态用 CSS transform 派生动画。
  // 诚实度参见 docs/v0.2-pet-hatch.md §3.3 — 比真·多帧 sprite 逊色,但远比静态强。
  function buildProceduralCSS(manifest, imageUrls) {
    const url = imageUrls.base;
    const id = manifest.id;
    const kf = (name) => `proc-${name}-${id}`;
    const decl = (state, anim, extra) =>
      `.cat-sprite--${state} {\n` +
      `  background-image: url("${url}");\n` +
      `  animation: ${anim};\n` +
      (extra || '') +
      `}`;

    return [
      // idle:慢呼吸
      decl('idle', `${kf('breath')} 1.2s ease-in-out infinite alternate`),
      `@keyframes ${kf('breath')} {\n  from { transform: scale(0.98); }\n  to   { transform: scale(1.00); }\n}`,

      // walk:squash + stretch(v0.2.1)— 起跳时拉长,落地时压扁,比纯 Y bob 有"步态"
      // transform-origin: bottom center 让 squash 从脚部压上来
      decl('walk', `${kf('walk')} 0.6s ease-in-out infinite`, `  transform-origin: bottom center;\n`),
      `@keyframes ${kf('walk')} {\n` +
      `  0%   { transform: translateY(0)    scale(1.00, 1.00); }\n` +
      `  25%  { transform: translateY(-3px) scale(0.96, 1.04); }\n` +
      `  50%  { transform: translateY(0)    scale(1.00, 1.00); }\n` +
      `  75%  { transform: translateY(0)    scale(1.06, 0.96); }\n` +
      `  100% { transform: translateY(0)    scale(1.00, 1.00); }\n` +
      `}`,

      // sleep:倾斜 + 慢脉动
      decl('sleep', `${kf('sleep')} 1.6s ease-in-out infinite alternate`, `  transform-origin: bottom center;\n`),
      `@keyframes ${kf('sleep')} {\n  from { transform: rotate(-4deg) scale(0.99); }\n  to   { transform: rotate(-6deg) scale(1.01); }\n}`,

      // eat:短促 Y bobbing(spec §3.3 提到"食物 emoji popup",需要 DOM 元素而非纯 CSS,留 v0.2.1)
      decl('eat', `${kf('eat-bob')} 0.28s ease-in-out infinite alternate`),
      `@keyframes ${kf('eat-bob')} {\n  from { transform: translateY(0); }\n  to   { transform: translateY(-4px); }\n}`,

      // attack:scale + shake(spec §3.3 还提到"水平翻转",但 .cat-sprite-pacer 已经做了方向翻转,不再叠加)
      decl('attack', `${kf('attack')} 0.5s ease-in-out infinite`),
      `@keyframes ${kf('attack')} {\n` +
      `  0%   { transform: scale(1.00) translateX(0); }\n` +
      `  15%  { transform: scale(1.18) translateX(-2px); }\n` +
      `  35%  { transform: scale(1.20) translateX(3px); }\n` +
      `  55%  { transform: scale(1.18) translateX(-2px); }\n` +
      `  85%  { transform: scale(1.05) translateX(1px); }\n` +
      `  100% { transform: scale(1.00) translateX(0); }\n` +
      `}`,
    ];
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
  // pack-aware:当 sprite 朝向 (manifest.defaultFacing) 与移动方向不一致时翻转
  window.committen.onDirection((dir) => {
    const facing = activePack?.manifest?.defaultFacing || 'left';
    const facingLeft = facing === 'left';
    const goingRight = dir === 1;
    document.body.classList.toggle('cat-flipped', facingLeft === goingRight);
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
  menuHatch.addEventListener('click', () => {
    window.committen.openHatch();
    closeMenu();
  });

  menuPets.addEventListener('click', () => {
    window.committen.openPetsList();
    closeMenu();
  });

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
