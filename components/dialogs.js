'use client';
import { useState } from 'react';
import { Ic, Modal, Switch } from './ui';
import { useApp } from './ctx';
import { DEFAULTS, clean } from '../lib/engine';

// Searchable tree of every level. onPick(id | null for "top level").
export function Picker({ onPick, exclude, root, value }) {
  const { idx } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set(value ? idx.path(value).map((n) => n.id) : []));
  const ok = (n) => !(exclude && idx.isDesc(exclude, n.id));
  const rows = [];
  const walk = (list, d) => list.forEach((n) => { if (!ok(n)) return; rows.push({ n, d }); if (open.has(n.id)) walk(idx.kids.get(n.id) || [], d + 1); });
  walk(idx.roots, 0);
  const found = q.trim() ? [...idx.byId.values()].filter((n) => ok(n) && idx.text(n.id).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60) : null;
  const toggle = (id) => setOpen((o) => { const c = new Set(o); c.has(id) ? c.delete(id) : c.add(id); return c; });
  return (
    <div className="picker">
      <label className="search"><Ic n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search levels" aria-label="Search levels" /></label>
      {root && !q && <button className="prow" onClick={() => onPick(null)}><Ic n="north_west" /><b>Make it a course (top level)</b></button>}
      {!idx.roots.length && <p className="hint">Create a course first.</p>}
      {(found || rows).map((r) => {
        const n = r.n || r, d = r.d || 0, k = idx.kids.get(n.id) || [];
        return (
          <div className="prow" key={n.id} style={{ paddingLeft: 8 + d * 18 }}>
            {!found && <button className="ib sm" aria-label="Expand" disabled={!k.length} onClick={() => toggle(n.id)}><Ic n={k.length ? (open.has(n.id) ? 'expand_more' : 'chevron_right') : 'remove'} className={k.length ? '' : 'faint'} /></button>}
            <button className="pname" onClick={() => onPick(n.id)}>
              <i className="dot" style={{ background: idx.color(n.id) }} /><b>{n.title}</b>{found && <small>{idx.text(n.id)}</small>}
            </button>
          </div>
        );
      })}
      {found && !found.length && <p className="hint">No level matches “{q}”.</p>}
    </div>
  );
}

function LevelField({ id, onClick, label = 'Level' }) {
  const { idx } = useApp();
  const n = id && idx.byId.get(id);
  return (
    <button type="button" className="lvlfield" onClick={onClick}>
      <small>{label}</small>
      {n ? <b><i className="dot" style={{ background: idx.color(id) }} />{n.title}</b> : <b className="ph">Choose a level</b>}
      {n && <span>{idx.text(id)}</span>}
      <Ic n="chevron_right" />
    </button>
  );
}

const Field = ({ label, children }) => <label className="field">{children}<span>{label}</span></label>;

export function Prompt({ d }) {
  const { closeDlg } = useApp();
  const [v, setV] = useState(d.value || '');
  const [sw, setSw] = useState(!!(d.sw && d.sw.on));
  const submit = () => v.trim() && closeDlg(() => d.onSubmit(v, sw));
  return (
    <Modal title={d.title} onClose={closeDlg} small>
      <div className="form">
        <Field label={d.label}>
          {d.multi
            ? <textarea autoFocus rows={5} value={v} onChange={(e) => setV(e.target.value)} placeholder=" " />
            : <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder=" " />}
        </Field>
        {d.hint && <p className="hint">{d.hint}</p>}
        {d.sw && <Switch on={sw} onChange={setSw} label={d.sw.label} />}
        <div className="btns"><button className="btn text" onClick={() => closeDlg()}>Cancel</button><button className="btn" disabled={!v.trim()} onClick={submit}>{d.cta || 'Save'}</button></div>
      </div>
    </Modal>
  );
}

export function Confirm({ d }) {
  const { closeDlg } = useApp();
  return (
    <Modal title={d.title} onClose={closeDlg} small>
      <div className="form">
        <p>{d.body}</p>
        <div className="btns"><button className="btn text" onClick={() => closeDlg()}>Cancel</button><button className={`btn${d.danger ? ' danger' : ''}`} onClick={() => closeDlg(d.onYes)}>{d.cta}</button></div>
      </div>
    </Modal>
  );
}

