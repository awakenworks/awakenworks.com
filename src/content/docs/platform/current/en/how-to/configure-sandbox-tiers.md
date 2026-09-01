---
title: "Configure and verify one Sandbox tier"
description: "Select an enforceable isolation boundary, validate its configuration, and run one harmless task without silent fallback."
evidence:
  - "crates/bin/awaken-cli/src/config/runtime_settings.rs"
  - "crates/bin/awaken-worker/src/bootstrap.rs"
  - "crates/server/awaken-runtime-host/src/deployment_config.rs"
  - "crates/server/awaken-runtime-host/src/sandbox_source.rs"
  - "crates/server/awaken-runtime-host/src/container_environment.rs"
section: "Operate"
subsection: "Deployment"
order: 20
---

Use this guide to put one AllInOne or standalone Worker process on a Sandbox
tier it can actually enforce. Finish with one harmless task running inside the
chosen boundary and an unsupported tier failing closed.

## Goal

Confirm three facts:

1. the process loaded the intended tier;
2. the host can realize that tier;
3. a test Session runs without falling back to unsandboxed local execution.

## Prerequisites

- Choose the boundary in [Execution backends and Sandbox placement](../concepts/execution-modes#sandbox-tiers).
- Use an Awaken build with the matching `container-docker`, `container-podman`,
  or `container-k8s` feature when selecting a container tier. The default
  `namespace` tier needs working `bwrap` user namespaces on Linux or Seatbelt on
  macOS.
- Keep an immutable `container_image` digest for a container tier.
- Prepare one published test Agent that can perform a harmless local operation,
  such as reporting its working directory and writing a disposable output file.

## 1. Configure the smallest enforceable tier

For AllInOne or another `awaken` product-launcher process:

```toml
sandbox_tier = "namespace"
sandbox_dir = "/var/lib/awaken/sandboxes"
sandbox_allow_local_fallback = false
```

For a standalone Worker, keep its strict file to the supported Sandbox subset:

```toml
role = "worker"
mode = "server"
worker_server = "https://coordinator.example"
worker_id = "worker-a"
sandbox_tier = "namespace"
sandbox_dir = "/var/lib/awaken/sandboxes"
sandbox_allow_local_fallback = false
```

Use `awaken-worker --config /etc/awaken/worker.toml` to start this process. The
standalone Worker is a separate binary, not a product-launcher subcommand.

For Docker, Podman, or Kubernetes, replace the tier and add an immutable image:

```toml
sandbox_tier = "docker"
container_image = "registry.example/awaken-hand@sha256:<digest>"
sandbox_allow_local_fallback = false
```

The complete field list belongs to the [configuration reference](../reference/configuration).
Do not copy product-launcher warm-pool, proxy, package-builder, or wake fields
into a standalone Worker file; unknown keys are rejected.

## 2. Validate configuration before startup

For an `awaken` product-launcher file:

```console
awaken config --json --config /etc/awaken/config.toml
```

Check the reported role, `sandbox_tier`, image, and fallback setting. The command
validates and redacts configuration, but it does not prove that the host launcher,
container daemon, registry, or Kubernetes API is reachable.

A standalone Worker validates its strict file when it starts:

```console
awaken-worker --config /etc/awaken/worker.toml
```

Treat a startup error as the preflight result. Do not enable local fallback to
turn that error into a successful startup.

## 3. Run one boundary check

Start one new Session with the test Agent. Have it report the working directory,
write a disposable output, and attempt only the network access that the selected
Environment permits. Then check:

- the Session reaches a terminal state;
- the output is readable through the Session rather than an undeclared host path;
- the process, container, or Pod exists in the expected runtime while the task runs;
- a denied mount or network request remains denied.

Use a new Session after changing the tier or image. An existing Session keeps its
frozen Environment.

## 4. Add package images only when the Environment needs them

Docker and Podman can derive an image with their local engine. Kubernetes needs
both a shared registry and a package-image builder in the product-launcher
configuration:

```toml
package_image_registry = "registry.example/awaken"
package_registry_auth_file = "/etc/awaken/registry-auth.json"
package_image_builder = "k8s"
package_local_cache_ttl_secs = 604800
```

Keep registry credentials outside the Session. Pin package versions where
possible, run two new Sessions from the same Environment revision, and confirm
that the second run reuses the same derived digest. If the exact image cannot be
built or retrieved, the Session must fail instead of reporting idle success.

## Verify

Verify fail-closed behavior before admitting real work:

1. request a tier the current binary cannot realize and confirm startup or
   placement fails;
2. leave `sandbox_allow_local_fallback = false`;
3. restart the process and repeat the harmless boundary check;
4. for a container tier, repeat once with an unavailable image digest and confirm
   that no local process is substituted.

If a rollout fails, return to the last tier the host can enforce and restart the
affected process. Do not use unsandboxed fallback as an availability repair.

## Troubleshooting

If the table does not resolve the problem, record the Awaken version or commit,
OS, exact binary, sanitized config report, selected tier, Worker and Session IDs,
Environment revision, and exact error before contacting support. Do not include
registry credentials, request credentials, tokens, or Session content.

| Symptom | Check | Action |
| --- | --- | --- |
| `awaken config` rejects the file | exact field named in the error | Correct that field in the product-launcher file; do not move it into the standalone Worker file |
| `awaken-worker` reports an unknown field | compare the key with the standalone Worker subset above | Remove the unsupported key and configure it only on a process whose schema accepts it |
| OS-native Sandbox is unavailable | Linux user namespaces and `bwrap`, or macOS Seatbelt | Restore the host primitive or choose another explicit tier; keep fallback disabled |
| Container tier needs a matching feature | build features and selected tier | Build the exact binary with the corresponding container feature, then restart it |
| Container tier cannot start | `container_image` is absent or the configured image cannot be retrieved | Set a reachable image; keep the deployment prerequisite above by pinning it to an immutable digest |
| Kubernetes package provisioning is unavailable | registry and builder are not both configured | Configure both on the product launcher, or remove package requirements from the test Environment |

## Next steps

- [Review all deployment configuration fields](../reference/configuration).
- [Run the self-hosting checklist](./self-host).
- [Understand Brain, Hand, and Session Environment](../concepts/brain-and-hand).
