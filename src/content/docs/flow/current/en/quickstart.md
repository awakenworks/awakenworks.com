---
title: "Open your first Awaken Workforce Issue"
description: "Start Workforce from source, bootstrap one Project, and open its first Issue in the local workspace."
section: "Start"
order: 1
---

This guide starts Awaken Workforce on your machine and creates one Issue with the
`project bootstrap` command. You are done when the browser shows **Explore
Awaken Workforce** inside the bootstrapped Project.

This first Issue does not run a live model. It gives you the Workforce workspace,
Project, Workflow, and work record that later Agent runs will use.

## Before you start

You need:

- Rust stable and Cargo;
- Node.js 22 or later and pnpm 11;
- a local `awaken-flow` source checkout at the revision shown above this page;
- OpenSSL to create two local evaluation secrets.

Cargo fetches the Git dependencies pinned by the Workforce repository. The steps
below keep configuration, secrets, and SQLite files under one explicit
`/tmp/awaken-flow-evaluation` directory.

## 1. Prepare the local files

Run these commands from the `awaken-flow` repository root:

```sh
mkdir -p /tmp/awaken-flow-evaluation
umask 077
openssl rand -hex 32 > /tmp/awaken-flow-evaluation/vault-key
openssl rand -hex 32 > /tmp/awaken-flow-evaluation/worker-key
cp docs/examples/awaken-flow.toml /tmp/awaken-flow-evaluation/awaken-flow.toml
```

Open `/tmp/awaken-flow-evaluation/awaken-flow.toml` and change these paths:

| Field | Local value |
| --- | --- |
| `vault_seal_key_file` | `/tmp/awaken-flow-evaluation/vault-key` |
| `storage.work_db` | `/tmp/awaken-flow-evaluation/work.db` |
| `storage.awaken_db` | `/tmp/awaken-flow-evaluation/awaken.db` |
| `storage.registry_db` | `/tmp/awaken-flow-evaluation/registry.db` |
| `worker_credentials."agent-worker-v1".signing_secret_file` | `/tmp/awaken-flow-evaluation/worker-key` |

Keep the example's local evaluation settings:

```toml
[iam]
mode = "none"
org_id = "local-org"
workspace_id = "local-workspace"

[server]
listen_addr = "127.0.0.1:7979"
embedded_orchestrator = true
embedded_agent_worker = true
```

Model providers and API keys do not belong in this deployment document. Awaken's
model catalog and credential vault own them when you add live Agent execution.

## 2. Check the deployment document

```sh
cargo run -p awaken-flow-server -- config schema \
  > /tmp/awaken-flow-evaluation/awaken-flow.schema.json

cargo run -p awaken-flow-server -- \
  config validate --config /tmp/awaken-flow-evaluation/awaken-flow.toml

cargo run -p awaken-flow-server -- \
  config show --config /tmp/awaken-flow-evaluation/awaken-flow.toml
```

Continue when `validate` prints `deployment configuration is valid`. `show`
prints the normalized configuration without secret contents. Fix the reported
field or file before starting the server.

## 3. Start the complete local process

```sh
cargo run -p awaken-flow-server -- \
  --config /tmp/awaken-flow-evaluation/awaken-flow.toml
```

Leave this terminal running. The default command starts the Server, embedded
Orchestrator, and embedded Agent Worker. The separate production roles are
`server`, `orchestrator`, and `agent-worker`; they are not needed for this guide.

## 4. Bootstrap the Project and Issue

Open a second terminal at the repository root and copy the two request examples:

```sh
cp contracts/examples/project-bootstrap.json \
  /tmp/awaken-flow-evaluation/project-bootstrap.json
cp contracts/examples/create-first-issue.json \
  /tmp/awaken-flow-evaluation/create-first-issue.json
```

Edit `project-bootstrap.json` and set `project.workspace_id` to
`local-workspace`, matching the deployment document. Then run:

```sh
cargo run -p awaken-flow-server -- project bootstrap \
  --server http://127.0.0.1:7979 \
  --request /tmp/awaken-flow-evaluation/project-bootstrap.json \
  --first-issue /tmp/awaken-flow-evaluation/create-first-issue.json \
  --wait
```

The JSON output should contain `"configuration_ready": true` and a
`first_issue` object titled **Explore Awaken Workforce**. Rerunning the same command
uses the same idempotency key and is safe. It calls the Bootstrap API; it does
not write the database directly.

This guide uses `iam.mode = "none"` on a loopback listener. If you later switch
to local authentication, pass `--token-file` with the owner-only
`flow-admin-token` path printed by the Server.

## 5. Open the Workforce workspace

In a third terminal:

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173` and select `local-workspace`. **Home** shows the
workspace delivery path and Project directory. Open **First project**:

1. use **Overview** to confirm Project readiness and see any blocking setup;
2. open **Issues** and confirm the list contains **Explore Awaken Workforce**;
3. open that Issue and inspect **Your next step**, **Diagnosis**, Workflow
   progress, and the worklog.

This bootstrap creates a first Issue, not a claimed customer Outcome. Later, use
**Commission outcome** on Workspace Home when you have a real result and formal
acceptance boundary to record. Live Agent execution comes after you publish an
Agent and configure its model, provider, credential, and signed Worker. Business
Resources and external acceptance evidence remain Objects responsibilities.

## When the result differs

| Symptom | Check | Action |
| --- | --- | --- |
| Configuration validation cannot read a secret | The two file paths and owner read permission | Point the document at the files created in step 1; do not place secret text in TOML. |
| Configuration validation reports another field | The named field and generated schema | Correct the deployment document and run `config validate` again. |
| Bootstrap does not become ready | Readiness response and `plan_digest` | Repair the reported Project configuration, then rerun the same command. |
| Bootstrap returns unauthorized | `iam.mode` and Server startup output | For local auth, pass the printed owner-only token with `--token-file`. |
| The browser cannot reach the API | Server address and Vite proxy target | Keep ports `7979` and `5173`, or change the proxy and browser URL together. |
| The workspace opens but the Issue is absent | Bootstrap JSON output, **First project**, and selected workspace | Confirm that `first_issue` exists, the UI shows `local-workspace`, and the selected Project is **First project**. |

## Stop or start over

Stop each foreground process with `Ctrl-C`. Keep the evaluation directory to
continue with the same Project and Issue. To reset, remove only the three SQLite
files named in the deployment document after both processes have stopped. Keep
the TOML and secret files if you plan to run the guide again.

## Continue from here

- [Create and follow an Issue](/docs/workforce/how-to/create-and-follow-an-issue/).
- [Exercise the API Workflow path](/docs/workforce/tutorials/first-agent-run/).
- [Deploy separate roles](/docs/workforce/operating/deployment-topologies/).
