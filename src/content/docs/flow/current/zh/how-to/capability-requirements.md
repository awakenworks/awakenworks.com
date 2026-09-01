---
title: "满足 Resource 要求"
description: "评估并满足一个精确 ResourceType 需求，或一项已声明的 Resource relation requirement。"
---

Resource requirement API 根据现有 ResourceType declaration 与当前 Project catalog
生成 projection，不会持久化第二个 requirement aggregate。

## 选择 requirement

可以评估一个精确 ResourceType revision：

```json
{
  "selector": {
    "kind": "resource_type",
    "resource_type": {
      "type_name": "credential",
      "revision_id": "revision-1"
    }
  }
}
```

也可以评估一个精确 consumer Resource 上命名的 `requires` role：

```json
{
  "selector": {
    "kind": "requirement",
    "consumer": {
      "resource_id": "github-connector",
      "resource_type": {
        "type_name": "github_connector",
        "revision_id": "revision-7"
      }
    },
    "role": "credential"
  }
}
```

把 selector 提交到 `/api/scopes/{scope}/resource-requirements/assessment`。返回 plan
包含允许的精确 target type、作者负责的字段、当前 candidate，以及
`missing_resource`、`missing_link`、`configured`、`unverified` 或 `available` 状态。

## 满足已评估 plan

向 `/api/scopes/{scope}/resource-requirements/fulfillment` 提交一种封闭 command：

- `bind_existing` 选择当前已配置 candidate；
- `create_resource` 按允许的精确 type 创建非 Credential Resource；
- `store_credential` 通过只写 Credential 路径接收 secret，并要求 managed Credential
  写入所使用的 idempotency header。

每个 command 都重复相同 selector。`requirement` selector 还会把 consumer 的命名 link
替换为已满足的 Resource；`resource_type` selector 只创建或绑定 Resource，不添加 relation。

公开 receipt 只包含 Resource reference、revision、fulfillment status 与可选 link，绝不
返回 Credential secret 或 backing reference。
