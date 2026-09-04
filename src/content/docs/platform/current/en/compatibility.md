---
title: "Check whether an Anthropic Managed Agents client can run on Awaken"
description: "Decide whether an existing client can connect as-is, needs a named adaptation, or should use an Awaken-native API."
evidence:
  - "crates/server/awaken-protocol-managed/src/lib.rs"
section: "Start"
order: 2
---

Use this page before changing an existing Anthropic Managed Agents client. Name
the SDK version and resource family you use, then choose one of the four outcomes
below. Do not treat “the request reached the server” as proof that the whole
client is compatible.

This page does not cover migration from an earlier Awaken runtime or local
server. Use the [Awaken 1.0 migration guide](./how-to/migrate-to-1-0) for product,
configuration, storage, and deployment changes, then return here for the
Managed client decision.

## Make the compatibility decision first

| What you find | What to do |
| --- | --- |
| The resource family is **Compatible**, and the client's SDK version is covered by the matrix with the required beta and Awaken authentication | Change the connection settings, run one minimal Session, then test the operations your application actually uses. |
| The family is **Compatible with constraints** or names a header divergence | Apply the named constraint before migration. Keep that adaptation visible in the client rather than assuming drop-in behavior. |
| The application needs an **Awaken extension** | Use the documented Awaken route or field explicitly. Do not present that code path as Anthropic baseline compatibility. |
| The SDK version or API is outside the tables | Treat it as unreviewed. Test the resource families your application uses, use a documented Awaken-native API, or wait for a compatibility review. |

The current validation record covers **`@anthropic-ai/sdk` 0.122.0** and
**Python `anthropic` 1.2.0**. Both expose 127 generated operations in the
reviewed Managed surface. The TypeScript matrix also exercises 0.121.0,
0.117.1, and 0.105.0; the Python matrix covers every selected change point from
0.92.0 through 1.2.0. These are tested versions, not dependency requirements.
Choose versions under your own dependency policy, then use this page to see
what was actually exercised. At Awaken revision
`50d5035c68456c9106626f748cf4c169c2057beb`, the operation manifest maps all
127 current SDK methods and 12 reviewed SDK-absent documented routes to named
executable scenarios. Compatibility applies only to the named paths, methods,
DTOs, errors, helpers, and constraints on this page.

## Connect the official SDK

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'http://localhost:8080',
  apiKey: process.env.AWAKEN_API_KEY ?? 'local',
});

