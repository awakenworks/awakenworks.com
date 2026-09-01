---
title: "连接 Vercel AI SDK 聊天界面"
description: "从 React useChat 向 Awaken 发送一次 turn，流式显示结果，并恢复同一个已提交 thread。"
evidence:
  - "crates/server/awaken-protocol-ai-sdk/src/router.rs"
  - "crates/server/awaken-protocol-ai-sdk/src/types.rs"
---

把现有的 Vercel AI SDK React 聊天界面连接到一个已发布的 Awaken Agent。你将发送
一项容易辨认的任务，显示原生 UI Message Stream，并从已提交历史中读回同一个 thread。

## 目标

得到一个会在每次 turn 中向 Awaken 发送稳定 `threadId` 的 `useChat` 组件。浏览器负责
显示实时流；页面刷新或进程重启后，Awaken history endpoint 仍是可恢复的持久记录。

## 前置条件

- 运行 `awaken` 并完成[自托管配置](/zh/docs/agents/how-to/self-host/)。
- 发布一个可运行模型；如果界面只服务于某个已保存 Agent，也要先发布该 Agent。
- 准备一个 Node.js React 项目。锁定的 Awaken Console 源码声明了本例使用的 `ai` 7.x
  与 `@ai-sdk/react` 4.x package line。
- 确认浏览器与 API 是否同源。若本地跨域，应在打开页面前通过反向代理配置 CORS。

## 1. 选择运行端点

验证界面连通性时，先使用默认路由：

```text
http://localhost:8080/v1/ai-sdk/chat
```

如果要运行某个已发布 Agent，改用其作用域路由：

```text
http://localhost:8080/v1/ai-sdk/agents/<agent_id>/runs
```

完整的路由与事件目录由 [AI SDK 协议参考](/zh/docs/agents/protocols/ai-sdk/)维护。
这份任务指南只需要保留组件实际调用的端点。

## 2. 安装客户端包

```bash
npm install ai@7 @ai-sdk/react@4
```

## 3. 每次 turn 都发送 thread ID

加入聊天组件。`useChat({ id })` 标识客户端聊天状态，但 Awaken 从请求体的
`threadId` 读取持久身份。使用 `prepareSendMessagesRequest` 同时发送 `threadId` 与
`messages`：

```tsx
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const threadId = "support-demo-1";
const transport = new DefaultChatTransport({
  api: "http://localhost:8080/v1/ai-sdk/chat",
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { threadId, messages },
  }),
});

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    transport,
  });

  return (
    <main>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}:</strong>{" "}
          {message.parts.map((part, index) =>
            part.type === "text" ? <span key={index}>{part.text}</span> : null,
          )}
        </div>
      ))}

      {error && <p role="alert">{error.message}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || status === "submitted" || status === "streaming") return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}
```

如果使用已保存 Agent，只需要把 `api` 改为第 1 步选择的作用域端点。需要继续同一项
工作时保持 `threadId` 不变；用户开始无关工作时再换用新值。

## 4. 验证

1. 打开前端，发送一项容易辨认的任务，例如：

   ```text
   用一句话概括：发布工作因为缺少凭据而受阻。
   ```

2. 确认 `status` 为 `streaming` 时文字逐步出现，并且 turn 最终离开流式状态。
3. 从 Awaken 读取同一个 thread：

   ```bash
   curl -sS http://localhost:8080/v1/ai-sdk/threads/support-demo-1/messages
   ```

4. 确认返回的 `items` 同时包含刚才提交的文字与已经提交的 assistant 回复。

history endpoint 不会自动填充 `useChat`。如果产品需要刷新恢复，应在页面加载时读取这段
历史，并把转换后的 messages 放入应用的聊天状态。

## 5. 转向生产边界

前面的 URL 用于检查本地连接。不要把 Workspace service API key 交给浏览器，也不要把
未经认证的本地 listener 暴露到互联网。

面向互联网的应用应当：

1. 由后端认证用户，并创建或解析一个 Managed Session。
2. 使用 Console 的 **Protocols** 流程签发短期 application access token；它只允许
   `ai-sdk`、`thread.run`、`thread.messages.read`，并显式绑定外部 thread 与 Session。
3. 只把该短期 token 和绑定后的 thread ID 返回浏览器。
4. 让 `DefaultChatTransport` 调用 `/v1/ai-sdk/threads/<thread_id>/runs`，并加入
   `Authorization: Bearer <application_access_token>`。
5. token 过期后，如果用户仍在继续同一项工作，应把新 token 绑定到同一个 Managed
   Session。最后通过生产 ingress 重做 stream 与 history 检查。

认证、TLS 与 CORS 属于服务器边界。Provider credential 与 Workspace service key
不得进入前端代码。

## 故障排查

如果表中步骤仍未解决问题，请先记录 route、HTTP status、response error code、thread ID、
已知的 Session ID 与 correlation ID，再联系支持。先删除 bearer token 与 message content。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 每个 turn 都像是新的 thread | 检查 POST body 中是否有 `threadId` | 保留 `prepareSendMessagesRequest`；只有 `useChat` 的 `id` 并不会形成 Awaken 请求字段 |
| 浏览器报告 CORS 错误 | 比较页面 origin 与 `localhost:8080` | 让界面与 API 同源，或在反向代理中配置允许的 origin、method 与 header |
| `useChat` 收不到 stream part | 检查请求 URL 与响应 content type | 使用确切的运行端点，并确认响应为 `text/event-stream` |
| 运行路由返回 404 | 检查 bind 地址与所选路由 | 启动 `awaken`，再按照协议参考核对 URL |
| 生产请求返回 401 或 403 | 检查 token expiry、protocol、operation 与 thread binding | 由后端为同一个已授权 Session 重新签发最小权限 application token |
| 实时回复出现过，但刷新后为空 | 检查应用是否读取 history endpoint | 从已提交历史恢复客户端；不要把短暂的流当作存储 |

## 下一步

- 在显示工具、审批、文件、usage 或平台元数据前，阅读
  [AI SDK 协议参考](/zh/docs/agents/protocols/ai-sdk/)。
- 产品需要打断、归档或其他生命周期操作时，使用
  [管理 Session](/zh/docs/agents/how-to/manage-a-session/)。
- 暴露应用路由前，阅读 [Console 与认证所有权](/zh/docs/agents/reference/admin-console/)。
- 如果应用界面由 CopilotKit 管理，改用
  [CopilotKit 与 AG-UI](/zh/docs/agents/how-to/integrate-copilotkit-ag-ui/)。
