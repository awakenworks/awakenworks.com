---
title: "Deployment configuration"
description: "The schema-versioned TOML shared by Awaken Workforce Server, Orchestrator, and Agent Worker roles."
section: "Reference"
order: 11
---

Awaken Workforce process configuration has one authority: the TOML selected by
`--config`, or the platform configuration directory's
`awaken-flow/config.toml` when omitted. The preview distribution includes the
maintained example.

## Commands

```sh
awaken-flow config validate --config ./awaken-flow.toml
awaken-flow config show --config ./awaken-flow.toml
awaken-flow config schema > awaken-flow.schema.json
```

Validation rejects unknown fields, unsupported `schema_version`, invalid values,
missing referenced files, inconsistent Worker credentials, and incomplete role
configuration. `show` prints a normalized, secret-safe form. `schema` prints the
JSON Schema generated from the same Rust types as the runtime parser.

## Top-level schema

| Key | Purpose |
| --- | --- |
| `schema_version` | Deployment document compatibility; the current value is `1`. |
| `vault_seal_key_file` | File containing the Awaken credential-vault seal key. |
| `storage` | SQLite paths or a Postgres URL and pool settings. |
| `worker_credentials` | Named signed Worker identities; secret material remains file-backed. |
| `agent_execution` | Credentials accepted by the Server and optional checkpoint directory. |
| `iam` | `none`, `local`, or `cloud` identity mode. |
| `pack` | Studio switch and trust, signer, Registry, curated-release, and credential files. |
| `server` | Listener, public URL, and embedded-role switches. |
| `orchestrator` | Reserved typed configuration for the Orchestrator role. |
| `agent_worker` | Credential, control URL, ACP CLIs, sandbox tier, and sandbox paths. |
| `runtime` | Lease, timeout, sweep, retry, clock, and node-id tuning. |
| `ssh` | Optional known-hosts file, command allowlist, and SSH binary. |

## Storage variants

```toml
[storage]
kind = "sqlite"
work_db = "/var/lib/awaken-flow/work.db"
awaken_db = "/var/lib/awaken-flow/awaken.db"
registry_db = "/var/lib/awaken-flow/registry.db"
```

For Postgres, use `kind = "postgres"` with `url`, optional `registry_url`,
`pool_size`, and `connect_timeout_secs`. All process roles must agree on the
deployment boundary; an Agent Worker remains database-less and reaches the
Server through `agent_worker.control_url`.

## Composition switches

| `embedded_orchestrator` | `embedded_agent_worker` | Server process behavior |
| --- | --- | --- |
| `true` | `true` | Complete local topology |
| `true` | `false` | Server plus Orchestrator; external Agent Worker |
| `false` | `true` | Server plus Agent Worker; external Orchestrator |
| `false` | `false` | Control-only Server; both roles external |

## Ownership boundary

This document deliberately contains no provider endpoint, model identifier, or
provider API key. Awaken's persisted model catalog, config publication, and
credential vault own model connectivity. Workforce configuration selects process
composition; it must not become a parallel model configuration path.

See [deployment topologies](/docs/workforce/operating/deployment-topologies/) for
startup and recovery sequences. The generated `config schema` output is the exact
machine-readable field/default contract for the checkout; this page deliberately
does not duplicate every optional runtime knob.
