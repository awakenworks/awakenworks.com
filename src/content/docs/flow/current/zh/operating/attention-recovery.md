---
title: "关注与恢复"
description: "使用带类型的 attention 注册表就地恢复工作，不重写业务状态。"
---

Awaken Workforce 让无进展明确可见。Attention signal 是持久、带类型并出现在派生 inbox 中的
记录；它是**调度 overlay**，不是工作流状态。Subject 保留底层业务 state，因此 resolve
只移除 hold，不做重入或重置预算。

## Signal 生命周期

Signal 按 `open → acknowledged → resolved` 推进。Acknowledgement 只表示“已看到”，不
表示“已修复”：`open` 与 `acknowledged` 都继续阻止调度；只有 `resolved` 清除 overlay。

使用：

- `GET /api/inbox?project={project}&limit={n}` 查看 attention 与 approvals；
- `GET /api/attention-signals` 查看 attention queue；
- `GET /api/issues/{id}/attention` 查看单个 Issue；
- 向 `POST /api/attention/{signal_id}/status` 提交
  `{ "status": "acknowledged" }` 或 `{ "status": "resolved" }`。

## 精确原因码

代码注册表是穷尽的；未声明字符串会被 `422` 拒绝。

| 分类 | 原因码 |
| --- | --- |
| 执行/配置 | `execution_failed`、`execution_configuration_invalid`、`acp_launch_failed`、`script_runtime_failed` |
| 有界终止 | `max_attempts_exhausted`、`run_deadline_exceeded`、`handshake_timeout`、`stall_timeout` |
| 外部可用性 | `service_unreachable`、`provider_unavailable`、`mcp_unreachable` |
| 工作流/依赖 | `awaiting_dependencies`、`blocked_on_review`、`prerequisite_canceled`、`output_contract_violated` |
| 共享资源 | `credential_exhausted`、`no_capable_worker` |

API 会为每个 signal 补充注册表中的 label、remedy 与 behavior。应依据 remedy 操作，而
不是从 transcript 猜测。

## Behavior 分类

- `converges_to_attention`：确定性或已耗尽条件需要人工处理。
- `self_healing`：瞬时条件会重试，并声明最终升级到的 code。
- `violation`：声明契约的违例按其策略处理。
- `shared_resource`：按失败 credential/worker 资源只建一个 aggregate signal；Workforce
  拒绝为每个 Issue 各建一份。

只有在确认具名资源已恢复健康后才 resolve 共享资源 signal；同一次 resolve 会清除受影响
工作的 scheduling overlay。

## 恢复流程

1. 阅读 `reason_code`、`label`、`remedy` 与 Issue 未改变的 scheduling state。
2. 修复指定原因，例如 provider route、credential、worker、MCP server 或 workflow。
3. 调查中可以 acknowledge，但不要马上重新派发。
4. 只有根因确实消失后才 resolve。
5. 若需再次执行，再重新 dispatch 或使用可审计 WorkUnit 控制。

若要放弃工作，使用 Issue 或 WorkUnit cancel endpoint。Cancel 是真实终态决定；resolve
attention 不是。
