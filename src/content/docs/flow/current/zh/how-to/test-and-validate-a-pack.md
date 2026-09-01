---
title: "测试和验证 Domain Pack"
description: "验证 Pack、不可变 publication、import、adoption 与受治理 Resource 行为。"
---

请在四个已实现边界验证 Pack。仅仅成功解析 YAML，不能证明 draft 可发布，也不能证明其
Resource 已配置完成。

## 1. 运行可执行契约

在 `awaken-flow` 仓库中执行：

```sh
cargo test -p awaken-flow-pack
cargo test -p awaken-flow-lua-sandbox
cargo test -p awaken-flow-server
```

仓库中的 Pack 文件是 authoring fixture。测试覆盖解析与 lowering、Lua admission、Pack
Studio validation、不可变 Registry release、Project import/adoption 与 HTTP 行为。

## 2. 验证精确 draft head

向 `/api/pack-studio/drafts/{draft_id}/validate` 提交当前 `expected_head` 与已 trim 的
idempotency key。Validation 针对已存储 revision 运行并记录结果；过期 head 会发生冲突，
不会验证调用方未预期的另一份 bytes。

Admission 会拒绝未知 manifest 字段、无效名称或类型值、未解析 component reference，
以及违反其 lane 的 Lua。把 validation error 当作 declaration error 处理，不要用原始
manifest 上传绕过该边界。

## 3. 证明 publication 与 import 不可变

通过 `/api/pack-studio/drafts/{draft_id}/publish` 发布已验证、已批准的 head，再通过
`/api/scopes/{scope}/domain-pack-imports` 导入精确 coordinate。重试两种操作并确认相同
内容返回已有不可变结果，同时确认不同内容无法替换已有 coordinate。

## 4. 证明 adoption 与 Resource 行为

1. 在 `/api/scopes/{scope}/domain-pack-imports/{import_id}` 读取 import。
2. 使用当前 `expected_version` 和目标 updates，通过
   `/api/scopes/{scope}/domain-pack-adoption` 替换 adoption。
3. 评估所需 Resource instance 与 link，再通过 Resource requirement API 创建或绑定。
4. 通过 Resource API 或固定 MCP Resource tool 调用有代表性的 property、action 与 event。
5. 验证缺少精确 revision、Resource binding、Credential source、scope grant 或必需
   approval 时会 fail closed。
