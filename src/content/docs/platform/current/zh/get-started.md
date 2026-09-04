---
title: "运行第一个 Awaken Session"
description: "在本地启动 Awaken，发布一个 Agent，通过官方 Anthropic SDK 发送工作，并在重启后重新打开同一个 Session。"
evidence:
  - "crates/bin/awaken-cli/src/main.rs"
  - "web/src/components/agent/AgentQuickstart.tsx"
  - "e2e/managed_e2e.mjs"
---

先在本机启动 Awaken，在 Console 中发布一个 Agent，再用一小段 Node.js 程序调用它。当程序
打印出 `agent.message`、Session 回到 `idle`，并且重启 Awaken 后仍能读到同一段历史，这条
路径就完成了。

当前代码已开源，尚无打包的稳定版 release。

## 开始前准备

你需要：

- Awaken 源码的本地 checkout，revision 与页面上方标注一致；
- 能够构建 workspace 的 Rust toolchain；
- Node.js 20 或更高版本；
- 一份受支持模型供应商的凭据。

本指南使用独立数据目录。Agent、provider 配置和 Session 历史都会保存在其中，继续使用或
清理时不会混入其他工作。

## 1. 构建 Awaken

在 Awaken 仓库根目录运行：

```console
cargo build -p awaken-cli --bin awaken
./target/debug/awaken --version
./target/debug/awaken config
```

最后一条命令打印脱敏后的生效配置。需要让程序读取时可加 `--json`。Awaken 不会从环境中的
`AWAKEN_*` 变量拼装部署、模型、业务或凭据设置。

## 2. 在本地启动 Awaken

```console
./target/debug/awaken all-in-one --data-dir /tmp/awaken-evaluation
```

AllInOne 会在 `127.0.0.1:8080` 启动 Control、Coordinator、Resources、本地 Worker、
Console 和协议 API。录入凭据前，先确认你连接的是刚刚启动的进程：

```console
curl http://127.0.0.1:8080/v1/capabilities
```

保持这个终端运行。如果启动报告 `127.0.0.1:8080` 已被占用，进程会退出，不会自动选择
另一个端口。用明确的空闲端口重新启动，例如增加 `--port 8181`，并在下文所有 URL 和
`AWAKEN_BASE_URL` 中使用同一端口。

## 3. 连接一个模型供应商

打开 `http://127.0.0.1:8080/w/default/overview`，沿 provider readiness 链接进入
**供应商连接**。选择供应商和认证方式，然后点击**验证并导入模型**。

连接显示 `ready`，且至少一个导入模型标记为 executable 后再继续。该命令会先检查凭据和
endpoint，再保存 Provider、endpoint、credential reference 和 model offerings。若连接
无法 ready，转到[配置 provider、模型与凭据](./how-to/configure-providers-models-credentials)
排查。

## 4. 发布一个 Agent

打开 **Agents**，创建 Agent，并使用内置 quickstart：

1. 选择**任务助手**、**代码仓改动**或**证据简报**。
2. 为 Agent 设置人类可读的显示名称和稳定的 API id。
3. 选择标记为 runnable 的模型。
4. 选择第一次 Run 使用的 Environment。
5. 输入一项能从回复中辨认结果的小任务。
6. 检查 publication diff，然后点击**审阅、发布并运行**。

记下 Console 显示的已发布 Agent id 和 Environment id。下一步会使用这两个值。发布会生成
不可变 execution snapshot；停留在 draft 的 Agent 不能启动这个 Session。

## 5. 从 Node.js 应用发送工作

打开第二个终端，创建一个小应用：

```console
mkdir awaken-quickstart && cd awaken-quickstart
npm init -y
npm pkg set type=module
npm install @anthropic-ai/sdk
```

本 Node.js 指南已用 TypeScript SDK 0.122.0 验证。这个版本是验证坐标，不是依赖要求。
请按自己的依赖治理选择 SDK 版本，并在[兼容矩阵](./compatibility)中核对应用会使用的资源族。

填入刚才记录的 id。本地 no-login 模式接受 `local`。在受保护的 self-managed 部署中，
打开**访问控制**，创建专用的 Workspace Service API Key，并立即复制仅显示一次的明文。
本快速开始会创建 Session，因此请选择**工作区管理员**；只读开发者只能检查已有状态，
不能启动工作。请设置到期时间，并在评估结束后吊销该 Key。