const session = await client.beta.sessions.create({
  agent: process.env.AWAKEN_AGENT_ID,
  environment_id: process.env.AWAKEN_ENVIRONMENT_ID,
});
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: 'user.message',
    content: [{ type: 'text', text: 'Summarize RFC 8259.' }],
  }],
});
```

Changing the base URL is not the only integration change: configure Awaken
authentication. Official Managed resource methods add their required beta
selector. Raw HTTP clients must send it themselves. Awaken accepts
`x-api-key: <token>` or `Authorization: Bearer <token>`.

Before migrating the full application:

1. Record the SDK version you chose and find every resource family the client calls.
2. Set `baseURL` and Awaken authentication; confirm the SDK method adds the expected beta selector.
3. Create one Session, send one event, and inspect the returned error envelope.
4. Apply every constraint used by the application, then test its retry and
   archive paths.

## How to use the design references

This page is the single public owner of compatibility and divergence claims.
The [Managed Agents protocol page](/docs/agents/protocols/managed-agents/) only
explains how this wire enters the runtime. Each meaningful constraint below
links to the page that explains its ownership, state changes, failure handling,
and deployment responsibility. That design page explains why the behavior
exists; this page remains the place to decide whether a client can use it.

## SDK validation matrix

| Client | Reviewed versions | Evidence run against Awaken | Result boundary |
| --- | --- | --- | --- |
| TypeScript `@anthropic-ai/sdk` | 0.122.0 current; 0.121.0, 0.117.1, and 0.105.0 change points | Exact method, path, query, beta selector, request and response shape, typed errors, retry behavior, pagination, SSE, helper exports, real-process lifecycle, and restart recovery | Current 0.122.0 has 127 generated operations. The 0.122.0 removal of `resolveSkillVersion` is an upstream source change, not an Awaken shim. |
| Python `anthropic` | 1.2.0 current; 12 selected change points from 0.92.0 through 1.1.0 | All 127 current operations through sync and async clients, five generated helper entrypoints, typed errors, middleware and credential providers, real-process lifecycle, restart recovery, and 3,827 declaration-derived response witnesses | One reviewed upstream type variance remains on `BetaSelfHostedWork.data`: Python 1.2.0 omits the `healthcheck` branch from its annotation, while the wire and live poller accept both branches. |
| Raw HTTP | Current documented route families | Rust wire schemas, route behavior, negative admission, persistence, and process-replacement tests | Raw callers own authentication, `anthropic-version`, and the resource family's beta selector. Awaken extensions remain outside the Anthropic baseline. |

This matrix is worth publishing because “SDK compatible” has more than one
failure mode. A route can exist while a generated method, helper, retry rule,
stream decoder, or response DTO still differs. The matrix shows which client
and behavior were tested, while the resource matrix below answers which API
family an application can use.

Use Anthropic's [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview),
[Session operations](https://platform.claude.com/docs/en/managed-agents/session-operations),
and the official [TypeScript](https://github.com/anthropics/anthropic-sdk-typescript)
and [Python](https://github.com/anthropics/anthropic-sdk-python) SDK repositories
as the upstream reference. This page records Awaken's tested projection and
differences; it does not replace those sources.

## Beta-header decision table

The server parses comma-separated values and repeated `anthropic-beta` headers.
Missing a required beta returns a Managed `invalid_request_error`.

| Resource family | Required beta value | Relationship to Managed beta |
| --- | --- | --- |
| Agents, Sessions, Environments, Deployments, Deployment Runs, Vaults | `managed-agents-2026-04-01` | Required |
| Dreams | `dreaming-2026-04-21` | Family beta required; Managed beta is not required |
| Memory Stores, Memories, Memory Versions | `agent-memory-2026-07-22` for current SDKs; legacy `managed-agents-2026-04-01` is also accepted alone | Send exactly one selector; sending both is rejected |
| Files through current SDK Beta and GA namespaces | none | Current 0.122.0 and Python 1.2.0 keep `beta=true` on Beta methods but omit the legacy Files selector. Older clients may still send `files-api-2025-04-14`. |
| Skills and Skill Versions through current SDK Beta and GA namespaces | none | Current 0.122.0 and Python 1.2.0 keep `beta=true` on Beta methods but omit the legacy Skills selector. Older clients may still send `skills-2025-10-02`. |
| User Profiles | SDK 0.122.0 sends `user-profiles-2026-08-18`; legacy `user-profiles-2026-03-24` remains accepted | Family beta required; Managed beta is not required |
| Tunnels and Certificates | `mcp-tunnels-2026-06-22` | Family beta required; Managed beta is not required |
| GA Files, Skills, and Models in SDK 0.122.0 | none | No beta gate; the same resource authority serves the GA and beta roots |
| Skill version file route not generated by the current SDK | `skills-2025-10-02` | Required only for `GET /v1/skills/{id}/versions/{version}/files/{path}?beta=true` |

The Dreams SDK methods add the dreaming beta themselves. Awaken accepts that
generated request without requiring the Managed beta on `/v1/dreams`.

## Compatibility matrix

| Official SDK surface | Status in Awaken | Boundary |
| --- | --- | --- |
| Agents and Agent Versions | Compatible | Create, list, retrieve, update, archive, and version listing use the official Managed routes and DTOs. |
| Sessions, Events, Threads, and Session Resources | Compatible with constraints | CRUD/archive, event history, event creation, thread history, and SSE routes are implemented. See [Sessions and events](/docs/agents/concepts/sessions-and-events/) and the constraints below. |
| Environments and Work | Compatible | Environment lifecycle and deferred-work lease/ack/heartbeat/stop routes are implemented. Physical Sandbox timing is an Awaken execution concern; see [Brain, Hand, and Session Environment](/docs/agents/concepts/brain-and-hand/). |
| Deployments and Deployment Runs | Compatible | Official lifecycle and run routes are implemented. |
| Vaults and Credentials | Compatible | Official lifecycle, archive, and `mcp_oauth_validate` routes are implemented. Secret custody and last-mile realization follow [Awaken's custody design](/docs/agents/concepts/credential-custody/). |
| Memory Stores, Memories, and Memory Versions | Compatible with header constraint | Paths use `/memories`; the Memory beta is exclusive as described above. |
| Files | Compatible across the GA projection transition | SDK 0.122.0 GA and query-only Beta multipart upload, metadata, content download, list, and delete are implemented. Legacy Files selectors still select the reviewed older projection. |
| Skills and Skill Versions | Compatible across the GA projection transition | SDK 0.122.0 GA and query-only Beta create, version upload, metadata, list, and delete are implemented. Legacy Skills selectors remain accepted; the SDK-absent single-file route keeps its explicit selector. |
| User Profiles | Compatible across the reviewed beta transition | CRUD/list and enrollment URL accept the 0.122.0 `access_type` vocabulary and the legacy `relationship` vocabulary under their respective beta selectors. |
| Dreams | Compatible under the Dreams beta | Create, retrieve, list, archive, and cancel are implemented under `dreaming-2026-04-21`. |
| Tunnels and Certificates | Compatible | Tunnel lifecycle and certificate operations are implemented under the Tunnels beta. |
| Models | Compatible | SDK 0.122.0 GA and beta list/retrieve are implemented. Availability reflects Awaken's configured catalog. |

“Compatible” applies to the named wire contract. Model availability, credentials,
sandbox capacity, and backend placement are Awaken configuration concerns and
can still cause a valid request to fail explicitly.

## Known differences and constraints

| Case | Current behavior | Public design owner |
| --- | --- | --- |
| SDK authentication and beta admission | Changing `baseURL` is insufficient. Awaken authentication and the resource family's beta selector are required. | [Managed Agents protocol](/docs/agents/protocols/managed-agents/) |
| `vault_ids` on Session create | Supported and frozen into the secret-free Session baseline. | [Credential custody](/docs/agents/concepts/credential-custody/) and [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| `vault_ids` on Session update | Rejected with `400`; an existing Session's frozen credential baseline is not mutated. | [Credential custody](/docs/agents/concepts/credential-custody/) and [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Vault secret storage and delivery | The wire is compatible, but the installed self-hosted, hosted, or enterprise custody composition determines the material authority and last-mile holder. Compatibility does not imply Anthropic-hosted secret infrastructure. | [Credential custody and last-mile realization](/docs/agents/concepts/credential-custody/) |
| Session `initial_events` count | `0..50`. An idempotency key cannot be combined with non-empty `initial_events`. | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| `system.message` in Session `initial_events` | Rejected. Deployment initial events do allow it under their distinct batch policy. | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| `user.define_outcome` in Session `initial_events` | At most one; `max_iterations` must be `1..20`. | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Deployment `initial_events` | Requires `1..50`; a final `system.message` immediately after its user message is accepted, and outcome `max_iterations` remains `1..20`. | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| `agent.thinking` projection | Awaken emits the SDK's contentless marker from committed inference progress, but never exposes provider reasoning text. History and replay preserve stable event identity. | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Session creation and Sandbox creation | They are separate. Accepted `on_tool_use` policies may leave a Native, inference-only Session without a Sandbox until the first Hand tool; local filesystem demand can force eager realization, and non-Native deferred provisioning is rejected. | [Brain, Hand, and Session Environment](/docs/agents/concepts/brain-and-hand/) |
| Skill discovery and body loading | A Session with filesystem tools uses Anthropic-compatible prompt catalog metadata and `SKILL.md` file loading without semantic Skill tools. A Native Session with every filesystem tool disabled uses `list_skills` and `Skill`. Each Session freezes exactly one projection. | [Use Skills Subsystem](/docs/agents/runtime/how-to/use-skills-subsystem/) |
| Files and Skills Beta-to-GA projection | Current SDK Beta methods send `beta=true` without the old dated selector, so Awaken returns the post-GA shape. Reviewed older selectors still select their older projections. The SDK-absent Skill single-file route remains explicitly gated. | [Managed Agents protocol](/docs/agents/protocols/managed-agents/) |
| User Profiles beta transition | SDK 0.122.0 sends `user-profiles-2026-08-18` and uses `access_type`; the prior `user-profiles-2026-03-24` selector and `relationship` vocabulary remain accepted for reviewed older clients. | [Managed Agents protocol](/docs/agents/protocols/managed-agents/) |
| Anthropic APIs outside the table | No compatibility claim. Use only documented Awaken routes. | [API reference](/docs/agents/reference/api/) |

## Awaken extensions

Extensions share the same governed objects, but are not part of the Anthropic
baseline. Most use distinct route families:

| Extension | Public surface | Public design owner |
| --- | --- | --- |
| Live Inbox and full resource-manifest replacement | `/v1/awaken/sessions/*` | [Live Inbox](/docs/agents/protocols/live-inbox/) and [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Durable run control, recovery, pause/resume, and dead letters | `/v1/durable/*` | [Production reliability](/docs/agents/concepts/production-reliability/) |
| Provider, model, credential, Agent-authoring, and webhook-subscription configuration | `/v1/config/*` | [Model publication](/docs/agents/reference/provider-model-config/) and [Credential custody](/docs/agents/concepts/credential-custody/) |
| Sandbox execution and dream policy | `/v1/awaken/*` | [Brain, Hand, and Session Environment](/docs/agents/concepts/brain-and-hand/) |
| AI SDK, AG-UI, A2A, and MCP adapters | Their documented protocol paths | [Protocol connection matrix](/docs/agents/protocols/connect/) |
| Application access tokens and workspace path projection | `/v1/application-access-tokens`, `/v1/workspaces/*` | [Governance](/docs/agents/concepts/governance/) |

A small number of extensions intentionally sit beside or inside compatible
shapes and therefore must be handled explicitly by strict clients:

| Extension | Location | Public design owner |
| --- | --- | --- |
| Disable an Agent | `POST /v1/agents/{id}/disable` | [Configuration to execution](/docs/agents/concepts/configuration-to-execution/) |
| Launch an MCP server inside the Session sandbox | Agent MCP server variant `type: "sandbox_stdio"` | [MCP](/docs/agents/protocols/mcp/) and [Brain/Hand](/docs/agents/concepts/brain-and-hand/) |
| Seed an Awaken transcript | `SessionCreateParams.x_awaken.transcript_prefix` | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Select an ACP backend profile | `ModelConfig.id` with the `executor=acp:<id>` qualifier | [Select models and ACP runtimes through the API](/docs/agents/how-to/select-models-and-acp-runtimes/) |
| Bind uploaded files to Awaken resources | File metadata fields `purpose`, `session_id`, `logical_path`, and the `purpose` list filter | [Sessions and events](/docs/agents/concepts/sessions-and-events/) |
| Read one file from a Skill version | `GET /v1/skills/{id}/versions/{version}/files/{path}` | [API reference](/docs/agents/reference/api/) |

These fields and routes are extensions; a client that wants only baseline
behavior should not send or depend on them. The canonical application route-family
index is [API reference](/docs/agents/reference/api/).

## Execution extensions: Native, ACP, and A2A

The compatible wire does not fix the execution backend. An immutable published
model binding selects one of:

- a Native in-process backend;
- a supported ACP CLI backend such as Claude Code, Codex, Gemini, OpenCode, or
  Hermes;
- a remote A2A endpoint.

ACP runtime choice is separate from sandbox placement (`local`, `namespace`,
`docker`, `podman`, or `k8s`). Exact model selection, credential delivery, and
session persistence differ by ACP implementation. See
[Select models and ACP runtimes through the API](/docs/agents/how-to/select-models-and-acp-runtimes/)
for selectors and publication boundaries, then the
[ACP runtime matrix](/docs/agents/protocols/acp/) for per-runtime differences.
