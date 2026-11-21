// Pure logic: hierarchy index, completion roll-up, time roll-up, date helpers. No React in here.
export const DEFAULTS = {
  template: ['Understand the concept', 'Read the material', 'Solve practice questions', 'Revise'],
  mode: 'items',     // 'items' = % weighted by checklist items, 'equal' = every level counts the same
  implicit: true,    // a level with no checklist gets one tick box
  mandatory: [],     // [{id, title}] items every level inside a course must have (set per course)
};
export const COLORS = ['#1a73e8', '#188038', '#f9ab00', '#d93025', '#9334e6', '#12b5cb', '#e8710a'];

const sum = (a) => a.reduce((x, y) => x + y, 0);
const pad = (n) => String(n).padStart(2, '0');
export const lines = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);
export const clean = (c) => ({ ...c, template: (c.template || []).map((t) => t.trim()).filter(Boolean) });

// dates are IST (UTC+5:30); weeks start on Monday
export const istDate = (ms = Date.now()) => new Date(ms + 19800000).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const weekStart = (d) => addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7));
export const niceDate = (d, today) => d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday'
  : new Date(d + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const dur = (s) => {
  s = Math.round(s);
  if (s < 60) return s ? `${s}s` : '0m';
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
export const clock = (s) => `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;

const group = (rows) => {
  const m = new Map();
  rows.forEach((r) => { if (!m.has(r.node_id)) m.set(r.node_id, []); m.get(r.node_id).push(r); });
  return m;
};

// Index of the whole hierarchy with completion % and rolled-up study time for every level.
export function build(D) {
  const byId = new Map(D.nodes.map((n) => [n.id, n]));
  const kids = new Map();
  D.nodes.forEach((n) => {
    const k = n.parent_id && byId.has(n.parent_id) ? n.parent_id : 'root';
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(n);
  });
  const ord = (a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at));
  kids.forEach((a) => a.sort(ord));
  const roots = kids.get('root') || [];
  const items = group(D.items), logs = group(D.logs), notes = group(D.notes);
  items.forEach((a) => a.sort((x, y) => x.position - y.position));
  const cfgOf = (root) => ({ ...DEFAULTS, ...(D.settings || {}), ...((root && root.settings) || {}) });

  const stats = new Map(), course = new Map();
  const visit = (n, root, cfg) => {
    course.set(n.id, root);
    const c = kids.get(n.id) || [], all = items.get(n.id) || [];
    const sub = c.map((k) => visit(k, root, cfg));
    // a mandatory item that the levels inside also have only summarises theirs, so it is not counted twice
    const own = all.filter((i) => !(i.tpl_id && c.some((k) => (items.get(k.id) || []).some((x) => x.tpl_id === i.tpl_id))));
    let done = own.filter((i) => i.done).length, total = own.length;
    const implicit = !c.length && !all.length && cfg.implicit;
    if (implicit) { total = 1; done = n.done ? 1 : 0; }
    const ownFrac = own.length ? own.filter((i) => i.done).length / own.length : implicit ? (n.done ? 1 : 0) : null;
    sub.forEach((s) => { done += s.done; total += s.total; });
    let pct;
    if (cfg.mode === 'equal') {
      const parts = sub.map((s) => s.pct).filter((p) => p !== null);
      if (ownFrac !== null) parts.push(ownFrac);
      pct = parts.length ? sum(parts) / parts.length : null;
    } else pct = total ? done / total : null;
    const leaf = !c.length;
    const s = {
      sec: sum((logs.get(n.id) || []).map((l) => l.seconds)) + sum(sub.map((x) => x.sec)),
      done, total, pct, leaf,
      leafs: leaf ? (pct === null ? 0 : 1) : sum(sub.map((x) => x.leafs)),
      leafsDone: leaf ? (pct !== null && pct >= 1 ? 1 : 0) : sum(sub.map((x) => x.leafsDone)),
      status: pct === null ? 'none' : pct >= 1 ? 'done' : pct > 0 ? 'part' : 'todo',
    };
    stats.set(n.id, s);
    return s;
  };
  roots.forEach((r) => visit(r, r, cfgOf(r)));

  const path = (id) => { const p = []; let n = byId.get(id); while (n) { p.unshift(n); n = n.parent_id ? byId.get(n.parent_id) : null; } return p; };
  const subtree = (id) => { const out = []; const go = (n) => { out.push(n); (kids.get(n.id) || []).forEach(go); }; if (byId.has(id)) go(byId.get(id)); return out; };
  return {
    byId, kids, roots, items, logs, notes, stats, course, path, subtree, cfgOf,
    text: (id) => path(id).map((n) => n.title).join(' › '),
    depth: (id) => path(id).length,
    isDesc: (anc, id) => path(id).some((n) => n.id === anc),   // true when id is anc or inside it
    color: (id) => COLORS[Math.max(0, roots.indexOf(course.get(id))) % COLORS.length],
  };
}

// Mandatory items (same tpl_id) are linked through the levels: ticking one ticks it on every level inside, and a
// level's item is ticked exactly when every level inside it is ticked. Returns the items whose state must change.
export function linkItems(items, idx, toggled) {
  const by = new Map(), start = new Map();
  items.forEach((i) => { if (i.tpl_id) { by.set(i.node_id + '|' + i.tpl_id, { ...i }); start.set(i.id, i.done); } });
  const hit = toggled && items.find((x) => x.id === toggled.id);
  if (hit) idx.subtree(hit.node_id).forEach((n) => { const x = by.get(n.id + '|' + hit.tpl_id); if (x) x.done = toggled.done; });
  const tpls = [...new Set(items.filter((i) => i.tpl_id).map((i) => i.tpl_id))];
  const walk = (n) => {
    const kids = idx.kids.get(n.id) || [];
    kids.forEach(walk);
    tpls.forEach((t) => {
      const mine = by.get(n.id + '|' + t), ks = kids.map((k) => by.get(k.id + '|' + t)).filter(Boolean);
      if (mine && ks.length) mine.done = ks.every((k) => k.done);
    });
  };
  idx.roots.forEach(walk);
  return [...by.values()].filter((x) => x.done !== start.get(x.id)).map((x) => ({ id: x.id, done: x.done }));
}

// Study time for a period and for the matching period before it, read from the per-day totals (rangeStats().day)
// so it always agrees with the chart. range: today | week | month | all. prev is null for 'all'.
export function compare(day, today, range) {
  const sum = (a, b) => { let s = 0; for (let d = a; d <= b; d = addDays(d, 1)) s += day.get(d) || 0; return s; };
  const wk = weekStart(today), mo = today.slice(0, 8) + '01';
  if (range === 'today') return { cur: sum(today, today), prev: sum(addDays(today, -1), addDays(today, -1)), vs: 'yesterday' };
  if (range === 'week') {
    const n = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;   // days since Monday
    return { cur: sum(wk, today), prev: sum(addDays(wk, -7), addDays(wk, -7 + n)), vs: 'the same days last week' };
  }
  if (range === 'month') {
    const pm = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)).toISOString().slice(0, 10);
    const len = Math.round((Date.parse(mo) - Date.parse(pm)) / 864e5);
    return { cur: sum(mo, today), prev: sum(pm, addDays(pm, Math.min(+today.slice(8), len) - 1)), vs: 'the same days last month' };
  }
  let total = 0;
  day.forEach((v) => { total += v; });
  return { cur: total, prev: null, vs: '' };
}

// Study time inside a date range, rolled up to every parent (each log is counted once per level above it).
export function rangeStats(D, idx, from) {
  const node = new Map(), day = new Map();
  let total = 0;
  D.logs.forEach((l) => {
    if (from && l.log_date < from) return;
    total += l.seconds;
    day.set(l.log_date, (day.get(l.log_date) || 0) + l.seconds);
    idx.path(l.node_id).forEach((n) => node.set(n.id, (node.get(n.id) || 0) + l.seconds));
  });
  return { total, node, day };
}

// plain-text links in notes -> [{t, href?}]
export function parts(text) {
  return text.split(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi).map((t, i) => {
    if (i % 2 === 0) return { t };
    const m = t.match(/[.,;:!?)\]}]+$/), trail = m ? m[0] : '';
    const url = trail ? t.slice(0, -trail.length) : t;
    return [{ t: url, href: /^www\./i.test(url) ? 'https://' + url : url }, trail && { t: trail }];
  }).flat().filter(Boolean);
}

export const csv = (rows) => '\ufeff' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name;
  a.click();
}
