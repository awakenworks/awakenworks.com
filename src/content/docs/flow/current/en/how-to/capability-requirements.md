---
title: "Satisfy Resource requirements"
description: "Assess and fulfill an exact ResourceType need or one declared Resource relation requirement."
section: "Design"
subsection: "Design work"
order: 13
---

The Resource requirement API projects existing ResourceType declarations and the
current Project catalog. It does not persist a second requirement aggregate.

## Select the requirement

Assess either one exact ResourceType revision:

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

or one named `requires` role on an exact consumer Resource:

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

Post the selector to
`/api/scopes/{scope}/resource-requirements/assessment`. The returned plan contains
accepted exact target types, author-owned fields, current candidates, and one of
`missing_resource`, `missing_link`, `configured`, `unverified`, or `available`.

## Fulfill the assessed plan

Post one closed command to
`/api/scopes/{scope}/resource-requirements/fulfillment`:

- `bind_existing` selects a current configured candidate;
- `create_resource` creates a non-Credential Resource at an accepted exact type;
- `store_credential` accepts a secret through the write-only Credential path and
  requires the idempotency header used by managed Credential writes.

Every command repeats the same selector. A `requirement` selector also replaces
the named link from its consumer to the fulfilled Resource. A `resource_type`
selector creates or binds the Resource without adding a relation.

The public receipt contains the Resource reference, revision, fulfillment status,
and optional link. It never returns the Credential secret or backing reference.
