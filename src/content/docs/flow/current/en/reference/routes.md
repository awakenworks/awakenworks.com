---
title: "HTTP API"
description: "Generate the exact OpenAPI contract from the Awaken Workforce router and use task guides for behavioral sequences."
section: "Reference"
order: 12
---

The **generated OpenAPI document is the only route and schema inventory**. This
page deliberately does not copy its paths, fields, or response tables.

## Get the contract

From a checkout:

```sh
cargo run -q -p awaken-flow-server -- openapi \
  > /tmp/awaken-flow-openapi.json
```

From a running Server:

```sh
curl -fsS http://127.0.0.1:7979/api/openapi.json \
  > /tmp/awaken-flow-openapi.json
```

Both are generated from the assembled router. Confirm `info.title` is
`awaken-flow` and retain the document with generated clients or compatibility
tests so an upgrade produces a reviewable diff.

## Surface ownership

Use OpenAPI tags and paths to locate the exact operation. Use task documentation
for ordering and recovery:

| Job | Behavioral owner |
| --- | --- |
| Bootstrap a Project and definitions | [Design and automate](/docs/workforce/designing/) |
| Create and advance Issues | [Manage work](/docs/workforce/how-to/) |
| Inspect or control WorkUnits | [Operating Workforce](/docs/workforce/operating/) |
| Resolve approval and Attention | [Inbox and approvals](/docs/workforce/operating/inbox-approvals/) |
| Use generic Resource tools | [Resource and authorization model](/docs/objects/concepts/permissions-resources/) |
| Deploy and inspect service endpoints | [Deployment topologies](/docs/workforce/operating/deployment-topologies/) |

Most `/api/*` operations are protected by the configured IAM mode. Health,
metrics, and contract discovery are intentionally assembled outside that layer;
verify their exposure at your network boundary.

Do not build new integrations against compatibility routes merely because they
remain in OpenAPI. A deprecation description in the generated operation is the
authority; new work should use immutable owner revisions and current command
surfaces.
