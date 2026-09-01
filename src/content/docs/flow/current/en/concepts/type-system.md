---
title: "Types as operational contracts"
description: "Where Awaken Workforce uses closed enums, schemas, references, revisions, and reason codes to make work inspectable."
section: "Understand"
subsection: "Resources and governance"
order: 40
---

Awaken Workforce uses types to keep control decisions out of prompts and naming
conventions. A check can advance work automatically only when its inputs, result,
authority, and affected revision are machine-verifiable. “Typed” does not mean
every output has a universal JSON Schema; it means each boundary validates the
structure it actually owns.

## Where types carry authority

| Boundary | Examples |
| --- | --- |
| Work lifecycle | `state_group`, `completion`, declared transitions and CEL guards |
| Assignment | Slot responsibility plus `actor` or `by_team` selector |
| Handoff | Typed state `outputs`, downstream state `inputs.from`, terminal Workflow `outputs` |
| Execution | Closed WorkUnit status, event/state trace, lease identity/version |
| Operations | Registered attention reason codes and explicit signal/approval status |
| Resource catalog | Category, data class, facet schemas, typed values, revision references |
| Scripts | Engine/lane, input/output schema where declared, sandbox admission |
| Access | Principal, action, scope, role binding, visibility projection |

This structure gives failure a location. An invalid Workflow specification fails admission;
an unresolved slot or Resource holds readiness; a denied action fails
authorization; a risky concrete call can wait for approval; an exhausted or
unreachable execution produces attention evidence. These are related gates, not
one interchangeable “permission” result.

## Authoring rule

Declare only what the current contract supports. Do not infer behavior from a
state name such as `review`, invent `output_contract`, or treat a field called
`git_ref` as a built-in Workforce type. Put values in typed state `outputs`, exact
object identities in Resource realization ports, and domain validation in Resource
schemas/scripts or explicit verification checkpoints.

The practical payoff is explainability: a human can inspect the same declared
state, reference, reason, and revision that the system used to decide. See the
[object model](/docs/objects/concepts/object-model) and [authorization, readiness,
and Resources](/docs/objects/concepts/permissions-resources).
