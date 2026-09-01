---
title: "API tutorial: manually advance a Workflow"
description: "Save a Workflow revision and manually advance an Issue through one declared HTTP transition."
section: "Design"
subsection: "API tutorial"
order: 30
---

This tutorial shows you how to advance one declared Workflow transition through
the HTTP API. It does not execute an Agent; use it to learn the orchestration
boundary before adding technical execution.

## Goal

Create a two-state Workflow, save a Project revision, file an Issue, and advance
the Issue through its declared transition.

## Prerequisites

You need an existing Project whose required platform lifecycle definitions were
installed through Project Bootstrap.
Run the [source quickstart](/docs/workforce/quickstart/) first. Its `project bootstrap`
command installs the selected Pack through the canonical Bootstrap API and creates
an initial Project. Use the returned `project_id` below. Do not seed a database.

Keep the Workforce server running at `http://127.0.0.1:7979`. The commands below use
the unauthenticated local evaluation mode from the quickstart. For any other IAM
mode, pass the exact authentication material required by that deployment rather
than weakening the server configuration.

## 1. Save a Workflow revision

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/projects/PROJECT_ID/workflows/first-flow/revision \
  -H 'content-type: application/json' \
  -d '{
    "expected_override_version":0,
    "idempotency_key":"save-first-flow-1",
    "declaration":{
      "name":"First Workforce",
      "description":"Proves one declared transition.",
      "icon":"lucide:workflow",
      "start":"triage",
      "states":{
        "triage":{"name":"Triage","description":"Review the work before completion.","icon":"lucide:search","state_group":"in_progress","completion":"open","transitions":[{"key":"finish","name":"Finish","description":"Accept the demonstrated result.","icon":"lucide:check","to":"done","when":null}]},
        "done":{"name":"Done","description":"The result was accepted.","icon":"lucide:circle-check","state_group":"done","completion":"completed","transitions":[]}
      }
    }
  }'
```

The response returns the exact Workflow revision, definition digest, and Project
override version. Save changes the default only for future objects in that Project;
existing Issues are not retargeted.

## 2. File work

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/projects/PROJECT_ID/issues \
  -H 'content-type: application/json' \
  -d '{"title":"Prove the first workflow","description":"Advance only through the declared edge."}'
```

Retain the returned Issue `id`. It should open at `triage`.

## 3. Advance through the declared edge

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/issues/ISSUE_ID/advance \
  -H 'content-type: application/json' \
  -d '{"event":"finish"}'
```

Read `GET /api/issues/ISSUE_ID` and `/timeline`; the Issue should be terminal in
`done`. An undeclared event is refused rather than guessed.

## Verify

After the last request, you should see:

1. saving returns a Workflow revision and definition digest;
2. the new Issue starts at `triage` and records that exact revision;
3. sending `finish` moves the Issue to terminal state `done`;
4. the timeline records the declared transition instead of an out-of-band state
   edit.

If you want to check the guardrail, submit an event name that the Workflow does
not declare. The request should fail without changing the Issue.

## Troubleshooting

If the table does not resolve the problem, record the Project ID, Workflow
revision, Issue ID, request route, HTTP status, error code, and correlation ID.
Do not include tokens or request content.

| Symptom | Check | What to do |
| --- | --- | --- |
| Workflow save returns a conflict | `expected_override_version` and the current Project override version | Read the current version, review concurrent changes, then retry with the new expected value and a new idempotency key. |
| Issue does not start at `triage` | Issue's pinned Workflow revision and the saved declaration | Create a new Issue after the intended revision is active; do not retarget an existing Issue in storage. |
| `finish` is rejected | Current Issue state and the transition keys declared from that state | Use the transition admitted by the pinned Workflow, or publish a reviewed revision for future Issues. |

## Clean up

Stop the server with `Ctrl-C`. The Workflow and Issue remain available when you
restart with the same data directory, so you can keep them for the next guide.
There is no per-exercise deletion step in this tutorial. If you need an isolated
disposable run, start it with a new explicit data directory; do not delete
database rows or a broad parent directory to reset one exercise.

## What this tutorial does not do

No WorkUnit or Agent Run occurs in these steps. A real Agent path additionally
needs an activated Agent revision, the governed model/provider/credential join,
an executor slot, and an accepted Worker. Maintainers can use the repository's
executable E2E fixtures for that integration boundary; those fixtures are not a
general production solution.

## Next steps

- [Create and follow an Issue](/docs/workforce/how-to/create-and-follow-an-issue/)
  through the user-facing path.
- [Define an Agent](/docs/workforce/designing/define-an-agent/) and review the
  publication and activation boundary before attempting technical execution.
- [Understand Workforce-Awaken execution ownership](/docs/workforce/concepts/agents-runs/)
  before interpreting an Awaken Run as a business outcome.
