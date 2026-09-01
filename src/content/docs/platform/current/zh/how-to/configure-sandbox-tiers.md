---
title: "配置并验证一个 Sandbox tier"
description: "选择可执行的隔离边界，校验配置，并在不静默降级的前提下运行一个无破坏任务。"
evidence:
  - "crates/bin/awaken-cli/src/config/runtime_settings.rs"
  - "crates/bin/awaken-worker/src/bootstrap.rs"
  - "crates/server/awaken-runtime-host/src/deployment_config.rs"
  - "crates/server/awaken-runtime-host/src/sandbox_source.rs"
  - "crates/server/awaken-runtime-host/src/container_environment.rs"
---

这份指南用于把一个 AllInOne 或独立 Worker 进程放到它确实能够执行的 Sandbox tier。
完成时，一项无破坏任务应在所选边界内运行；不受支持的 tier 应 fail closed。

## 目标

确认三个事实：

1. 进程读取了预期 tier；
2. 当前 host 能够实现该 tier；
3. 测试 Session 没有降级到无 Sandbox 的 local execution。

## 前置条件

- 在[执行 backend 与 Sandbox placement](../concepts/execution-modes#sandbox-tier)中选择边界。
- 选择 container tier 时，Awaken build 需要匹配的 `container-docker`、
  `container-podman` 或 `container-k8s` feature。默认 `namespace` tier 在 Linux 上
  需要可用的 `bwrap` user namespace，在 macOS 上使用 Seatbelt。
- Container tier 使用不可变 `container_image` digest。
- 准备一个已发布测试 Agent，让它执行无破坏的本地操作，例如报告工作目录并写入一份
  可丢弃 output。

## 1. 配置最小可执行 tier

AllInOne 或其他 `awaken` product launcher 进程：

```toml
sandbox_tier = "namespace"
sandbox_dir = "/var/lib/awaken/sandboxes"
sandbox_allow_local_fallback = false
```

独立 Worker 使用严格 schema，只保留受支持的 Sandbox 子集：

```toml
role = "worker"
mode = "server"
worker_server = "https://coordinator.example"
worker_id = "worker-a"
sandbox_tier = "namespace"
sandbox_dir = "/var/lib/awaken/sandboxes"
sandbox_allow_local_fallback = false
```

使用 `awaken-worker --config /etc/awaken/worker.toml` 启动该进程。独立 Worker 是单独的
binary，不是 product launcher 的 subcommand。

选择 Docker、Podman 或 Kubernetes 时，替换 tier 并增加不可变 image：

```toml
sandbox_tier = "docker"
container_image = "registry.example/awaken-hand@sha256:<digest>"
sandbox_allow_local_fallback = false
```

完整字段清单由[配置参考](../reference/configuration)维护。不要把 product launcher 的
warm pool、proxy、package builder 或 wake 字段复制到独立 Worker 文件；未知 key 会被拒绝。

## 2. 启动前校验配置

校验 `awaken` product launcher 文件：

```console
awaken config --json --config /etc/awaken/config.toml
```

检查输出中的 role、`sandbox_tier`、image 与 fallback 设置。该命令会校验并脱敏配置，
但不能证明 host launcher、container daemon、registry 或 Kubernetes API 可达。

独立 Worker 会在启动时校验其严格配置：

```console
awaken-worker --config /etc/awaken/worker.toml
```

把启动错误当作 preflight 结果。不要为了让进程成功启动而开启 local fallback。

## 3. 运行一次边界检查

用测试 Agent 新建一个 Session，让它报告工作目录、写入可丢弃 output，并且只尝试所选
Environment 允许的网络访问。然后检查：

- Session 到达终态；
- output 通过 Session 读取，而不是来自未声明的 host path；
- 任务运行时，预期 process、container 或 Pod 确实存在；
- 被拒绝的 mount 或 network request 仍然被拒绝。

改变 tier 或 image 后使用新 Session。已有 Session 保留冻结的 Environment。

## 4. 只有 Environment 需要 package 时才增加派生 image

Docker 与 Podman 可以通过本地 engine 派生 image。Kubernetes 需要在 product launcher
配置中同时提供共享 registry 与 package-image builder：

```toml
package_image_registry = "registry.example/awaken"
package_registry_auth_file = "/etc/awaken/registry-auth.json"
package_image_builder = "k8s"
package_local_cache_ttl_secs = 604800
```

Registry credential 留在 Session 外。尽量固定 package version；从同一个 Environment
revision 新建两个 Session，并确认第二次复用相同 derived digest。如果精确 image 无法构建
或读取，Session 应失败，不能报告 idle success。

## 验证

接收真实工作前，验证 fail-closed 行为：

1. 请求当前 binary 无法实现的 tier，确认 startup 或 placement 失败；
2. 保持 `sandbox_allow_local_fallback = false`；
3. 重启进程，再做一次无破坏边界检查；
4. Container tier 再使用一个不可读取的 image digest 测试，确认系统不会改用 local process。

Rollout 失败时，回到当前 host 能执行的上一个 tier，并重启受影响进程。不要把无 Sandbox
fallback 当作可用性修复。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Awaken version 或 commit、OS、确切 binary、已脱敏
config report、所选 tier、Worker 与 Session ID、Environment revision 和完整错误，再联系
支持。不要附带 registry credential、request credential、token 或 Session content。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| `awaken config` 拒绝配置 | 错误中指出的确切 field | 在 product launcher 文件中修正该 field；不要把它移入独立 Worker 文件 |
| `awaken-worker` 报告 unknown field | 对照上面的独立 Worker 子集 | 删除不受支持的 key，只在接受该 key 的进程中配置 |
| OS-native Sandbox 不可用 | Linux user namespace 与 `bwrap`，或 macOS Seatbelt | 恢复 host primitive，或显式选择其他 tier；保持 fallback 关闭 |
| Container tier 需要匹配 feature | build feature 与所选 tier | 使用对应 container feature 构建确切 binary，再重新启动 |
| Container tier 无法启动 | `container_image` 缺失，或无法拉取已配置 image | 设置可访问的 image；同时遵守上文部署前提，把它固定到 immutable digest |
| Kubernetes package provisioning 不可用 | registry 与 builder 是否同时配置 | 在 product launcher 同时配置两者，或从测试 Environment 移除 package requirement |

## 下一步

- [查看完整部署配置字段](../reference/configuration)。
- [执行自托管检查清单](./self-host)。
- [理解 Brain、Hand 与 Session Environment](../concepts/brain-and-hand)。
