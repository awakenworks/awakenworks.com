---
title: "Workflow author contract"
description: "The current WorkflowAuthorDeclaration request shape and its lowering into the internal ProcessSpec."
section: "Reference"
order: 14
---

Save a Project-local revision with:

```http
POST /api/projects/{project}/workflows/{definition}/revision
```

The request requires `expected_override_version`, `idempotency_key`, and
`declaration`. Unknown fields fail closed.

```json
{
  "expected_override_version": 0,
  "idempotency_key": "save-review-flow-1",
  "declaration": {
    "name": "Review flow",
    "description": "Accept one reviewed result",
    "icon": "lucide:badge-check",
    "start": "done",
    "states": {
      "done": {
        "name": "Done",
        "description": "The declared result is accepted",
        "icon": "lucide:circle-check",
        "state_group": "done",
        "completion": "completed",
        "transitions": []
      }
    }
  }
}
```

## Static shape

| Scope | Required | Optional |
| --- | --- | --- |
| declaration | `name`, `description`, `icon`, `start`, `states` | `inputs`, `requires`, `outputs`, `max_iterations` |
| state | `name`, `description`, `icon`, `state_group`, `completion`, `transitions` | `instruction`, `spec_delivery`, `agent_session`, `environment`, `agent_tool_profile`, `slots`, `inputs`, `outputs`, `wip_limit` |
| transition | `key`, `name`, `description`, `icon`, `to`, `when` | none |

`state_group` is `backlog`, `todo`, `in_progress`, `review`, `waiting`, `done`,
or `canceled`. `completion` is `open`, `completed`, or `canceled`.

A state slot is either `{ "responsibility": "executor", "agent":
"workflow.requires.ROLE" }` or a responsibility plus an Actor/Team `selector`.
At most one Executor is permitted. Dynamic parallelism uses child-Issue
decomposition; `join_policy` is not a field.

State inputs reference `workflow.inputs.*`, `workflow.requires.*`, or
`states.*.outputs.*`. Outputs declare typed values or Resource realization.
Workflow outputs project `states.*.outputs.*` and form the terminal acceptance
contract. Symbolic `AuthorRef` values resolve inside the Pack/Project context;
the saved runtime revision contains exact references.

## Environment requirement and selection

An Environment requirement has a description and an Environment `AuthorRef`:

```json
{
  "requires": {
    "build_environment": {
      "description": "Network- and package-constrained build execution",
      "environment": "build-linux"
    }
  },
  "states": {
    "build": {
      "environment": "build_environment"
    }
  }
}
```

The saved Workflow revision resolves that reference to one exact Environment
revision. At Issue binding time the same requirement key selects
`{ "kind": "environment", "activation_id": "build-linux-active" }`. Dispatch
fails closed if the activation is missing, disabled, drifted, or resolves to a
different revision. See [Environments](/docs/workforce/concepts/environments/).

The response returns the immutable revision and Project override result. Existing
Issues retain their pinned revision. Clear only the Project default with
`POST /api/projects/{project}/workflows/{definition}/override/clear` and an
`expected_override_version` body.
