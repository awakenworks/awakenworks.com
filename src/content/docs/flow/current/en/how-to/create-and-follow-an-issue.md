---
title: "Create and follow an Issue"
description: "Create one Issue from the workspace, bind an exact Workflow when needed, and use its workbench to follow state, diagnosis, and evidence."
section: "Use"
subsection: "Manage work"
order: 21
---

An Issue is Workforce's accountable work record. Create it from the Project rather
than writing persistence directly, then use the same Issue detail page to follow
its Workflow state, scheduling diagnosis, WorkUnits, approvals, and accepted
evidence.

## Goal

Finish with one visible Issue whose title, optional Workflow binding, current
state, next action, and worklog can all be inspected from the Workforce workspace.

## Prerequisites

- a running Workforce deployment and web workspace;
- a bootstrapped, ready Project;
- an installed Workflow revision if this Issue needs a non-default Workflow.

Use the [source quickstart](/docs/workforce/quickstart/) to create the first ready
Project through the supported Bootstrap service.

## 1. Create the Issue

Open the Project's **Issues** page and choose **New issue**. Enter a concrete
title and, when useful, a description. If you select a Workflow, wait until the
UI displays its exact revision and configuration token before submitting.

Choose **Create issue**. The product sends one command that creates the Issue and
its selected Workflow binding together; it does not create a client-side shadow
record.

## 2. Find and open it

Use the Issue search field or list, board, and tree views. Open the Issue detail
page. The header shows accountable identity and current status; **Next action**
and **Diagnosis** explain what can progress and what is blocking it.

## 3. Follow work and evidence

Use the Workflow progress, worklog, relationships, approval, and Agent
conversation sections on the Issue page. WorkUnit activity and accepted outputs
remain attached to this Issue; summary views do not replace it as the command
authority.

## Verify

- Workforce displays an **Issue created** confirmation;
- the Issue appears in search or the selected Project view;
- its detail page shows the same title and exact Workflow binding;
- Next action, Diagnosis, and the worklog load without a client-only state copy.

The preview's executable UI acceptance suite covers plain creation, exact
Workflow binding, search, paging, and fail-closed loading.

## Troubleshooting

If the table does not resolve the problem, record the Project ID, selected
Workflow revision, Issue ID if one was returned, HTTP status, error code, and
correlation ID. Do not include tokens, credentials, or Issue content.

| Symptom | Check | Action |
| --- | --- | --- |
| Creation reports a configuration error | Project readiness and Workflow revision | Repair Project configuration or select an installed revision; do not bypass the command with a database write. |
| Issue detail is unavailable | Project scope and Issue identity | Return to the Project Issue list, search again, and retry the canonical detail read. |

## Next steps

- [Commission and follow an Outcome](/docs/workforce/how-to/manage-outcomes/).
- [Plan work with Cycles](/docs/workforce/how-to/cycles/).
- [Resolve Attention without rewriting Issue state](/docs/workforce/operating/attention-recovery/).
