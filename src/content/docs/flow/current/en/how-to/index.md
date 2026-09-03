---
title: "Manage everyday work"
description: "Complete everyday work in the Workforce workspace, with API references for advanced integration."
section: "Use"
subsection: "Manage work"
order: 20
---

Start in the product UI. The primary workspace navigation is Home, Chats, Work,
Objects, and Library. Project delivery contains Overview, Outcomes, Canvases,
and Issues; Advanced contains Planning, Workflows, Automations, and Build;
Operations contains Runs and Agent Center. The generated API remains the contract for
automation and integration, not the default explanation of a user's task.

| Task | Start here |
| --- | --- |
| Commission and accept one result | [Commission and follow an Outcome](/docs/workforce/how-to/manage-outcomes) |
| Open a workspace and project | [Source quickstart](/docs/workforce/quickstart) |
| Create and follow an Issue | [Create and follow an Issue](/docs/workforce/how-to/create-and-follow-an-issue) |
| Decide what needs human attention across Projects | Open Workspace **Work**, filter the exact decision type, then continue in the owning Issue or Agent Center |
| Check why one Issue cannot advance | Open the Issue detail diagnosis and scheduling sections |
| Talk freely, then create accountable work | Open Workspace **Chats**, select the target Project, review the proposed command, and follow its owner receipt |
| Inspect or operate business data | Open Workspace **Objects**, choose the Object type, then inspect data, relationships, and Pack-defined Actions |
| Inspect evidence or recover work | Use the Issue worklog, attention actions, and run controls |
| Author and bind a workflow | [Design a workflow](/docs/workforce/designing/design-a-workflow) |
| Define an Agent | [Define an Agent](/docs/workforce/designing/define-an-agent) |
| Configure Agent execution and credentials | [Define an Agent](/docs/workforce/designing/define-an-agent) and [Credential custody](/docs/workforce/concepts/credential-custody) |
| Model and distribute domain definitions | [Develop a Domain Pack](/docs/workforce/designing/develop-a-domain-pack) |
| Publish, import, and adopt a Pack | [Publish and install a Domain Pack](/docs/workforce/how-to/publish-a-pack) |
| Monitor and steer work | [Monitor WorkUnits](/docs/workforce/operating/monitoring-runs) |
| Decide permissions | [Inbox and approvals](/docs/workforce/operating/inbox-approvals) |
| Recover non-progress | [Attention and recovery](/docs/workforce/operating/attention-recovery) |
| Plan a batch | [Use Cycles](/docs/workforce/how-to/cycles) |

For advanced diagnosis, inspect the Issue scheduling projection, WorkUnits and
event stream, then the frozen execution snapshot and Resource joins. Act through
the same approval, attention, or WorkUnit commands used by the UI; never edit
persistence directly.

The current onboarding boundary is explicit: use `awaken-flow project bootstrap`
for the first Project. It calls the same authoritative Bootstrap API used by
integrations and does not seed persistence. Attention is resolved through the
Issue and control APIs described in the operating guides.
