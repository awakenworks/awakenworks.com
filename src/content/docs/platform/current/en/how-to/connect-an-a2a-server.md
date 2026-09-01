---
title: "Run a remote Agent over A2A"
description: "Publish one exact remote A2A endpoint, run it through an Awaken Session, and recover the same remote task on failure."
evidence:
  - "crates/server/awaken-run-executor-a2a/src/lib.rs"
  - "crates/server/awaken-protocol-a2a/src/client.rs"
  - "crates/server/awaken-coordinator/tests/a2a_loopback.rs"
section: "Connect"
subsection: "Connect applications"
order: 30
---

Use a remote A2A Agent as the execution backend of one published Awaken Agent.
The endpoint is fixed at publication, while the resulting work still uses the
ordinary Session, Worker claim, and commit path.

## Goal

Finish with one Session that sends a recognizable task to a remote A2A service,
records the remote task identity, and commits its terminal reply or typed failure.

## Prerequisites

- Run Awaken with an eligible Worker.
- Obtain the remote service's absolute HTTPS base URL and its Agent Card.
- Decide how the remote service authenticates requests. Store credential
  material through the owning credential path, never inside Agent JSON.
- Confirm the task does not require a local Environment, mount, repository,
  Memory store, or executable Skill. Outbound A2A does not provide a local Hand.

## 1. Check the remote service from the Worker boundary

Awaken's outbound client discovers the card at this path below the configured
base URL:

```text
GET /v1/a2a/agent-card
```

Check reachability, TLS name, the advertised URL, and the declared security
scheme from the same network boundary the Worker will use. If the card requires
Bearer or header authentication, configure a credential reference and rotation
owner before publication.

## 2. Publish the exact endpoint

Create an ordinary Agent through the Console or Managed API. Its backend model
ID is `a2a:<absolute-http-url>`:

```json
{
  "name": "remote-researcher",
  "model": {
    "id": "a2a:https://remote-agent.example.com"
  },
  "system": "Return one bounded research result and list its sources."
}
```

The hostname is a placeholder. Replace it with the exact service whose card you
checked. Publish through the normal Agent path; publication discovers the card,
pins its security fingerprint and credential authority, and rejects an
unreachable or incompatible endpoint.

There is no second A2A server catalog. Do not add a parallel endpoint registry
or a plaintext header to the Agent object.

## 3. Run one recognizable task

Create a Session for `remote-researcher` and send a task whose result you can
identify later. Use [Awaken Agents Get Started](/docs/agents/get-started/) for the
Session request and event stream.

Awaken sends A2A `message:send`, commits the returned remote task ID, and polls
or streams that same task until it completes, waits, or fails. A retry restores
the committed task identity instead of creating unrelated remote work.

## 4. Add delegation only after direct execution works

To delegate, publish `remote-researcher` first and add its exact published
version to the parent Agent's delegate roster. The parent uses the ordinary
`agent_run` tool; the child still enters the same Run and dispatch authority.

Do not start with delegation. First prove the remote Agent directly so network,
card, credential, and task-state failures remain easy to locate.

## Verify

- Publication succeeds with the expected endpoint and card security fingerprint.
- The Session history contains the recognizable input and terminal remote result.
- The remote service observes one context and task identity for the run.
- Restart or retry continues that committed remote task rather than creating a duplicate.
- Cancellation targets the same persisted remote task.

## Troubleshooting

If the table does not resolve the problem, record the Agent ID and publication
revision, sanitized remote origin, card security scheme and fingerprint,
Session/Run ID, HTTP status, and correlation ID before contacting support. Do
not send the credential or substitute another endpoint.

| Symptom | Check | Action |
| --- | --- | --- |
| Publication cannot read the Agent Card | Worker DNS, TLS, route, and auth challenge | Correct reachability or the configured credential reference; do not publish an unverified fallback URL |
| The remote service still returns 401 or 403 after credential refresh | Card security fingerprint and credential revision | Rotate or reauthorize through the credential path, then republish if the card security declaration changed |
| The run fails before provisioning | Agent requests local Environment resources or deny-all tool enforcement | Remove unsupported local requirements or use Native/ACP execution instead |
| Delegation fails while direct execution works | Parent roster and exact child publication | Republish the intended child version, review the parent diff, then retry delegation |

## Next steps

- Read the [A2A protocol reference](/docs/agents/protocols/a2a/) for inbound
  routes and version negotiation.
- [Configure Agent behavior](/docs/agents/how-to/configure-agent-behavior/)
  before adding the remote Agent to a parent roster.
- Use [Manage a Session](/docs/agents/how-to/manage-a-session/) for interrupt,
  archive, and recovery decisions.
