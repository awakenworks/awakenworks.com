---
title: "HTTP API"
description: "从 Awaken Workforce router 生成精确 OpenAPI 契约，并通过任务指南理解行为顺序。"
---

**生成的 OpenAPI 文档是唯一 route 与 schema 清单**。本页刻意不复制其中的 path、字段或
response 表。

## 获取契约

从 checkout 生成：

```sh
cargo run -q -p awaken-flow-server -- openapi \
  > /tmp/awaken-flow-openapi.json
```

从运行中的 Server 获取：

```sh
curl -fsS http://127.0.0.1:7979/api/openapi.json \
  > /tmp/awaken-flow-openapi.json
```

两者都从已装配 router 生成。确认 `info.title` 为 `awaken-flow`；生成 client 或兼容性测试
时保存该文档，使升级产生可评审 diff。

## Surface 所有权

通过 OpenAPI tag 与 path 查找精确 operation；通过任务文档理解顺序与恢复：

| 任务 | 行为所有者 |
| --- | --- |
| Bootstrap Project 与定义 | [设计与自动化](/zh/docs/workforce/designing/) |
| 创建和推进 Issue | [管理工作](/zh/docs/workforce/how-to/) |
| 检查或控制 WorkUnit | [运营 Workforce](/zh/docs/workforce/operating/) |
| 处理 Approval 与 Attention | [Inbox 与审批](/zh/docs/workforce/operating/inbox-approvals/) |
| 使用通用 Resource tool | [Resource 与授权模型](/zh/docs/objects/concepts/permissions-resources/) |
| 部署和检查服务端点 | [部署拓扑](/zh/docs/workforce/operating/deployment-topologies/) |

大部分 `/api/*` operation 受配置的 IAM 模式保护。Health、metrics 与契约发现刻意在该层
之外装配，应在网络边界验证其暴露方式。

不要因为兼容 route 仍出现在 OpenAPI 中就用它建立新集成。生成 operation 中的 deprecation
说明是权威来源；新功能应使用 immutable owner revision 与当前 command surface。
