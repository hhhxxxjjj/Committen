// Journal — persistent event log + streak tracking.
//
// 状态长在 userData/journal.json:
//   { events: [{type, when, ...}...], streak: { current, longest, lastActiveDate } }
//
// events 是 append-only;超过 MAX_EVENTS 时丢最旧的。
// "streak" = 连续天数(以本地日历日为单位),每天至少有 1 个 commit 维持。
// 中断:今天 > lastActiveDate + 1 天 → 下次 commit 时 current 重置为 1。

const fs = require('fs');
const path = require('path');

const MAX_EVENTS = 1000;          // 老的事件被挤掉
const RECENT_DAYS_DEFAULT = 30;   // Diary 默认显示窗口

function ymd(ts) {
  // 本地时区 YYYY-MM-DD
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function daysBetween(a, b) {
  // a, b are YYYY-MM-DD strings — count calendar days between them (a → b).
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86400000);
}

class Journal {
  constructor(filePath) {
    this.filePath = filePath;
    this.events = [];
    this.streak = { current: 0, longest: 0, lastActiveDate: null };
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const obj = JSON.parse(raw);
      if (Array.isArray(obj.events)) this.events = obj.events.slice(-MAX_EVENTS);
      if (obj.streak && typeof obj.streak === 'object') {
        this.streak = {
          current: Number(obj.streak.current) || 0,
          longest: Number(obj.streak.longest) || 0,
          lastActiveDate: typeof obj.streak.lastActiveDate === 'string'
            ? obj.streak.lastActiveDate
            : null,
        };
      }
    } catch (_) {
      // 没文件 / 文件损坏 → 走默认
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload = JSON.stringify({ events: this.events, streak: this.streak }, null, 2);
      fs.writeFileSync(this.filePath, payload, 'utf-8');
    } catch (e) {
      console.error('[Journal] save failed:', e.message);
    }
  }

  _append(ev) {
    this.events.push(ev);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  // commit 来了 → 记事件 + 推 streak
  logCommit({ sha, message, repo, when }) {
    const now = when || Date.now();
    this._append({
      type: 'commit',
      sha: (sha || '').slice(0, 12),
      message: String(message || '').slice(0, 200),
      repo: repo || '',
      when: now,
    });
    this._updateStreak(now);
    this.save();
  }

  // 攻击事件(=入侵被扑)
  logAttack({ app, when }) {
    this._append({
      type: 'attack',
      app: String(app || ''),
      when: when || Date.now(),
    });
    this.save();
  }

  _updateStreak(now) {
    const today = ymd(now);
    const last = this.streak.lastActiveDate;
    if (last === today) {
      // 今天已经有 commit 了,streak 不重复涨
      return;
    }
    if (last && daysBetween(last, today) === 1) {
      // 昨天有 → 今天连上,streak +1
      this.streak.current += 1;
    } else {
      // 第一次,或中断后重启 → 从 1 起算
      this.streak.current = 1;
    }
    if (this.streak.current > this.streak.longest) {
      this.streak.longest = this.streak.current;
    }
    this.streak.lastActiveDate = today;
  }

  // 用于猫窗口实时显示。如果 lastActiveDate 离今天 > 1 天,streak 视为 broken(返回 0 显示用,
  // longest/lastActiveDate 仍然保留以便 Diary 展示)。
  getDisplayStreak(now = Date.now()) {
    const today = ymd(now);
    if (!this.streak.lastActiveDate) return { current: 0, longest: this.streak.longest, broken: false };
    const gap = daysBetween(this.streak.lastActiveDate, today);
    if (gap > 1) {
      return { current: 0, longest: this.streak.longest, broken: true };
    }
    return { current: this.streak.current, longest: this.streak.longest, broken: false };
  }

  // Diary 渲染用 — 最近 N 天的事件,按时间降序(新的在前)
  getRecentEvents(days = RECENT_DAYS_DEFAULT) {
    const cutoff = Date.now() - days * 86400000;
    return this.events
      .filter((e) => e.when >= cutoff)
      .sort((a, b) => b.when - a.when);
  }

  // 启动 toast 用 — 返回 YYYY-MM-DD 的事件计数
  getYesterdaySummary(now = Date.now()) {
    const yesterday = ymd(now - 86400000);
    const commits = this.events.filter((e) => e.type === 'commit' && ymd(e.when) === yesterday).length;
    const attacks = this.events.filter((e) => e.type === 'attack' && ymd(e.when) === yesterday).length;
    return { date: yesterday, commits, attacks };
  }
}

module.exports = { Journal, ymd, daysBetween };
