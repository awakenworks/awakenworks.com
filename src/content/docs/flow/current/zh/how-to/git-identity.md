---
title: "保留真实 Git 署名"
description: "将 Git 认证与真实、run-scoped 的 author/committer 归属分开。"
---

Git 认证回答“这次运行能否访问远端”，署名回答“谁创建、谁接受了这次变更”。Awaken
Workforce 将二者分开建模。

- 把当前 principal 解析为 name/email，并显式选择 `attribution_honest`、
  `accountability_first` 或 `patch_model` authorship policy。
- 将远端凭据作为已绑定的 Resource 引用交付；broker 只在执行边界渲染进程级 Git
  credential overlay。
- 仅通过允许的 `GIT_AUTHOR_*` 和 `GIT_COMMITTER_*` 环境 slot 注入身份。provisioner
  不得修改 `~/.gitconfig`、仓库 `.git/config`、hooks 或 `core.hooksPath`。
- 按所选 policy 验证产出 commit 的 author、committer 和 `Co-Authored-By` trailer。
