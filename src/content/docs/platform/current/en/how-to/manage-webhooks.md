---
title: "Send signed lifecycle events to your backend"
description: "Create an outbound Webhook in Console, keep its one-time signing secret, verify deliveries, and distinguish retries from a paused endpoint."
evidence:
  - "web/src/surfaces/webhooks.tsx"
  - "web/e2e/webhooks.spec.ts"
  - "crates/server/awaken-webhook-managed/src/control_plane.rs"
  - "crates/server/awaken-webhook/src/dispatch.rs"
  - "crates/server/awaken-webhook/src/signing.rs"
section: "Connect"
subsection: "Connect applications"
order: 29.5
---

## Goal

Send selected Agent and Session lifecycle events from Awaken to a backend you
control. You are done when the receiver verifies the signature, ignores a
duplicate event id, fetches the referenced object when needed, and returns a
`2xx` response.

A Webhook is an outbound notification path from Awaken. Use a Session event
stream when an application needs live output from an Agent. Use a Webhook when a
backend needs to react to lifecycle changes without polling.

## Prerequisites

You need:

- a publicly resolvable HTTPS receiver. Production authoring rejects HTTP,
  loopback, private, link-local, and metadata addresses;
- a secure place for the `whsec_` signing secret;
- permission to manage Workspace configuration;
- the exact Webhook event names your receiver needs. Webhook names are separate
  from Session SSE names. For example, the Webhook form is
  `session.status_idled`, not `session.status_idle`.

The [Managed Agents Webhook guide](https://platform.claude.com/docs/en/managed-agents/webhooks)
owns the compatible event envelope, signature headers, and event catalog.
Awaken owns the Console and management route used to create the subscription.

## 1. Open the outbound connection

In Console, open **Connect > Webhooks**. Confirm that the page says
**Awaken to your backend**. If the other system needs to call an Agent, return to
the [connection matrix](/docs/agents/protocols/connect/) and choose an inbound
application protocol instead.

## 2. Create the endpoint

Enter the public HTTPS URL. Add exact Webhook event names separated by commas or
new lines, or leave the list empty to receive every lifecycle event emitted by
this Awaken deployment. Choose **Create endpoint**.

Console uses the Workspace-scoped Awaken extension below. This is not an
Anthropic Webhook CRUD route:

```http
PUT /v1/config/webhook-subscriptions/wh_your_stable_id
Content-Type: application/json

{
  "url": "https://events.example.com/awaken",
  "event_types": ["session.status_idled", "session.status_terminated"]
}
```

On the first successful create, the response includes `secret`. Later reads and
updates never include it.

## 3. Store the secret before leaving

Copy the `whsec_` value from the one-time banner and store it as
`ANTHROPIC_WEBHOOK_SIGNING_KEY` in the receiver's secret manager. Dismissing the
banner or reloading Console removes the cleartext from the UI. Awaken cannot show
the same secret again.

If the secret is lost, delete the subscription and create another one. Updating
the URL, event filters, or enabled state keeps the existing secret and does not
return it.

## 4. Verify before processing the body

Read the raw request body. Verify `webhook-id`, `webhook-timestamp`, and
`webhook-signature` against the saved secret before parsing or acting on the
payload. Reject a stale timestamp as well as a bad signature.

After verification:

1. deduplicate on the top-level event `id`, which also appears in
   `webhook-id`;
2. switch on `data.type`;
3. use `data.id` to fetch the current resource when the event is not a deletion;
4. return any `2xx` response only after the receiver has accepted the event.

Do not derive state from delivery order. A retry uses the same event id, and
independent lifecycle events may arrive in another order. Fetching the resource
gives the receiver current committed state.

## 5. Read delivery state in Console

The Webhooks table keeps authored state separate from delivery evidence:

| Console state | Meaning | Action |
| --- | --- | --- |
| Active | the endpoint is enabled and has no consecutive delivery failure | none |
| Delivery retrying | the endpoint is enabled, but recent delivery failed | inspect receiver availability, status codes, and signature handling |
| Paused | an operator disabled the endpoint and no failure is recorded | enable it when notifications should resume |
| Disabled after failures | delivery failures reached the automatic threshold | fix the receiver, then enable the endpoint |

Enabling an endpoint applies only to new events. Events emitted while the
subscription was disabled are not backfilled. If the backend must observe every
state transition, reconcile by listing or retrieving the source resource through
the API.

## Verify

Produce one lifecycle change whose exact Webhook type is subscribed. Verify all
of these facts:

1. the receiver gets the JSON event and all three signature headers;
2. signature and timestamp validation pass using the one-time secret;
3. a repeated event id changes no downstream state;
4. the receiver fetches the referenced resource and records the intended result;
5. Console remains **Active**, or returns to **Active** after a successful retry;
6. reloading Console does not reveal the secret.

## Troubleshooting

| Result | Cause to inspect | Action |
| --- | --- | --- |
| Create returns `400 invalid_request_error` | URL scheme or resolved address, or a malformed `event_types` value | use a public HTTPS endpoint and an array of non-empty strings |
| Receiver rejects every signature | raw body changed before verification, wrong secret, stale timestamp, or wrong header names | verify the unmodified bytes and the three `webhook-*` headers with the secret from this subscription |
| No event arrives | filter does not match the Webhook event name, endpoint is paused, or the event occurred before subscription | correct the filter, enable the endpoint, then produce a new event |
| Delivery state is **Delivery retrying** | transport error or retryable non-`2xx` response | inspect the receiver and return `2xx` after accepting the event |
| Delivery state is **Disabled after failures** | consecutive failed deliveries reached the configured threshold | fix the receiver first, then choose **Enable**; missed events are not replayed |
| Secret was not saved | cleartext is intentionally unrecoverable | delete the endpoint and create a replacement |

## Next steps

- Use [Managed Agents](/docs/agents/protocols/managed-agents/) to fetch the
  resource named by a lifecycle event.
- Use [Session events](/docs/agents/concepts/sessions-and-events/) for live Agent
  output and committed history.
- Use the [public API index](/docs/agents/reference/api/) and generated
  [management OpenAPI contract](/docs/agents/reference/management-openapi/) for
  configuration automation.
