---
title: "Preserve Git authorship"
description: "Keep Git authentication separate from truthful, run-scoped author and committer attribution."
section: "Operate"
subsection: "Operations"
order: 20
---

Git authentication answers “may this run access the remote?”; authorship answers
“who created and who accepted this change?” Awaken Workforce models them separately.

- Resolve the active principal to a name/email identity and choose an explicit
  authorship policy: `attribution_honest`, `accountability_first`, or
  `patch_model`.
- Deliver remote credentials as bound Resource references. The broker renders a
  process-scoped Git credential overlay at the execution boundary.
- Inject author/committer identity through the allowed `GIT_AUTHOR_*` and
  `GIT_COMMITTER_*` environment slots. The provisioner must not edit
  `~/.gitconfig`, repository `.git/config`, hooks, or `core.hooksPath`.
- Verify the produced commit's author, committer, and any `Co-Authored-By`
  trailer against the selected policy.
