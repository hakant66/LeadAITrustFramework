# How to Create "Safety Score for the Latest Week" for All Projects

Trend alerts (e.g. **pillar:safety &lt; 20%**) need **control_values_history** rows for controls that belong to the **Safety** pillar. The alert worker reads the latest week bucket and averages `normalized_pct` for those controls.

**How the data gets there**

- The **control_values** table holds current KPI/control values per project.
- A **database trigger** copies every INSERT/UPDATE on **control_values** into **control_values_history** (with `entity_id`, timestamps, etc.).
- So: **any write to control_values** (for a Safety-pillar control) creates history and contributes to "Safety score for the latest week" for that project.

---

## Option 1: Scorecard UI (per project)

For each project where you want a Safety score:

1. Open the **project scorecard/dashboard** (e.g.  
   `https://dev.theleadai.co.uk/blueprint-limited/scorecard/<project-slug>/dashboard` or the **KPIs admin** page for that project).
2. Find KPIs that belong to the **Safety** pillar (pillar name "Safety" in the UI).
3. **Enter or update** at least one raw value for a Safety KPI and save.

That triggers a **POST** to `/scorecard/{project_slug}` with the score, which **upserts control_values** → trigger → **control_values_history**. The next run of the alert worker (or diagnostic) will see a Safety value for that project’s latest week.

**Entity-scoped URL pattern:**  
`/{entitySlug}/scorecard/{project_slug}/dashboard` or the KPIs admin / control execution page for that project.

---

## Option 2: Admin control values import (Excel)

If your setup has **Admin → import control values** (Excel) per project:

1. Get the list of **Safety pillar** controls (e.g. from **Control Register** or API `GET /scorecard/{project_slug}/controls` and filter by `pillar === 'Safety'`).
2. For each project, upload an Excel file that includes at least one **control_id** (or kpi_key) that maps to a Safety control, with a **raw_value**.
3. The import **inserts/updates control_values** → trigger → **control_values_history**.

Repeat for every project you want to have a Safety score.

---

## Option 3: API in bulk (script or tool)

You can generate "Safety score for the latest week" for all projects by calling the scorecard API for each project with at least one Safety-pillar KPI:

1. **List projects** for the entity (e.g. `GET /projects?entity_id=<entity_id>`).
2. **List Safety pillar KPIs**: e.g. `GET /scorecard/{any_project_slug}/controls` and take `kpi_key` where `pillar === 'Safety'` (or query the DB: `SELECT kpi_key FROM controls c JOIN pillars p ON lower(trim(p.name)) = lower(trim(c.pillar)) WHERE lower(p.key) = 'safety'`).
3. For **each project**, call:
   - **POST** `/scorecard/{project_slug}?entity_id=<entity_id>`
   - Body: `{ "updates": [ { "kpi_key": "<safety_kpi_key>", "raw_value": <number> } ] }`  
   Use a real value (e.g. 50) or a value from existing data. The backend normalizes it and writes **control_values** → trigger → **control_values_history**.

Use a script (curl, Python, etc.) with the same auth (e.g. session cookie or API token) the app uses.

---

## Summary

| Goal | Action |
|------|--------|
| **Safety score for one project** | In the UI: open that project’s scorecard/KPIs and enter or update at least one Safety-pillar KPI value. |
| **Safety score for all projects** | Do Option 1 for each project, or use Option 2 (import) per project, or Option 3 (script that POSTs one Safety KPI per project). |

There is no single "Create Safety score for all projects" button. The system is designed so that **control values are entered per project** (scorecard submission or import); the trigger then fills **control_values_history**, and the alert worker reads the latest week from that history.

---

## Verify

After creating data:

- **Run the diagnostic** on the [Intelligent Alerts & Trends](https://dev.theleadai.co.uk/blueprint-limited/scorecard/admin/alerts) page: **Run alerts diagnostic**. For each project you should see a **value** (e.g. `value=45.2`) instead of `value=—` when Safety data exists for the latest week.
- The **alert worker** runs every 5 minutes; once **value** is below your threshold (e.g. 20%), a trend alert will be created.
