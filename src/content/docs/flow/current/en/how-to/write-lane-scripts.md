---
title: "Write Domain Pack ResourceType Lua"
description: "Write V2 inline Lua whose lane and capabilities follow the ResourceType facet that owns it."
section: "Maintain"
subsection: "Extensions"
order: 20
---

Put Lua inline on the ResourceType member that owns the behavior. V2 authors do
not select a lane directly; compilation assigns it deterministically:

| Manifest member | Assigned lane | Intent |
| --- | --- | --- |
| computed `properties.<name>.lua` | `resource` | Read/derive one property. |
| `actions.<name>.lua` | `egress` | Perform a governed action and return its declared result. |
| `events.<name>.lua` | `ingress` | Normalize an incoming event and its produced objects. |
| `lifecycle.<name>.lua` | `hook` | Run host-free lifecycle logic. |
| `constructor.lua` | `egress` | Construct through the connector named by `via`. |

`verify` is a real runtime lane, but the current ResourceType declaration has no verify facet.

## Sandbox contract

The Lua VM loads only `table`, `string`, and `math`. Host I/O and dynamic-code
facilities such as `io`, `os`, `debug`, `package`, `require`, `load`, and
`dofile` are unavailable; randomness is rejected. Execution is bounded by an
instruction budget, a five-second VM deadline with an outer watchdog, and a
64 MiB heap limit.

Capabilities are lane-scoped:

- `resource` and `ingress` are read-only for `platform.*` capabilities;
- `egress` may use the full injected platform capability set;
- `hook` has no platform capabilities;
- connector `send`/`respond` calls are allowed only in `ingress` and `egress`.

All outside-world effects must cross the injected capability or connector host.
Reference declared transports and credential roles; never embed a token or make
an undeclared host call.

## Author and verify

Declare argument/result/payload schemas beside the Lua and keep returned values
compatible with them. Then install the complete Pack through the Pack API: script
admission applies static sandbox and lane checks before persistence. Add Rust
tests to `awaken-flow-pack` for lowering and to `awaken-flow-lua-sandbox` for
sandbox behavior; finally exercise the member through the Resource API or MCP
tools with real bindings.
