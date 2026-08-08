# Prompt to paste into the Homebase / Scheduler conversation

Copy everything in the box below into that conversation. It asks for the weekly
coverage view **and** the deep-link support that makes it open directly from the
Colette Ops shell tab I built.

---

**Add a "Week Coverage" view to the crew scheduler (`scheduler/index.html`).**

I need a whole-week, at-a-glance coverage view so I can instantly see who's working each day and spot gaps.

Requirements:

1. **Layout:** a 7-column grid, one column per day (use the scheduler's current week; default to the week containing today). Each day column lists every scheduled person with their shift **start–end time** (e.g., "Maria 6:00a–2:00p"). Sort each day by start time.
2. **Coverage at a glance:**
   - Show a per-day header with the **date**, **# of people**, and **total scheduled hours**.
   - Visually flag days that look **understaffed** (e.g., fewer than a configurable minimum, or any hour of the open day with nobody scheduled) — highlight in red/amber.
   - Optionally show an **opening → closing coverage bar** per day so I can see uncovered hours.
3. **Navigation:** previous / next week buttons, and a "This week" reset. Show the week range in the header (e.g., "Aug 10 – Aug 16").
4. **Data source:** use the scheduler's existing shift/assignment data model and employee names — don't invent a new store. Read the same shifts the day view uses.
5. **Roles:** admins see everyone; if an employee opens it, it's fine for them to see the coverage grid read-only (no editing from this view).
6. **Deep link (important — this is how the Colette Ops shell opens it):** when the page is loaded with **`?view=week`** in the URL (e.g., `scheduler/index.html?view=week`), it must open **directly on this weekly coverage view** after login, not the default screen. Also support `#week` as a fallback. This lets my unified app embed it as its own tab.
7. **Responsive:** works on phone (columns can scroll horizontally) and desktop.

Keep it consistent with the scheduler's existing bakery styling. After building, confirm that visiting `scheduler/index.html?view=week` lands on the weekly view.

---

## How it links into the overall app (already done on my side)

The unified **Colette Ops** app (`colette-website.vercel.app/ops.html`) already has a
**🗓️ Week Coverage** tab that loads `…/scheduler/index.html?view=week`. So the
moment the scheduler supports the `?view=week` deep link above, that tab will show
the weekly coverage view automatically — no further change needed in the Ops app.
