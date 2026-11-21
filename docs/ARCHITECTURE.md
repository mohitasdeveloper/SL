# Architecture

## Data (Supabase, `supabase/schema.sql`)
| Table | Purpose |
|---|---|
| `sl_users` | one row per student: name, course, dp_url, `settings` (global `{template, mode, implicit}`), `timer` (running timer) |
| `sl_nodes` | every level, any depth: `parent_id`, `title`, `position`, `done` (only for a level with no items), `settings` (course override, see below) |
| `sl_items` | checklist items: `node_id`, `title`, `done`, `position`, `tpl_id` (set = mandatory item; points at the course setting item's id). Mandatory items use negative positions so they sort first |
| `sl_logs` | study time, stored once: `node_id`, `log_date`, `seconds`, `source` (`manual`/`timer`) |
| `sl_notes` | `node_id`, `body`, `log_id` (set when written in a session) |

All tables have `user_id`, `is_deleted`, `deleted_at`, `created_at`. RLS is on with **no policies**: the anon key can only call these functions (all `security definer`):
`sl_open` (upsert student + return all data) · `sl_load` · `sl_save(kind, row)` (kind = node|item|log|note; checks ownership, parent validity, cycles, future dates) · `sl_save_many(rows)` · `sl_delete(kind, id)` · `sl_restore(kind, id)` · `sl_put(key, val)` (key = settings|timer) · `sl_sync(course?)` (mandatory checklist sync).

Settings model: global `sl_users.settings = {template[], mode, implicit}`. Course override `sl_nodes.settings` (course level only) is a **partial** object that may hold `template, mode, implicit, mandatory:[{id,title}]`. Effective settings = `{...DEFAULTS, ...global, ...course}` (`cfgOf()`). "Custom settings" = the course has any of template/mode/implicit.

## Client (`app/page.js` is the shell)
- State: `D` = whole dataset from `sl_open` (`settings, timer, nodes, items, logs, notes`). `idx = build(D)` is derived (memo): children, stats per level (sec, done, total, pct, status, leaf counts), course of each level, paths, colours.
- **Mutations**: `put(kind, patch)` merges into local state at once and pushes `{kind,row}` into a buffer sent as one `sl_save_many` after 40 ms; `remove(kind,id,label)` soft-deletes locally + `sl_delete` + Undo toast (`sl_restore` then reload). `rpc()` flushes the buffer first and everything runs through one **sequential queue**, so a level always exists before items inside it. Any server error shows a toast and reloads (`load()`).
- **Actions** live in `act` (add/rename/move/shift/delete level, items, logs, notes, settings, timer, `linkFix`, `syncAll`, `addExample`). Components call `act.*`, never Supabase.
- `linkFix(toggled|null)` applies `linkItems()` and is also run after first load, adding levels, deleting levels (and undo), and `syncAll`.
- **Routing**: hash routes `home | courses | n/<levelId> | timer | history | notes | settings | help`. Tabs use `location.replace`, drilling in uses `location.hash=` (so the Android back button works). One dialog at a time: opening adds `~o` to the hash; closing = `history.back()`; `closeDlg(afterFn)` runs `afterFn` once the dialog is gone. Dialog types: `prompt, confirm, log (new|edit|session), note, pick, cfg`.
- `ctx` (`components/ctx.js`) gives screens `{D, idx, me, today, route, go, swap, dlg, openDlg, closeDlg, flash, act}`.
- Timer object: `{node_id, running, started(ms), acc(ms), day('YYYY-MM-DD'), note}`; elapsed = `acc + (running ? now-started : 0)`; saved with `sl_put('timer')`.

## Engine (`lib/engine.js`, pure, tested)
`build(D)` · `rangeStats(D, idx, from)` (time per level incl. ancestors, per day) · `compare(day, today, range)` · `linkItems(items, idx, toggled)` · `parts(text)` (link detection) · date/duration helpers (`istDate, addDays, weekStart, dur, clock, niceDate`) · `csv/download`.

## Verification
`npm test` (engine), `node scripts/check.cjs` (syntax + undefined names, needs `typescript`), `npm run build` (needs env vars). Not covered by tests: the React screens and the SQL (run `supabase/schema.sql` on a scratch project to check it).

## Gotchas
- `engine.js` is ESM syntax in a non-module project; tests import a temp `.mjs` copy.
- Module-level `createClient` throws at build time if the env vars are missing.
- `position` is also a SQL keyword; it works as a column name here.
- Hash links: never end a real route with `~o`.
