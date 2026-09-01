---
title: "通过 HTTP 与 SSE 读取一个 Session"
description: "打开 Session event stream，辨认已提交与实时事件，并让它通过生产代理后仍可用。"
evidence:
  - "crates/server/awaken-protocol-managed/src/routes/sessions.rs"
  - "crates/server/awaken-protocol-managed/tests/streaming.rs"
---

把一个 Awaken Session 作为 Server-Sent Events stream 打开。连接会先返回已提交 event
snapshot，再持续发送实时事件，直到当前 run 到达终态。

## 目标

得到一条能够显示可辨认 Session turn 的 `curl` stream，并确认承载生产流量的 ingress
不会破坏这条流。

## 前置条件

- 使用 `awaken all-in-one` 运行本地 AllInOne；从源码运行时使用
  `cargo run -p awaken-cli --bin awaken -- all-in-one`。
- 完成[快速上手](/zh/docs/agents/get-started/)，包括一个已发布 Agent 与一个 Session turn。
- 保留返回的 Session ID。下例中的 `sesn_...` 是占位符。

## 1. 打开 Session event stream

```bash
curl -N \
  -H 'accept: text/event-stream' \
  http://localhost:8080/v1/sessions/sesn_.../events/stream
```

`-N` 会关闭 curl 的输出缓冲。请换成真实 Session ID，不要把占位符复制到健康检查中。

## 2. 按正确顺序阅读 stream

每次连接都会先发送该 Session 当前完整的已提交 snapshot。订阅之后提交的事件继续通过
同一条 stream 到达；边缘会按 event ID 去除 snapshot 与实时部分的重叠。

找到刚才发送的用户输入、Agent 回复或工具活动，以及最终的 `session.status_idle` 或错误
状态。屏幕上出现 text delta 不代表任务完成；已提交的终态 event 才是完成记录。

## 3. 有意识地重连

停止 curl，再执行同一命令。当前 endpoint 会再次发送完整的已提交 snapshot，不使用
`Last-Event-ID` 做增量重放。如果应用把多次连接合并成同一个视图，应按 event ID 去重。

只有当应用已经持有明确的 child thread 时，才使用 thread 作用域 stream：

```text
GET /v1/sessions/<session_id>/threads/<thread_id>/stream
```

完整 route 目录由[公共 HTTP API](/zh/docs/agents/reference/api/)维护。本页只负责打开与
运行 SSE stream 这项任务。

## 4. 让同一检查通过 ingress

接入生产流量前：

1. 由所属 gateway 或应用服务器终结 TLS 与认证。
2. 对 SSE route 关闭 response buffering。
3. 让 upstream read 与 idle timeout 长于允许的最长 turn。
4. 转发 `accept: text/event-stream`，并及时 flush chunk，避免压缩延迟。
5. 对公开 URL 重做 curl 检查，确认初始 snapshot 与新提交 event 都能到达。

不要把 Workspace service key 写进浏览器代码。浏览器应用应使用所选协议指南中的
application-specific authorization 路径。

## 验证

- 响应成功，且 `content-type` 为 `text/event-stream`。
- 第一次连接包含可辨认的已提交 turn。
- 新事件无需等待连接关闭就能出现。
- 重连会重复已提交事件，但不会丢失终态。
- 通过生产 ingress 后，上述四点仍然成立。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Session ID、route、HTTP status 与 content
type、最后一个 event ID/type、timestamp 与已清理的 proxy setting，再联系支持。不要附带
API key。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 请求结束前一直没有输出 | curl 或代理是否缓冲 | 使用 `curl -N`，并关闭 SSE route 的 buffering 与延迟压缩 |
| 本地正常，经过 ingress 后停滞 | gateway read timeout 或 chunk buffering | 延长 timeout、及时 flush，并对同一个公开 URL 复测 |
| 浏览器请求未授权 | 所选应用协议是否缺少有效 access binding | 使用其短期 application token 流程，不要把 service key 移入浏览器 |

## 下一步

- 如果 AI SDK、AG-UI 或 A2A 已经适合客户端，应[选择应用协议](/zh/docs/agents/protocols/connect/)，
  而不是自行解析 managed event stream。
- 通过[管理 Session](/zh/docs/agents/how-to/manage-a-session/)处理中断、归档与继续。
- 通过[选择自托管拓扑](/zh/docs/agents/how-to/self-host/)确定 TLS、identity、持久化、
  恢复与代理所有权。
