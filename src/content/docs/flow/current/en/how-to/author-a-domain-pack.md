---
title: "Author and validate a Pack"
description: "Create one contract-version-2 PackDescriptor, validate it through Pack Studio, review it, and publish immutable signed bytes."
section: "Design"
subsection: "Build Domain Packs"
order: 21
---

New authoring has one source format: `PackDescriptor`. Start in **Pack Studio** or
use the same Draft APIs; do not use a `kind: ResourcePack` compatibility document.

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

Add dependencies as exact locked Pack coordinates and reference imported members
with author references. Add only `resource_type`, `workflow`, `automation`,
`agent`, or `environment` component declarations. A Solution also needs a non-empty installation
`default_roots`, and every selection default must satisfy its min/max bounds.

## Draft-to-release path

1. Create a Draft with `POST /api/pack-studio/drafts`.
2. Save a revision at `/api/pack-studio/drafts/{draft_id}/revisions` with the
   expected head, message, and complete descriptor.
3. Validate at `/validate`. Resolve every contract, dependency-closure,
   owner-admission, installation, Bootstrap, and runtime-interaction error.
4. Inspect the revision diff, request review, and approve the exact Draft head.
5. Publish the approved head. Workforce canonicalizes compact JSON, signs immutable
   bytes, and projects the verified tier into Registry metadata.
6. Import the complete exact closure, then adopt only the explicit roots the
   Project needs. Configure credentials and Environment activations separately.

Exact retry converges through Draft heads, content addresses, Registry
immutability, and import idempotency. Any validation failure terminates before
publication or installation; fix the Draft and create a new revision rather than
editing released bytes.
