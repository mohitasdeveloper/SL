# Study Log

A mini app for students: organise courses into nested levels, track completion with checklists, and measure real study time.
It runs inside the **EC_NATIVE** student app (Android WebView) as a "mini app", and also works in any browser.

**Stack:** Next.js 14 (app router, plain JavaScript, no TypeScript, no Tailwind) · Supabase (Postgres + RPC functions only) · plain CSS · Vercel.

## Start here (humans and AI)
1. Read `AGENTS.md` (rules for contributors), then `docs/PRODUCT.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`.
2. `docs/study_log_product_concept.md` is the original product brief, unchanged.
3. `docs/ROADMAP.md` lists what is not built yet and known limitations.
4. `docs/PROMPT.md` is a ready-to-paste prompt for continuing the work with an AI assistant.

## Run it
```bash
npm install
cp .env.example .env.local        # Study Log's OWN Supabase project URL + anon key
npm run dev
npm test                          # engine tests (pure logic)
```
Supabase: create a project, run `supabase/schema.sql` in the SQL editor (safe to run again on an existing project; it only adds what is new).
Vercel: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` **before** the first build, or the build fails with "Invalid supabaseUrl".

## How users get in (no login screen)
The host app opens the mini app with URL parameters:
`/?student_id=…&name=…&course=…&dp_url=…&theme=dark|light`
- `student_id` is shifted by 5489 in the host app; the real id is `student_id - 5489` (`realId()` in `lib/supabase.js`, one constant `ID_OFFSET`).
- `theme` forces dark/light, otherwise the device setting is used.
- Anyone who knows a student id can open that student's data (no real auth). This was accepted for now; signed links are a possible upgrade.

## Folder map
```
app/page.js          app shell: data state, hash routing, dialogs, all actions (act.*), save queue
app/globals.css      the whole design system (tokens, components, responsive layout)
components/screens.js  Home, Courses, NodeView, TimerView, History, Notes, Settings, Help
components/dialogs.js  Picker, Prompt, Confirm, LogForm, NoteForm, CfgForm, MandatoryForm, CourseCfg
components/parts.js    CheckRow, LogRow, NoteCard      components/ui.js  shared UI bits
lib/engine.js        pure logic: hierarchy index, completion, time roll-up, linking, comparisons (tested)
supabase/schema.sql  tables + RPC functions (the only API)
scripts/             test-engine.mjs (npm test), check.cjs (syntax/undefined-name check)
docs/                product, decisions, architecture, design, roadmap, prompt
```
