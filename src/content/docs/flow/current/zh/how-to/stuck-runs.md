---
title: "判断工作是否需要干预"
description: "使用带类型的 Issue diagnosis，区分系统自动收敛与必须由外部修正的条件。"
---

1. 读取 `/api/issues/{id}/diagnosis`。这是 Issue 层唯一汇总 scheduling、active
   Attention、active WorkUnit 与公共恢复动作的视图。
2. Scheduling 为 `ready` 或 `running` 时不要干预。系统会轮询 queued WorkUnit，并由
   reaper 限制仍在执行的本地工作。不要修改 lease，也不要再次 dispatch 同一 Issue。
3. 如果是 `blocked_by_dependency`，检查返回的 blocker。Blocker 关闭后，Workforce 会通过
   resident pump 重新评估 dependent；没有手工 wake 命令。Pending approval 也是明确的
   决策状态，不是 run 卡住。
4. 只有 response 明确指出外部修正项时才处理：
   - `attention`：读取 `/api/issues/{id}/attention-signals`，按确切 `reason_code` 与
     `remedy` 处理；
   - `waiting_on_resource`：存在 `retry_at` 时等待该时间；没有 `retry_at` 时，按返回的
     `reason_code` 恢复指明的 Resource；
   - Agent placement failure：读取 `/api/agent-fleet/readiness`，恢复缺失 capability
     或 Worker connection；
   - `execution_gated`：补齐 error detail 指出的 Agent、model、provider、credential
     或 Resource binding。
5. WorkUnit 已经 `failed` 时，读取它的 `/events` 与 `/state`，再处理 Workforce 为该终态生成的
   Attention signal。不要恢复 lease，也不要重写 WorkUnit state。
6. `/message`、`/pause`、`/resume`、`/interrupt`、`/redirect` 与 `/cancel` 只用于对
   确切 WorkUnit 作有意的控制决定，不是通用 retry 手段。

当前没有 `doctor` 命令。如果明确的外部条件仍无法修正，请保留 diagnosis response、相关
events、reason code、Worker identity 与 correlation ID。分享前删除 credential、message
content 和包含秘密的 URL。
