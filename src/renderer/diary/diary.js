// Diary window orchestration. Renders events grouped by day from main process.

const dayListEl = document.getElementById("day-list");
const emptyEl = document.getElementById("empty-state");
const streakRow = document.getElementById("streak-row");
const streakCurrent = document.getElementById("streak-current");
const streakBest = document.getElementById("streak-best");
const closeBtn = document.getElementById("close-btn");

closeBtn.addEventListener("click", () => window.committenDiary.close());

(async () => {
  let data;
  try {
    data = await window.committenDiary.list();
  } catch (err) {
    showEmpty(`Failed to load diary: ${err.message}`);
    return;
  }
  renderStreak(data.streak);
  renderEvents(data.events || []);
})();

function renderStreak(streak) {
  if (!streak || (!streak.current && !streak.longest)) {
    streakRow.hidden = true;
    return;
  }
  streakRow.hidden = false;
  streakCurrent.textContent = String(streak.current || 0);
  streakBest.textContent = String(streak.longest || 0);
  if (streak.broken) {
    streakRow.classList.add("is-broken");
  } else {
    streakRow.classList.remove("is-broken");
  }
}

function renderEvents(events) {
  dayListEl.innerHTML = "";
  if (events.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const today = ymd(Date.now());
  const yesterday = ymd(Date.now() - 86400000);

  // Group by day (events already sorted desc by when)
  const groups = new Map();
  for (const ev of events) {
    const key = ymd(ev.when);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }

  for (const [date, dayEvents] of groups) {
    const group = document.createElement("section");
    group.className = "day-group";

    const header = document.createElement("h2");
    header.className = "day-header";
    header.textContent = formatDayHeader(date, today, yesterday);
    group.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "event-list";
    for (const ev of dayEvents) {
      ul.appendChild(renderEvent(ev));
    }
    group.appendChild(ul);

    dayListEl.appendChild(group);
  }
}

function renderEvent(ev) {
  const li = document.createElement("li");
  li.className = "event-row";
  li.dataset.type = ev.type;

  const time = document.createElement("div");
  time.className = "event-time";
  time.textContent = formatTime(ev.when);

  const type = document.createElement("div");
  type.className = "event-type";
  type.textContent = ev.type === "commit" ? "commit" : "pounce";

  const body = document.createElement("div");
  body.className = "event-body";
  if (ev.type === "commit") {
    body.textContent = ev.message || "(no message)";
    if (ev.repo || ev.sha) {
      const meta = document.createElement("span");
      meta.className = "event-meta";
      const parts = [];
      if (ev.repo) parts.push(repoBasename(ev.repo));
      if (ev.sha) parts.push(ev.sha.slice(0, 7));
      meta.textContent = parts.join(" · ");
      body.appendChild(meta);
    }
  } else if (ev.type === "attack") {
    body.textContent = ev.app || "(unknown)";
  } else {
    body.textContent = JSON.stringify(ev);
  }

  li.appendChild(time);
  li.appendChild(type);
  li.appendChild(body);
  return li;
}

function repoBasename(p) {
  return String(p).split(/[\\/]/).filter(Boolean).pop() || p;
}

function ymd(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDayHeader(date, today, yesterday) {
  if (date === today) return `Today · ${prettyDate(date)}`;
  if (date === yesterday) return `Yesterday · ${prettyDate(date)}`;
  return prettyDate(date);
}

function prettyDate(date) {
  // date is YYYY-MM-DD
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function showEmpty(msg) {
  emptyEl.hidden = false;
  emptyEl.textContent = msg;
}
