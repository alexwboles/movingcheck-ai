# MovingCheck AI — Redesign Audit (2026-10-13)

Competitors researched: **MoveAdvisor**, **Sortly / Moving Checklist app** (label printing, box inventory with rooms), **MyMovingReviews-style planners** (mover comparison, moving-day timeline).

## Visual gaps vs competitors
1. The hero showed "% complete" ring but buried the emotional core — the **countdown**. MoveAdvisor leads with the date pressure; a big T-minus number was missing.
2. The plan tab opened straight into the 8-week route — no **"do this now"** focus. Competitors lead with today's/this-week's tasks.
3. Box inventory had no **printable labels** — the Sortly-grade "stick it on the box" output movers actually use.

## Functional gaps vs competitors
1. No focus view: overdue + due-this-week tasks required scrolling the whole route to find.
2. No label printing for boxes.
3. (Kept as-is, already strong: mover comparison, budget tracker, address checklist, moving-day run sheet, supplies estimator, ICS export.)

## Redesign plan
- **"Up next" panel** at the top of the Countdown plan tab: overdue tasks (red-flagged) + due within the next 7 days, each with working checkboxes; grounded in a new pure, tested `focusTasks(plan, doneIds, todayISO)` in logic.js.
- **Countdown hero**: big T-minus days number beside the progress ring ("T–23"), keeping all existing stats.
- **Print box labels**: per-box label cards (big label, room, fragile/first-night badges) via a dedicated print mode — prints cleanly, one label per card.
- All existing features preserved: week-grouped plan + search + custom tasks + ICS, box inventory + room filter + search + CSV, movers + booking, budget + expenses, address checklist, run sheet, supplies estimator.

## Concept (1 paragraph)
Keep "The Long Haul" identity (burnt amber #c2410c, warm paper, route-station timeline) but lead with urgency like MoveAdvisor: a big T-minus countdown in the hero, an "Up next" focus panel that answers "what do I do today?", and Sortly-grade printable box labels — so it feels like the moving-day command center that also hands you the tape gun.
