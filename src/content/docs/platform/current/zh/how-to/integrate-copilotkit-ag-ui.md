---
title: "通过 AG-UI 连接 CopilotKit 聊天界面"
description: "使用 AG-UI HttpAgent 把 CopilotKit 连接到 Awaken，验证一个持久 thread，并选择生产连接边界。"
evidence:
  - "crates/server/awaken-protocol-ag-ui/src/router.rs"
  - "crates/server/awaken-protocol-ag-ui/src/types.rs"
---

通过 AG-UI endpoint，把 CopilotKit v2 聊天界面连接到 Awaken Agent。先使用本地直连的
`HttpAgent`，发送一项任务并确认可以从已提交历史读回同一 thread，再选择生产路径。

## 目标

得到一个能够显示 Awaken AG-UI event stream、并使用稳定 `threadId` 的 CopilotKit 聊天
界面。同时明确：离开本地开发环境后，应由哪个组件负责认证。

## 前置条件

- 运行 `awaken` 并完成[自托管配置](/zh/docs/agents/how-to/self-host/)。
- 发布一个可运行模型；如界面只服务于某个 Agent，也要先发布该 Agent。
- 准备一个 Node.js React 项目。
- 确定这是本地直连还是生产连接。CopilotKit 对两者使用不同的配置与安全边界。

## 1. 选择连接边界

| 用途 | CopilotKit 路径 | 含义 |
| --- | --- | --- |
| 本地接线与界面开发 | 使用 AG-UI `HttpAgent` 的 `agents__unsafe_dev_only` | 浏览器直接调用 Awaken；不要把这个设置带到生产环境 |
| 生产环境直连 | 使用受保护 `HttpAgent` 的 `selfManagedAgents` | endpoint 自己负责认证与授权；CopilotKit 当前文档把该选项归入 Enterprise offering |
| 生产环境 Runtime 代理 | 让 `runtimeUrl` 指向 Copilot Runtime | Copilot Runtime 负责发现和代理 Agent；`runtimeUrl` 不能直接指向 Awaken 的 `/v1/ag-ui` 运行端点 |

下面使用本地路径，以便在不增加第二个服务器的情况下验证协议。

## 2. 安装 CopilotKit 与 AG-UI client

```bash
npm install @copilotkit/react-core@1 @ag-ui/client@0.0.58
```

示例使用 CopilotKit v2 exports。具体版本应由应用 lockfile 固定；改变 major API 前先阅读
CopilotKit 的迁移说明。

## 3. 把 Awaken 注册为本地 HttpAgent

先使用默认端点；如果要选择某个已发布 Agent，把 URL 换成
`/v1/ag-ui/agents/<agent_id>`：

```tsx
"use client";

import { HttpAgent } from "@ag-ui/client";
import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";

const awakenAgent = new HttpAgent({
  url: "http://localhost:8080/v1/ag-ui",
  threadId: "copilotkit-demo-1",
});

export default function App() {
  return (
    <CopilotKit
      agent="awaken"
      agents__unsafe_dev_only={{ awaken: awakenAgent }}
    >
      <CopilotChat agentId="awaken" />
    </CopilotKit>
  );
}
```

注册表中的 `awaken` 是 CopilotKit 组件使用的 ID；endpoint path 选择 Awaken Agent；
显式 `threadId` 让后续 run 继续写入同一个已提交 Session。

不要把它改成 `runtimeUrl=".../v1/ag-ui"`。`runtimeUrl` 期待的是 Copilot Runtime API，
其中包含 raw AG-UI 运行端点不提供的发现行为。

## 4. 验证

1. 打开页面，发送一项容易辨认的任务，例如：

   ```text
   列出这段话中的两个决定：先选择负责人，再选择截止日期。
   ```

2. 确认 `CopilotChat` 在响应到达时逐步显示内容。
3. 从 Awaken 读取同一个 thread：

   ```bash
   curl -sS http://localhost:8080/v1/ag-ui/threads/copilotkit-demo-1/messages
   ```

4. 确认返回的 `items` 包含刚才提交的任务与已经提交的 Agent 回复。

页面打开期间，`HttpAgent` 把 messages 保存在浏览器内存中。如果产品必须支持刷新恢复，
应在构造 Agent 前读取已提交历史，并把这些 messages 作为 `initialMessages` 传入。

## 5. 转向生产路径

在接入流量前：

1. 根据 CopilotKit plan，选择 Copilot Runtime 代理或其支持的生产
   `selfManagedAgents` 路径。
2. 在服务器边界认证调用者，并对选中的 Workspace、Agent 与 thread 授权。
3. 如果浏览器直接调用 Awaken，应由后端签发短期 application access token；它只允许
   `ag-ui`、所需 thread operation 与已授权 Session binding。Application token 可以作为
   `HttpAgent` bearer header 发送；provider credential 与 Workspace service key 不可以。
4. 由所属 ingress 或同源应用服务器负责 CORS 与 TLS。
5. 通过生产 URL 再次执行任务与已提交历史检查。

## 故障排查

如果表中步骤仍未解决问题，请先记录所选 connection path、package version、route、HTTP
status、thread ID 与 correlation ID，再联系支持。先删除 token 与 message content。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| CopilotKit 请求 `/info` 或报告 Runtime 连接失败 | 是否把 raw AG-UI URL 传给了 `runtimeUrl` | 本地直连应注册 `HttpAgent`；否则让 `runtimeUrl` 指向真正的 Copilot Runtime |
| CopilotKit 提示缺少 runtime 或 key | 本地 Agent map 是否缺失，是否未使用 v2 import | 传入 `agents__unsafe_dev_only={{ awaken: awakenAgent }}`，并使用上例中的 `/v2` exports |
| 浏览器报告 CORS 错误 | 页面与 Awaken 是否来自不同 origin | 使用同源代理，或配置 ingress CORS policy |
| 刷新后没有消息 | 是否只使用了 `HttpAgent` 的内存状态 | 读取已提交 thread history，并作为 `initialMessages` 传入 |
| 运行请求返回 404 | 服务器、端口或 Agent 作用域路径是否错误 | 确认 `awaken` 正在监听，再按照 AG-UI 参考核对路由 |

## 下一步

- 在处理 tool call、state、context、resume input 或 custom event 前，阅读
  [AG-UI 协议参考](/zh/docs/agents/protocols/ag-ui/)。
- 需要打断、归档或其他生命周期操作时，使用
  [管理 Session](/zh/docs/agents/how-to/manage-a-session/)。
- 暴露应用路由前，阅读 [Console 与认证所有权](/zh/docs/agents/reference/admin-console/)。
- 如果界面已经使用 Vercel AI SDK `useChat`，改用
  [AI SDK 指南](/zh/docs/agents/how-to/integrate-ai-sdk-frontend/)。
