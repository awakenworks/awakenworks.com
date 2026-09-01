---
title: "Public HTTP API"
description: "The canonical index of Managed Agents, Awaken extension, protocol-adapter, and operations route families."
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "crates/server/awaken-run-ingress-http/src/durable_ops.rs"
section: "Reference"
order: 10
---

Use this page to find the owner of an application HTTP contract. It is the single application route-family index
for the `awaken` service, not a second field or payload reference. The process mounts only the surfaces
enabled by its configuration; a listed route is not proof that every deployment serves it.

## Find the contract you need

| You are trying to | Start here | Completion signal |
| --- | --- | --- |
| use the official Managed Agents SDK | Managed Agents families, then [compatibility](/docs/agents/compatibility/) | the SDK receives the documented resource or typed error |
| connect an application protocol | Protocol adapters, then the matching protocol page | the wire result and committed Session state agree |
| automate Agent, provider, model, credential, or resource configuration | Control-plane extensions, then the [generated OpenAPI contract](./management-openapi) | the intended revision is validated and explicitly published |
| operate readiness, drain, limits, or durable recovery | Operations and Durable runtime operations | readiness or committed Coordinator state shows the result |

If you already know the route, follow its linked owner for request fields,
authentication, state transitions, and errors. Do not infer those details from a
neighboring route family.

Public APIs use several media types:

- JSON for most request/response APIs;
- Server-Sent Events (`text/event-stream`) for live streams;
- multipart upload and binary content for Files and Skills;
- JSON-RPC, optionally with SSE, for MCP and A2A.

Managed compatibility, beta headers, and divergences are owned by
[Anthropic Managed Agents compatibility](/docs/agents/compatibility/). Detailed
protocol payloads are owned by their protocol pages. This index does not repeat
those contracts.

Exact management-plane fields and schemas come from the
[generated OpenAPI contract](./management-openapi); this route-family map must not
be expanded into a second hand-maintained field reference.

## Static route ownership

| Owner | Public route families | Contract |
| --- | --- | --- |
| Managed Agents adapter | `/v1/agents`, `/v1/sessions`, `/v1/environments`, `/v1/deployments`, `/v1/deployment_runs`, `/v1/vaults`, `/v1/memory_stores`, `/v1/files`, `/v1/skills`, `/v1/user_profiles`, `/v1/dreams`, `/v1/tunnels`, `/v1/models` | Official SDK-compatible wire within the documented baseline and constraints |
| Awaken extension adapter | `/v1/awaken/*`, `/v1/durable/*` | Awaken-specific Session steering, policy, and durable control |
| Control plane | `/v1/config/*`, `/v1/application-access-tokens`, `/v1/workspaces/{workspace}/*` | Authoring, catalog, credentials, access, and workspace addressing |
| Application adapters | `/v1/ai-sdk/*`, `/v1/ag-ui*`, `/v1/a2a*`, configurable MCP path (default `/v1/mcp`) | Protocol-specific application wires |
| Process operations | `/metrics`, `/readyz`, `/admin/drain` | Metrics, readiness, and graceful drain |

## Managed Agents families

The official SDK owns the request and response types. The main families are:

| Family | Base and subordinate paths |
| --- | --- |
| Agents | `/v1/agents`; retrieve/update/archive/disable and versions below `/{agent_id}`. `disable` is an Awaken extension. |
| Sessions | `/v1/sessions`; retrieve/update/delete/archive, events, threads, thread events/stream, and resources below `/{session_id}`. |
| Environments | `/v1/environments`; lifecycle plus `/work` poll, lease, update, ack, heartbeat, and stop operations. |
| Deployments | `/v1/deployments`, `/v1/deployment_runs`; deployment lifecycle and run control. |
| Vaults | `/v1/vaults`; credentials below `/{vault_id}/credentials`, including `/mcp_oauth_validate`. |
| Memory | `/v1/memory_stores`; `/memories` and `/memory_versions` below a store. |
| Files | `/v1/files`; metadata and binary `/content`. |
| Skills | `/v1/skills`; versions and binary `/content`. A single-file version read is an Awaken extension. |
| Other official families | `/v1/user_profiles`, `/v1/dreams`, `/v1/tunnels` with certificates, and `/v1/models`. |

