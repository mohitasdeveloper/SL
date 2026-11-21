// Tests for lib/engine.js (the pure logic). Run: npm test   (node scripts/test-engine.mjs)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// engine.js uses ES module syntax but the project is not "type: module", so import a temporary .mjs copy
const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), `engine-${process.pid}.mjs`);
fs.copyFileSync(path.join(here, '../lib/engine.js'), tmp);
const { build, rangeStats, compare, linkItems, parts, dur, weekStart, addDays } = await import(pathToFileURL(tmp));
fs.unlinkSync(tmp);

const node = (id, parent, pos = 0) => ({ id, parent_id: parent, title: id, position: pos, done: false, settings: null, created_at: '2026-01-0' + (pos + 1) });
const item = (n, i, done = false, tpl = null) => ({ id: `${n}-${i}`, node_id: n, title: i, done, position: 0, tpl_id: tpl });
const data = (nodes, items, logs = [], settings = {}) => ({ settings, timer: null, nodes, items, logs, notes: [] });
const t = (name, fn) => { fn(); console.log('ok  ', name); };

t('time rolls up to every parent and is counted once', () => {
  const D = data([node('ca', null), node('tax', 'ca'), node('dep', 'tax'), node('bc', null, 1)], [],
    [{ id: 'l', node_id: 'dep', log_date: '2026-11-16', seconds: 2700 }]);
  const ix = build(D);
  ['ca', 'tax', 'dep'].forEach((id) => assert.equal(ix.stats.get(id).sec, 2700));
  assert.equal(ix.stats.get('bc').sec, 0);
  assert.equal(rangeStats(D, ix, null).total, 2700);
});

t('completion: items mode, equal mode, implicit tick box', () => {
  const nodes = [node('c', null), node('a', 'c'), node('b', 'c', 1)];
  const items = [item('a', '1', true), item('a', '2', true), item('a', '3'), item('a', '4')];   // a = 2/4, b has no items
  assert.equal(build(data(nodes, items)).stats.get('c').pct, 2 / 5);                                  // b counts as 1 implicit item
  assert.equal(build(data(nodes, items, [], { implicit: false })).stats.get('c').pct, 0.5);
  assert.equal(build(data(nodes, items, [], { mode: 'equal' })).stats.get('c').pct, 0.25);           // mean of 0.5 and 0
});

t('mandatory items are linked through the levels (up and down)', () => {
  const nodes = [node('course', null), node('sub', 'course'), node('mod', 'sub'), node('ch', 'mod'), node('k1', 'ch'), node('k2', 'ch', 1)];
  let items = ['sub', 'mod', 'ch', 'k1', 'k2'].map((n) => item(n, 'Revision', false, 'T'));
  const step = (toggled) => {
    const ps = linkItems(items, build(data(nodes, items)), toggled);
    items = items.map((i) => { const p = ps.find((q) => q.id === i.id); return p ? { ...i, done: p.done } : i; });
    return Object.fromEntries(items.map((i) => [i.node_id, i.done]));
  };
  assert.deepEqual(Object.values(step({ id: 'sub-Revision', done: true })), [true, true, true, true, true]);   // subject ticks everything
  assert.equal(step({ id: 'k1-Revision', done: false }).sub, false);                                           // one concept off -> parents off
  assert.equal(step({ id: 'k1-Revision', done: true }).sub, true);                                             // all on again -> parents on
  const nodes2 = [...nodes, node('k3', 'ch', 2)];
  nodes.push(nodes2[6]); items.push(item('k3', 'Revision', false, 'T'));
  assert.equal(step(null).ch, false);                                                                          // a new unticked concept un-ticks the chapter
});

t('a linked parent item is not counted twice in the percentage', () => {
  const nodes = [node('c', null), node('s', 'c'), node('k1', 's'), node('k2', 's', 1)];
  const items = ['s', 'k1', 'k2'].map((n) => item(n, 'Revision', n !== 'k2', 'T'));
  const s = build(data(nodes, items)).stats.get('s');
  assert.deepEqual([s.done, s.total], [1, 2]);
});

t('today / week / month comparison reads the per-day totals', () => {
  const D = data([node('c', null), node('k', 'c')], [], [
    { node_id: 'k', log_date: '2026-11-21', seconds: 720 }, { node_id: 'k', log_date: '2026-11-20', seconds: 5 * 3600 + 44 * 60 },
    { node_id: 'k', log_date: '2026-11-19', seconds: 6 * 3600 + 60 }, { node_id: 'k', log_date: '2026-11-18', seconds: 7200 }]);
  const day = rangeStats(D, build(D), null).day;
  assert.deepEqual(compare(day, '2026-11-21', 'today'), { cur: 720, prev: 20640, vs: 'yesterday' });
  const w = compare(day, '2026-11-21', 'week');                      // Saturday: Mon-Sat vs last Mon-Sat
  assert.equal(w.cur, 720 + 20640 + 21660 + 7200);
  assert.equal(w.prev, 0);
  assert.equal(compare(day, '2026-11-21', 'month').cur, w.cur);
  assert.equal(compare(day, '2026-11-21', 'all').prev, null);
});

t('dates, durations, links', () => {
  assert.equal(weekStart('2026-11-21'), '2026-11-16');               // weeks start on Monday
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dur(2700), '45m'); assert.equal(dur(3590), '1h 0m');
  assert.deepEqual(parts('see https://a.com/x, ok').filter((p) => p.href).map((p) => p.href), ['https://a.com/x']);
  assert.equal(parts('www.b.org.').find((p) => p.href).href, 'https://www.b.org');
});
console.log('all engine tests passed');
