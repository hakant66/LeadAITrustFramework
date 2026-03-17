# Intelligent Alerts and Trends Solution

## Overview

This document describes the **Intelligent Alerts and Trends** feature for LeadAI: configurable rules that generate alerts when score trends degrade (e.g. overall or pillar score drops below a threshold or over a time window). It integrates with the existing **trends API** and **alert worker**, and adds a unified alerts experience in the UI.

## Goals

1. **Trend-based alert rules**: Allow users to define rules such as "alert when overall project score drops below 70%" or "alert when score drops by more than 10% over the last 14 days".
2. **Entity and project scope**: Rules are scoped to an entity; optionally to a specific project (or "any project").
3. **Persistence**: Store rules and generated trend alerts in the database (Alembic migrations).
4. **Evaluation**: The existing alert worker runs trend-rule evaluation periodically and inserts/updates trend alerts.
5. **UI**: Dashboard to view all alerts (policy alerts + trend alerts) and optionally manage trend alert rules.

## Data Model

### 1. `alert_rules` (new table)

| Column           | Type         | Description |
|------------------|--------------|-------------|
| id               | UUID         | Primary key |
| entity_id        | UUID         | FK to entities; which entity this rule belongs to |
| project_slug     | TEXT (nullable) | If set, rule applies only to this project; if NULL, applies to all projects of the entity |
| name             | TEXT         | Human-readable rule name |
| rule_type        | TEXT         | `threshold` = alert when metric &lt; threshold_pct; `trend_drop` = alert when metric drops by more than threshold_pct over window_days |
| metric           | TEXT         | `overall` or `pillar:<pillar_key>` (e.g. `pillar:safety`) |
| threshold_pct    | FLOAT        | For threshold: minimum acceptable score (0–100); for trend_drop: minimum drop % to trigger (e.g. 10 = 10% drop) |
| window_days      | INT (nullable) | For trend_drop: number of days to compare (e.g. 14). Ignored for threshold. |
| severity         | TEXT         | `high`, `medium`, `low` |
| enabled          | BOOLEAN      | Default true |
| created_at       | TIMESTAMPTZ  | |
| updated_at       | TIMESTAMPTZ  | |

### 2. `trend_alerts` (new table)

| Column            | Type         | Description |
|-------------------|--------------|-------------|
| id                | UUID         | Primary key |
| entity_id         | UUID         | FK entities |
| project_slug       | TEXT         | Project this alert refers to |
| rule_id           | UUID         | FK alert_rules (nullable if rule deleted) |
| alert_type        | TEXT         | e.g. `trend_threshold`, `trend_drop` |
| severity          | TEXT         | high / medium / low |
| message           | TEXT         | Human-readable message |
| metric_value_before | FLOAT (nullable) | Value at start of window (for trend_drop) |
| metric_value_after  | FLOAT (nullable) | Current value or value at end of window |
| status            | TEXT         | `open`, `resolved` |
| created_at        | TIMESTAMPTZ  | |
| updated_at        | TIMESTAMPTZ  | |
| resolved_at       | TIMESTAMPTZ (nullable) | |
| details_json      | JSONB (nullable) | Extra context (pillar_key, window_days, etc.) |

## API (Backend)

- **GET /scorecard/alert-rules** – List alert rules for the current entity (optional filter by project_slug). Auth: viewer.
- **POST /scorecard/alert-rules** – Create alert rule. Auth: editor.
- **PATCH /scorecard/alert-rules/{rule_id}** – Update rule (name, threshold, enabled, etc.). Auth: editor.
- **DELETE /scorecard/alert-rules/{rule_id}** – Delete rule. Auth: editor.
- **GET /scorecard/trend-alerts** – List trend alerts for the entity (pagination, filter by project_slug, status). Auth: viewer.
- **POST /scorecard/trend-alerts/{alert_id}:resolve** – Mark trend alert as resolved. Auth: editor.
- **GET /scorecard/pillars** – List available pillars (metrics for rules).
- **POST /scorecard/trend-alerts:compute** (optional) – Trigger trend-alert evaluation once (for testing). Auth: admin or existing pattern.
- **GET /scorecard/trend-alerts/diagnostic** – Inspect rule evaluation context.

Alert worker: `alert_worker` calls `compute_trend_alerts()` (toggle with `ALERT_WORKER_TREND_ALERTS=true`) after `compute_policy_alerts()`. `compute_trend_alerts()` loads enabled rules, for each (entity, project) fetches recent trend data, evaluates threshold/trend_drop, and inserts/updates rows in `trend_alerts`.

## UI

- **Alerts dashboard** (e.g. under Scorecard or Admin): one view that shows:
  - **Policy alerts** (existing): from `GET /admin/policy-alerts` (or equivalent).
  - **Trend alerts** (new): from `GET /scorecard/trend-alerts`.
  - Filters: project, status (open/resolved), severity.
- **Alert rules management** (same area or a tab): list/create/edit/delete alert rules; form fields: name, rule type (threshold vs trend_drop), metric (overall / pillar), threshold_pct, window_days (for trend_drop), severity, enabled, optional project_slug.

## Implementation Order

1. Alembic migration: create `alert_rules` and `trend_alerts` with FKs and indexes.
2. Backend: alert_rules CRUD + trend_alerts list/resolve + service `compute_trend_alerts()` using trends data.
3. Alert worker: call `compute_trend_alerts()` in the existing loop.
4. Frontend: Alerts dashboard page + alert rules CRUD UI.
5. Wire routes in main (if new router) or add to existing scorecard/admin router.
