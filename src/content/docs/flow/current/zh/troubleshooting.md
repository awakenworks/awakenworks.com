---
title: "故障排查"
description: "只处理无法自行收敛、且已经由 Workforce 明确报告的配置或工作流故障。"
---

从确切的 API error 或 Attention remedy 开始，不要依据 summary 诊断。queued work、
pending approval、仍有效的 lease，或暂时被 dependency 阻塞，本身都不是故障。Workforce 会轮询
queued work、在有界时间内终结符合条件的本地异常执行，并在 dependency 恢复后重新评估，
不需要手工修复命令。

如果下表仍不能解决问题，请记录 Workforce version、topology、route、HTTP status 与 error code、
Project/Issue/WorkUnit/Run ID 和 correlation ID。分享前先删除 token、credential、message
content，以及包含秘密的 URL。

| 症状 | 检查 | 常见动作 |
| --- | --- | --- |
| 进程在 `/healthz` 可用前退出 | stderr 与 startup error 指出的确切配置字段 | 修正明确的 seal-key、database 或 schema 条件；按[部署拓扑指南](/zh/docs/workforce/operating/deployment-topologies/)处理，不要直接改 store。 |
| Dispatch 返回 `execution_gated`，detail 明确指出缺失 Agent revision、model route、provider、credential 或 Resource | 返回的 detail 与 Project execution-readiness response | 补齐缺失的受治理 join，再重试同一 public command。不要用数据库写入绕过 admission。 |
| Issue 存在 open Attention signal，并给出具体 `reason_code` 与 `remedy` | Signal 与当前 authoritative resource 或 configuration state | 按[Attention 恢复](/zh/docs/workforce/operating/attention-recovery/)处理；只有明确条件修复后才 resolve signal。 |
| Transition request 返回 `no_transition` | 当前 Issue state、提交的 event 与固定的 Workflow revision | 提交该 state 已声明的 event，或为未来 Issue 保存经检查的新 Workflow revision。不要猜测或修补 edge。 |

用 `/healthz` 看 liveness，`/metrics` 看 Prometheus counters，`/api/openapi.json` 看当前
binary 的准确 route contract。
