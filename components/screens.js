'use client';
import { useEffect, useMemo, useState } from 'react';
import { Ic, Header, Bar, Ring, Menu, Empty } from './ui';
import { CheckRow, LogRow, NoteCard } from './parts';
import { CfgForm } from './dialogs';
import { useApp } from './ctx';
import { dur, clock, niceDate, rangeStats, compare, weekStart, addDays, lines, clean, csv, download, DEFAULTS } from '../lib/engine';

const pctText = (p) => (p === null ? '—' : `${Math.round(p * 100)}%`);

// ───────────────────────────── Home (dashboard)
export function Home() {
  const { D, idx, me, today, go, act, openDlg } = useApp();
  const [range, setRange] = useState('today');
  const [chart, setChart] = useState('day');
  const wk = weekStart(today), mo = today.slice(0, 8) + '01';
  const R = { today: { from: today, label: 'today' }, week: { from: wk, label: 'this week' }, month: { from: mo, label: 'this month' }, all: { from: null, label: 'all time' } }[range];
  const cur = R.from ? D.logs.filter((l) => l.log_date >= R.from) : D.logs;
  const rs = useMemo(() => rangeStats(D, idx, R.from), [D, idx, R.from]);
  const all = useMemo(() => rangeStats(D, idx, null), [D, idx]);
  const cmp = compare(all.day, today, range);
  const diff = cmp.prev === null ? null : cmp.cur - cmp.prev;
  const studyDays = new Set(D.logs.map((l) => l.log_date)).size;
  const levels = new Set(cur.map((l) => l.node_id)).size;
  const tot = idx.roots.reduce((a, r) => { const s = idx.stats.get(r.id); return { d: a.d + s.done, t: a.t + s.total, l: a.l + s.leafs, ld: a.ld + s.leafsDone }; }, { d: 0, t: 0, l: 0, ld: 0 });
  const bars = chart === 'day'
    ? Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { k: d, now: d === today, v: all.day.get(d) || 0, l: new Date(d + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' }) }; })
    : Array.from({ length: 8 }, (_, i) => { const w = addDays(wk, (i - 7) * 7); let v = 0; for (let k = 0; k < 7; k++) v += all.day.get(addDays(w, k)) || 0; return { k: w, now: w === wk, v, l: new Date(w + 'T00:00:00Z').toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' }) }; });
  const max = Math.max(...bars.map((b) => b.v), 1);
  const recent = [...new Map(D.logs.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((l) => [l.node_id, l])).keys()].filter((id) => idx.byId.has(id)).slice(0, 5);
  const top = [...rs.node].filter(([id]) => idx.depth(id) > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const todays = D.logs.filter((l) => l.log_date === today && idx.byId.has(l.node_id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const addCourse = () => openDlg({ type: 'prompt', title: 'New course', label: 'Course name', multi: true, cta: 'Create', hint: 'For example B.Com, CA or Class 12. Put each course on a new line to add several.', onSubmit: (v) => act.addNodes(null, lines(v), []) });

  return (
    <>
      <Header title={`Hi, ${(me.name || '').split(' ')[0]}`} sub={niceDate(today, today) + ' · ' + new Date(today + 'T00:00:00Z').toLocaleDateString([], { day: 'numeric', month: 'long', timeZone: 'UTC' })}>
        <button className="ib" aria-label="Help guide" onClick={() => go('help')}><Ic n="help" /></button>
        <button className="ib" aria-label="Settings" onClick={() => go('settings')}><Ic n="settings" /></button>
      </Header>
      <div className="page">
        {!idx.roots.length ? (
          <div className="card welcome">
            <Empty icon="school" title="Welcome to Study Log">
              Organise your courses, tick off what you finish and see exactly how long you really study.
              <div className="btns col"><button className="btn" onClick={addCourse}><Ic n="add" />Create your first course</button><button className="btn tonal" onClick={act.addExample}><Ic n="auto_awesome" />Load an example course</button><button className="btn text" onClick={() => go('help')}>Read the help guide</button></div>
            </Empty>
          </div>
        ) : (
          <>
            <div className="chips" role="tablist" aria-label="Time range">
              {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, t]) => <button key={k} role="tab" aria-selected={range === k} className={`chip${range === k ? ' on' : ''}`} onClick={() => setRange(k)}>{t}</button>)}
            </div>
            <div className="hero">
              <small>Study time · {R.label}</small>
              <div className="big">{dur(cmp.cur)}</div>
              {diff !== null && <div className="delta"><Ic n={diff > 0 ? 'trending_up' : diff < 0 ? 'trending_down' : 'trending_flat'} className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''} />{diff === 0 ? `Same as ${cmp.vs}` : `${dur(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than ${cmp.vs}`}</div>}
              {diff !== null && <div className="vs">{cmp.vs[0].toUpperCase() + cmp.vs.slice(1)}: {dur(cmp.prev)}</div>}
              {range === 'all' && studyDays > 0 && <div className="delta"><Ic n="event_available" />Average {dur(rs.total / studyDays)} across {studyDays} study day{studyDays > 1 ? 's' : ''}</div>}
              <div className="mini"><span><b>{cur.length}</b> session{cur.length === 1 ? '' : 's'}</span><span><b>{levels}</b> level{levels === 1 ? '' : 's'} studied</span></div>
            </div>
            <div className="tiles">
              <div className="tile"><Ic n="task_alt" /><b>{tot.ld}<small>/{tot.l}</small></b><span>Concepts done</span></div>
              <div className="tile"><Ic n="donut_large" /><b>{tot.t ? Math.round((100 * tot.d) / tot.t) : 0}%</b><span>Overall completion</span></div>
            </div>

            {range === 'today' && (
              <section className="card">
                <div className="sec"><h2>Today’s sessions</h2>{todays.length > 0 && <span className="muted">{todays.length} logged</span>}</div>
                {todays.map((l) => <LogRow key={l.id} l={l} path />)}
                {!todays.length && (
                  <div className="hint">Nothing logged yet today. {D.timer ? <button className="link" onClick={() => go('timer')}>Open your running timer</button> : <button className="link" onClick={() => go('timer')}>Start studying</button>}</div>
                )}
              </section>
            )}

            <section className="card">
              <div className="sec"><h2>Study time</h2>
                <div className="chips sm">{[['day', 'Daily'], ['week', 'Weekly']].map(([k, t]) => <button key={k} className={`chip${chart === k ? ' on' : ''}`} onClick={() => setChart(k)}>{t}</button>)}</div>
              </div>
              <div className="chart" role="img" aria-label="Study time chart">
                {bars.map((b) => (
                  <div className="col" key={b.k} title={`${b.l}: ${dur(b.v)}`}>
                    <small>{b.v ? dur(b.v) : ''}</small>
                    <div className="colbar"><i className={b.now ? 'now' : ''} style={{ height: `${(b.v / max) * 100}%` }} /></div>
                    <span>{b.l}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="sec"><h2>By course · {R.label}</h2></div>
              {rs.total > 0 && <div className="stack">{idx.roots.map((r) => <i key={r.id} style={{ width: `${((rs.node.get(r.id) || 0) / rs.total) * 100}%`, background: idx.color(r.id) }} />)}</div>}
              {idx.roots.map((r) => {
                const v = rs.node.get(r.id) || 0;
                return (
                  <button key={r.id} className="lrow" onClick={() => go('n/' + r.id)}>
                    <i className="dot" style={{ background: idx.color(r.id) }} /><span className="lt"><b>{r.title}</b><small>{pctText(idx.stats.get(r.id).pct)} complete</small></span>
                    <span className="ld">{dur(v)}<small>{rs.total ? Math.round((v / rs.total) * 100) : 0}%</small></span>
                  </button>
                );
              })}
              {!rs.total && <p className="hint">No study time logged {range === 'all' ? 'yet' : R.label}.</p>}
            </section>

            {top.length > 0 && (
              <section className="card">
                <div className="sec"><h2>Most studied · {R.label}</h2></div>
                {top.map(([id, v]) => (
                  <button key={id} className="lrow" onClick={() => go('n/' + id)}>
                    <i className="dot" style={{ background: idx.color(id) }} /><span className="lt"><b>{idx.byId.get(id).title}</b><small>{idx.text(id)}</small></span><span className="ld">{dur(v)}</span>
                  </button>
                ))}
              </section>
            )}

            {recent.length > 0 && !D.timer && (
              <section className="card">
                <div className="sec"><h2>Quick start</h2></div>
                {recent.map((id) => (
                  <div className="lrow" key={id}>
                    <i className="dot" style={{ background: idx.color(id) }} /><span className="lt"><b>{idx.byId.get(id).title}</b><small>{idx.text(id)}</small></span>
                    <button className="btn sm" aria-label={`Start timer for ${idx.byId.get(id).title}`} onClick={() => act.timerStart(id)}><Ic n="play_arrow" />Start</button>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ───────────────────────────── Courses
export function Courses() {
  const { idx, go, act, openDlg } = useApp();
  const add = () => openDlg({ type: 'prompt', title: 'New course', label: 'Course name', multi: true, cta: 'Create', hint: 'For example B.Com, CA or Class 12. Put each course on a new line to add several.', onSubmit: (v) => act.addNodes(null, lines(v), []) });
  return (
    <>
      <Header title="Courses" sub={idx.roots.length ? `${idx.roots.length} course${idx.roots.length > 1 ? 's' : ''}` : ''} />
      <div className="page">
        {!idx.roots.length && (
          <Empty icon="school" title="No courses yet">
            Start with a course, then add subjects, chapters and concepts inside it.
            <div className="btns col"><button className="btn" onClick={add}><Ic n="add" />Create a course</button><button className="btn tonal" onClick={act.addExample}><Ic n="auto_awesome" />Load an example course</button></div>
          </Empty>
        )}
        {idx.roots.map((r) => {
          const s = idx.stats.get(r.id);
          return (
            <button key={r.id} className="ccard" style={{ '--c': idx.color(r.id) }} onClick={() => go('n/' + r.id)}>
              <span className="cmain"><b>{r.title}</b><small>{dur(s.sec)} studied · {s.leafs ? `${s.leafsDone}/${s.leafs} concepts done` : 'No checklist yet'}</small><Bar value={s.pct} color="var(--c)" /></span>
              <span className="cpct">{pctText(s.pct)}</span>
            </button>
          );
        })}
      </div>
      {idx.roots.length > 0 && <button className="fab" onClick={add}><Ic n="add" /><span>Course</span></button>}
    </>
  );
}

// ───────────────────────────── One level (course, subject, chapter, concept…)
function Tree({ list, depth, open, toggle }) {
  const { idx, go, act } = useApp();
  return list.map((n) => {
    const s = idx.stats.get(n.id), k = idx.kids.get(n.id) || [], isOpen = open.has(n.id);
    return (
      <div key={n.id}>
        <div className="trow" style={{ paddingLeft: 4 + depth * 18 }}>
          <button className="ib sm" aria-label={isOpen ? 'Collapse' : 'Expand'} aria-expanded={isOpen} disabled={!k.length} onClick={() => toggle(n.id)}>
            <Ic n={k.length ? (isOpen ? 'expand_more' : 'chevron_right') : 'remove'} className={k.length ? '' : 'faint'} />
          </button>
          <button className="ttl" onClick={() => go('n/' + n.id)}><b>{n.title}</b><small>{dur(s.sec)}</small></button>
          <span className={`stat st-${s.status}`}>{s.pct === null ? '' : pctText(s.pct)}</span>
          <button className="ib sm" aria-label={`Start timer for ${n.title}`} onClick={() => act.timerStart(n.id)}><Ic n="play_arrow" /></button>
        </div>
        {isOpen && <Tree list={k} depth={depth + 1} open={open} toggle={toggle} />}
      </div>
    );
  });
}

export function NodeView({ id }) {
  const { D, idx, today, swap, act, openDlg } = useApp();
  const n = idx.byId.get(id);
  const [tab, setTab] = useState('over');
  const [deep, setDeep] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => { if (!n) swap('courses'); }, [n]);
  if (!n) return null;

  const s = idx.stats.get(id), p = idx.path(id), own = idx.items.get(id) || [], kids = idx.kids.get(id) || [];
  const root = idx.course.get(id), cfg = idx.cfgOf(root), col = idx.color(id);
  const ids = new Set(idx.subtree(id).map((x) => x.id));
  const logs = D.logs.filter((l) => ids.has(l.node_id)).sort((a, b) => b.log_date.localeCompare(a.log_date) || String(b.created_at).localeCompare(String(a.created_at)));
  const notes = D.notes.filter((x) => (deep ? ids.has(x.node_id) : x.node_id === id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const sibs = n.parent_id ? idx.kids.get(n.parent_id) || [] : idx.roots, at = sibs.indexOf(n);
  const toggle = (x) => setOpen((o) => { const c = new Set(o); c.has(x) ? c.delete(x) : c.add(x); return c; });

  const addChild = () => openDlg({ type: 'prompt', title: `Add inside “${n.title}”`, label: 'Level name', multi: true, cta: 'Add', hint: 'Put each name on a new line to add several at once.', sw: { label: 'Start each with the default checklist', on: p.length >= 2 }, onSubmit: (v, sw) => act.addNodes(id, lines(v), sw ? cfg.template : []) });
  const addItems = () => openDlg({ type: 'prompt', title: 'Add checklist items', label: 'Items', multi: true, cta: 'Add', hint: 'One item per line.', onSubmit: (v) => act.addItems(id, lines(v)) });
  const rename = () => openDlg({ type: 'prompt', title: 'Rename', label: 'Name', value: n.title, onSubmit: (v) => act.renameNode(id, v.trim()) });
  const move = () => openDlg({ type: 'pick', title: `Move “${n.title}” into…`, exclude: id, root: !!n.parent_id, onPick: (to) => act.moveNode(id, to) });
  const del = () => openDlg({
    type: 'confirm', title: `Delete “${n.title}”?`, cta: 'Delete', danger: true,
    body: `This also deletes ${ids.size - 1} level${ids.size === 2 ? '' : 's'} inside it, ${logs.length} study log${logs.length === 1 ? '' : 's'} (${dur(s.sec)} of study time) and the notes. You can undo right after.`,
    onYes: () => { act.delNode(id); swap(n.parent_id ? 'n/' + n.parent_id : 'courses'); },
  });
  const tick = !kids.length && !own.length && cfg.implicit;

  return (
    <>
      <div className="hdr nav-top">
        <button className="ib" aria-label="Back" onClick={() => history.back()}><Ic n="arrow_back" /></button>
        <nav className="crumbs" aria-label="Breadcrumb">
          <button onClick={() => swap('courses')}>Courses</button>
          {p.slice(0, -1).map((x) => <span key={x.id}><Ic n="chevron_right" /><button onClick={() => swap('n/' + x.id)}>{x.title}</button></span>)}
        </nav>
        <Menu items={[
          { icon: 'edit', label: 'Rename', onClick: rename },
          { icon: 'drive_file_move', label: 'Move to…', onClick: move },
          at > 0 && { icon: 'arrow_upward', label: 'Move up', onClick: () => act.shiftNode(id, -1) },
          at < sibs.length - 1 && { icon: 'arrow_downward', label: 'Move down', onClick: () => act.shiftNode(id, 1) },
          !n.parent_id && { icon: 'tune', label: 'Course settings', onClick: () => openDlg({ type: 'cfg', id }) },
          { icon: 'delete', label: 'Delete', danger: true, onClick: del },
        ]} />
      </div>
      <div className="page">
        <div className="nhead" style={{ '--c': col }}>
          <div><h1>{n.title}</h1><p>{dur(s.sec)} studied{s.leafs ? ` · ${s.leafsDone}/${s.leafs} concepts done` : ''}</p></div>
          <Ring value={s.pct || 0} size={72} stroke={8}><b>{pctText(s.pct)}</b></Ring>
        </div>
        <div className="qa">
          <button className="btn" onClick={() => act.timerStart(id)}><Ic n="play_arrow" />Start timer</button>
          <button className="btn tonal" onClick={() => openDlg({ type: 'log', mode: 'new', init: { node_id: id, seconds: 0, log_date: today, source: 'manual' } })}><Ic n="edit_calendar" />Log time</button>
          <button className="btn tonal" onClick={() => openDlg({ type: 'note', node_id: id })}><Ic n="sticky_note_2" />Add note</button>
          <button className="btn tonal" onClick={addChild}><Ic n="create_new_folder" />Add level</button>
        </div>
        <div className="chips" role="tablist">
          {[['over', 'Overview'], ['notes', `Notes${notes.length ? ` (${notes.length})` : ''}`], ['hist', `History${logs.length ? ` (${logs.length})` : ''}`]].map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
        </div>

        {tab === 'over' && (
          <>
            <section className="card">
              <div className="sec"><h2>Checklist</h2>{own.length > 0 && <button className="chip" onClick={addItems}><Ic n="add" />Add</button>}</div>
              {own.map((it) => <CheckRow key={it.id} item={it} />)}
              {tick && (
                <div className={`crow${n.done ? ' done' : ''}`}>
                  <button type="button" role="checkbox" aria-checked={n.done} aria-label="Mark as done" className={`cb${n.done ? ' on' : ''}`} onClick={() => act.toggleNode(id)}><Ic n="check" /></button>
                  <span className="ctitle">Mark “{n.title}” as done</span>
                </div>
              )}
              {!own.length && <div className="hint">{tick ? 'No checklist yet. ' : 'This level has no checklist of its own. '}<button className="link" onClick={addItems}>Add checklist items</button></div>}
              {own.length > 0 && <p className="hint">Checklist time and completion roll up to the levels above.</p>}
            </section>
            <section className="card">
              <div className="sec"><h2>Inside this level</h2>
                {kids.length > 0 && <div className="chips sm"><button className="chip" onClick={() => setOpen(new Set(idx.subtree(id).map((x) => x.id)))}>Expand all</button><button className="chip" onClick={() => setOpen(new Set())}>Collapse</button></div>}
              </div>
              {kids.length ? <Tree list={kids} depth={0} open={open} toggle={toggle} /> : <div className="hint">Nothing inside yet. <button className="link" onClick={addChild}>Add subjects, chapters or concepts</button></div>}
            </section>
          </>
        )}

        {tab === 'notes' && (
          <>
            {kids.length > 0 && <button className="sw-line" role="switch" aria-checked={deep} onClick={() => setDeep(!deep)}><span className={`sw-t${deep ? ' on' : ''}`}><i /></span>Include notes from levels inside</button>}
            {notes.map((x) => <NoteCard key={x.id} n={x} path={deep} />)}
            {!notes.length && <Empty icon="sticky_note_2" title="No notes here">Notes for “{n.title}” show up here. <div className="btns col"><button className="btn tonal" onClick={() => openDlg({ type: 'note', node_id: id })}><Ic n="add" />Add a note</button></div></Empty>}
          </>
        )}

        {tab === 'hist' && (
          <section className="card">
            {logs.map((l) => <div key={l.id}><div className="dtag">{niceDate(l.log_date, today)}</div><LogRow l={l} path={l.node_id !== id} /></div>)}
            {!logs.length && <p className="hint">No study time logged here yet.</p>}
          </section>
        )}
      </div>
    </>
  );
}

// ───────────────────────────── Timer
export function TimerView() {
  const { D, idx, act, openDlg, today } = useApp();
  const t = D.timer;
  const [sel, setSel] = useState(null);
  const [, tick] = useState(0);
  const [note, setNote] = useState((t && t.note) || '');
  useEffect(() => { if (!t || !t.running) return; const i = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(i); }, [t && t.running]);
  useEffect(() => {   // keep the screen on while studying
    if (!t || !t.running || !navigator.wakeLock) return;
    let lock;
    const get = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    const vis = () => document.visibilityState === 'visible' && get();
    get();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock && lock.release(); };
  }, [t && t.running]);

  const sec = t ? Math.floor((t.acc + (t.running ? Date.now() - t.started : 0)) / 1000) : 0;
  const nid = t ? t.node_id : sel, n = nid && idx.byId.get(nid);
  const recent = [...new Map(D.logs.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((l) => [l.node_id, l])).keys()].filter((id) => idx.byId.has(id)).slice(0, 5);
  const choose = () => openDlg({ type: 'pick', title: 'What are you studying?', value: sel, onPick: setSel });
  const finish = () => openDlg({ type: 'log', mode: 'session', init: { node_id: t.node_id, seconds: sec, log_date: t.day, source: 'timer', note } });

  return (
    <>
      <Header title="Timer" sub={t ? (t.running ? 'Session in progress' : 'Session paused') : 'Pick a level and start'} />
      <div className="page timer">
        <div className={`tring${t && t.running ? ' live' : ''}`}>
          <Ring value={(sec % 3600) / 3600} size={248} stroke={12}><div className="tclock">{clock(sec)}</div><small>{!t ? 'Ready' : t.running ? 'Studying' : 'Paused'}</small></Ring>
        </div>
        <button className="lvlfield center" disabled={!!t} onClick={choose}>
          <small>Studying</small>
          {n ? <b><i className="dot" style={{ background: idx.color(nid) }} />{n.title}</b> : <b className="ph">{t ? 'This level was deleted' : 'Choose a level'}</b>}
          {n && <span>{idx.text(nid)}</span>}
        </button>
        <div className="tctl">
          {!t && <button className="btn big" disabled={!n} onClick={() => act.timerStart(nid)}><Ic n="play_arrow" />Start</button>}
          {t && <button className="btn tonal big" onClick={t.running ? act.timerPause : act.timerResume}><Ic n={t.running ? 'pause' : 'play_arrow'} />{t.running ? 'Pause' : 'Resume'}</button>}
          {t && <button className="btn big" onClick={n ? finish : act.timerClear}><Ic n="stop" />{n ? 'Finish' : 'Discard'}</button>}
        </div>
        {t && <label className="field"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => act.timerNote(note)} placeholder=" " /><span>Session notes (optional)</span></label>}
        {!t && recent.length > 0 && (
          <section className="card">
            <div className="sec"><h2>Quick start</h2></div>
            {recent.map((id) => (
              <div className="lrow" key={id}>
                <i className="dot" style={{ background: idx.color(id) }} /><span className="lt"><b>{idx.byId.get(id).title}</b><small>{idx.text(id)}</small></span>
                <button className="btn sm" aria-label={`Start timer for ${idx.byId.get(id).title}`} onClick={() => act.timerStart(id)}><Ic n="play_arrow" />Start</button>
              </div>
            ))}
          </section>
        )}
        <button className="btn text" onClick={() => openDlg({ type: 'log', mode: 'new', init: { node_id: sel, seconds: 0, log_date: today, source: 'manual' } })}><Ic n="edit_calendar" />Add time manually</button>
      </div>
    </>
  );
}

// ───────────────────────────── History
export function History() {
  const { D, idx, today, openDlg } = useApp();
  const [course, setCourse] = useState('all');
  const logs = D.logs.filter((l) => idx.byId.has(l.node_id) && (course === 'all' || (idx.course.get(l.node_id) || {}).id === course))
    .sort((a, b) => b.log_date.localeCompare(a.log_date) || String(b.created_at).localeCompare(String(a.created_at)));
  const days = [...new Set(logs.map((l) => l.log_date))];
  const exportCsv = () => {
    const rows = [['Date', 'Course', 'Level', 'Path', 'Minutes', 'Duration', 'Source', 'Notes']];
    logs.slice().reverse().forEach((l) => rows.push([l.log_date, idx.course.get(l.node_id).title, idx.byId.get(l.node_id).title, idx.text(l.node_id), (l.seconds / 60).toFixed(1), dur(l.seconds), l.source, D.notes.filter((x) => x.log_id === l.id).map((x) => x.body).join(' | ')]));
    download(`study-log-${today}.csv`, csv(rows));
  };
  return (
    <>
      <Header title="History" sub={`${logs.length} log${logs.length === 1 ? '' : 's'} · ${dur(logs.reduce((a, l) => a + l.seconds, 0))}`}>
        <button className="ib" aria-label="Export CSV" title="Export CSV" disabled={!logs.length} onClick={exportCsv}><Ic n="download" /></button>
      </Header>
      <div className="page">
        {idx.roots.length > 1 && (
          <div className="chips scroll-x">
            <button className={`chip${course === 'all' ? ' on' : ''}`} onClick={() => setCourse('all')}>All courses</button>
            {idx.roots.map((r) => <button key={r.id} className={`chip${course === r.id ? ' on' : ''}`} onClick={() => setCourse(r.id)}>{r.title}</button>)}
          </div>
        )}
        {days.map((d) => (
          <section className="card" key={d}>
            <div className="sec"><h2>{niceDate(d, today)}</h2><span className="muted">{dur(logs.filter((l) => l.log_date === d).reduce((a, l) => a + l.seconds, 0))}</span></div>
            {logs.filter((l) => l.log_date === d).map((l) => <LogRow key={l.id} l={l} path />)}
          </section>
        ))}
        {!logs.length && <Empty icon="history" title="No study logged yet">Start the timer or add time by hand. Every log keeps its date and duration here.</Empty>}
      </div>
      {idx.roots.length > 0 && <button className="fab" onClick={() => openDlg({ type: 'log', mode: 'new', init: { node_id: null, seconds: 0, log_date: today, source: 'manual' } })}><Ic n="add" /><span>Log time</span></button>}
    </>
  );
}

// ───────────────────────────── Notes (global search)
export function Notes() {
  const { D, idx, go, openDlg } = useApp();
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('all');
  const qq = q.trim().toLowerCase();
  const list = D.notes.filter((x) => idx.byId.has(x.node_id) && (course === 'all' || (idx.course.get(x.node_id) || {}).id === course)
    && (!qq || x.body.toLowerCase().includes(qq) || idx.text(x.node_id).toLowerCase().includes(qq)));
  const groups = [...list.reduce((m, x) => m.set(x.node_id, [...(m.get(x.node_id) || []), x]), new Map())]
    .sort((a, b) => idx.text(a[0]).localeCompare(idx.text(b[0])));
  return (
    <>
      <Header title="Notes" sub={`${list.length} note${list.length === 1 ? '' : 's'}${qq ? ' found' : ''}`} />
      <div className="page">
        <label className="search sticky"><Ic n="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all notes, levels and links" aria-label="Search notes" />{q && <button className="ib sm" aria-label="Clear search" onClick={() => setQ('')}><Ic n="close" /></button>}</label>
        {idx.roots.length > 1 && (
          <div className="chips scroll-x">
            <button className={`chip${course === 'all' ? ' on' : ''}`} onClick={() => setCourse('all')}>All courses</button>
            {idx.roots.map((r) => <button key={r.id} className={`chip${course === r.id ? ' on' : ''}`} onClick={() => setCourse(r.id)}>{r.title}</button>)}
          </div>
        )}
        {groups.map(([id, ns]) => (
          <section key={id} className="ngroup">
            <button className="nghead" onClick={() => go('n/' + id)}><i className="dot" style={{ background: idx.color(id) }} /><span>{idx.text(id)}</span><Ic n="chevron_right" /></button>
            {ns.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((x) => <NoteCard key={x.id} n={x} q={qq} path={false} />)}
          </section>
        ))}
        {!list.length && (qq
          ? <Empty icon="search_off" title="No notes found">Nothing matches “{q}”. Try a shorter word or another course.</Empty>
          : <Empty icon="sticky_note_2" title="No notes yet">Add notes to any course, subject, chapter or concept. Notes you write while studying appear here too.</Empty>)}
      </div>
      {idx.roots.length > 0 && <button className="fab" onClick={() => openDlg({ type: 'note', node_id: null })}><Ic n="add" /><span>Note</span></button>}
    </>
  );
}

// ───────────────────────────── Settings
export function Settings() {
  const { D, idx, me, act, openDlg, go } = useApp();
  const g = { ...DEFAULTS, ...(D.settings || {}) };
  const [cfg, setCfg] = useState(g);
  useEffect(() => {   // save a moment after the last change
    if (JSON.stringify(clean(cfg)) === JSON.stringify(clean(g))) return;
    const t = setTimeout(() => act.setGlobal(clean(cfg)), 700);
    return () => clearTimeout(t);
  }, [cfg]);
  return (
    <>
      <div className="hdr nav-top"><button className="ib" aria-label="Back" onClick={() => history.back()}><Ic n="arrow_back" /></button><h1>Settings</h1></div>
      <div className="page">
        <section className="card">
          <div className="sec"><h2>Global settings</h2></div>
          <p className="hint">These apply to every course unless a course has its own settings.</p>
          <CfgForm value={cfg} onChange={setCfg} />
        </section>
        <section className="card">
          <div className="sec"><h2>Course settings</h2></div>
          {idx.roots.map((r) => (
            <button key={r.id} className="lrow" onClick={() => openDlg({ type: 'cfg', id: r.id })}>
              <i className="dot" style={{ background: idx.color(r.id) }} /><span className="lt"><b>{r.title}</b><small>{r.settings && ['template', 'mode', 'implicit'].some((k) => k in r.settings) ? 'Custom settings' : 'Using global settings'}{r.settings && (r.settings.mandatory || []).length ? ` · ${r.settings.mandatory.length} mandatory item${r.settings.mandatory.length > 1 ? 's' : ''}` : ''}</small></span><Ic n="chevron_right" />
            </button>
          ))}
          {!idx.roots.length && <p className="hint">Create a course to give it its own settings.</p>}
        </section>
        <section className="card">
          <div className="sec"><h2>Account</h2></div>
          <div className="lrow"><span className="lt"><b>{me.name}</b><small>Student ID {me.id}{me.course ? ` · ${me.course}` : ''}</small></span></div>
          <button className="lrow" onClick={() => go('help')}><span className="lt"><b>Help guide</b><small>How Study Log works, with tips</small></span><Ic n="chevron_right" /></button>
        </section>
      </div>
    </>
  );
}

// ───────────────────────────── Help
const GUIDE = [
  ['rocket_launch', 'Quick start', <ol key="a"><li>Open <b>Courses</b> and create a course, for example B.Com.</li><li>Open it and tap <b>Add level</b>. Add subjects, chapters and concepts. Type one per line to add many at once.</li><li>Tick checklist items as you finish them.</li><li>Tap <b>Start</b> next to any level to time your study, or <b>Log time</b> to add it by hand.</li></ol>],
  ['account_tree', 'Levels and structure', <><p>A course can have as many levels inside it as you need, for example Course › Subject › Module › Chapter › Concept. You name every level yourself, and every course can have a different structure.</p><p>Use <b>⋮</b> on a level to rename, move or reorder it. Tap the arrows in the list to open and close levels.</p></>],
  ['checklist', 'Checklists and completion', <><p>Any level can have checklist items. A level is <b>completed</b> when everything inside it is done, <b>partial</b> when some is done, and <b>pending</b> when nothing is done. This works at every level, up to the whole course.</p><p>Completion % counts checklist items by default, so a chapter with 10 items weighs more than one with 2. You can change this in Settings. Logging time never marks anything complete.</p><p><b>Mandatory checklist:</b> open a course’s settings to add items that every level inside that course must have. They are added to all existing and future levels, can be ticked but not edited or deleted on the level, and are managed only in the course settings.</p><p><b>Mandatory items are linked.</b> Tick Revision on a subject and it is ticked on every level inside it. When every concept in a chapter is ticked, the chapter ticks itself, then the module, then the subject. Unticking one level unticks the levels above it. A linked item is counted once in the percentage, through the levels at the bottom.</p></>],
  ['timer', 'Study time', <><p>Use the <b>Timer</b> to start, pause, resume and finish a session. It keeps running if you close the app. Or tap <b>Log time</b> to enter minutes yourself for today or any past date. Future dates are not allowed.</p><p>You can log time on any level: a concept, a chapter, a subject or a whole course.</p></>],
  ['functions', 'How time adds up', <p>If you study Goodwill for 45 minutes, that 45 minutes is saved once. Its chapter, module, subject and course all show 45 minutes too, because they add up the time of everything inside them. Nothing is counted twice in your overall total.</p>],
  ['sticky_note_2', 'Notes', <><p>Add notes to any level from the <b>Add note</b> button. Notes written while you log study time are saved under the level you studied. Open the <b>Notes</b> tab to see everything and search it.</p><p>Links such as https://example.com are tappable and open outside the app.</p></>],
  ['space_dashboard', 'Dashboard, history and export', <p>Home shows your study time for this week, this month or all time, a daily or weekly chart, time by course and your most studied levels. History lists every log by date. Tap the download icon in History to export a CSV file.</p>],
  ['tune', 'Settings', <p>Global settings set your default checklist, how completion % is worked out, and whether levels without a checklist get a tick box. Open a course in Settings to give it its own settings instead. A course’s mandatory checklist is set there too.</p>],
  ['delete', 'Deleting and undo', <p>Deleting a level also deletes the study time logged inside it, so totals go down. Right after any delete you can tap <b>Undo</b>. Deleted items are only hidden and are never wiped from the database.</p>],
  ['quiz', 'Questions', <><p><b>Why did time not complete my topic?</b> Time and completion are separate on purpose.</p><p><b>Which timezone is used?</b> India time (IST). Weeks start on Monday.</p><p><b>My timer shows a long time.</b> The timer keeps counting until you finish it. When you finish, you can correct the duration before saving.</p></>],
];

export function Help() {
  const { go, act, idx } = useApp();
  return (
    <>
      <div className="hdr nav-top"><button className="ib" aria-label="Back" onClick={() => history.back()}><Ic n="arrow_back" /></button><h1>Help guide</h1></div>
      <div className="page">
        <p className="lead">Everything you need to organise your courses, track progress and measure real study time.</p>
        {GUIDE.map(([icon, title, body], i) => (
          <details className="card help" key={title} open={i === 0}>
            <summary><Ic n={icon} /><b>{title}</b><Ic n="expand_more" className="chev" /></summary>
            <div className="hbody">{body}</div>
          </details>
        ))}
        {!idx.roots.length && <button className="btn tonal block" onClick={() => { act.addExample(); go('courses'); }}><Ic n="auto_awesome" />Load an example course to explore</button>}
      </div>
    </>
  );
}
