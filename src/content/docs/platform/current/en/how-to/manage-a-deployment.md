---
title: "Turn a reviewed Agent into a recurring operation"
description: "Create a Deployment in Console, verify it with Run once, inspect the resulting Session, and control its future schedule."
evidence:
  - "web/src/surfaces/deployments.tsx"
  - "web/e2e/managed-resources.spec.ts"
  - "crates/bin/awaken-cli/tests/deployment_sessions.rs"
  - "crates/server/awaken-protocol-managed/tests/deployments.rs"
section: "Govern"
subsection: "Deployments"
order: 12
---

Use a Deployment after an Agent has produced the right result once and the same
job must run again. A Deployment freezes the selected Agent publication, binds
an Environment and kickoff message, and creates a separate inspectable Session
for every scheduled or manual run.

## Before you start

You need a published Agent, an active Environment, and a model route that the
selected Environment can execute. First run the task as an ordinary Session. A
schedule repeats that behavior; it does not make an unverified prompt safer.

## Create the Deployment in Console

1. Open **Run → Deployments**, then choose **New deployment**.
2. Give the operation a human-readable name.
3. Select the published Agent and Environment you already verified.
4. Enter a standard cron expression and IANA timezone.
5. Write the kickoff message that each new Session should receive.
6. Choose **Create**.

The new row shows the schedule and next run. The stable Deployment id remains
available as technical metadata; people should identify the operation by name.

## Verify the complete loop with Run once

Choose **Run** before relying on the schedule. Console creates a Deployment Run
and shows **Open Session** when the run has a Session. Open it and verify:

- the expected published Agent and Environment were used;
- the kickoff message appears in committed history;
- the Agent produced the expected result and evidence;
- any approval or permission wait remains visible and actionable.

This Session is the observable result. A success toast or a future cron time is
not evidence that the job completed.

## Use the equivalent API path

Applications can create the same definition with `POST /v1/deployments`, then
start a bounded verification with `POST /v1/deployments/{id}/run`. The create
body carries `name`, `agent`, `environment_id`, a cron `schedule`, and
`initial_events`. Read the returned `session_id`, then inspect that Session and
its committed events through the normal Session API.

Use `POST /v1/deployments/{id}/pause`, `/unpause`, or `/archive` for lifecycle
control. Exact authentication, beta header, request, response, and error schemas
remain in the [Public HTTP API](/docs/agents/reference/api) and generated
[management contract](/docs/agents/reference/management-openapi).

## Pause, resume, or archive intentionally

- **Pause** prevents scheduled firings while keeping the definition and prior
  Sessions available. **Run once** is rejected while paused.
- **Unpause** allows future scheduled firings again.
- **Archive** permanently stops the schedule. Existing Deployment Runs and
  Sessions remain available for inspection.

If creation fails, correct the named Agent, Environment, schedule, or access
error. If a Run is created but its Session fails, diagnose the Session result;
do not recreate the Deployment to hide a runtime failure.

## Next step

After Run once closes the task successfully, keep the Deployment paused until
its cadence and human response path are agreed. Then unpause it and use
[production reliability](/docs/agents/concepts/production-reliability) to decide
which failures require intervention.
