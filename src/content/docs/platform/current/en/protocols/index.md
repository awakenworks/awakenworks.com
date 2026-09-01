---
title: "Choose a connection layer"
description: "Identify the systems on each side of a connection, then choose the protocol that joins them to Awaken."
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
section: "Connect"
subsection: "Connect applications"
order: 21
---

Start with the two systems that need to communicate. The protocol name is the
second decision.

| Connection job | Start with | What the protocol is responsible for |
|---|---|---|
| Application or frontend to Awaken | [Managed Agents](/docs/agents/protocols/managed-agents/), [AI SDK](/docs/agents/protocols/ai-sdk/), or [AG-UI](/docs/agents/protocols/ag-ui/) | Turn an application request into input and events for one Awaken Session |
| Agent to tool or data service | [MCP](/docs/agents/protocols/mcp/) | Export a reviewed Awaken tool set or attach an external MCP server to an Agent |
| Agent to Agent | [A2A](/docs/agents/protocols/a2a/) | Discover a remote Agent and exchange task state across an HTTP boundary |
| Worker to an external Agent process | [ACP](/docs/agents/protocols/acp/) | Let a Worker run a supported external CLI as the Brain for one governed execution |
| Operator to a Session already running | [Live Inbox](/docs/agents/protocols/live-inbox/) | Change queued input before the Agent consumes it |
| Awaken to your backend | [Webhooks](/docs/agents/how-to/manage-webhooks/) | Send signed lifecycle notifications so a backend can fetch current resource state without polling |

These are adapters around one published Agent and Session model. Choosing a
different wire does not create a second execution path, permission system, or
event history.

## Continue with the exact connection

Use the **[connection matrix](/docs/agents/protocols/connect/)** for the
authoritative direction, endpoint, configuration surface, authentication rule,
and observable completion signal. Those details live there so they do not drift
across protocol introductions.

After choosing a row, open its protocol guide to understand the boundary, then
use the linked how-to guide to make one recognizable request and verify the same
Session or event record.
