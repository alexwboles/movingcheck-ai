# MovingCheck AI

Your moving-day copilot. Set a moving date and get an 8-week countdown checklist, a box inventory with a first-night essentials highlight, and a mover quote comparison — all in one page.

**100% local.** No account, no API keys, no network calls. Your move details never leave the browser (saved in localStorage).

## Features

- **8-week countdown plan** — 36 tasks across declutter, packing, admin, research, and moving day, each auto-dated from your moving date with overdue highlighting
- **Progress tracking** — live completion % with per-week counts
- **Box inventory** — label boxes, assign rooms, list contents, flag fragile; mark your first-night essentials box (with a suggested packing list)
- **Custom tasks** — add your own tasks to any week (with category), searchable alongside the built-in plan
- **Mover comparison** — collect quotes + ratings + notes, auto-ranked cheapest-first with a best-quote badge
- **Packing supplies estimator** — rough boxes/tape/wrap counts from your bedroom count
- **Room filter** — filter the box inventory by room, with per-room counts
- **CSV export** — download the box inventory or mover quotes as CSV
- **Printable** — clean print CSS for the checklist and box list

## Run it

Just open `index.html` in a browser — no build step. Or serve locally:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Tests

```bash
bash test/smoke.sh   # 13 checks
bash test/e2e.sh     # 11 flows
```

## Optional AI enhancement

Set an `OPENAI_API_KEY` in a future settings panel to generate custom tasks — the app works fully without any key.

## License

MIT