// One form for: new manual entry, editing a log, and finishing a timer session.
export function LogForm({ d }) {
  const { closeDlg, act, today } = useApp();
  const i = d.init, mins0 = Math.round((i.seconds || 0) / 60);
  const [node, setNode] = useState(i.node_id);
  const [h, setH] = useState(mins0 >= 60 ? String(Math.floor(mins0 / 60)) : '');
  const [m, setM] = useState(mins0 ? String(mins0 % 60) : '');
  const [date, setDate] = useState(i.log_date);
  const [note, setNote] = useState(i.note || '');
  const [pick, setPick] = useState(false);
  const [sure, setSure] = useState(false);
  const secs = ((parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)) * 60;
  const add = (x) => { const t = Math.min(99 * 60 + 59, secs / 60 + x); setH(String(Math.floor(t / 60) || '')); setM(String(t % 60)); };
  const bad = !node ? 'Choose a level' : secs < 60 ? 'Enter at least 1 minute' : !date ? 'Pick a date' : date > today ? 'Dates in the future are not allowed' : '';
  const title = d.mode === 'session' ? 'Finish session' : d.mode === 'edit' ? 'Edit study log' : 'Log study time';
  if (pick) return <Modal title="Choose a level" onClose={() => setPick(false)}><Picker value={node} onPick={(id) => { setNode(id); setPick(false); }} /></Modal>;
  return (
    <Modal title={title} onClose={closeDlg}>
      <div className="form">
        <LevelField id={node} onClick={() => setPick(true)} label="Studied" />
        <Field label="Date"><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} placeholder=" " /></Field>
        <div className="dur">
          <Field label="Hours"><input type="number" inputMode="numeric" min="0" max="99" value={h} onChange={(e) => setH(e.target.value)} placeholder=" " /></Field>
          <Field label="Minutes"><input type="number" inputMode="numeric" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} placeholder=" " /></Field>
        </div>
        <div className="chips">{[15, 30, 60].map((x) => <button key={x} type="button" className="chip" onClick={() => add(x)}>+{x === 60 ? '1 h' : `${x} min`}</button>)}</div>
        {d.mode === 'session' && i.seconds > 4 * 3600 && <p className="hint warn">That is a long session. Please check the duration before saving.</p>}
        <Field label="Notes (optional)"><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder=" " /></Field>
        <p className="hint">Notes are saved under the level you studied.</p>
        {bad && <p className="hint warn">{bad}</p>}
        <div className="btns">
          {d.mode === 'edit' && <button className="btn text danger-t" onClick={() => closeDlg(() => act.delLog(i.id))}>Delete</button>}
          {d.mode === 'session' && <button className="btn text danger-t" onClick={() => (sure ? closeDlg(() => act.timerClear()) : setSure(true))}>{sure ? 'Tap again to discard' : 'Discard'}</button>}
          <button className="btn" disabled={!!bad} onClick={() => closeDlg(() => act.saveLog({ id: i.id, node_id: node, log_date: date, seconds: secs, source: i.source || 'manual' }, note, d.mode === 'session'))}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

