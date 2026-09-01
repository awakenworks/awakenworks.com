---
title: "通过 A2A 运行远端 Agent"
description: "发布一个精确的远端 A2A endpoint，通过 Awaken Session 运行，并在故障后恢复同一个 remote task。"
evidence:
  - "crates/server/awaken-run-executor-a2a/src/lib.rs"
  - "crates/server/awaken-protocol-a2a/src/client.rs"
  - "crates/server/awaken-coordinator/tests/a2a_loopback.rs"
---

把 remote A2A Agent 作为一个已发布 Awaken Agent 的执行 backend。Endpoint 在发布时固定，
而产生的工作仍然使用普通 Session、Worker claim 与 commit path。

## 目标

得到一个 Session：它把容易辨认的任务发送给 remote A2A service，记录 remote task
identity，并提交终态回复或 typed failure。

## 前置条件

- 运行 Awaken，并提供满足条件的 Worker。
- 获得 remote service 的绝对 HTTPS base URL 与 Agent Card。
- 确认 remote service 如何认证请求。Credential material 必须通过所属路径保存，不能写入
  Agent JSON。
- 确认任务不依赖本地 Environment、mount、repository、Memory store 或 executable Skill。
  Outbound A2A 不提供本地 Hand。

## 1. 从 Worker 边界检查 remote service

Awaken outbound client 会从配置的 base URL 下列路径发现 card：

```text
GET /v1/a2a/agent-card
```

从 Worker 实际使用的网络边界检查可达性、TLS name、advertised URL 与声明的 security
scheme。如果 card 要求 Bearer 或 header authentication，应在发布前配置 credential
reference 与轮换负责人。

## 2. 发布精确 endpoint

通过 Console 或 Managed API 创建普通 Agent。它的 backend model ID 是
`a2a:<absolute-http-url>`：

```json
{
  "name": "remote-researcher",
  "model": {
    "id": "a2a:https://remote-agent.example.com"
  },
  "system": "Return one bounded research result and list its sources."
}
```

hostname 是占位符，必须换成刚才检查过的确切 service。通过普通 Agent 路径发布；
publication 会发现 card、固定 security fingerprint 与 credential authority，并拒绝不可达
或不兼容的 endpoint。

这里没有第二个 A2A server catalog。不要增加平行 endpoint registry，也不要把明文
header 写进 Agent object。

## 3. 运行一项容易辨认的任务

为 `remote-researcher` 创建 Session，并发送以后容易辨认的任务。Session 请求与 event
stream 使用 [Awaken Agents 快速上手](/zh/docs/agents/get-started/)中的做法。

Awaken 发送 A2A `message:send`，提交返回的 remote task ID，并持续 poll 或 stream 同一
task，直到它完成、等待或失败。重试会恢复已提交的 task identity，不会另建无关远端工作。

## 4. 直连成功后再增加委托

需要委托时，先发布 `remote-researcher`，再把它的确切已发布版本加入 parent Agent 的
delegate roster。Parent 使用普通 `agent_run` tool；child 仍进入同一 Run 与 dispatch
authority。

不要从委托开始。先直连验证 remote Agent，才能清楚定位 network、card、credential 与
task state 故障。

## 验证

- Publication 使用预期 endpoint 与 card security fingerprint 成功。
- Session history 包含可辨认输入与 remote terminal result。
- Remote service 针对该 run 只观察到一个 context 与 task identity。
- 重启或重试继续已提交 remote task，而不是创建重复任务。
- Cancellation 指向同一个已持久化 remote task。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Agent ID 与 publication revision、已清理的 remote
origin、card security scheme/fingerprint、Session/Run ID、HTTP status 与 correlation
ID，再联系支持。不要发送 credential，也不要换用另一个 endpoint 绕过问题。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| Publication 读不到 Agent Card | Worker DNS、TLS、route 与 auth challenge | 修正可达性或已配置的 credential reference，不要发布未经验证的 fallback URL |
| Credential refresh 后 remote service 仍返回 401 或 403 | Card security fingerprint 与 credential revision | 通过 credential path 轮换或重新授权；card security declaration 改变后重新发布 |
| Run 在 provisioning 前失败 | Agent 是否要求本地 Environment resource 或 deny-all tool enforcement | 移除不支持的本地要求，或改用 Native/ACP execution |
| 直连成功但委托失败 | Parent roster 与确切 child publication | 重新发布预期 child version，审阅 parent diff 后再委托 |

## 下一步

- 通过 [A2A 协议参考](/zh/docs/agents/protocols/a2a/)了解 inbound route 与版本协商。
- 把 remote Agent 加入 parent roster 前，先[配置 Agent 行为](/zh/docs/agents/how-to/configure-agent-behavior/)。
- 通过[管理 Session](/zh/docs/agents/how-to/manage-a-session/)处理中断、归档与恢复决定。
