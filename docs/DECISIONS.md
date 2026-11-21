# Decisions log (owner's answers, in order)

Update this file whenever the owner decides something new.

## Ecosystem
- Study Log is one of several mini apps in the EC_NATIVE student app (others: Plastic Log, EcoPay, Zip). Each has its **own Supabase project**, is a Next.js app, uses **URL-parameter login** (`student_id, name, course, dp_url, theme`), a Google/Material look and an Android-native feel. Mini apps open full screen and must close with proper back navigation.
- The `student_id` in the URL has 5489 added; subtract it (also done in Plastic Log).

## Initial build (from the concept doc)
- Login/stack/ID handling: same as the other apps. Privacy: personal data only, no admin or teacher view; accepted that URL-param identity is not secure.
- Hierarchy: **no depth limit**; levels are user-named, can be created, renamed, moved, reordered. Many levels can be added at once (one per line).
- Delete: **deleting a level also deletes its logged time**. **Soft delete for everything** (`is_deleted`), never hard delete. (Undo was added on top.)
- Completion: the proposed rule is the default; add a **general setting and per-course settings** to change it (default checklist, % mode, implicit tick box).
- Manual entry on all levels; past dates allowed, **no future dates**. Timer + manual both required.
- IST time zone; week starts Monday.
- Included extras: **quick start** (start timer from any level; recent topics) and **CSV export**. Not included (not chosen): daily goal/streak, exam countdown, syllabus templates.
- **Notes on every level**, also writable inside a study log and shown under the level they belong to; **one global notes search**; links in plain text must be clickable and open outside the app.
- UI/UX must be "super professional": best usability, all screen sizes, good colour combinations, smooth transitions, easy to understand; plus a **help guide**.

## Later changes
- **Mandatory checklist**: items every level under a course must have, managed in the course settings (not in global settings).
- The example course is **B.Com** (not CA).
- Mandatory items are **linked** across levels (tick parent = all inside; all inside ticked = parent ticked; concepts → chapter → module → subject).
- Home shows **Today's insights** alongside week and month (Today is the default tab).
- Bug report: Today's "vs yesterday" number was wrong (showed "12m more" while yesterday had 5h 44m). Comparison now reads the same per-day totals as the chart and prints the previous total ("Yesterday: 5h 44m") so it can be checked.

## Preferences seen across the owner's apps
- No bottom sheets for dropdowns/pickers ("just make the list selection better").
- Admin/data screens should fill the width. Dark and light theme via `?theme=`.
- The owner likes being asked about doubts and suggestions before a big build, with sensible defaults offered.