export function NoteForm({ d }) {
  const { closeDlg, act } = useApp();
  const n = d.note;
  const [node, setNode] = useState(n ? n.node_id : d.node_id || null);
  const [body, setBody] = useState(n ? n.body : '');
  const [pick, setPick] = useState(false);
  if (pick) return <Modal title="Choose a level" onClose={() => setPick(false)}><Picker value={node} onPick={(id) => { setNode(id); setPick(false); }} /></Modal>;
  return (
    <Modal title={n ? 'Edit note' : 'New note'} onClose={closeDlg}>
      <div className="form">
        <LevelField id={node} onClick={() => setPick(true)} label="Belongs to" />
        <Field label="Note"><textarea autoFocus rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder=" " /></Field>
        <p className="hint">Links you type, like https://example.com, become tappable.</p>
        <div className="btns">
          {n && <button className="btn text danger-t" onClick={() => closeDlg(() => act.delNote(n.id))}>Delete</button>}
          <button className="btn" disabled={!node || !body.trim()} onClick={() => closeDlg(() => act.saveNote({ id: n && n.id, node_id: node, body }))}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

export function PickLevel({ d }) {
  const { closeDlg } = useApp();
  return <Modal title={d.title} onClose={closeDlg}><Picker value={d.value} exclude={d.exclude} root={d.root} onPick={(id) => closeDlg(() => d.onPick(id))} /></Modal>;
}

export function CfgForm({ value, onChange }) {
  const set = (p) => onChange({ ...value, ...p });
  const tpl = value.template;
  return (
    <div className="form">
      <h3>Default checklist</h3>
      <p className="hint">New levels can start with these items. Every checklist can still be changed level by level.</p>
      {tpl.map((t, i) => (
        <div className="row2" key={i}>
          <Field label={`Item ${i + 1}`}><input value={t} onChange={(e) => set({ template: tpl.map((x, j) => (j === i ? e.target.value : x)) })} placeholder=" " /></Field>
          <button className="ib" aria-label="Remove item" onClick={() => set({ template: tpl.filter((_, j) => j !== i) })}><Ic n="close" /></button>
        </div>
      ))}
      <button className="btn tonal" onClick={() => set({ template: [...tpl, ''] })}><Ic n="add" />Add item</button>
      <h3>How completion % is worked out</h3>
      {[['items', 'By checklist items', 'Every checklist item counts the same, so a chapter with 10 items weighs more than one with 2.'],
        ['equal', 'Equal per level', 'Every level under a parent counts the same, however many items it has.']].map(([k, t, s]) => (
        <button key={k} type="button" role="radio" aria-checked={value.mode === k} className={`radio${value.mode === k ? ' on' : ''}`} onClick={() => set({ mode: k })}>
          <i /><span><b>{t}</b><small>{s}</small></span>
        </button>
      ))}
      <Switch on={value.implicit} onChange={(v) => set({ implicit: v })} label="Tick box for levels without a checklist" hint="Lets you mark a level done by itself when it has no checklist items." />
    </div>
  );
}

export function MandatoryForm({ list, onChange, levels }) {
  return (
    <div className="form">
      <h3>Mandatory checklist</h3>
      <p className="hint">These items are added to every level inside this course, including levels you create later. On a level they can be ticked, but not edited or deleted.</p>
      {list.map((m, i) => (
        <div className="row2" key={m.id}>
          <Field label={`Required item ${i + 1}`}><input value={m.title} onChange={(e) => onChange(list.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder=" " /></Field>
          <button className="ib" aria-label="Remove item" onClick={() => onChange(list.filter((x) => x.id !== m.id))}><Ic n="close" /></button>
        </div>
      ))}
      <button className="btn tonal" onClick={() => onChange([...list, { id: crypto.randomUUID(), title: '' }])}><Ic n="add" />Add required item</button>
      <p className="hint">{levels ? `Saving applies this list to all ${levels} level${levels > 1 ? 's' : ''} in the course. Items you remove are removed from every level.` : 'It will apply to every level you add to this course.'}</p>
    </div>
  );
}

export function CourseCfg({ d }) {
  const { idx, D, closeDlg, act } = useApp();
  const root = idx.byId.get(d.id);
  const has = !!root && !!root.settings && ['template', 'mode', 'implicit'].some((k) => k in root.settings);
  const [custom, setCustom] = useState(has);
  const [cfg, setCfg] = useState(() => ({ ...DEFAULTS, ...(D.settings || {}), ...((root && root.settings) || {}) }));
  const [mand, setMand] = useState(() => (root && root.settings && root.settings.mandatory) || []);
  if (!root) return null;
  const save = () => {
    const m = mand.map((x) => ({ ...x, title: x.title.trim() })).filter((x) => x.title);
    const { template, mode, implicit } = clean(cfg);
    closeDlg(() => act.setCourseCfg(d.id, !custom && !m.length ? null : { ...(custom ? { template, mode, implicit } : {}), mandatory: m }));
  };
  return (
    <Modal title={`${root.title} settings`} onClose={closeDlg}>
      <div className="form">
        <MandatoryForm list={mand} onChange={setMand} levels={idx.subtree(d.id).length - 1} />
        <h3>Checklist and completion</h3>
        <Switch on={custom} onChange={setCustom} label="Use custom settings for this course" hint={custom ? 'These settings apply to this course only.' : 'This course follows your global settings.'} />
        {custom && <CfgForm value={cfg} onChange={setCfg} />}
        <div className="btns"><button className="btn" onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

export function Dialogs() {
  const { dlg } = useApp();
  if (!dlg) return null;
  return {
    prompt: <Prompt d={dlg} />, confirm: <Confirm d={dlg} />, log: <LogForm d={dlg} />,
    note: <NoteForm d={dlg} />, pick: <PickLevel d={dlg} />, cfg: <CourseCfg d={dlg} />,
  }[dlg.type] || null;
}
