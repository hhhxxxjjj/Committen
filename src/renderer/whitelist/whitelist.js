// Whitelist UI orchestration.
//
// 三段:Recently attacked(被扑过的)/ Your additions(用户加的)/ Default(只读)。
// 每次 add/remove 直接 invoke 主进程,主进程 live-update WindowMonitor,
// 不需要重启 app。

const recentEl = document.getElementById("recent-list");
const recentEmpty = document.getElementById("recent-empty");
const userEl = document.getElementById("user-list");
const userEmpty = document.getElementById("user-empty");
const userCount = document.getElementById("user-count");
const defaultsEl = document.getElementById("defaults-list");
const defaultsHint = document.getElementById("defaults-hint");
const defaultsCount = document.getElementById("defaults-count");
const defaultsToggle = document.getElementById("defaults-toggle");
const manualInput = document.getElementById("manual-input");
const manualBtn = document.getElementById("manual-btn");
const closeBtn = document.getElementById("close-btn");

closeBtn.addEventListener("click", () => window.committenWhitelist.close());

defaultsToggle.addEventListener("click", () => {
  const open = defaultsToggle.classList.toggle("is-open");
  defaultsEl.hidden = !open;
  defaultsHint.hidden = !open;
});

manualInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addManual();
});

manualBtn.addEventListener("click", addManual);

async function addManual() {
  const v = manualInput.value.trim();
  if (!v) return;
  manualInput.value = "";
  await doAdd(v);
}

async function doAdd(name) {
  let result;
  try {
    result = await window.committenWhitelist.add(name);
  } catch (err) {
    alert(`Add failed: ${err.message}`);
    return;
  }
  if (!result?.ok) {
    alert(`Add failed: ${result?.error || "unknown"}`);
    return;
  }
  if (result.alreadyDefault) {
    // Already covered by defaults — no-op success, refresh for UX feedback
  }
  await refresh(name);
}

async function doRemove(name) {
  let result;
  try {
    result = await window.committenWhitelist.remove(name);
  } catch (err) {
    alert(`Remove failed: ${err.message}`);
    return;
  }
  if (!result?.ok) {
    alert(`Remove failed: ${result?.error || "unknown"}`);
    return;
  }
  await refresh();
}

async function refresh(highlightAddedName) {
  let data;
  try {
    data = await window.committenWhitelist.list();
  } catch (err) {
    console.error("whitelist:list failed:", err);
    return;
  }
  renderRecent(data.recent || []);
  renderUser(data.user || [], highlightAddedName);
  renderDefaults(data.defaults || []);
}

function renderRecent(recent) {
  recentEl.innerHTML = "";
  recentEmpty.hidden = recent.length > 0;
  for (const a of recent) {
    const li = document.createElement("li");
    li.className = "entry-row";
    const name = document.createElement("div");
    name.className = "entry-name";
    name.textContent = a.name;
    const btn = document.createElement("button");
    btn.textContent = "Add";
    btn.addEventListener("click", () => doAdd(a.name));
    li.appendChild(name);
    li.appendChild(btn);
    recentEl.appendChild(li);
  }
}

function renderUser(user, highlightAddedName) {
  userEl.innerHTML = "";
  userCount.textContent = user.length;
  userEmpty.hidden = user.length > 0;
  for (const name of user) {
    const li = document.createElement("li");
    li.className = "entry-row";
    if (highlightAddedName && name.toLowerCase() === highlightAddedName.toLowerCase()) {
      li.classList.add("is-pulse");
    }
    const nameEl = document.createElement("div");
    nameEl.className = "entry-name";
    nameEl.textContent = name;
    const btn = document.createElement("button");
    btn.className = "danger";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => doRemove(name));
    li.appendChild(nameEl);
    li.appendChild(btn);
    userEl.appendChild(li);
  }
}

function renderDefaults(defaults) {
  defaultsCount.textContent = defaults.length;
  defaultsEl.innerHTML = "";
  for (const name of defaults) {
    const li = document.createElement("li");
    li.className = "entry-row is-default";
    const nameEl = document.createElement("div");
    nameEl.className = "entry-name";
    nameEl.textContent = name;
    li.appendChild(nameEl);
    defaultsEl.appendChild(li);
  }
}

refresh();
