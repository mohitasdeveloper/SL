'use client';
import { useEffect, useState } from 'react';
import { parts } from '../lib/engine';

export const Ic = ({ n, fill, className = '' }) => <span aria-hidden="true" className={`ms${fill ? ' fill' : ''} ${className}`}>{n}</span>;

export const Header = ({ title, sub, children }) => (
  <header className="hdr"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="hact">{children}</div></header>
);

export const Bar = ({ value, color }) => <div className="bar"><i style={{ width: `${Math.round((value || 0) * 100)}%`, background: color }} /></div>;

export function Ring({ value, size = 120, stroke = 10, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={h} cy={h} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
        <circle cx={h} cy={h} r={r} className="ring-fg" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value || 0))} transform={`rotate(-90 ${h} ${h})`} />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}

function Hl({ t, q }) {
  if (!q) return t;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return t.split(re).map((s, i) => (i % 2 ? <mark key={i}>{s}</mark> : s));
}

// Note text: plain-text links become clickable (opened in a new tab/outside the app) and search hits are highlighted.
export const Text = ({ text, q }) => parts(text).map((p, i) => p.href
  ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{p.t}</a>
  : <Hl key={i} t={p.t} q={q} />);

export function Modal({ title, onClose, children, small }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`panel${small ? ' small' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="phd"><button className="ib" aria-label="Close" onClick={onClose}><Ic n="close" /></button><h2>{title}</h2></header>
        <div className="pbd">{children}</div>
      </div>
    </div>
  );
}

export function Menu({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu-wrap">
      <button className="ib" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Ic n="more_vert" /></button>
      {open && (
        <>
          <div className="shade" onClick={() => setOpen(false)} />
          <div className="menu" role="menu">
            {items.filter(Boolean).map((m) => (
              <button key={m.label} role="menuitem" className={m.danger ? 'danger' : ''} onClick={() => { setOpen(false); m.onClick(); }}><Ic n={m.icon} />{m.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const Switch = ({ on, onChange, label, hint }) => (
  <button type="button" role="switch" aria-checked={on} className={`sw${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
    <span className="sw-l"><b>{label}</b>{hint && <small>{hint}</small>}</span><span className="sw-t"><i /></span>
  </button>
);

export const Check = ({ on, onChange, label }) => (
  <button type="button" role="checkbox" aria-checked={on} aria-label={label} className={`cb${on ? ' on' : ''}`} onClick={() => onChange(!on)}><Ic n="check" /></button>
);

export const Empty = ({ icon, title, children }) => (
  <div className="empty"><div className="empty-i"><Ic n={icon} /></div><h3>{title}</h3><div className="empty-t">{children}</div></div>
);
