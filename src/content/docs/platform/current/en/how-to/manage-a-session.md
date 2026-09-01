---
title: "Start, interrupt, or archive a Session"
description: "Start work in a Session, confirm its durable history, interrupt an active Run, or archive the Session as read-only."
evidence:
  - "crates/server/awaken-session-application/src/application.rs"
  - "web/e2e/console.spec.ts"
section: "Govern"
subsection: "Everyday use"
order: 4
---

Use a Session to start or continue work with one published Agent. Interrupt only
when an active Run should stop. Archive only when the history should remain
readable but the Session must accept no more input.

## Goal

Finish with one Session whose committed messages remain readable after reload.
If you archive it, use a new Session for all later work.

| What you need now | Action | Result |
| --- | --- | --- |
| start or continue work | send an event and wait for `idle` | the new turn joins the same durable history |
| stop active work | choose **Stop run** | the Session records an accepted `user.interrupt` request |
| keep history but block new input | choose **Archive** | the Session remains readable and rejects later events |
| work again after archive | create a new Session | the archived lifecycle stays closed |

## Prerequisites

- a running Awaken AllInOne or equivalent deployment;
- one validated and published Agent with a resolvable model and credential;
- access to the Agent and Session surfaces in the same Workspace.

Complete [Get started with Awaken](/docs/agents/get-started/) first if those
conditions are not yet true.

## 1. Create the Session

Open **Sessions**, create a Session, and select the published Agent. A Session
freezes the selected Agent publication and resolved resources; later draft edits
do not change work already attached to it.

## 2. Send work and confirm committed history

Send a message and wait for the Session to return to its idle interaction state.
Reload the page and confirm that messages and tool results remain visible. Treat
the reloaded history as the durable record; the live stream shows only what is
arriving now.

## 3. Interrupt active work when necessary

While a Run is active, choose **Stop run**, then confirm the controlled stop. The Session records a
`user.interrupt` event and displays its acceptance receipt. Interrupt requests a
controlled stop; it does not delete the Session or its earlier evidence.

## 4. Archive work that must become read-only

Choose **Archive** only after no new input should be accepted. The archived state
remains visible and the Session can still be retrieved for inspection. A later
event write is rejected instead of silently reopening the lifecycle.

## Verify

- reloading the Session preserves committed messages and tool results;
- interrupt displays an accepted `user.interrupt` receipt;
- archive displays the archived state;
- an archived Session remains readable and rejects a new event with a conflict.

## Troubleshooting

If the table does not resolve the problem, record the Workspace, Agent ID and
publication revision, sanitized Session request shape, HTTP status and error
code, and correlation ID before contacting support. Do not include tokens,
credentials, or message content.

| Symptom | Check | Action |
| --- | --- | --- |
| Session creation is unavailable | Agent publication, model resolution, credential readiness | Repair the named readiness failure, publish again if the Agent changed, then create a new Session. |

## Next steps

- [Connect the published Agent to an application](/docs/agents/how-to/connect-a-published-agent/).
- [Understand Sessions and committed events](/docs/agents/concepts/sessions-and-events/).
- [Use Live Inbox for queued in-flight input](/docs/agents/protocols/live-inbox/).