这里不要改用短期 Application Access Token。后者绑定浏览器或移动端协议操作；可信的
Managed Agents 后端使用 Workspace Service API Key。

```console
export AWAKEN_BASE_URL=http://127.0.0.1:8080
export AWAKEN_API_KEY=local
export AWAKEN_AGENT_ID=your-published-agent-id
export AWAKEN_ENVIRONMENT_ID=your-environment-id
```

创建 `quickstart.mjs`：

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: process.env.AWAKEN_BASE_URL,
  apiKey: process.env.AWAKEN_API_KEY,
});

const session = await client.beta.sessions.create({
  agent: process.env.AWAKEN_AGENT_ID,
  environment_id: process.env.AWAKEN_ENVIRONMENT_ID,
});

const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: 'user.message',
    content: [{ type: 'text', text: '介绍你自己，并完成一项小型代表任务。' }],
  }],
});

for await (const event of stream) {
  console.log(event.type);
  if (event.type === 'agent.message') {
    for (const block of event.content ?? []) {
      if (block.type === 'text') console.log(block.text);
    }
  }
  if (event.type === 'session.status_idle') break;
}

console.log(`session=${session.id}`);
```

运行：

```console
node quickstart.mjs
```

终端应打印 Agent 文本、`session.status_idle` 和 Session id。完整 event list 还可能包含已接受的
user event、running 状态、模型或工具活动，以及累计 `session.usage`。

Eligible Worker 领取 Run 之前，短暂 `queued` 属于正常状态。这段时间不要新建 Session，
也不要修改模型。只有 Awaken 返回下列明确结果时才需要动作。

## 6. 重启后重新打开 Session

保存程序打印的 Session id。用 `Ctrl-C` 停止 Awaken，再使用同一个 `--data-dir` 启动：

```console
./target/debug/awaken all-in-one --data-dir /tmp/awaken-evaluation
```

回到应用目录，读取已提交 events：

```console
node -e "import('@anthropic-ai/sdk').then(async ({default:Anthropic}) => { const c=new Anthropic({baseURL:process.env.AWAKEN_BASE_URL,apiKey:process.env.AWAKEN_API_KEY}); for await (const e of c.beta.sessions.events.list(process.argv[1])) console.log(e.type) })" your-session-id
```

输出中应包含之前的 `user.message`、`agent.message` 和终态。Streamed delta 用于实时显示；重启
进程重新打开的是已提交 event list。

## 对明确结果采取动作

| 结果 | 含义 | 动作 |
| --- | --- | --- |
| 启动退出并报告 `address is already in use` | Listener 没有启动 | 用未占用的 `--port` 重新启动，并更新全部本地 URL |
| Provider verification 返回错误 | Connection 没有保存为 ready | 在该 Provider Connection 中修正 endpoint 或 authentication；不要手工创建 catalog object |
| `/v1/config/executable-models` 没有可用模型 | 尚无完整的 Native provider、offering、credential 与 Runtime 组合 | 完成 Provider Connection，或选择已导入的 available model |
| SDK 返回 `invalid_request_error` | Request 或 compatibility header 在执行前被拒绝 | 检查 `baseURL`、application token、`managed-agents-2026-04-01`、Agent id 与 Environment id |
| 预期 Worker 已启动，但 Environment 仍显示没有 eligible Worker，Session 保持 `queued` | 当前没有进程满足冻结的 placement requirement | 启动或修正 eligible Worker，然后继续观察同一个 Session |
| 重启后读取已保存 Session 返回 not found | 进程打开了另一个 data directory，或应用使用了另一个 Session id | 使用同一个 `--data-dir` 重启，并读取记录的 Session id |

## 保留或清理本地状态

用 `Ctrl-C` 停止前台进程。需要继续使用同一个 Agent 和 Session 时，保留
`/tmp/awaken-evaluation`。只有在 Awaken 已停止，并确认其中没有需要保留的工作后，才能删除
该目录。不要删除宽泛父目录。

## 接下来

- 如果来自旧版 Runtime 或本地 Server，请先按照 [Awaken 1.0 迁移指南](./how-to/migrate-to-1-0)处理配置和数据。
- 通过其他应用协议[接入已发布 Agent](./how-to/connect-a-published-agent)。
- 核对 [Managed Agents 兼容边界](./compatibility)。
- 使用显式身份、数据库、备份和 Sandbox 边界[部署与运营 Awaken](./how-to/self-host)。
- 使用生成的[管理 OpenAPI 契约](./reference/management-openapi)进行自动化。
