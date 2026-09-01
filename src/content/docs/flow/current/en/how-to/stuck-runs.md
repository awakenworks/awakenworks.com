---
title: "Decide whether work needs intervention"
description: "Use typed Issue diagnosis to separate automatic convergence from conditions that require an external correction."
section: "Use"
subsection: "Decide and recover"
order: 42
---

1. Read `/api/issues/{id}/diagnosis`. It is the single Issue-level view of
   scheduling, active Attention, the active WorkUnit, and public recovery actions.
2. Do nothing when scheduling is `ready` or `running`. A queued WorkUnit is polled,
   and a live local execution is bounded by the reaper. Do not edit a lease or
   dispatch the same Issue again.
3. For `blocked_by_dependency`, inspect the named blocker. Closing it causes Workforce
   to re-evaluate dependants through the resident pump; there is no manual wake
   command. A pending approval is also an explicit decision state, not a stalled
   run.
4. Intervene only when the response names an external correction:
   - for `attention`, read `/api/issues/{id}/attention-signals` and follow its
     exact `reason_code` and `remedy`;
   - for `waiting_on_resource`, wait until `retry_at` when it is present; when it
     is absent, restore the named Resource and its reported `reason_code`;
   - for an Agent placement failure, read `/api/agent-fleet/readiness` and restore
     the missing capability or Worker connection;
   - for `execution_gated`, complete the missing Agent, model, provider,
     credential, or Resource binding named in the error detail.
5. If a WorkUnit is already `failed`, read its `/events` and `/state`, then follow
   the Attention signal Workforce raised for that terminal outcome. Do not revive the
   lease or rewrite WorkUnit state.
6. Use `/message`, `/pause`, `/resume`, `/interrupt`, `/redirect`, or `/cancel`
   only for an intentional control decision on the exact WorkUnit, not as a generic
   retry mechanism.

There is no current `doctor` command. If an explicit condition still cannot be
corrected, capture the diagnosis response, relevant events, reason code, Worker
identity, and correlation IDs. Remove credentials, message content, and
secret-bearing URLs before sharing them.
