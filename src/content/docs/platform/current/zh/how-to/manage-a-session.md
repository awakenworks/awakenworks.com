---
title: "启动、中断或归档 Session"
description: "在 Session 中开始工作，确认持久历史，中断活跃 Run，或把 Session 归档为只读。"
evidence:
  - "crates/server/awaken-session-application/src/application.rs"
  - "web/e2e/console.spec.ts"
---

用 Session 开始或继续一个已发布 Agent 的工作。只有在活跃 Run 应该停止时才中断；
只有在历史需要继续可读、但不应再接受输入时才归档。

## 目标

最终得到一个刷新后仍能读取已提交消息的 Session。如果将它归档，之后的工作使用新 Session。

| 现在要做什么 | 操作 | 结果 |
| --- | --- | --- |
| 开始或继续工作 | 发送事件并等待 `idle` | 新一轮进入同一份持久历史 |
| 停止活跃工作 | 选择 **停止运行** | Session 记录已接受的 `user.interrupt` 请求 |
| 保留历史但禁止新输入 | 选择 **Archive** | Session 仍可读取，并拒绝后续事件 |
| 归档后再次开始工作 | 创建新 Session | 已归档生命周期保持关闭 |

## 前置条件

- 正在运行的 Awaken AllInOne 或等价部署；
- 一个已经校验并发布、模型与凭据可解析的 Agent；
- 对同一 Workspace 中 Agent 与 Session 页面的访问权限。

如果这些条件尚未满足，请先完成 [Awaken 入门](/zh/docs/agents/get-started/)。

## 1. 创建 Session

打开 **Sessions**，创建 Session 并选择已发布的 Agent。Session 会固定所选 Agent 发布版本
和已解析资源；之后的草稿修改不会改变已经绑定的工作。

## 2. 发送工作并确认已提交历史

发送消息并等待 Session 回到空闲交互状态。刷新页面，确认消息与工具结果仍然可见。把
刷新后读取的历史作为持久记录；实时 stream 只表示当前正在到达的内容。

## 3. 必要时中断正在进行的工作

Run 活跃时选择 **停止运行**，再确认受控停止。Session 会记录 `user.interrupt` 事件并显示接受回执。中断
请求受控停止，不会删除 Session 或早先的证据。

## 4. 将不再接受输入的工作归档

只有在不应再接受新输入时才选择 **Archive**。归档状态仍然可见，Session 也仍可读取。
之后的新事件写入会被拒绝，而不是悄悄重新打开生命周期。

## 验证

- 刷新 Session 后仍能看到已提交消息与工具结果；
- 中断显示已接受的 `user.interrupt` 回执；
- 归档显示 archived 状态；
- 已归档 Session 仍可读取，并以 conflict 拒绝新事件。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Workspace、Agent ID 与 publication revision、已脱敏
Session request shape、HTTP status 与 error code、correlation ID，再联系支持。不要附带
token、credential 或 message content。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 无法创建 Session | Agent 发布、模型解析、凭据就绪状态 | 修复明确的就绪失败；Agent 改变时重新发布，再创建新 Session。 |

## 下一步

- [把已发布 Agent 接入应用](/zh/docs/agents/how-to/connect-a-published-agent/)。
- [理解 Session 与已提交事件](/zh/docs/agents/concepts/sessions-and-events/)。
- [使用 Live Inbox 管理运行中的排队输入](/zh/docs/agents/protocols/live-inbox/)。
