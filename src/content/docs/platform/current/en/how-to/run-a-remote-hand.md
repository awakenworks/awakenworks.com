---
title: "Validate the standalone Hand relay"
description: "Run the checked Unix or reverse-dial relay path and interpret duplicate, indeterminate, and connection outcomes."
evidence:
  - "crates/bin/awaken-sandbox/src/hand.rs"
  - "crates/bin/awaken-sandbox/tests/hand_role.rs"
  - "crates/bin/awaken-sandbox/tests/hand_dial_role.rs"
  - "crates/worker/awaken-tool-relay/tests/relay.rs"
section: "Operate"
subsection: "Fleet operations"
order: 40
---

Use this path to validate the low-level Hand relay itself. It is not an Agent
placement option: normal Awaken Agents execution gets one Hand from the
Session's frozen Environment and the Worker that claims the Run.

## Goal

Finish with one real tool call crossing the selected relay transport and a clear
interpretation of what a retry or post-dispatch disconnect means.

## Prerequisites

- Use an Awaken source checkout with the Rust toolchain and platform build dependencies.
- Run Unix-socket tests on a Unix host. Use reverse dial when the Hand can make
  outbound connections but the Brain cannot dial into its network.
- Do not add Hand addresses to Agent JSON or deployment TOML. This page validates
  a primitive; it does not create another placement authority.

## 1. Choose the transport you need to validate

| Situation | Relay mode | Checked path |
| --- | --- | --- |
| Same host or network-denied Sandbox with a private mounted directory | `--unix <path>` | `hand_role` |
| Hand must dial out to a Brain rendezvous | `--dial <addr>` | `hand_dial_role` |
| Directed cross-node connection | `--listen <addr>` | connection-plan and TCP relay tests |
| Shared request/reply relay | `--nats <url> [--subject <subject>]` | NATS feature and relay tests |

Use stdio only when the owning Environment attaches the process channel directly.

## 2. Run the smallest end-to-end test

For the private Unix rendezvous:

```bash
cargo test -p awaken-sandbox --test hand_role --features hand -- --nocapture
```

For reverse dial:

```bash
cargo test -p awaken-sandbox --test hand_dial_role --features hand -- --nocapture
```

Each test starts the real Hand role, crosses the selected transport, executes a
real `bash` tool, and checks the returned marker. It gives a stronger completion
signal than starting a listener with no matching caller.

## 3. Check relay result semantics

```bash
cargo test -p awaken-tool-relay
```

The operation ledger owns retry identity:

- a completed operation returns its recorded result on retry;
- a duplicate still in progress is not executed as unrelated work;
- a connection loss after dispatch can return `HandResult::Indeterminate`;
- an indeterminate result requires reconciliation at the owning Run boundary,
  not a blind second side effect.

## 4. Start the binary only when you own both ends

```bash
awaken-sandbox hand --unix /run/awaken/hand.sock
```

The matching caller must construct the corresponding `ConnectionPlan`. A
listener message alone is not verification. Keep the Unix rendezvous directory
private and mount it into exactly the processes that own the connection.

## Verify

- The chosen end-to-end test passes and prints the expected tool marker.
- The Hand ledger uses a deliberate persistent or test-isolated directory.
- A completed retry reuses its recorded result.
- A post-dispatch disconnect is surfaced as indeterminate rather than success.
- No Agent, Session, Worker claim, or commit authority was duplicated.

## Troubleshooting

If the table does not resolve the problem, record the exact test command,
commit, OS, enabled features, transport mode, sanitized rendezvous, ledger
directory ownership, and observed `HandResult` before contacting support. Do
not attach relay credentials or broaden network policy.

| Symptom | Check | Action |
| --- | --- | --- |
| The Hand role is unavailable | Binary was built without the `hand` feature | Rebuild with the feature and rerun the exact role test |
| Unix connect is denied | Parent directory ownership, mode, and mount | Use a private rendezvous directory accessible to both owning processes |
| Reverse dial never arrives | Egress policy, rendezvous address, and listener | Validate the Brain listener first, then permit the exact outbound destination |
| A retry returns indeterminate | Operation may have crossed the dispatch boundary | Reconcile the original operation; do not assume it is safe to execute again |

## Next steps

- [Understand Brain, Hand, and Session Environment](/docs/agents/concepts/brain-and-hand/).
- [Configure Sandbox tiers](/docs/agents/how-to/configure-sandbox-tiers/) for
  product-owned execution.
- [Review Agents architecture](/docs/agents/concepts/architecture/) before
  changing Worker or Environment ownership.
