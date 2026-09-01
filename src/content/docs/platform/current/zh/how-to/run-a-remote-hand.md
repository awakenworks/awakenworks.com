---
title: "验证独立 Hand relay"
description: "运行已检查的 Unix 或 reverse-dial relay 路径，并理解 duplicate、indeterminate 与连接结果。"
evidence:
  - "crates/bin/awaken-sandbox/src/hand.rs"
  - "crates/bin/awaken-sandbox/tests/hand_role.rs"
  - "crates/bin/awaken-sandbox/tests/hand_dial_role.rs"
  - "crates/worker/awaken-tool-relay/tests/relay.rs"
---

这条路径用于验证底层 Hand relay 本身。它不是 Agent placement 选项：正常 Awaken Agents
execution 从 Session 冻结的 Environment 与领取 Run 的 Worker
获得唯一 Hand。

## 目标

让一次真实 tool call 穿过选定 relay transport，并能准确判断 retry 或 dispatch 后断连的
含义。

## 前置条件

- 使用具备 Rust toolchain 与平台构建依赖的 Awaken source checkout。
- Unix socket test 需要 Unix host。当 Hand 可以向外连接、Brain 却不能拨入其网络时，
  使用 reverse dial。
- 不要把 Hand address 写入 Agent JSON 或 deployment TOML。本页验证执行原语，不创建
  第二个 placement authority。

## 1. 选择要验证的 transport

| 场景 | Relay mode | 已检查路径 |
| --- | --- | --- |
| 同一主机，或通过私有挂载目录跨越 network-denied Sandbox | `--unix <path>` | `hand_role` |
| Hand 必须向外拨号到 Brain rendezvous | `--dial <addr>` | `hand_dial_role` |
| 定向跨节点连接 | `--listen <addr>` | connection-plan 与 TCP relay test |
| 共享 request/reply relay | `--nats <url> [--subject <subject>]` | NATS feature 与 relay test |

只有所属 Environment 直接附加 process channel 时才使用 stdio。

## 2. 运行最小端到端测试

验证私有 Unix rendezvous：

```bash
cargo test -p awaken-sandbox --test hand_role --features hand -- --nocapture
```

验证 reverse dial：

```bash
cargo test -p awaken-sandbox --test hand_dial_role --features hand -- --nocapture
```

每个 test 都会启动真实 Hand role，穿过所选 transport，执行真实 `bash` tool，并检查
返回 marker。这比只启动 listener、却没有匹配 caller 提供了更明确的完成信号。

## 3. 检查 relay result 语义

```bash
cargo test -p awaken-tool-relay
```

Operation ledger 拥有 retry identity：

- 已完成 operation 在 retry 时返回 recorded result；
- 仍在执行的 duplicate 不会被当成无关工作再次执行；
- dispatch 后连接丢失可能返回 `HandResult::Indeterminate`；
- indeterminate result 应在所属 Run boundary 完成 reconciliation，不能盲目再次产生副作用。

## 4. 只有同时拥有两端时才启动 binary

```bash
awaken-sandbox hand --unix /run/awaken/hand.sock
```

匹配的 caller 必须构造对应 `ConnectionPlan`。只有 listener message 不算验证。保持 Unix
rendezvous directory 私有，并只挂载到拥有这条连接的进程。

## 验证

- 所选 end-to-end test 通过，并打印预期 tool marker。
- Hand ledger 使用经过选择的持久目录或 test-isolated directory。
- 已完成 retry 复用 recorded result。
- Dispatch 后断连被报告为 indeterminate，而不是 success。
- 没有复制 Agent、Session、Worker claim 或 commit authority。

## 故障排查

如果表中步骤仍未解决问题，请先记录 exact test command、commit、OS、enabled feature、
transport mode、已清理的 rendezvous、ledger directory ownership 与观察到的
`HandResult`，再联系支持。不要附带 relay credential，也不要扩大 network policy。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| Hand role 不可用 | Binary 是否未启用 `hand` feature | 启用 feature 重新构建，再运行确切 role test |
| Unix connect 被拒绝 | Parent directory ownership、mode 与 mount | 使用两个所属进程都能访问的私有 rendezvous directory |
| Reverse dial 始终不到达 | Egress policy、rendezvous address 与 listener | 先验证 Brain listener，再只允许确切 outbound destination |
| Retry 返回 indeterminate | Operation 是否可能已越过 dispatch boundary | 对原 operation 做 reconciliation，不要假定可以安全重做 |

## 下一步

- [理解 Brain、Hand 与 Session Environment](/zh/docs/agents/concepts/brain-and-hand/)。
- 通过[配置 Sandbox tier](/zh/docs/agents/how-to/configure-sandbox-tiers/)使用产品所属执行路径。
- 改变 Worker 或 Environment ownership 前，阅读
  [Agents 架构](/zh/docs/agents/concepts/architecture/)。
