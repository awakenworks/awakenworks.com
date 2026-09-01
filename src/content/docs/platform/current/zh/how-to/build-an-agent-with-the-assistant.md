---
title: "用 Admin Assistant 起草 Agent"
description: "说清需要的 Agent，审阅保存后的草稿，并只在配置符合意图时发布。"
evidence:
  - "crates/control/awaken-admin-assistant/src/lib.rs"
  - "web/src/surfaces/assistant.tsx"
  - "web/src/components/agent/useAgentDraftReview.ts"
  - "web/e2e/console.spec.ts"
---

先描述希望 Agent 完成的工作。Admin Assistant 会把这段描述整理成草稿，依据当前
Workspace 可用的能力进行检查并保存；是否发布，始终由你决定。

## 目标

得到一份已经由你审阅的 Agent 草稿，确认其中的指令、模型、工具、资源与权限边界。
只有显式发布之后，新 Session 才能使用这个 Agent。

## 前置条件

- 运行 `awaken`，并打开目标 Workspace 的 Console。
- 至少配置一个可运行的 provider-backed 模型。如果 Models 中没有可运行选项，先完成
  [Provider 与模型配置](/zh/docs/agents/how-to/configure-providers-models-credentials/)。
- 确定 Agent ID、第一项任务、允许使用的工具、必须审批的动作，以及绝不能做的事情。

## 1. 打开 Assistant

在 Console 中打开 `/w/<workspace>/assistant`。Console 会从 Workspace 的可运行模型
准备保留 Agent `__admin_assistant`。只有发送第一条消息时才会创建对话 Session；仅仅
打开页面不会留下空 Session。

Assistant 可以检查当前 Workspace 已发布的能力。它不会读取已保存的秘密、创建凭据，
也不会发布 Agent。

## 2. 描述工作与边界

给出一项具体任务和清楚的完成条件。把示例中的工具 ID 替换为 Workspace 中确实存在的
工具：

```text
创建一个显示名称为 Support Triage、稳定 ID 为 support-triage 的未发布 Agent。

它负责阅读支持请求，概括问题，并列出工程师开始处理前仍然缺少的事实。只允许使用
[tool-id-1] 和 [tool-id-2]。任何会改变外部状态的工具动作都必须先获得批准。不得发送
消息，也不得修改客户数据。优先选择已发布且可运行的模型。保存并校验草稿，但不要发布。
```

如果语气或输出结构很重要，再附上例子。如果请求依赖当前不存在的模型、工具、plugin、
Skill、MCP server 或 Resource，应先选择已有能力或完成配置。不要让 Assistant 代替你
猜测一个以后难以辨认的 ID。

## 3. 审阅已保存的草稿

草稿卡片出现后，选择 **在编辑器打开**，按照原始工作目标逐项检查：

- 指令是否说清结果与停止条件？
- 模型及其输入模态是否适合第一项任务？
- 每个工具、plugin、Skill、MCP server 与 Resource 是否确有必要？
- 权限规则是否会阻止那些必须由人决定的动作？
- 差异中是否只有你想要的改动？

校验通过只表示这份配置可以发布，不表示 Agent 的行为已经适合真实用户。

## 4. 检查并发布草稿

手工修改后选择 **检查草稿**。随后选择 **审阅并发布**，阅读草稿与已发布版本之间的
确切差异；只有确认无误，才选择 **发布**。

发布后的版本会供新 Session 使用，不会改写已有 Session 持有的版本快照。

## 验证

1. 返回 Agents，确认 `support-triage` 标记为 **已发布**。
2. 使用该 Agent 新建 Session，发送审阅草稿时使用的支持请求任务。
3. 确认结果符合约定结构；如果触发受保护的工具动作，它应停下来等待批准。
4. 如果行为不对，修改草稿、重新检查并发布新版本。保留当前 Session，作为旧版本实际
   行为的记录。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Workspace、Agent ID、Session ID、validation field
path、error code 与 correlation ID，再联系支持。不要附带 API key 或其他 credential
material。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| Assistant 提示没有可用模型 | Models 中没有可运行的已发布选项 | 完成 Provider 与模型配置，再从 Assistant 重试准备 |
| **检查草稿** 报错 | 阅读编辑器中的字段路径和错误信息 | 修正该值，或让 Assistant 修复这份已保存草稿；发布前再次检查 |

## 下一步

- 需要精确控制保存后的配置时，继续[调整 Agent 行为](/zh/docs/agents/how-to/configure-agent-behavior/)。
- 通过[管理 Session](/zh/docs/agents/how-to/manage-a-session/)继续、打断、归档或检查
  Agent 的工作。
- 需要自动化时，按照 [Awaken Agents 快速上手](/zh/docs/agents/get-started/)中的 Session
  请求形状，把 agent 设为 `__admin_assistant`，并保留相同的人工审阅与发布边界。
