# Structured LLM Output in LeadAI: Next Steps as JSON

This document explains how LeadAI can use **structured JSON output** from the LLM (instead of or in addition to markdown tables) for **Next Steps** in board-level and governance reports. It covers the current behaviour, the proposed approach, benefits for the UI and automation (e.g. “create Jira tickets from Next Steps”), and a concrete implementation outline.

---

## 1. Current behaviour: entity/project JSON in, markdown out

### 1.1 What is sent to the LLM

For the **board-level report**, the backend already builds a rich **entity/project JSON** payload and sends it to the LLM:

- **Where:** `apps/core-svc/app/routers/ai_reports.py` — `_build_board_level_payload()` builds the payload; `get_board_level_report` appends it to the prompt as `ENTITY DATA (JSON): …`.
- **Content of the payload:**  
  - Entity context: `entity_id`, `entity_slug`, `entity_name`, `primary_role`, `risk_classification`.  
  - **Projects:** list of `{ slug, name, status, risk_level, priority, updated_at }`.  
  - **AI systems:** list of `{ id, name, project_slug, model_provider, risk_tier, status, lifecycle_stage, … }`.  
  - **Policies:** list with `policy_title`, `policy_status`, `iso42001_*`, `version_status`, `updated_at`.  
  - **Policy aggregates:** `policy_status_counts`, `policy_version_counts`, `policy_review_counts`, `policy_review_overdue`, `policy_review_due_soon`, `policy_alert_counts`.  
  - **Controls:** `total_controls`, `with_owner_email`, `with_due_date`, `with_evidence`.

So the LLM already receives **structured entity and project data** as JSON; the only “unstructured” part is the **response format**.

### 1.2 What the LLM returns today

The board-level report prompt (see e.g. `board-level-report` prompt in DB / migrations like `20260229_update_board_level_report_prompt_professional.py`) asks for:

- A full **markdown** report with sections: Executive Summary, Portfolio Overview, AI Systems Snapshot, Policy & Compliance Status, Controls & Evidence Readiness, Key Risks & Issues, **Next Steps (90 Days)**.
- For **Next Steps (90 Days)** the model is instructed to output a **markdown table** with columns: **Priority** | **Action** | **Owner** | **Due Date** | **Rationale**.

So today: **input = entity/project JSON**, **output = markdown** (including a Next Steps table).

### 1.3 How the UI uses it today

- **Where:** `apps/web/src/app/scorecard/admin/governance-dashboard-reporting/BoardLevelReportPage.tsx`.
- The UI receives `report_md` (full markdown).
- It runs **`parseNextStepsTable(report_md)`**, which:
  - Finds the `## Next Steps (90 Days)` section.
  - Parses the following lines as a **markdown table** (splitting on `|`, skipping separator lines).
  - Maps columns to `priority`, `action`, `owner`, `dueDate`, `rationale` (with header-name heuristics).
  - Returns `nextStepsRows: NextStepRow[]` and `mdWithoutNextSteps` (report with that section replaced by a short note).
- The report body is rendered with `ReactMarkdown`; the Next Steps are rendered as **cards** (priority badge, action, owner, due date, rationale).

So today the **Next Steps** are: **LLM → markdown table → regex/string parsing → UI cards**, with an important override path. The **`report_next_steps`** table is live and used for **manual overrides** of board-level next steps. The board-level report endpoint returns a `next_steps` array and merges manual steps when present; otherwise the UI still parses the markdown table. Manual steps are managed via `GET/POST/PATCH/DELETE /admin/ai-reports/next-steps`.

---

## 2. Proposed approach: structured JSON for Next Steps

### 2.1 Idea

- **Keep** sending the same (or similar) **entity/project JSON** to the LLM.
- **Ask the LLM** to return a **structured JSON** object that includes, among other things, a list of **Next Steps** with fixed fields, for example:
  - `priority` (e.g. High / Medium / Low)
  - `action` (short title or description)
  - `owner` (role or person; can be "TBD")
  - `due_date` (e.g. ISO date string or "TBD")
  - `rationale` (short reason)

