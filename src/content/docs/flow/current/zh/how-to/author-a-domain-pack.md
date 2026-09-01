---
title: "编写并验证 Pack"
description: "创建唯一 contract-version-2 PackDescriptor，经 Pack Studio 验证、review，并发布不可变签名字节。"
---

新 authoring 只有一个源格式：`PackDescriptor`。从 **Pack Studio** 开始，或使用相同 Draft
API；不要再使用 `kind: ResourcePack` 兼容文档。

```yaml
contract_version: 2
coordinate: { pack: acme/review, version: 1.0.0 }
tier: domain
name: Review workforce
description: One accountable review workflow
icon: lucide:badge-check
components:
  - key: review
    summary: Terminal review contract
    declaration:
      kind: workflow
      definition:
        name: Review
        description: Accept a reviewed result
        icon: lucide:badge-check
        start: done
        states:
          done:
            name: Done
            description: Result accepted
            icon: lucide:circle-check
            state_group: done
            completion: completed
            transitions: []
```

依赖使用精确锁定 Pack coordinate，并用 author reference 引用导入 member。component
declaration 只能是 `resource_type`、`workflow`、`automation`、`agent` 或
`environment`。Solution 还必须
提供非空 installation `default_roots`，且每组默认选择满足 min/max 范围。

## 从 Draft 到 release

1. 调用 `POST /api/pack-studio/drafts` 创建 Draft。
2. 向 `/api/pack-studio/drafts/{draft_id}/revisions` 提交 expected head、message 与完整 descriptor。
3. 调用 `/validate`；解决 contract、依赖闭包、owner admission、installation、Bootstrap 与
   runtime interaction 的全部错误。
4. 检查 revision diff，请求 review，并批准精确 Draft head。
5. 发布已批准 head。Workforce canonicalize compact JSON、签名不可变字节，并把已验证 tier 投影到 Registry metadata。
6. Import 完整精确闭包，再只 adopt Project 需要的显式 roots；credential 与 Environment
   activation 单独配置。

完全相同的重试通过 Draft head、content address、Registry immutability 与 import idempotency
收敛。任何验证失败都在发布或安装前终止；应修复 Draft 并创建新 revision，不要编辑已发布字节。
