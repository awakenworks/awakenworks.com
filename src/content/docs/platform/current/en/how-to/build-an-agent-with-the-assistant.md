---
title: "Draft an Agent with the Admin Assistant"
description: "Describe the Agent you need, review the saved draft, and publish it only when the configuration matches your intent."
evidence:
  - "crates/control/awaken-admin-assistant/src/lib.rs"
  - "web/src/surfaces/assistant.tsx"
  - "web/src/components/agent/useAgentDraftReview.ts"
  - "web/e2e/console.spec.ts"
section: "Build"
subsection: "Agent setup"
order: 10
---

Describe the job you want an Agent to perform. The Admin Assistant turns that
description into a saved draft, checks it against the capabilities available in
your Workspace, and leaves publication to you.

## Goal

Finish with one Agent draft whose instructions, model, tools, resources, and
permission boundaries you have reviewed. The Agent becomes available to new
Sessions only after you explicitly publish it.

## Prerequisites

- Run `awaken` and open the Console for the target Workspace.
- Configure at least one runnable provider-backed model. If Models shows no
  runnable choice, complete [provider and model setup](/docs/agents/how-to/configure-providers-models-credentials/)
  first.
- Decide the Agent ID, its first task, the tools it may use, the actions that
  require approval, and what it must never do.

## 1. Open the Assistant

Open `/w/<workspace>/assistant` in the Console. The Console prepares the
reserved `__admin_assistant` Agent from a runnable Workspace model. It creates
the conversation Session only when you send the first message, so opening the
page alone does not leave an empty Session behind.

The Assistant can inspect the published capabilities in this Workspace. It
does not read stored secrets, create credentials, or publish an Agent.

## 2. Describe the job and its limits

Give the Assistant a concrete first task and a finish line. Replace the bracketed
tool IDs with tools that already exist in your Workspace:

```text
Create an unpublished Agent with display name Support Triage and stable ID support-triage.

Its job is to read a support report, summarize the problem, and list the facts
still needed before an engineer can act. Use only [tool-id-1] and [tool-id-2].
Require approval before any tool action that changes external state. Never send
messages or change customer data. Prefer a published runnable model. Save and
validate the draft, but do not publish it.
```

Include examples when tone or output shape matters. If the request depends on a
model, tool, plugin, Skill, MCP server, or Resource that is not available, choose
an existing capability or configure it before continuing. Do not ask the
Assistant to invent an ID that you will later have to interpret.

## 3. Review the saved draft

When the draft card appears, choose **Open in editor**. Review the configuration
against the job you described:

- Do the instructions define the result and the stopping condition?
- Are the selected model and input modalities suitable for the first task?
- Is every tool, plugin, Skill, MCP server, and Resource necessary?
- Do permission rules stop the actions that require a person?
- Does the diff contain only the change you intended?

A clean validation result means the configuration can be published. It does not
mean the Agent's behavior is good enough for your users.

## 4. Check and publish the draft

Choose **Check draft** after any manual edit. Then choose **Review & publish**,
read the exact draft-versus-published diff, and confirm **Publish** only if it is
correct.

Publication creates the version used by new Sessions. It does not rewrite the
snapshot already held by an existing Session.

## Verify

1. Return to Agents and confirm `support-triage` is marked **published**.
2. Start a new Session with that Agent and send the support-report task you used
   while reviewing the draft.
3. Confirm the response follows the requested shape and that any protected tool
   action stops for approval.
4. If the behavior is wrong, edit the draft, check it again, and publish a new
   version. Keep the current Session as the record of what the earlier version did.

## Troubleshooting

If the table does not resolve the problem, record the Workspace, Agent ID,
Session ID, validation field path, error code, and correlation ID before
contacting support. Do not include API keys or other credential material.

| Symptom | Check | Action |
| --- | --- | --- |
| The Assistant says no model is available | Models has no runnable published choice | Complete provider and model setup, then retry preparation from the Assistant |
| **Check draft** reports an issue | Read the field path and message in the editor | Correct that value or ask the Assistant to repair this saved draft; check it again before publishing |

## Next steps

- [Refine Agent behavior](/docs/agents/how-to/configure-agent-behavior/) when
  you need exact control over the saved configuration.
- [Manage a Session](/docs/agents/how-to/manage-a-session/) to continue,
  interrupt, archive, or inspect the Agent's work.
- For automation, use the Session request shape in
  [Awaken Agents Get Started](/docs/agents/get-started/) with agent
  `__admin_assistant`, then keep the same review and publication boundary.
