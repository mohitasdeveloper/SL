# Design

**Look:** Google Material (3-ish), Google Sans Text / Roboto, Material Symbols Rounded icons (loaded in `globals.css`). Tokens are CSS variables (`--p` primary, `--pc` primary container, `--s1..s3` surfaces, `--t`/`--t2` text, `--o` outline, `--ok/--warn/--err`) with a dark set under `[data-theme=dark]` set by `applyTheme()` from `?theme=`. Course colours: `COLORS` in `lib/engine.js` (one per course, stable by order).

**Layout:** mobile first. Bottom bar (Home, Courses, Timer, Notes, History) under 840px; side rail from 840px; content column max 760px. Safe-area insets respected. FABs sit above the bar.

**Dialogs:** full-screen on phones (except small prompts/confirms, centred), centred cards on larger screens. No bottom sheets. Menus are anchored popovers.

**Motion:** 150–300 ms ease-out; views fade/slide in; bars and rings animate; check boxes, switches and dialogs have small transitions. `prefers-reduced-motion` turns it off.

**Usability rules:** touch targets ≥ 44px (icon buttons 36px only in dense rows); text contrast ≥ 4.5:1; every icon-only button has an `aria-label`; empty states explain what to do next; destructive actions are confirmed and undoable; long text wraps (`overflow-wrap:anywhere`), nothing scrolls sideways; tabs/switches use proper roles.
