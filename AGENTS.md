# Instructions for AI assistants working on Study Log

Read `README.md` first, then the files in `docs/`. The owner decides product behaviour; `docs/DECISIONS.md` records what they decided. Do not reverse a decision without asking.

## Rules
1. **Keep `lib/engine.js` pure** (no React, no browser APIs except the tiny `download` helper). Every change to completion, time roll-up, linking or comparisons needs a test in `scripts/test-engine.mjs`; run `npm test`.
2. **Never hard-delete data.** Everything is soft-deleted (`is_deleted`, `deleted_at`). Deleting a level soft-deletes everything inside it (sub-levels, items, logs, notes) with one shared timestamp so Undo can restore it.
3. **Time is stored once** (`sl_logs`). Parent totals are always summed from descendant logs in the client. Never store totals.
4. **All database access goes through RPC functions** in `supabase/schema.sql`. Tables have RLS on with no policies. Keep the file re-runnable (`create table if not exists`, `create or replace function`, `add column if not exists`). When you change a function, change it there.
5. **Client updates are optimistic:** use `put()` / `remove()` in `app/page.js`; saves are batched (`sl_save_many`) and sent in order. Do not call Supabase directly from components; add an `act.*` action instead.
6. **Dates are IST** (`istDate()`), weeks start on **Monday**. Logs on future dates are not allowed (client and server).
7. **UI:** follow `docs/DESIGN.md`. No bottom sheets for pickers or dropdowns (the owner dislikes them); use anchored menus or full dialogs. Keep every screen usable from 320px wide to desktop, dark and light.
8. Plain JavaScript and plain CSS only. No new dependencies unless really needed.
9. Update `docs/` when behaviour changes, and add a line to `docs/DECISIONS.md` for any new owner decision.

## Verify before you hand back
```bash
npm test                      # engine logic
node scripts/check.cjs        # syntax + undefined names (needs: npm i -D typescript)
npm run build                 # needs the two env vars from .env.example
```
There is no browser test suite. Say plainly what you could not test.
