---
title: "Authorization, readiness, and Resources"
description: "Why identity, authorization, admission, readiness, selection, tool approval, and credential custody stay separate."
section: "Understand"
subsection: "Resources and governance"
order: 43
---

Awaken Workforce avoids one overloaded “permission” switch. Each gate answers a
different question and leaves distinct evidence:

| Gate | Question |
| --- | --- |
| Identity | Which principal is making the request or running the work? |
| Authorization | May that principal perform this action in this scope? |
| Admission | Is the submitted declaration valid and internally safe? |
| Readiness | Do dependencies, Resources, providers, and workers exist now? |
| Selection | Which eligible Actor/provider/Resource should serve this work? |
| Approval | May this concrete subject action or tool call proceed? |
| Egress/lease | Is the live authority still valid at the side-effect boundary? |

HTTP authorization is centralized through the Workforce IAM layer and scoped role
bindings. Team membership participates in selection and access policy but is not
an implicit grant. Visibility projects read access through the same authorization
path; public reads are scrubbed/read-only, and hidden scopes return 404.

Tool permission is not Resource permission. A runtime may allow a tool call, but
the owning Workforce service still authorizes the Resource action and may require its
own approval. This prevents a broad tool grant from becoming a domain-data bypass.

Content makes that distinction concrete. An Agent sees `resource.content.get`
only when its exact frozen Resource grant includes the `content` read, and sees
`resource.submit` only with the `submit` mutation. Each call rederives the live
activation/revision grant, resolves the reached exact ResourceType and Project,
and applies ordinary Resource IAM. Approval denial or pending approval happens
before content normalization or storage, so it leaves no partial Resource write.

ResourceBinding makes a Resource available at a scope under a handle; ResourceLink
connects declared roles. Credential Resources store opaque backing references,
while managed secret values remain in the vault and materialize only at the
governed connector/sandbox boundary. Readiness reports a missing Resource or link
before use rather than allowing ambient credentials or guessed defaults.

The benefit is practical: operators can tell whether a failure is access,
configuration, capacity, approval, or expired live authority—and fix the right
thing without weakening every other boundary.
