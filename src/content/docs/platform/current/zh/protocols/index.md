---
title: "选择连接层"
description: "先确认连接两端分别是什么系统，再选择把它们接入 Awaken 的协议。"
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
---

先看需要通信的两个系统，协议名称是第二个决定。

| 要建立的连接 | 从这里开始 | 协议负责什么 |
|---|---|---|
| 应用或前端连接 Awaken | [Managed Agents](/zh/docs/agents/protocols/managed-agents/)、[AI SDK](/zh/docs/agents/protocols/ai-sdk/) 或 [AG-UI](/zh/docs/agents/protocols/ag-ui/) | 把应用请求转成同一个 Awaken Session 的输入与事件 |
| Agent 连接工具或数据服务 | [MCP](/zh/docs/agents/protocols/mcp/) | 导出经过选择的 Awaken 工具集，或把外部 MCP server 接入 Agent |
| Agent 连接 Agent | [A2A](/zh/docs/agents/protocols/a2a/) | 发现远端 Agent，并跨 HTTP 边界交换任务状态 |
| Worker 连接外部 Agent 进程 | [ACP](/zh/docs/agents/protocols/acp/) | 让 Worker 使用受支持的外部 CLI，作为一次受治理执行的 Brain |
| 操作者连接正在运行的 Session | [Live Inbox](/zh/docs/agents/protocols/live-inbox/) | 在 Agent 消费前修改排队中的输入 |
| Awaken 连接你的后端 | [Webhooks](/zh/docs/agents/how-to/manage-webhooks/) | 发送签名生命周期通知，让后端无需轮询即可读取 resource 当前状态 |

这些协议都是同一套已发布 Agent 与 Session 模型外侧的适配器。更换 wire 不会产生第二条
执行路径、第二套权限系统或另一份事件历史。

## 继续完成准确接入

**[协议接入矩阵](/zh/docs/agents/protocols/connect/)** 是方向、endpoint、配置入口、
认证规则和可观察完成信号的唯一权威。具体值只在那里维护，避免协议介绍各自复制后发生漂移。

选定一行后，先阅读对应协议页理解边界，再按其链接的操作指南发送一个容易辨认的请求，
并核对同一个 Session 或事件记录。
