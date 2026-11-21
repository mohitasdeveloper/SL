# Roadmap and known limitations

## Not built (ideas the owner has not asked for yet)
Reminders and notifications · advanced analytics (heatmap, per-level trends) · daily goal and streak · exam date per course with countdown · syllabus templates published by an admin · course archive · pull-to-refresh / live multi-device sync (data loads when the app opens) · offline mode · restoring deleted items from a "trash" screen (data is kept in the DB; only Undo exists in the UI) · weekly leaderboards.

## Known limitations
- No real authentication: URL parameters identify the student (anyone with an id can open that data). A signed token checked by the database would fix it.
- Settings screen autosaves 700 ms after the last edit; global settings do not contain the mandatory list (it is per course).
- The Android wrapper must open `target=_blank` links in the external browser for note links to leave the app.
- React screens and SQL are not covered by automated tests.
- A failed batched save reloads from the server and drops unsaved local edits.

## Manual test checklist
Create course → add levels (several lines) → tick items → % and "concepts done" update → timer start/pause/finish (edit minutes, add note) → manual log (past date ok, future blocked) → totals roll up to every parent → notes search and links → delete level + Undo → mandatory item on a course (applies to existing + new levels, locked, linked up/down) → Today/Week/Month insights → CSV export → dark/light via `?theme=` → 320px and desktop widths.