Example shape:

```json
{
  "next_steps": [
    {
      "priority": "High",
      "action": "Finalise draft AI policy and get sign-off",
      "owner": "Legal / Compliance Lead",
      "due_date": "2026-03-15",
      "rationale": "Draft policy present; needed for governance alignment"
    },
    {
      "priority": "Medium",
      "action": "Assign owners to controls without designated owner",
      "owner": "TBD",
      "due_date": "2026-04-30",
      "rationale": "Only 40% of controls have owner assigned"
    }
  ]
}
```

You can either:

- **Replace** the Next Steps markdown table with this JSON (and optionally still ask for the rest of the report in markdown), or  
- **Add** this JSON block (e.g. at the end of the response or via a separate call) so you have both human-readable narrative and machine-readable next steps.

### 2.2 Why use JSON instead of a markdown table?

| Aspect | Markdown table (current) | Structured JSON |
|--------|--------------------------|-----------------|
| **Parsing** | Fragile: depends on table format, separators, column order; regex can break with model variations. | Robust: parse once as JSON; no dependency on markdown layout. |
| **Schema** | Implicit (column names in header row); easy for the model to drop or reorder columns. | Explicit schema (e.g. `priority`, `action`, `owner`, `due_date`, `rationale`); validators and types. |
| **Automation** | Need to parse markdown → map to fields → then create Jira tickets or DB rows. | Direct mapping: one JSON array → create N Jira issues or N `report_next_steps` rows. |
| **UI** | Parse then render. | Consume JSON directly; same card UI, no parsing logic. |
| **I18n / APIs** | Text is embedded in markdown. | Fields can be sent as-is to Jira, Assign in LeadAI, or translation pipelines. |

So: **same input (entity/project JSON), but request a structured JSON slice for Next Steps** so that the board-level and governance reports are easier to automate and the UI can render from a single source of truth.

---

## 3. Use in LeadAI in detail

### 3.1 Sending entity/project JSON to the LLM

- This is **already done** for the board-level report: `_build_board_level_payload()` builds `data_payload`; the prompt is appended with `ENTITY DATA (JSON):` + `json.dumps(data_payload, indent=2, default=str)`.
- For **governance reports** (e.g. per-project or entity-level governance requirements), the same pattern can be used: build a JSON blob (entity + project + controls + policies + frameworks) and send it in the prompt.
- So “send entity/project JSON to the LLM” is the **current input pattern**; the only change is what you **ask for in the output** (see below).

### 3.2 Asking for a structured JSON response (Next Steps)

- **Prompt design:** In the board-level (and optionally governance) prompt, add an explicit instruction and schema, for example:
  - “In addition to the markdown report, output a JSON block (or only a JSON block for the Next Steps section) with the following shape: `{ "next_steps": [ { "priority", "action", "owner", "due_date", "rationale" }, ... ] }`. Use only the fields listed; use 'TBD' for owner or due_date when not known.”
- **Response format (when the provider supports it):**  
  - **OpenAI:** Use `response_format: { type: "json_object" }` (or a JSON schema) so the model returns valid JSON.  
  - **Ollama:** Prefer models that support JSON mode or a strict “respond only with JSON” instruction; optionally wrap the response in a code block and parse the inner JSON.
- **Parsing:**  
  - If the LLM returns **only** the Next Steps as JSON, parse the response as `JSON.parse(...)` (frontend) or `json.loads(...)` (backend).  
  - If the LLM returns **markdown + JSON**, either: (a) ask for a clearly delimited block (e.g. ````json ... ````) and extract it, or (b) run a separate “Next Steps only” request that returns just the JSON.  
- **Validation:** Validate the parsed list against the expected schema (e.g. required fields, allowed priorities, date format) and reject or fix malformed items before storing or sending downstream.

