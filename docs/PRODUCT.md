# Product

**Study Log** = hierarchical academic progress tracker + study time logger. Original brief: `docs/study_log_product_concept.md` (unchanged). This file records what is built and the exact rules.

## Concepts
- **Course** = top-level item. Everything under it is a **level**; there is no fixed naming (Subject/Module/Chapter/Concept are only examples) and **no depth limit**. A "concept" in the dashboard means a leaf level with a checklist.
- **Checklist item**: a tickable line on any level. Optional on every level. A level with no children and no items gets one tick box ("implicit", can be turned off in settings).
- **Study log**: minutes studied on any level on a date (timer or manual). Stored once.
- **Note**: free text on any level; may link to the study log it was written in.

## Rules (all implemented)
**Completion** (`build()` in `lib/engine.js`)
- Completed = everything inside is done; partial = some; pending = none; "no checklist" = nothing to track.
- Default % = done items / all items in the subtree ("items" mode). Alternative "equal" mode: each child level counts the same (mean of children's %). Setting `implicit` controls the single tick box. Global defaults + per-course override (course value wins).
- Logging time never completes anything.
- "Concepts done" = leaf levels at 100%. Overall completion = sum of done items / sum of items across courses.

**Mandatory checklist** (per course, managed in the course settings)
- A list of `{id, title}` stored in the course's `settings.mandatory`. Every level inside the course (not the course itself), existing and future, carries these items (`sl_items.tpl_id` = the setting item's id). They can be ticked but not edited or deleted on the level.
- Editing the list renames/removes/adds the items on every level (`sl_sync`). Moving a level to another course re-syncs it.
- **Linked through the levels:** ticking an item on a level ticks it on every level inside; a level's item is ticked exactly when every level inside it is ticked; unticking one unticks the levels above. A new unticked level un-ticks its parents; deleting the last unticked one can tick them. (`linkItems()`.)
- A linked parent item is **not counted** in the percentage (only the bottom levels count) so it isn't counted twice.

**Time**
- Timer: start, pause, resume, finish. One at a time, stored in `sl_users.timer` so it survives closing the app. Finishing opens a form where duration, date and notes can be corrected before saving. Over 4 hours shows a warning. Under 1 minute cannot be saved.
- Manual entry on any level: hours + minutes, any past date, never future.
- Roll-up: a log counts in its level and every ancestor (`rangeStats()`); each log is counted once in totals.

**Dashboard (Home)**: ranges Today / This week / This month / All time. Hero shows study time, the comparison with the previous period (yesterday; same days last week; same days last month; average per study day for All time), sessions and levels studied. Then concepts done, overall completion, today's sessions (Today only), a daily/weekly chart, time by course, most studied levels, quick start (last 5 topics). Comparison numbers come from the same per-day totals as the chart (`compare()`).

**Notes**: on any level (Add note on the level, or while finishing a session, or the Notes tab). Notes tab groups by level, with one global search (note text, level path). Plain-text links (`https://…`, `www.…`) are tappable and open in a new tab.

**History**: logs grouped by date, filter by course, export CSV (Date, Course, Level, Path, Minutes, Duration, Source, Notes).

**Delete**: soft delete + Undo toast (7 s). Deleting a level deletes its time and everything inside.

**Help**: in-app guide (`Help` in `components/screens.js`) and an "Load an example course" button (creates "Example: B.Com").
