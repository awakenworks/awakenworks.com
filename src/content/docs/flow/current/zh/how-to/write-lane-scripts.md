---
title: "编写 Domain Pack ResourceType Lua"
description: "编写 V2 内联 Lua，使 lane 和能力严格跟随其所属的 ResourceType facet。"
---

把 Lua 内联在拥有该行为的 ResourceType 成员上。V2 作者不能直接选择 lane；编译会
确定性地完成映射：

| 清单成员 | 分配的 lane | 意图 |
| --- | --- | --- |
| 计算属性 `properties.<name>.lua` | `resource` | 读取或派生一个属性。 |
| `actions.<name>.lua` | `egress` | 执行受治理的动作并返回已声明结果。 |
| `events.<name>.lua` | `ingress` | 规范化入站事件及其产生的对象。 |
| `lifecycle.<name>.lua` | `hook` | 执行无宿主能力的生命周期逻辑。 |
| `constructor.lua` | `egress` | 通过 `via` 指定的 Connector 构造对象。 |

`verify` 是真实的运行时 lane，但当前 ResourceType declaration 没有 verify facet。

## 沙箱契约

Lua VM 只加载 `table`、`string` 和 `math`。`io`、`os`、`debug`、`package`、
`require`、`load`、`dofile` 等宿主 I/O 或动态代码设施不可用，随机数也会被拒绝。
执行受到指令预算、5 秒 VM deadline（外加调用侧 watchdog）和 64 MiB heap 上限约束。

能力按 lane 隔离：

- `resource` 和 `ingress` 只能使用只读 `platform.*` 能力；
- `egress` 可使用完整的注入式 platform 能力集；
- `hook` 没有 platform 能力；
- Connector 的 `send`/`respond` 只允许出现在 `ingress` 与 `egress`。

所有外部世界副作用都必须经过注入的 capability 或 Connector host。引用已声明的
transport 和 credential role；不要内嵌 token，也不要调用未声明的宿主能力。

## 编写与验证

在 Lua 旁声明 argument/result/payload schema，并确保返回值与其兼容。然后通过 Pack
API 安装完整清单；脚本 admission 会在持久化前执行静态沙箱和 lane 检查。把 lowering
测试放进 `awaken-flow-pack`，把沙箱行为测试放进 `awaken-flow-lua-sandbox`，最后使用
真实 binding 通过 Resource API 或 MCP 工具调用该成员。