So in LeadAI terms: **same `generate_text()` (or a dedicated helper), same entity/project JSON input, but with a prompt and response_format that yield a list of `{ priority, action, owner, due_date, rationale }` instead of relying on a markdown table.**

### 3.3 Rendering in the UI

- **Current:** The UI parses markdown to get `NextStepRow[]` and then renders cards.
- **With JSON:** The API can return `report_md` (narrative) **and** `next_steps: Array<{ priority, action, owner, due_date, rationale }>`.
  - The frontend **skips** `parseNextStepsTable(report_md)` for Next Steps and instead uses `next_steps` from the API response.
  - The same card layout (priority badge, action, owner, due date, rationale) can be driven from `next_steps`; no markdown parsing needed for this section.
- **Backward compatibility:** If the API still returns only `report_md`, the UI can fall back to `parseNextStepsTable(report_md)` until all clients and report types use the new contract.

So: **render in the UI** = use the structured list from the API as the single source for the “Next Steps (90 Days)” block; the rest of the report stays markdown.

### 3.4 Making board-level and governance reports easier to automate

Once Next Steps are a **list of structured objects** in the API response (or in the DB), you can:

- **Create Jira tickets from Next Steps:**  
  - For each item in `next_steps`, call Jira’s API to create an issue: title ← `action`, description ← e.g. `rationale` + optional link back to LeadAI, assignee/custom field ← `owner` if mapped, due date ← `due_date`, priority ← `priority`.  
  - This can be a “Create Jira tickets” button on the board-level report page that: (1) reads `next_steps` from state or API, (2) maps fields to Jira, (3) shows progress and links to created issues.

- **Assign in LeadAI:**  
  - Persist `next_steps` into the existing **`report_next_steps`** table (entity_id, report_key, priority, title, owner, due_date, detail).  
  - The UI can then offer “Save as action plan” so users can edit owners/dates and track completion inside LeadAI; the same rows can later be used for reminders or for “Create Jira tickets” (reading from DB instead of from the last LLM response).

- **Multi-entity roll-up:**  
  - If you generate a report per entity and each returns `next_steps`, you can aggregate them (e.g. by priority, by owner) into a single view or export (e.g. CSV/Excel) for leadership.

- **Scheduled reports and integrations:**  
  - Batch or scheduled report runs (e.g. `llm_report_batch`) can store `next_steps` in the DB; downstream jobs or webhooks can create Jira tickets or notify owners without manual copy-paste.

So: **structured JSON (e.g. list of { priority, action, owner, due_date, rationale }) is what makes “create Jira tickets from Next Steps” and “Assign in LeadAI” straightforward** — one loop over the array, one mapping to the external system or to `report_next_steps`.

---

## 4. Summary

| Topic | Detail |
|-------|--------|
| **Input** | Entity/project JSON is already sent to the LLM for the board-level report (`_build_board_level_payload` + prompt in `ai_reports.py`). Same pattern can be used for governance reports. |
| **Output today** | LLM returns markdown; Next Steps are a markdown table; UI parses that table into `NextStepRow[]` and renders cards. |
| **Output proposed** | Ask the LLM for a **structured JSON** list of Next Steps, e.g. `{ "next_steps": [ { "priority", "action", "owner", "due_date", "rationale" }, ... ] }`, via prompt + JSON response format where supported. |
| **Rendering in the UI** | API returns `next_steps` array; UI uses it directly for the “Next Steps (90 Days)” block instead of parsing markdown; same card layout. |
| **Automation** | Structured list enables: **Create Jira tickets** (map each item to an issue), **Assign in LeadAI** (persist into `report_next_steps`), roll-ups and scheduled integrations. |

This document does not prescribe a specific implementation order; it explains the **possible LLM usage** (entity/project JSON in → structured JSON out for Next Steps) and how that supports both **rendering in the UI** and **automation (e.g. create Jira tickets from Next Steps)** in LeadAI.
