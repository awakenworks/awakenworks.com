---
title: "发布并安装 Domain Pack"
description: "发布已批准的 Pack Studio draft、导入精确 Registry coordinate，并控制 Project adoption。"
---

当前实现把 publication、import 与 adoption 分成三个边界。每个边界只有一个事实来源：
Pack Studio 拥有 draft，Registry 拥有不可变 release，Project 拥有自己的 import 与已采用
component revision。

## 1. 发布 Pack Studio draft

验证并批准精确的 draft head 后，提交：

```json
{ "expected_head": 4, "registry": "local" }
```

到 `/api/pack-studio/drafts/{draft_id}/publish`。Publication 会通过所选已配置 Registry
签名并发布准确的已存储 artifact，成功后写入持久 publication receipt。若 content address
一致，重试同一 draft head 会收敛到已有不可变 release；同一 coordinate 对应不同 artifact
则返回冲突。

## 2. 导入精确 release

把 Registry coordinate 导入 Project scope：

```json
{
  "registry": "local",
  "coordinate": {
    "pack": "awaken-flow/github",
    "version": "3.11.5"
  },
  "explicit_roots": []
}
```

提交到 `/api/scopes/{scope}/domain-pack-imports`。服务解析精确 release、验证供应链证据、
admit component revision；新 import 返回 `201`，相同 import 已存在时返回 `200`。同一路由
列出 imports，通过 `/api/scopes/{scope}/domain-pack-imports/{import_id}` 读取单个不可变
import。

## 3. 采用 Project 使用的 component

通过 `GET /api/scopes/{scope}/domain-pack-adoption` 读取当前 adoption 及其 version；再向
同一路由提交 `expected_version` 与 `updates`，替换 Project selection。Version 检查可防止
并发写入方静默覆盖彼此。

Import 不会静默迁移现有 Resource。Adoption 只选择 effective 的精确 component revision；
instance 创建、link 与 migration 仍是显式 Project 操作。
