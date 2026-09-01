---
title: "Publish and install a Domain Pack"
description: "Publish an approved Pack Studio draft, import an exact Registry coordinate, and control Project adoption."
section: "Design"
subsection: "Build Domain Packs"
order: 22
---

The implemented distribution path separates publication, import, and adoption.
Each boundary preserves one source of truth: Pack Studio owns the draft, the
Registry owns the immutable release, and the Project owns its imports and adopted
component revisions.

## 1. Publish a Pack Studio draft

After validating and approving the exact draft head, post:

```json
{ "expected_head": 4, "registry": "local" }
```

to `/api/pack-studio/drafts/{draft_id}/publish`. Publication signs and publishes
the exact stored artifact through the selected configured Registry. A successful
publication records a durable receipt. Retrying the same draft head converges on
the existing immutable release when its content address is identical; a different
artifact at the same coordinate is a conflict.

## 2. Import an exact release

Import the Registry coordinate into a Project scope:

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

Post to `/api/scopes/{scope}/domain-pack-imports`. The server resolves the exact
release, verifies its supply-chain evidence, admits its component revisions, and
returns `201` for a new import or `200` when the same import is already present.
List imports on the same route and read one immutable import at
`/api/scopes/{scope}/domain-pack-imports/{import_id}`.

## 3. Adopt the components the Project uses

Read the current adoption and its version with
`GET /api/scopes/{scope}/domain-pack-adoption`. Replace the Project selection by
posting `expected_version` and `updates` to the same route. The version check
prevents concurrent writers from silently replacing one another.

Import does not silently migrate existing Resources. Adoption selects the
effective exact component revisions; instance creation, linking, and migration
remain explicit Project operations.