Do not infer one common CRUD pattern from this table. Methods, archive/delete
semantics, beta values, multipart bodies, and response media types vary by
family. Use the official SDK at the tested version and the
[compatibility matrix](/docs/agents/compatibility/#compatibility-matrix).

## Awaken Session and policy extensions

| Method and path | Purpose |
| --- | --- |
| `GET/POST /v1/awaken/sessions/{id}/live-inbox` | Read or enqueue pending in-flight messages. |
| `PUT /v1/awaken/sessions/{id}/live-inbox/order` | Reorder the pending queue with version checks. |
| `PUT/DELETE /v1/awaken/sessions/{id}/live-inbox/{message}` | Replace or withdraw one pending message. |
| `PUT /v1/awaken/sessions/{id}/resources` | Replace the full Session resource manifest. |
| `/v1/awaken/sandbox-execution-policies*` | Create and publish immutable Sandbox policy versions. |
| `GET/POST /v1/awaken/environments/{id}/sandbox-execution-policy` | Read or bind an Environment policy. |
| `GET/PUT /v1/awaken/memory-stores/{id}/dream-policy` | Read or set recurring Dream policy. |

See [Live Inbox](/docs/agents/protocols/live-inbox/) and
[Sandbox tiers](/docs/agents/how-to/configure-sandbox-tiers/) for their
behavioral contracts.

## Durable runtime operations

These Coordinator-owned operations fail closed when durable ingress is not
available. Every route is below `/v1/durable/threads/{thread}`:

```text
POST  /submit_background
POST  /cancel
POST  /pause
POST  /resume
POST  /wake
POST  /deliver
POST  /supersede
GET   /superseded
GET   /dispatches
GET   /messages
POST  /reconcile
POST  /quarantine-retry-exhausted
GET   /dead-letters
POST  /dead-letters/{run_id}/requeue
POST  /dead-letters/purge
```

The control sequence is durable: submission records work before execution;
claim/epoch fencing controls commit; pause, cancel, supersede, and recovery
update Coordinator-owned state. Retry exhaustion normally commits
`Ended(Indeterminate)` and settles automatically. Dead letters appear only after
an explicit `quarantine-retry-exhausted` request; requeue or purge is also
explicit. A transport failure does not authorize an unfenced replay.

No dead-letter repair is needed after ordinary retry exhaustion. Inspect the
committed terminal only when the original business intent still requires another
attempt. Quarantine, requeue, and purge are reviewed control commands, not a
routine cleanup sequence.

For explicit quarantine, always pass a reviewed
`max_attempts=<positive integer>` query. The server treats an omitted or invalid
value as `0`, so omission is not a safe operational default; `now_ms` is optional
and otherwise uses server time. The response reports `{"quarantined": n}`. List
before repair, requeue one named Run only after its cause is fixed, and expect
`409` if that Run is not quarantined in the requested Thread. Purge deletes every
dead-lettered dispatch and its pending input for that Thread; it is not a retry
or cleanup prerequisite.

## Control-plane extensions

`/v1/config/*` is the authoring and catalog surface used by the embedded Console.
It includes Agent draft/validate/publish, providers, models, inference profiles,
credentials, resources, MCP/A2A configuration, and Awaken webhook subscriptions.
Webhook subscription CRUD is `/v1/config/webhook-subscriptions[/{id}]`; it is an
Awaken extension. Use [Send signed lifecycle events to your backend](../how-to/manage-webhooks)
for the Console path, one-time secret, delivery states, and receiver acceptance
test.

Application access tokens use `/v1/application-access-tokens[/{id}]`. Workspace
path addressing projects an otherwise identical application route below
`/v1/workspaces/{workspace}/{rest}`; it does not create another domain store.

## Protocol adapters

| Adapter | Entry routes | Detailed contract |
| --- | --- | --- |
| AI SDK | `/v1/ai-sdk/chat`, thread/Agent run routes, thread message history | [AI SDK](/docs/agents/protocols/ai-sdk/) |
| AG-UI | `/v1/ag-ui`, `/v1/ag-ui/agents/{id}`, thread message history | [AG-UI](/docs/agents/protocols/ag-ui/) |
| A2A | `/v1/a2a*` JSON-RPC, REST convenience routes, task and Agent Card routes | [A2A](/docs/agents/protocols/a2a/) |
| MCP | configurable path, default `/v1/mcp`; `POST`, `GET`, and `DELETE` | [MCP](/docs/agents/protocols/mcp/) |

All adapters converge on the same published Agent and thread-keyed Session
substrate. They preserve their own wire framing and error contract; clients must
not assume a process-wide JSON envelope.

## Operations

```text
GET   /metrics       Prometheus metrics
GET   /readyz        200 when ready; 503 while draining
POST  /admin/drain   stop accepting new work while existing streams finish
```

These routes sit outside `/v1` and do not use Anthropic beta headers. Protect the
drain endpoint at the deployment boundary.

## Related

- [Expose HTTP with SSE](/docs/agents/how-to/expose-http-sse/): assembly and streaming behavior
- [Console and API ownership](/docs/agents/reference/admin-console/): configuration lifecycle
- [Managed Agents compatibility](/docs/agents/compatibility/): exact wire support and divergences
