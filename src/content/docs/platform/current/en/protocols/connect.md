---
title: "Choose the protocol for one connection"
description: "Start from who initiates the connection, then use the endpoint, configuration surface, and completion signal for that path."
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "web/e2e/ui-inventory.spec.ts"
section: "Connect"
subsection: "Connect applications"
order: 22
---

Choose by direction before choosing by protocol name:

- an application or backend entering Awaken uses a **Client → Awaken Agents** row;
- a remote Agent entering Awaken uses the **A2A server** row;
- Awaken Agents calling a remote Agent or tool service uses an **Awaken Agents → remote** row;
- a Worker handing execution to an external brain process uses **ACP**;
- an operator changing queued input for an active Session uses **Live Inbox**;
- a backend receiving lifecycle notifications from Awaken uses **Webhooks**.

If the direction changes, stop and choose again. Authentication, configuration,
and the completion signal change with it.

| Protocol | Direction | Entry or configuration | Console location | Done when |
|---|---|---|---|---|
| Managed Agents | Client → Awaken Agents | `/v1/agents`, `/v1/sessions` | Agents, Sessions | The API-created Session appears with the same id, Agent, status, and metadata |
| AI SDK | Client → Awaken Agents | `POST /v1/ai-sdk/chat` | Sessions | UI Message Stream completes and committed message history is readable |
| AG-UI | Client → Awaken Agents | `POST /v1/ag-ui` | Sessions | AG-UI events stream and the same execution is inspectable |
| A2A server | Remote Agent → Awaken Agents | `/.well-known/agent-card.json`, `/v1/a2a/*` | A2A federation | A remote client discovers the local card and receives a task id |
| A2A delegate | Awaken Agents → Remote Agent | published Agent `model.id="a2a:<absolute-url>"` | A2A federation; Agent model | Publication pins the remote card before delegation |
| MCP server | MCP client → Awaken Agents | `GET`, `POST`, `DELETE /v1/mcp` | API & protocols → MCP Server help | Dedicated bearer initializes a session; `tools/list` contains only explicit management exports |
| MCP provider | Awaken Agents → MCP server | Agent `mcp_servers` binding | Agent → Build → Skills & MCP; Runtime secrets | Session trace shows the namespaced tool id and policy result |
| ACP | Worker → external brain process | Published `backend_ref`: `acp:claude`, `acp:codex`, `acp:gemini`, `acp:opencode`, or `acp:hermes` | Agent model; Environments; Session details | Session reports the exact `awaken.runtime`, model route, credential mode, and Sandbox policy |
| Live Inbox | Operator → active Session | `/v1/awaken/sessions/{id}/live-inbox` | Session details | Queued input changes before the Agent consumes it |
| Webhooks | Awaken Agents → your backend | `/v1/config/webhook-subscriptions` | Connect → Webhooks | Receiver verifies the signature, deduplicates the event id, fetches the referenced resource, and returns `2xx` |

## After choosing a row

1. Open the linked protocol guide from the [protocol index](/docs/agents/protocols/).
2. Configure the endpoint or published Agent field named in the matrix.
3. Apply the authentication rule for that surface.
4. Send one recognizable request.
5. Check both the wire response and the same Session or event record in Console.

## Shared prerequisites

1. Publish a valid Agent with a resolvable model/provider or ACP Environment.
2. Keep credentials in Credentials/Vault and bind references; do not paste secrets
   into Agent prompts or MCP configuration shown in recordings.
3. Match authentication to the surface: management APIs require a scoped token
   when embedded/cloud IAM is enabled; MCP export always requires its dedicated
   bearer; local AI SDK, AG-UI, A2A, and Session ingress are open by default and
   must sit behind an authenticated gateway before public exposure.
4. Verify both sides: the protocol response **and** the shared Session/event record.

For outbound Webhooks, follow [Send signed lifecycle events to your backend](/docs/agents/how-to/manage-webhooks/).
The receiver authenticates each delivery with its one-time signing secret; the
management token used to create the subscription is not sent to the receiver.

## Current product boundaries

- The A2A Console page shows the local inbound routes and performs outbound
  remote-card discovery. It is a protocol view, not a stored server-registration
  CRUD catalog.
- ACP uses the official JSON-RPC codec in the runtime executor by default; the
  newline codec is for fixtures/tests. ACP runtime and Sandbox tier are separate
  choices; see the [runtime matrix](/docs/agents/protocols/acp/).
- MCP is bidirectional. “Awaken as server” and “Awaken consumes tools” are separate
  configurations and should be tested separately.
- Dashboard, Eval, Datasets, and Audit are gated Console routes in the current build;
  do not use them as product proof until their backend capabilities are enabled.

For payloads and all routes, continue to the [Public HTTP API](/docs/agents/reference/api/).
