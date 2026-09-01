---
title: "把经过审查的 Agent 变成持续运行的工作"
description: "在 Console 创建 Deployment，用立即运行验证结果，检查生成的 Session，并控制后续计划。"
evidence:
  - "web/src/surfaces/deployments.tsx"
  - "web/e2e/managed-resources.spec.ts"
  - "crates/bin/awaken-cli/tests/deployment_sessions.rs"
  - "crates/server/awaken-protocol-managed/tests/deployments.rs"
---

当一个 Agent 已经正确完成过一次任务，而同一项工作还要重复执行时，再使用
Deployment。Deployment 固定所选 Agent publication，绑定 Environment 和启动消息；
每次计划触发或手动运行都会创建一个可以独立检查的 Session。

## 开始前

你需要一个已发布的 Agent、一个可用的 Environment，以及该 Environment 能执行的
模型路由。先把任务作为普通 Session 跑通。计划只会重复已有行为，不会让未经验证的
提示词自动变得安全。

## 在 Console 创建 Deployment

1. 打开 **运行 → 部署**，选择 **新建部署**。
2. 填写便于人理解的名称。
3. 选择已经验证过的已发布 Agent 和 Environment。
4. 输入标准 cron 表达式和 IANA 时区。
5. 填写每个新 Session 都会收到的启动消息。
6. 选择 **创建**。

新行会显示计划和下次运行时间。稳定 Deployment id 仍作为技术元数据可见；人应通过
名称识别这项工作。

## 用“立即运行”验证完整闭环

在依赖计划前先选择 **运行**。Console 会创建 Deployment Run；当它生成 Session 时，
页面会显示 **打开会话**。打开后检查：

- 使用了预期的已发布 Agent 和 Environment；
- 启动消息出现在已提交历史中；
- Agent 产出了预期结果和证据；
- 审批或权限等待仍然可见且可以处理。

这个 Session 才是可观察结果。成功提示或未来 cron 时间不能证明任务已经完成。

## 使用等价 API 路径

应用可以通过 `POST /v1/deployments` 创建同一定义，再用
`POST /v1/deployments/{id}/run` 做一次有界验证。创建请求包含 `name`、`agent`、
`environment_id`、cron `schedule` 和 `initial_events`。读取返回的 `session_id`，再通过
普通 Session API 检查该 Session 及其已提交事件。

生命周期控制使用 `POST /v1/deployments/{id}/pause`、`/unpause` 或 `/archive`。
准确的认证、beta header、请求、响应和错误 Schema 由[公共 HTTP API](/zh/docs/agents/reference/api)
和生成的[管理契约](/zh/docs/agents/reference/management-openapi)维护。

## 有意地暂停、恢复或归档

- **暂停**阻止计划触发，但保留定义和已有 Session；暂停时“立即运行”会被拒绝。
- **恢复**重新允许后续计划触发。
- **归档**永久停止计划，已有 Deployment Run 和 Session 仍可检查。

创建失败时，修正错误中指出的 Agent、Environment、计划或权限问题。Run 已创建但其
Session 失败时，应诊断 Session 结果；不要重建 Deployment 来掩盖运行失败。

## 下一步

“立即运行”成功完成任务后，在执行频率和人工响应路径达成一致前保持暂停；随后恢复
计划，并用[生产可靠性](/zh/docs/agents/concepts/production-reliability)判断哪些失败需要介入。
