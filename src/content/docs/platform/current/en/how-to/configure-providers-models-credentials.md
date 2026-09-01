---
title: "Make one provider model runnable"
description: "Choose an authentication path, verify the connection, select a ready model, and publish it with an Agent."
evidence:
  - "crates/control/awaken-admin-config-api/src/router/provider_connections.rs"
  - "web/src/surfaces/provider-connection-panel.tsx"
section: "Build"
subsection: "Agent setup"
order: 12
---

Use this guide to make one model runnable for a new Agent.

## Goal

Finish with a `ready` Provider Connection, a `ready` candidate from
`/v1/config/executable-models`, and a new Session started from the published
Agent.

## Prerequisites

- Awaken AllInOne or the Control role is running;
- the caller can write configuration in the target Workspace;
- one supported API key, OAuth helper, or existing credential reference;
- `curl` for the automation path.

## 1. Choose the connection you are creating

Decide how Awaken should authenticate before entering any credential:

| What you have | Send | Continue when |
| --- | --- | --- |
| A provider API key | write-only `secret` | authentication and model discovery succeed |
| A supported OAuth flow | `oauth_helper` | the helper returns a usable credential reference |
| A credential already held by the deployment | `credential_source_id` | the referenced credential can be opened and tested |
| A custom endpoint | the descriptor-supported dialect and required configuration | the endpoint returns at least one model |

If the server has no discovery adapter for the connection, stop and install that
capability. Do not create Provider, endpoint, credential, and model objects by hand.

## What Provider Connection changes

Provider Connection is the only authoring command for a provider credential and
endpoint. It tests authentication and model discovery before saving the Provider,
endpoint, credential reference, and discovered offerings together. The lower-level
objects keep their separate execution responsibilities; callers use this one
command instead of coordinating four writes.

## 2. Inspect supported provider descriptors

The server owns provider kinds, dialects, authentication methods, defaults, and
required configuration fields:

```console
curl http://127.0.0.1:8080/v1/config/provider-descriptors
```

Use the returned descriptor rather than hard-coding a second provider registry in
deployment scripts or documentation.

The built-in descriptors currently cover Anthropic, OpenAI, OpenRouter, DeepSeek,
Kimi, Google AI Studio, and Vertex AI. Each descriptor tells the Console which
authentication methods, API formats, fields, default endpoints, documentation
link, and model-discovery behavior to show. The server remains the source of
truth when that list changes.

## 3. Verify and save one connection

The Console path is **Models & providers → Provider connections → choose a
provider and authentication method**. Choose **New API key** to open a write-only
field and the selected provider's official key documentation. Choose **Use
existing** when Awaken already holds an active credential for that provider.
Vertex AI uses the `gcloud` OAuth helper instead.

Select **Verify & import models**. Awaken reads the provider's model directory and
saves the connection, credential reference, and imported models only after the
check succeeds. The card reports the number of imported models, and the Catalog
marks them as provider-synced. The same command is available over HTTP. This
Anthropic example uses a write-only API key:

```console
export PROVIDER_API_KEY=your-provider-key
export IDEMPOTENCY_KEY="provider-connection-$(date +%s)"

curl -sS -X POST http://127.0.0.1:8080/v1/config/provider-connections \
  -H 'content-type: application/json' \
  --data-binary @- <<JSON
{
  "idempotency_key": "${IDEMPOTENCY_KEY}",
  "workspace_id": "wrkspc_default",
  "provider_id": "anthropic",
  "display_name": "Anthropic",
  "credential_name": "Anthropic primary",
  "dialect": "anthropic_messages",
  "configuration": {},
  "timeout_secs": 60,
  "secret": "${PROVIDER_API_KEY}"
}
JSON
```

Exactly one of `secret`, `oauth_helper`, or `credential_source_id` is required.
Retry an uncertain request with the same idempotency key; do not create another
credential as a retry strategy. The response includes Provider, endpoint,
credential metadata, and catalog-sync results, but never echoes secret material.

## 4. Inspect connection and model readiness

```console
curl 'http://127.0.0.1:8080/v1/config/provider-connections?workspace_id=wrkspc_default'
curl 'http://127.0.0.1:8080/v1/config/executable-models?workspace_id=wrkspc_default'
```

Connection state and executable-model readiness are server-owned projections:

> `/v1/config/executable-models` currently reports Native-executor readiness
> only. Publication validates the exact ACP capability when an ACP runtime is
> selected. See [Select models and ACP runtimes through the API](./select-models-and-acp-runtimes)
> for the selector and this boundary.

| Result | Meaning | Action |
| --- | --- | --- |
| Connection `ready` | active credential and at least one active discovered model | select a model whose executable readiness is also `ready` |
| Connection `connected` | endpoint and credential exist, but no offering is available | rerun discovery or repair provider access |
| Connection `stale` | active models were not seen within the freshness window | verify the connection again before publication |
| Connection `needs_attention` | no active credential remains | rotate or replace the credential through the same connection path |
| Model `credential_unavailable` | offering exists but no usable credential can be pinned | repair credential availability |
| Model `offering_unavailable` or `runtime_unavailable` | catalog or execution capability cannot realize the model | choose a ready candidate or add the missing Runtime capability |

Do not infer readiness in a frontend from separate catalog and credential lists.

## 5. Publish the Agent

Choose a model marked `ready` in the Agent quickstart or configuration editor,
review the draft, and publish. Publication resolves and freezes provider, endpoint,
credential id/revision, route, and fallback order into the execution snapshot.
Later catalog or credential changes do not silently alter a running Session.

## Verify

- the provider connection reports `ready`;
- the Console reports **Credential verified and models imported** with a model count;
- imported Catalog rows identify **Provider sync** as their source;
- `/v1/config/executable-models` contains at least one `ready` candidate;
- **Test** returns a visible response through a real Session;
- the selected Agent validates and publishes;
- a new Session uses the publication while an existing Session keeps its prior snapshot.

## Troubleshooting

If the table does not resolve the problem, record the Workspace, Provider
Connection ID, idempotency key, provider kind, dialect, connection state,
executable-model state, upstream HTTP status, and correlation ID before
contacting support. Do not include the provider secret or OAuth material.

| Symptom | Check | Action |
| --- | --- | --- |
| `connection_auth_invalid` | request supplied zero or multiple authentication methods | send exactly one supported method |
| `connection_test_unavailable` | no discovery adapter is installed | enable the provider discovery capability; do not save an unverified endpoint manually |
| provider rejects the credential | connection response and upstream status | rotate the credential, retain the same connection identity, and verify again |
| models import but none is executable | executable-model readiness | repair the named credential, offering, or Runtime dependency |
| publication later fails closed | archived or revision-mismatched frozen candidate | republish after repairing the connection; never inject an ambient Worker credential |

## Next steps

- [Configure and publish Agent behavior](./configure-agent-behavior);
- [Select models and ACP runtimes through the API](./select-models-and-acp-runtimes);
- [Run the official-SDK quickstart](../get-started);
- inspect the [model publication and credential boundary](../reference/provider-model-config);
- use the generated [management OpenAPI contract](../reference/management-openapi) for exact request schemas.
