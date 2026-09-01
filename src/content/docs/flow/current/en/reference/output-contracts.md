---
title: "Structured output and hand-off"
description: "Typed Workflow inputs, state outputs, downstream sources, and terminal acceptance projections."
section: "Reference"
order: 13
---

A WorkUnit emits structured output. Workforce validates and stores the accepted state
output against the state's declared `outputs` map. Each port is either a typed
value (`type`, optional object `properties` / array `items`, optional closed
`variants`) or an exact Resource `attest` / `construct` realization.

A downstream state declares `inputs`. Every input has one `from` source:

- `workflow.inputs.<port>` or `workflow.requires.<role>`;
- `states.<state>.outputs.<port>`.

`required: true` gates dispatch until the value exists. `approved_by` names an
accepted state-output reference and requires equality with the artifact that was
approved, so an old approval cannot authorize a new revision.

Top-level Workflow `outputs` project exact `states.*.outputs.*` ports. Those
terminal projections form the Outcome acceptance contract; concatenating child
outputs or merely completing every child is not acceptance. The parent Executor
must read child terminal outputs, integrate them, and produce its own declared
root outputs.

The Outcome read model evaluates that contract once and exposes:

- `acceptance_deliverables[]`: `output_id`, the exact Workflow output
  `contract`, optional `fulfillment` (`value` or exact Resource `snapshots`), and
  `acceptance_state`;
- `acceptance_summary`: `total`, `fulfilled`, and `complete`.

The derived state table is closed: open + missing is `pending`; open + present is
`fulfilled`; completed + present is `accepted`; canceled is `canceled` regardless
of fulfillment. Completed + missing is an integrity failure. Only accepted
state-output envelopes named by the root Workflow's `from` references can
fulfill the contract; a latest Run result or child output cannot substitute.

Closed `variants` support publish-time transition coverage. Shape enforcement
belongs to the typed port, Resource schema/realization, and transition validator;
there is no parallel `produces`, downstream state-level `requires`, or generic
`output_contract` format.

See [Workflow author contract](/docs/workforce/reference/workflow-config).
