'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, applyTheme, realId } from '../lib/supabase';
import { build, istDate, addDays, linkItems, DEFAULTS } from '../lib/engine';
import { Ctx } from '../components/ctx';
import { Ic } from '../components/ui';
import { Dialogs } from '../components/dialogs';
import { Home, Courses, NodeView, TimerView, History, Notes, Settings, Help } from '../components/screens';

const uid = () => crypto.randomUUID();
const iso = () => new Date().toISOString();
const KIND = { nodes: 'node', items: 'item', logs: 'log', notes: 'note' };
const NAV = [['home', 'Home', 'space_dashboard'], ['courses', 'Courses', 'school'], ['timer', 'Timer', 'timer'], ['notes', 'Notes', 'sticky_note_2'], ['history', 'History', 'history']];

export default function StudyLog() {
  const [D, setD] = useState(null);
  const [err, setErr] = useState('');
  const [hash, setHash] = useState('');
  const [dlg, setDlg] = useState(null);
  const [toast, setToast] = useState(null);
  const dr = useRef(null);                       // latest data, always in step with D
  const queue = useRef(Promise.resolve());       // saves run one after another, so a level exists before things inside it
  const user = useRef(null), after = useRef(null), timer = useRef(null);
  const buf = useRef([]), flushT = useRef(null);   // saves made within a moment are sent together

  const route = hash.replace(/~o$/, '') || 'home';
  const idx = useMemo(() => (D ? build(D) : null), [D]);
  const today = istDate();

  const flash = (msg, undo) => {
    clearTimeout(timer.current);
    setToast({ msg, undo });
    timer.current = setTimeout(() => setToast(null), undo ? 7000 : 3000);
  };
  const load = async () => {
    const u = user.current;
    const { data, error } = await supabase.rpc('sl_open', { p_id: u.id, p_name: u.name, p_course: u.course, p_dp: u.dp });
    if (error || !data) return setErr('Could not load Study Log. Please try again.');
    dr.current = data; setD(data);
  };
  const apply = (fn) => { dr.current = fn(dr.current); setD(dr.current); };
  const enqueue = (fn, args) => {
    queue.current = queue.current.then(async () => {
      const { error } = await supabase.rpc(fn, { p_id: user.current.id, ...args });
      if (error) { flash(/future/i.test(error.message) ? 'Dates in the future are not allowed' : 'Could not save. Refreshing…'); await load(); }
    });
    return queue.current;
  };
  const flush = () => { clearTimeout(flushT.current); const rows = buf.current; buf.current = []; if (rows.length) enqueue('sl_save_many', { p_rows: rows }); };
  const rpc = (fn, args) => { flush(); return enqueue(fn, args); };   // anything else goes after the pending saves

  // create or update a row: the screen updates at once, the save follows
  const put = (kind, patch) => {
    const old = dr.current[kind].find((x) => x.id === patch.id);
    const row = { ...old, ...patch };
    apply((d) => ({ ...d, [kind]: old ? d[kind].map((x) => (x.id === row.id ? row : x)) : [...d[kind], row] }));
    buf.current.push({ kind: KIND[kind], row });
    clearTimeout(flushT.current); flushT.current = setTimeout(flush, 40);
  };
  // soft delete with Undo
  const remove = (kind, id, label) => {
    if (kind === 'nodes') {
      const gone = new Set(build(dr.current).subtree(id).map((n) => n.id));
      apply((d) => ({ ...d, nodes: d.nodes.filter((n) => !gone.has(n.id)), items: d.items.filter((i) => !gone.has(i.node_id)), logs: d.logs.filter((l) => !gone.has(l.node_id)), notes: d.notes.filter((n) => !gone.has(n.node_id)) }));
    } else apply((d) => ({ ...d, [kind]: d[kind].filter((x) => x.id !== id) }));
    rpc('sl_delete', { p_kind: KIND[kind], p_ref: id });
    if (kind === 'nodes') act.linkFix(null);   // the levels left inside may now all be ticked
    flash(`${label} deleted`, async () => { setToast(null); await rpc('sl_restore', { p_kind: KIND[kind], p_ref: id }); await load(); if (kind === 'nodes') act.linkFix(null); });
  };
  const setTimer = (t) => { apply((d) => ({ ...d, timer: t })); rpc('sl_put', { p_key: 'timer', p_val: t }); };

  // ── navigation: hash routes, and one dialog at a time that the Android back button can close
  const go = (r) => { location.hash = r; };
  const swap = (r) => location.replace('#' + r);
  const openDlg = (d) => { setDlg(d); if (!location.hash.endsWith('~o')) location.hash = route + '~o'; };
  const closeDlg = (fn) => {
    if (location.hash.endsWith('~o')) { after.current = typeof fn === 'function' ? fn : null; history.back(); }
    else { setDlg(null); if (typeof fn === 'function') fn(); }
  };

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    applyTheme(sp.get('theme'));
    const u = { id: realId(sp.get('student_id')), name: sp.get('name'), course: sp.get('course') || '', dp: sp.get('dp_url') || '' };
    if (!u.id || !u.name) return setErr('Open Study Log from your student app to continue.');
    user.current = u;
    load().then(() => act.linkFix(null));
    if (location.hash.endsWith('~o')) location.replace(location.hash.slice(0, -2) || '#home');
    const onHash = () => {
      setHash(location.hash.slice(1));
      if (after.current && !location.hash.endsWith('~o')) { const f = after.current; after.current = null; f(); }
    };
    onHash();
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { if (!hash.endsWith('~o')) setDlg(null); }, [hash]);

  const act = {
    addNodes: (parent, titles, template) => {
      const ix = build(dr.current);
      const base = (parent ? ix.kids.get(parent) || [] : ix.roots).length;
      const mand = parent ? ix.cfgOf(ix.course.get(parent)).mandatory || [] : [];   // the course's mandatory checklist
      titles.forEach((t, i) => {
        const id = uid();
        put('nodes', { id, parent_id: parent || null, title: t, position: base + i, done: false, settings: null, created_at: iso() });
        mand.forEach((m, j) => put('items', { id: uid(), node_id: id, title: m.title, done: false, position: j - 99, tpl_id: m.id }));
        (template || []).forEach((it, j) => put('items', { id: uid(), node_id: id, title: it, done: false, position: j }));
      });
      if (mand.length) act.linkFix(null);   // a new unticked level means the levels above are no longer fully ticked
    },
    renameNode: (id, title) => put('nodes', { id, title }),
    moveNode: (id, parent) => {
      const ix = build(dr.current);
      put('nodes', { id, parent_id: parent, position: (parent ? ix.kids.get(parent) || [] : ix.roots).length });
      flash('Moved');
      act.syncAll(null);   // the level now follows its new course's mandatory checklist
    },
    shiftNode: (id, dir) => {
      const ix = build(dr.current), n = ix.byId.get(id);
      const sibs = (n.parent_id && ix.byId.has(n.parent_id) ? ix.kids.get(n.parent_id) : ix.roots).slice();
      const i = sibs.indexOf(n), j = i + dir;
      if (j < 0 || j >= sibs.length) return;
      [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
      sibs.forEach((s, k) => { if (s.position !== k) put('nodes', { id: s.id, position: k }); });
    },
    delNode: (id) => remove('nodes', id, 'Level'),
    toggleNode: (id) => put('nodes', { id, done: !dr.current.nodes.find((n) => n.id === id).done }),
    setCourseCfg: (id, settings) => { put('nodes', { id, settings }); act.syncAll(id); flash('Course settings saved'); },
    syncAll: async (course) => { await rpc('sl_sync', { p_course: course || null }); await load(); act.linkFix(null); },

    addItems: (node, titles) => {
      const base = dr.current.items.filter((i) => i.node_id === node).length;
      titles.forEach((t, j) => put('items', { id: uid(), node_id: node, title: t, done: false, position: base + j }));
    },
    toggleItem: (id) => {
      const it = dr.current.items.find((i) => i.id === id);
      if (it.tpl_id) act.linkFix({ id, done: !it.done });   // mandatory items are linked through the levels
      else put('items', { id, done: !it.done });
    },
    linkFix: (toggled) => {
      const ps = linkItems(dr.current.items, build(dr.current), toggled);
      ps.forEach((p) => put('items', p));
      if (toggled && ps.length > 1) flash(`${ps.length} levels updated`);
    },
    editItem: (id, title) => put('items', { id, title: title.trim() }),
    delItem: (id) => remove('items', id, 'Checklist item'),

    saveLog: (row, note, fromSession) => {
      const id = row.id || uid();
      put('logs', { ...row, id, ...(row.id ? {} : { created_at: iso() }) });
      if (note && note.trim()) put('notes', { id: uid(), node_id: row.node_id, log_id: id, body: note.trim(), created_at: iso() });
      if (fromSession) setTimer(null);
      flash(row.id ? 'Study log updated' : 'Study time saved');
    },
    delLog: (id) => remove('logs', id, 'Study log'),
    saveNote: ({ id, node_id, body }) => {
      const isNew = !id || !dr.current.notes.some((n) => n.id === id);
      put('notes', { id: id || uid(), node_id, body: body.trim(), ...(isNew ? { created_at: iso() } : {}) });
      flash('Note saved');
    },
    delNote: (id) => remove('notes', id, 'Note'),

    setGlobal: (s) => { apply((d) => ({ ...d, settings: s })); rpc('sl_put', { p_key: 'settings', p_val: s }); },
    timerStart: (id) => {
      if (dr.current.timer) { go('timer'); return flash('Finish your current session first'); }
      setTimer({ node_id: id, running: true, started: Date.now(), acc: 0, day: istDate(), note: '' });
      go('timer');
    },
    timerPause: () => { const t = dr.current.timer; setTimer({ ...t, running: false, acc: t.acc + Date.now() - t.started }); },
    timerResume: () => setTimer({ ...dr.current.timer, running: true, started: Date.now() }),
    timerNote: (note) => dr.current.timer && setTimer({ ...dr.current.timer, note }),
    timerClear: () => setTimer(null),

    addExample: () => {
      const tpl = { ...DEFAULTS, ...(dr.current.settings || {}) }.template, ids = {};
      const add = (key, parent, title, pos, items = [], doneN = 0) => {
        const id = (ids[key] = uid());
        put('nodes', { id, parent_id: parent ? ids[parent] : null, title, position: pos, done: false, settings: null, created_at: iso() });
        items.forEach((t, j) => put('items', { id: uid(), node_id: id, title: t, done: j < doneN, position: j }));
      };
      add('bc', null, 'Example: B.Com', 0);
      add('fa', 'bc', 'Financial Accounting', 0); add('pa', 'fa', 'Partnership Accounts', 0); add('adm', 'pa', 'Admission of a Partner', 0);
      add('gw', 'adm', 'Goodwill', 0, tpl, 2); add('rev', 'adm', 'Revaluation of assets and liabilities', 1, tpl); add('psr', 'adm', 'New profit-sharing ratio', 2, tpl);
      add('cfr', 'bc', 'Corporate Financial Reporting', 1); add('ias', 'cfr', 'Presentation of financial statements', 0); add('fp', 'ias', 'Fair presentation', 0, tpl);
      put('logs', { id: uid(), node_id: ids.gw, log_date: addDays(istDate(), -1), seconds: 2700, source: 'manual', created_at: iso() });
      flash('Example course added. Delete it any time.');
    },
  };

  const ctx = { D, idx, me: user.current, today, route, go, swap, dlg, openDlg, closeDlg, flash, act };

  if (err) return <div className="boot"><Ic n="error" /><p>{err}</p></div>;
  if (!D || !idx) return <div className="boot"><div className="skel" /><div className="skel" /><div className="skel s" /></div>;

  const [view, arg] = route.split('/');
  const screen = { home: <Home />, courses: <Courses />, n: <NodeView key={arg} id={arg} />, timer: <TimerView />, history: <History />, notes: <Notes />, settings: <Settings />, help: <Help /> }[view] || <Home />;
  const active = view === 'n' ? 'courses' : ['settings', 'help'].includes(view) ? 'home' : view;

  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <nav className="nav" aria-label="Main">
          {NAV.map(([k, t, ic]) => (
            <button key={k} className={active === k ? 'on' : ''} aria-current={active === k ? 'page' : undefined} onClick={() => swap(k)}>
              <span className="pw"><Ic n={ic} fill={active === k} />{k === 'timer' && D.timer && D.timer.running && <i className="live-dot" />}</span>{t}
            </button>
          ))}
        </nav>
        <main className="main"><div className="view" key={route}>{screen}</div></main>
        <Dialogs />
        {toast && <div className="snack" role="status"><span>{toast.msg}</span>{toast.undo && <button onClick={toast.undo}>Undo</button>}</div>}
      </div>
    </Ctx.Provider>
  );
}
