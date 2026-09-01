---
title: "Test and validate a Domain Pack"
description: "Exercise Pack validation, immutable publication, import, adoption, and governed Resource behavior."
section: "Design"
subsection: "Build Domain Packs"
order: 23
---

Validate a Pack at four implemented boundaries. A successful YAML parse alone
does not prove that a draft is publishable or that its Resources are configured.

## 1. Run the executable contracts

From the `awaken-flow` repository:

```sh
cargo test -p awaken-flow-pack
cargo test -p awaken-flow-lua-sandbox
cargo test -p awaken-flow-server
```

The checked-in Pack files are authoring fixtures. The tests cover parsing and
lowering, Lua admission, Pack Studio validation, immutable Registry releases,
Project import/adoption, and HTTP behavior.

## 2. Validate the exact draft head

Post the current `expected_head` and a trimmed idempotency key to
`/api/pack-studio/drafts/{draft_id}/validate`. Validation runs against the stored
revision and records the result. An outdated head conflicts instead of validating
different bytes than the caller intended.

Admission rejects unknown manifest fields, invalid names or typed values,
unresolved component references, and Lua that violates its assigned lane. Treat a
validation error as a declaration error; do not bypass this boundary with a raw
manifest upload.

## 3. Prove publication and import immutability

Publish the validated and approved head through
`/api/pack-studio/drafts/{draft_id}/publish`, then import its exact coordinate
through `/api/scopes/{scope}/domain-pack-imports`. Retry both operations and
confirm that identical content returns the existing immutable result. Confirm that
different content cannot replace an existing coordinate.

## 4. Prove adoption and Resource behavior

1. Read the import at `/api/scopes/{scope}/domain-pack-imports/{import_id}`.
2. Replace adoption through `/api/scopes/{scope}/domain-pack-adoption` with the
   current `expected_version` and intended updates.
3. Assess required Resource instances and links, then create or bind them through
   the Resource requirement API.
4. Invoke representative properties, actions, and events through the Resource API
   or fixed MCP Resource tools.
5. Verify fail-closed behavior for a missing exact revision, Resource binding,
   Credential source, scope grant, or required approval.
