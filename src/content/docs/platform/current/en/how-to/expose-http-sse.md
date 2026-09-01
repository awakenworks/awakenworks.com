---
title: "Stream one Session over HTTP and SSE"
description: "Open a Session event stream, recognize committed and live events, and keep it usable through a production proxy."
evidence:
  - "crates/server/awaken-protocol-managed/src/routes/sessions.rs"
  - "crates/server/awaken-protocol-managed/tests/streaming.rs"
section: "Connect"
subsection: "Connect applications"
order: 24
---

Open one Awaken Session as a Server-Sent Events stream. You will see its
committed event snapshot first, then live events until the current run reaches a
terminal state.

## Goal

Finish with a `curl` stream that shows a recognizable Session turn and still
works through the ingress that will carry production traffic.

## Prerequisites

- Run local AllInOne with `awaken all-in-one`, or from the source tree with
  `cargo run -p awaken-cli --bin awaken -- all-in-one`.
- Complete [Get started](/docs/agents/get-started/), including one published
  Agent and one Session turn.
- Keep the returned Session ID. The examples below use `sesn_...` as a placeholder.

## 1. Open the Session event stream

```bash
curl -N \
  -H 'accept: text/event-stream' \
  http://localhost:8080/v1/sessions/sesn_.../events/stream
```

`-N` disables curl's output buffering. Replace `sesn_...` with the real ID; do
not copy the placeholder into a health check.

## 2. Read the stream in the right order

Each connection begins with the full committed snapshot available for that
Session. Events committed after subscription then arrive on the same stream,
with overlapping event IDs removed at the edge.

Look for the user input you sent, the Agent's response or tool activity, and the
terminal `session.status_idle` or error state. A displayed text delta is not the
completion record; the committed terminal event is.

## 3. Reconnect deliberately

Stop curl and run the same command again. The current endpoint sends the full
committed snapshot again; it does not use `Last-Event-ID` for incremental replay.
Deduplicate by event ID if your application joins repeated connections into one
view.

Use the thread-scoped stream only when the application already owns a specific
child thread:

```text
GET /v1/sessions/<session_id>/threads/<thread_id>/stream
```

The [Public HTTP API](/docs/agents/reference/api/) owns the full route
inventory. This page owns only the task of opening and operating an SSE stream.

## 4. Put the same check through ingress

Before production traffic:

1. Terminate TLS and authentication at the owning gateway or application server.
2. Disable response buffering for SSE routes.
3. Set upstream read and idle timeouts longer than the longest permitted turn.
4. Forward `accept: text/event-stream` and flush chunks without compression delays.
5. Repeat the curl check against the public URL and confirm both the initial
   snapshot and a newly committed event arrive.

Do not expose a Workspace service key in browser code. Browser applications use
the application-specific authorization path documented by their selected
protocol guide.

## Verify

- The response status is successful and `content-type` is `text/event-stream`.
- The first connection contains the recognizable committed turn.
- A new event appears without waiting for the connection to close.
- Reconnection repeats committed events without losing the terminal state.
- The same four facts hold through the production ingress.

## Troubleshooting

If the table does not resolve the problem, record the Session ID, route,
HTTP status and content type, last event ID and type, timestamp, and sanitized
proxy settings before contacting support. Do not include an API key.

| Symptom | Check | Action |
| --- | --- | --- |
| Nothing prints until the request ends | curl or proxy buffering | Use `curl -N` and disable buffering and delayed compression on the SSE route |
| Local works but ingress stalls | Gateway read timeout or chunk buffering | Raise the timeout, flush chunks, and repeat the same public-URL check |
| Browser request is unauthorized | The selected application protocol has no valid access binding | Use its short-lived application token flow; never move the service key into the browser |

## Next steps

- [Choose the application protocol](/docs/agents/protocols/connect/) rather
  than parsing the managed event stream when AI SDK, AG-UI, or A2A already fits.
- [Manage a Session](/docs/agents/how-to/manage-a-session/) for interrupt,
  archive, and continuation behavior.
- [Choose a self-hosted topology](/docs/agents/how-to/self-host/) for TLS,
  identity, persistence, recovery, and proxy ownership.
