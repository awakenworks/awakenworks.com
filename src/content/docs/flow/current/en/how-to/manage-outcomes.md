---
title: "Commission and follow an Outcome"
description: "Commission one accountable result, follow its child work, and verify the accepted output and Resource evidence."
section: "Use"
subsection: "Manage work"
order: 22
---

Use an Outcome when you want one accepted business result, even if Agents must
discover and coordinate many pieces of work to deliver it.

## Goal

Finish with one Outcome whose accepted deliverables can be traced to the root
Issue, its child work, and exact value or Resource evidence.

## Prerequisites

- a ready Project in the Workforce workspace;
- one installed Workflow suitable for the root Issue;
- an acceptance boundary that names the result and its required deliverables.

## Where this appears in the console

- Workspace **Home** commissions the result and shows whether it is in Needs
  you, In progress, or Blocked.
- Project **Outcomes** lists commissioned results by open, accepted, or canceled
  state.
- **Outcome Review** separates formal deliverables from supporting Issues and
  technical execution details, then exposes a business transition only when the
  Workflow is at review and the deliverables are complete.

Workforce owns these work and acceptance views. Agents owns the Session, Run,
Worker, Sandbox, and execution history used by a WorkUnit. Objects owns exact
Resource snapshots and external facts used as deliverables. The review surface
composes those records; it does not copy their authority.

## 1. Commission and follow the result

1. Open workspace **Home** and choose **Commission an outcome**.
2. Describe the result and acceptance boundary, preview the durable Issue, then
   commission it. Workforce creates one root Issue with one exact Workflow binding.
3. Follow the Outcome card from Home or Project **Outcomes**. Its stage and progress are projections of the root
   Issue and recursively reachable child Issues; they are not a second status.
4. Open the Issue graph when work is blocked. Dependency roots can execute in
   parallel; dependents wait. A canceled prerequisite requires Attention.
5. When all children finish, expect the root to become ready—not completed. The
   root Agent must integrate their accepted outputs and exact Resources.
6. Open **Outcome Review** and inspect `acceptance_deliverables`. A `pending` item has no accepted root
   fulfillment; `fulfilled` has evidence but the root remains open; `accepted`
   means the completed root accepted that exact value or Resource snapshot.
7. Confirm `acceptance_summary.complete` and accept the review/human transition
   only when every promised deliverable is present. A canceled Outcome is not an
   accepted result.

## Verify

- the Outcome resolves to one root Issue rather than a second work record;
- progress matches the recursively reachable child Issues;
- every required deliverable is `accepted`, not merely `fulfilled`;
- `acceptance_summary.complete` is true before human acceptance.
- Outcome Review still identifies supporting work as evidence, not as the formal
  acceptance boundary.

## Retry decomposition without changing its meaning

An exact decomposition retry returns the same children. If the proposed graph
changes, Workforce rejects the conflicting retry rather than rewriting execution
evidence. Send the changed graph as an explicit new command. Reopen or recover
through the Issue's governed commands; do not edit relationships or persistence
directly.

Advanced integrations can read `GET /api/projects/{project}/outcomes` or
`GET /api/outcomes/{id}`. These read-only endpoints rebuild the view from the existing
Issue, Workflow, relation, output, and Resource authorities. They do not provide
a separate Outcome command or repair path.

## Next steps

- [Create and follow an Issue](/docs/workforce/how-to/create-and-follow-an-issue/).
- [Resolve Attention](/docs/workforce/operating/attention-recovery/).
- [Inspect Workforce API routes](/docs/workforce/reference/routes/).
