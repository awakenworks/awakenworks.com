---
title: "Plan work with Cycles"
description: "Create, activate, inspect, and close a Cycle through the current planning API."
section: "Use"
subsection: "Plan work"
order: 10
---

A Cycle is a planning Subject with the built-in lifecycle `upcoming → active →
closed`. It groups work without redefining whether each Issue is ready.

## Goal

Group selected Issues into one Cycle, activate the planning boundary, inspect
membership and roadmap projections, then close it explicitly.

## Prerequisites

- a ready Project;
- at least one existing Issue in that Project;
- API access that can create Cycles and Issue relations.

## 1. Create, activate, and close the Cycle

1. Create it with `POST /api/projects/{project}/cycles` and at least
   `{ "title": "..." }`.
2. Add an Issue by posting `{ "to": "CYCLE_ID", "kind": "plan_membership" }`
   to `/api/issues/{issue_id}/relations`.
3. Activate it with `POST /api/cycles/{id}/activate`. Adding an Issue to an
   already active Cycle emits `plan.activated`; the seeded intake rule can then
   promote that Issue from `backlog` to `todo`.
4. Inspect `/api/cycles/{id}/memberships` and the Project's
   `/api/projects/{project}/roadmap`.
5. Close it with `POST /api/cycles/{id}/close`.

## Verify

- the Cycle starts as `upcoming`, becomes `active`, and ends as `closed`;
- `/api/cycles/{id}/memberships` contains the intended Issue relations;
- the Project roadmap shows the same Cycle and members;
- Issue readiness remains owned by Issue scheduling, not by a second Cycle status;
- closing the Cycle leaves open Issues open. Continue or recover each Issue through
  its own commands.

## Troubleshooting

If the table does not resolve the problem, record the Project, Issue, and Cycle
IDs, request route, HTTP status, error code, and correlation ID. Do not include
tokens or Issue content.

| Symptom | Check | Action |
| --- | --- | --- |
| The relation request returns `invalid_plan_membership` | Request path, target ID, and both Subject kinds | Send the command from the Issue path with the Cycle ID as `to`; do not reverse the relation. |

Current code does not provide the old Cycle page, scheduled Cycle dispatch, bulk
pause/start, or automatic carry-over. Build those policies explicitly instead of
assuming they happened.

## Next steps

- [Create and follow an Issue](/docs/workforce/how-to/create-and-follow-an-issue/).
- [Monitor WorkUnits](/docs/workforce/operating/monitoring-runs/).
- [Use the generated API route reference](/docs/workforce/reference/routes/).
