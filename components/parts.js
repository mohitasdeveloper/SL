'use client';
import { Ic, Check, Text } from './ui';
import { useApp } from './ctx';
import { dur } from '../lib/engine';

export function CheckRow({ item }) {
  const { act, openDlg, idx } = useApp();
  const req = !!item.tpl_id;   // mandatory: ticked like any other item, but set in the course settings
  const edit = () => openDlg({ type: 'prompt', title: 'Edit checklist item', label: 'Item', value: item.title, onSubmit: (v) => act.editItem(item.id, v) });
  return (
    <div className={`crow${item.done ? ' done' : ''}`}>
      <Check on={item.done} label={item.title} onChange={() => act.toggleItem(item.id)} />
      {req
        ? <div className="cmid"><span className="ctitle">{item.title}</span><span className="req">{(idx.kids.get(item.node_id) || []).length ? 'Required · linked to every level inside' : 'Required in this course'}</span></div>
        : <button className="ctitle" onClick={edit}>{item.title}</button>}
      {req
        ? <span className="lock" title="Managed in the course settings"><Ic n="lock" /></span>
        : <button className="ib sm" aria-label={`Delete ${item.title}`} onClick={() => act.delItem(item.id)}><Ic n="delete" /></button>}
    </div>
  );
}

export function LogRow({ l, path }) {
  const { idx, openDlg } = useApp();
  const n = idx.byId.get(l.node_id);
  if (!n) return null;
  return (
    <button className="lrow" onClick={() => openDlg({ type: 'log', mode: 'edit', init: { ...l } })}>
      <i className="dot" style={{ background: idx.color(l.node_id) }} />
      <span className="lt"><b>{n.title}</b>{path && <small>{idx.text(l.node_id)}</small>}</span>
      <span className="ld">{dur(l.seconds)}</span>
    </button>
  );
}

export function NoteCard({ n, q, path = true }) {
  const { idx, openDlg, act } = useApp();
  if (!idx.byId.has(n.node_id)) return null;
  return (
    <article className="note" onClick={() => openDlg({ type: 'note', note: n })}>
      {path && <div className="np"><i className="dot" style={{ background: idx.color(n.node_id) }} />{idx.text(n.node_id)}</div>}
      <p><Text text={n.body} q={q} /></p>
      <footer>
        <span>{new Date(n.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {n.log_id && <span className="tag"><Ic n="timer" />Study session</span>}
        <button className="ib sm" aria-label="Delete note" onClick={(e) => { e.stopPropagation(); act.delNote(n.id); }}><Ic n="delete" /></button>
      </footer>
    </article>
  );
}
