---
title: "Choose and deploy a self-hosted topology"
description: "Start with AllInOne, stop at a durable single node when it is enough, or split Control, Coordinator, and database-free Workers."
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "crates/bin/awaken-worker/src/admin.rs"
  - "crates/server/awaken-run-ingress-http/src/durable_ops.rs"
section: "Operate"
subsection: "Deployment"
order: 10
---

Use this guide to choose the smallest deployment you can operate safely. Start
with AllInOne. Move to a durable single node when one machine is enough. Split
Control, Coordinator, and Workers only when their isolation or scaling boundary
solves a requirement you already have.

## Goal

Finish at one of three stopping points below. Before it receives traffic, the
chosen topology should load one redacted effective configuration, start with the
expected role, preserve the same published Agent and Session across a restart,
and expose a recovery path you have exercised.

## Choose where to stop

| Need | Stop at | Do not move on until |
| --- | --- | --- |
| evaluate or develop on one machine | local AllInOne | Console, API, local Worker, and restart recovery work from one process |
| operate on one durable machine | hardened AllInOne | persistent storage, stable seal key, authenticated ingress, monitoring, and tested backup restoration are in place |
| isolate authority or scale execution separately | split services | PostgreSQL schemas, private service authentication, and database-free Worker dispatch work end to end |

Splitting processes does not create a second Agent catalog or Session path. Every
topology runs the same Control, Coordinator, Resources, Worker, and Runtime
responsibilities.

## Prerequisites

- complete [Get started](../get-started) and run the same Agent in AllInOne;
- choose persistent storage, secret custody, ingress, identity, and backup owners;
- for split services, provide PostgreSQL and a private authenticated network;
- choose a maintenance window and rollback point before schema migration.

Do not begin with a split cluster before the same Agent succeeds in AllInOne.

## 1. Create and validate one configuration document

Deployment configuration is TOML, not `AWAKEN_*` environment variables. Start
with a local service profile:

```toml
role = "all-in-one"
mode = "local"
data_dir = "/srv/awaken"
bind = "127.0.0.1:8080"
run_local_pool = true
no_browser = true
```

Validate what the process will use:

```console
awaken config --config /etc/awaken/config.toml
awaken all-in-one --config /etc/awaken/config.toml
```

`awaken config --json` is suitable for deployment assertions because secrets and
database URLs remain redacted. The complete key reference is
[Deployment configuration](../reference/configuration).

## 2. Harden a single node

- Put `data_dir` on persistent storage and back it up with its embedded stores.
- Supply exactly one stable `control_seal_key_file` or other documented Control
  seal-key source. Keep it outside the image and configuration repository.
- Choose `identity_mode` deliberately and place public ingress behind TLS and an
  authenticated gateway.
- Keep the service on a private listener when the proxy owns TLS. Disable proxy
  buffering on SSE routes.
- Select a Sandbox tier that meets the risk floor; do not enable local fallback
  merely to make startup green.
- Configure `log_filter`, structured logging/OTLP, content-capture policy,
  retention, and backup restoration before calling the node production-ready.

Local mode migrates embedded stores at startup. This convenience does not apply
to a shared server deployment.

## 3. Split Control and Coordinator

Run exactly these role commands:

```console
awaken control --config /etc/awaken/control.toml
awaken coordinator --config /etc/awaken/coordinator.toml
```

Control owns Agent publication, IAM, credential mutation, admin audit, and Data
Subject consent. Coordinator owns executable registration, Deployment, Session,
Environment execution state, dispatch, commits, and captured content. Configure
their store fields accordingly; role validation rejects cross-owned databases.

Control must set `coordinator_internal_url`. Both sides read the same
`executable_agent_registration_token_file`. The reverse Coordinator-to-Control
application boundary uses `control_internal_url` and
`control_service_token_file`. Project these least-scope token files through your
secret manager; never put token values in TOML.

## 4. Migrate shared schemas before starting services

Set `mode = "server"` and PostgreSQL store URLs in the role-owned configuration.
Then run a migration job before application Pods:

```console
awaken database migrate --config /etc/awaken/migration.toml
```

Server processes verify the existing schema and do not write DDL at startup. A
split Coordinator requires `runtime_database_url`. Shared Runtime and Resources
must use compatible shared stores; startup fails closed on a mixed shape that
could leave one node reading private embedded state.

## 5. Add database-free Workers

```toml
role = "worker"
mode = "server"
worker_server = "http://awaken-coordinator:8080"
worker_id = "worker-a"
worker_zone = "zone-a"
worker_credential_material_root = "/run/awaken/credentials"
worker_credential_trust_domain = "awaken.worker"
sandbox_tier = "namespace"
```

```console
awaken-worker --config /etc/awaken/worker.toml --server http://awaken-coordinator:8080
```

Workers reject every authority database field, Control seal key, and private
Control/Coordinator service token. They register capabilities, claim and renew
leased work, materialize only exact referenced credentials/Resources, commit
through the fenced Coordinator protocol, and settle under the same epoch.

For container tiers, add the matching feature/runtime and `container_image`.
See [Configure Sandbox tiers](./configure-sandbox-tiers).

## 6. Configure cross-node wake-up only after durable dispatch works

The dispatch database owns work. `dispatch_wake = "pg-notify"` or `"nats"`
only reduces the time an idle Worker waits before polling. Use a unique
`dispatch_owner` per process and verify takeover with the wake channel disabled
before relying on it for latency. See [Use a NATS wake signal](./use-nats-wake-signal).

## Verify

Before sending traffic:

- `awaken config --json` reports the intended role and effective values while
  keeping secrets and database URLs redacted;
- the process restarts against the same storage and reopens the same published
  Agent and Session;
- a shared-server deployment completes `awaken database migrate` before any
  application process starts;
- split Control registers the publication, Coordinator dispatches it, and a
  database-free Worker reaches a terminal commit;
- TLS, authentication, SSE proxying, logging, retention, and backup restoration
  behave as your operating policy requires;
- dispatch takeover succeeds with the wake channel disabled.

## Troubleshooting

If the table does not resolve the problem, record the Awaken version, topology,
exact binary, sanitized config report, health response, Session or Run ID, and
correlation ID before contacting support. Do not include tokens, seal keys,
credential files, or database URLs.

| Symptom | Check | Action |
| --- | --- | --- |
| A process rejects a database or seal-key field | exact binary schema and named config key | Remove the unsupported field; do not switch to a broader process to bypass validation |
| Control publishes but registration fails | Coordinator URL, TLS, authentication status, and correlation ID | Preserve the publication, repair the connection, and retry the same registration |
| Coordinator refuses startup | startup error for shared runtime DB, schema, or private Control URL | Correct the named configuration or run migration before starting traffic |
| A known pending Run remains unclaimed after automatic draining | Confirm `GET /readyz` returns `200`, then use the Run's `GET /v1/durable/threads/{thread}/dispatches` response to compare its placement requirements with Worker capability and capacity | Restore the failed readiness, connection, capability, or capacity check. An idle Worker without a pending eligible Run is healthy and needs no repair. |

### Roll back a split deployment

Stop new ingress, drain Workers, and run the
same canonical components in AllInOne against a store layout that AllInOne is
authorized to open. Do not copy Coordinator projection rows into Control or
invent a second warm-install path.

## Next steps

- [Review the complete deployment configuration](../reference/configuration).
- [Choose a Sandbox tier](./configure-sandbox-tiers).
- [Add NATS only as a wake signal](./use-nats-wake-signal).
- [Review production reliability and recovery](../concepts/production-reliability).
- [Review the platform architecture and authority boundaries](../concepts/architecture).
